import { LIMITS } from '@/domain/constants';
import { assertNoFieldErrors } from '@/domain/errors';
import { APPROVER_SLOTS, slotUserId } from '@/domain/permissions';
import type { RepairRecord } from '@/domain/types';
import { FieldErrorCollector, asNumber, asRecord, asString, requireVndAmount } from '@/domain/validation';
import { formatVnd, isValidVndAmount } from '@/utils/money';
import type { CommandHandler } from '../command-engine';
import { notify } from '../command-context';
import { newId } from '../runtime';
import { loadBuildingConfig } from './building-handlers';
import { assertSubmittable } from './repair-record-handlers';
import { commitRecord, loadRecordFor } from './repair-helpers';

/**
 * BQL lets work start before approval (proposal 2.5): amount within the building's emergency limit,
 * approvers are informed, and the proposal must follow within the configured hours.
 */
const startEmergencyRepair: CommandHandler = async (ctx, command) => {
  const record = await loadRecordFor(ctx, command, 'startEmergencyRepair');
  await assertSubmittable(ctx, record);
  const config = await loadBuildingConfig(ctx, record.buildingId);
  const payload = asRecord(command.payload);
  const reason = asString(payload.reason);
  const contractorName = asString(payload.contractorName);
  const amount = asNumber(payload.estimatedAmountVnd);
  const plannedEndDate = asString(payload.plannedEndDate);
  const errors = new FieldErrorCollector()
    .reason('reason', reason, 'Lý do khẩn cấp')
    .required('contractorName', contractorName, 'Cần tên nhà thầu thực hiện.')
    .amount('estimatedAmountVnd', amount, 'Chi phí dự kiến')
    .date('plannedEndDate', plannedEndDate, 'Ngày dự kiến xong');
  errors.when(contractorName.length > LIMITS.CONTRACTOR_NAME_MAX, 'contractorName', `Tên nhà thầu tối đa ${LIMITS.CONTRACTOR_NAME_MAX} ký tự.`);
  errors.when(
    isValidVndAmount(amount) && amount > config.emergencyLimitVnd,
    'estimatedAmountVnd',
    `Vượt hạn mức khẩn cấp của tòa (${formatVnd(config.emergencyLimitVnd)}). Hãy đi quy trình duyệt thông thường.`,
  );
  errors.when(errors.isEmpty && plannedEndDate < ctx.today, 'plannedEndDate', 'Ngày dự kiến xong không được trước hôm nay.');
  assertNoFieldErrors(errors.errors);
  const estimatedAmountVnd = requireVndAmount(amount, 'estimatedAmountVnd', 'Chi phí dự kiến');

  const docsDueAt = new Date(new Date(ctx.now).getTime() + config.emergencyDocHours * 3_600_000).toISOString();
  await ctx.db.constructions.add({ id: newId('con'), recordId: record.id, startDate: ctx.today, plannedEndDate, progressPercent: 0, logs: [] });
  const draft = await ctx.db.proposalDrafts.where('recordId').equals(record.id).first();
  await ctx.db.proposalDrafts.put({
    id: draft?.id ?? newId('pdr'),
    recordId: record.id,
    proposal: draft?.proposal ?? '',
    contractorName: draft?.contractorName || contractorName,
    amountVnd: draft?.amountVnd ?? estimatedAmountVnd,
    attachmentIds: draft?.attachmentIds ?? [],
    version: (draft?.version ?? 0) + 1,
    updatedAt: ctx.now,
  });
  const next: RepairRecord = {
    ...record,
    status: 'EMERGENCY_IN_PROGRESS',
    emergency: {
      startedAt: ctx.now,
      startedBy: ctx.actor.id,
      reason,
      estimatedAmountVnd,
      contractorName,
      limitVnd: config.emergencyLimitVnd,
      docsDueAt,
    },
  };
  const saved = await commitRecord(ctx, record, next, 'startEmergencyRepair', { reason });
  const recipients = new Set(
    [saved.confirmationUserId, ...APPROVER_SLOTS.map((slot) => slotUserId(saved, slot))].filter((id): id is string => Boolean(id)),
  );
  for (const recipientId of recipients) {
    await notify(ctx, {
      subjectType: 'REPAIR_RECORD',
      subjectId: saved.id,
      buildingId: saved.buildingId,
      recipientId,
      title: 'Sửa chữa khẩn cấp đã bắt đầu',
      message: `${saved.code} – ${saved.title}: ${formatVnd(estimatedAmountVnd)}, ${contractorName}. Hồ sơ bổ sung trong ${config.emergencyDocHours} giờ.`,
    });
  }
  return { ok: true, subjectId: saved.id };
};

export const emergencyHandlers: Record<string, CommandHandler> = { startEmergencyRepair };
