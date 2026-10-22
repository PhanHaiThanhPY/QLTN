import { approvalStepsFor, APPROVAL_STEP_SLOT } from '@/domain/actions';
import { LIMITS } from '@/domain/constants';
import { assertNoFieldErrors, conflict, invalidTransition, notFound } from '@/domain/errors';
import { slotUserId } from '@/domain/permissions';
import type { ApprovalDecision, RepairRecord, Submission, UnresolvedNotice } from '@/domain/types';
import { FieldErrorCollector, asNumber, asRecord, asString } from '@/domain/validation';
import { formatDate, toVnDate } from '@/utils/date';
import { formatVnd } from '@/utils/money';
import type { CommandHandler } from '../command-engine';
import type { CommandContext } from '../command-context';
import { notify } from '../command-context';
import { newId } from '../runtime';
import { commitRecord, loadRecordFor } from './repair-helpers';

const OUTCOME_TEXT: Record<ApprovalDecision['outcome'], string> = {
  APPROVED: 'duyệt',
  NEEDS_UPDATE: 'yêu cầu bổ sung',
  REJECTED: 'từ chối',
};

const stepActor = (decision: ApprovalDecision, record: RepairRecord): string =>
  approvalStepsFor(record.approvalStepKeys, record.workflowApprovalSteps).find((step) => step.key === decision.step)?.actor ?? 'Người duyệt';

/** One line per returned or rejected submission, oldest first. */
const reasonLines = (submissions: Submission[], decisions: ApprovalDecision[], record: RepairRecord): string[] =>
  submissions.flatMap((submission) =>
    decisions
      .filter((row) => row.submissionId === submission.id && row.outcome !== 'APPROVED')
      .map(
        (row) =>
          `- Lần trình ${submission.attemptNo} (${formatDate(toVnDate(row.createdAt))}, ${formatVnd(submission.amountVnd)}): ${stepActor(row, record)} ${OUTCOME_TEXT[row.outcome]} – ${row.reason ?? 'không ghi lý do'}`,
      ),
  );

/** Builds the draft text from the record, its three submissions and the decisions' reasons. */
const composeNotice = async (ctx: CommandContext, record: RepairRecord): Promise<Pick<UnresolvedNotice, 'title' | 'body'>> => {
  const [building, location, submissions, decisions] = await Promise.all([
    ctx.db.buildings.get(record.buildingId),
    ctx.db.locations.get(record.locationId),
    ctx.db.submissions.where('recordId').equals(record.id).sortBy('attemptNo'),
    ctx.db.approvalDecisions.where('recordId').equals(record.id).sortBy('createdAt'),
  ]);
  const buildingName = building?.name ?? record.buildingId;
  const place = location ? `${location.name}, tầng ${location.floor}` : 'chưa rõ vị trí';
  const body = [
    `Kính gửi: ${approvalStepsFor(record.approvalStepKeys, record.workflowApprovalSteps).map((step) => step.actor).join(', ')} – ${buildingName}.`,
    '',
    `Ban quản lý thông báo hồ sơ sửa chữa ${record.code} “${record.title}” (${place}) hiện CHƯA ĐƯỢC XỬ LÝ do tờ trình không được duyệt sau ${LIMITS.MAX_SUBMISSION_ATTEMPTS} lần trình.`,
    '',
    'Ý kiến qua các lần trình:',
    ...reasonLines(submissions, decisions, record),
    '',
    `Hiện trạng: ${record.description}`,
    '',
    'Đề nghị các bên xem xét phương án tiếp theo (điều chỉnh phạm vi, tìm nhà thầu khác hoặc lập hồ sơ mới).',
    '',
    `Ban quản lý ${buildingName}`,
  ].join('\n');
  return { title: `Thông báo hồ sơ chưa xử lý: ${record.code} – ${record.title}`, body };
};

/** Called inside rejectProposal on the third rejection. */
export const createUnresolvedNotice = async (ctx: CommandContext, record: RepairRecord): Promise<void> => {
  const text = await composeNotice(ctx, record);
  await ctx.db.notices.add({
    id: newId('ntc'),
    recordId: record.id,
    buildingId: record.buildingId,
    ...text,
    status: 'DRAFT',
    version: 1,
    createdAt: ctx.now,
    updatedAt: ctx.now,
  });
};

const loadNotice = async (ctx: CommandContext, record: RepairRecord, payload: Record<string, unknown>): Promise<UnresolvedNotice> => {
  const notice = await ctx.db.notices.where('recordId').equals(record.id).first();
  if (!notice) throw notFound('Không tìm thấy thông báo của hồ sơ.');
  if (notice.status !== 'DRAFT') throw invalidTransition('Thông báo đã phát hành, chỉ được xem.');
  const expected = asNumber(payload.noticeVersion);
  if (expected !== undefined && expected !== notice.version) throw conflict('Thông báo đã được sửa ở nơi khác. Vui lòng tải lại.');
  return notice;
};

const validateText = (payload: Record<string, unknown>) => {
  const title = asString(payload.title);
  const body = typeof payload.body === 'string' ? payload.body.trim() : '';
  assertNoFieldErrors(
    new FieldErrorCollector()
      .text('title', 'Tiêu đề', title, 5, LIMITS.NOTICE_TITLE_MAX)
      .text('body', 'Nội dung', body, LIMITS.NOTICE_BODY_MIN, LIMITS.NOTICE_BODY_MAX).errors,
  );
  return { title, body };
};

const saveUnresolvedNotice: CommandHandler = async (ctx, command) => {
  const record = await loadRecordFor(ctx, command, 'saveUnresolvedNotice');
  const payload = asRecord(command.payload);
  const notice = await loadNotice(ctx, record, payload);
  await ctx.db.notices.put({ ...notice, ...validateText(payload), version: notice.version + 1, updatedAt: ctx.now });
  await commitRecord(ctx, record, record, 'saveUnresolvedNotice');
  return { ok: true, subjectId: record.id };
};

/** Locks the notice and informs the approvers in the app; sending through Zalo/email is outside the demo. */
const issueUnresolvedNotice: CommandHandler = async (ctx, command) => {
  const record = await loadRecordFor(ctx, command, 'issueUnresolvedNotice');
  const payload = asRecord(command.payload);
  const notice = await loadNotice(ctx, record, payload);
  const text = 'title' in payload ? validateText(payload) : { title: notice.title, body: notice.body };
  await ctx.db.notices.put({ ...notice, ...text, status: 'ISSUED', issuedAt: ctx.now, issuedBy: ctx.actor.id, version: notice.version + 1, updatedAt: ctx.now });
  const saved = await commitRecord(ctx, record, { ...record, noticeIssuedAt: ctx.now }, 'issueUnresolvedNotice');
  const recipients = new Set(
    approvalStepsFor(saved.approvalStepKeys, saved.workflowApprovalSteps)
      .map((step) => {
        const slot = APPROVAL_STEP_SLOT[step.key];
        return slot ? slotUserId(saved, slot) : saved.approvalAssigneeUserIds?.[step.key];
      })
      .filter((id): id is string => Boolean(id)),
  );
  for (const recipientId of recipients) {
    await notify(ctx, {
      subjectType: 'REPAIR_RECORD',
      subjectId: saved.id,
      buildingId: saved.buildingId,
      recipientId,
      title: 'Thông báo hồ sơ chưa xử lý',
      message: text.title,
    });
  }
  return { ok: true, subjectId: saved.id };
};

export const unresolvedNoticeHandlers: Record<string, CommandHandler> = {
  saveUnresolvedNotice,
  issueUnresolvedNotice,
};
