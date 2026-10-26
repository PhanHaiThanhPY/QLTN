import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, In } from 'typeorm';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { conflict, conflictWithReason } from '../../common/errors';
import { formatVnDate, vnDate } from '../../common/utils/vn-date';
import { FieldErrors } from '../../common/validation/field-errors';
import { AuditService } from '../audit/audit.service';
import { SUBJECT_TYPE } from '../audit/entities/audit-event.entity';
import { Attachment } from '../attachments/entities/attachment.entity';
import { notify } from '../notifications/notify';
import type {
  AcceptanceDecisionDto,
  SaveRepairEvidenceDto,
  StartConstructionDto,
  SubmitAcceptanceDto,
  UpdateConstructionDto,
} from './dto/construction.dto';
import { RepairAcceptanceDecision, type AcceptanceDecisionOutcome } from './entities/repair-acceptance-decision.entity';
import { RepairAcceptance, type AcceptanceOutcome } from './entities/repair-acceptance.entity';
import { RepairConstructionUpdate } from './entities/repair-construction-update.entity';
import { RepairConstruction } from './entities/repair-construction.entity';
import { RepairRecord } from './entities/repair-record.entity';
import { RepairSignature } from './entities/repair-signature.entity';
import type { RecordAction } from './record-actions';
import { loadRecordForAction, validateText } from './record-loader';
import { acceptanceStepKeysOf, acceptanceStepsHeldBy, approvalStepOf, stepHolderOf } from './record-steps';
import { toRecordView, type RepairRecordView } from './record-view';
import { checkSignature, signatureDataUrl } from './signature';

const NOTE_MIN = 5;
const NOTE_MAX = 1000;
const CONTENT_MIN = 10;
const CONTENT_MAX = 2000;
const LOCATION_MAX = 200;
/** Roles whose step holders receive the construction plan (BR-S3-01). */
const PLAN_RECIPIENT_ROLES: readonly string[] = ['OWNERS_BOARD', 'TECH_CONSULTANT'];

export interface ConstructionView {
  startDate: string;
  plannedEndDate: string;
  planNote: string;
  progressPercent: number;
  completedDate: string | null;
  startedBy: string;
  updates: Array<{
    id: string;
    progressPercent: number;
    note: string;
    attachmentIds: string[];
    actorId: string;
    createdAt: Date;
  }>;
}

export interface AcceptanceDecisionView {
  id: string;
  stepKey: string;
  actorId: string;
  outcome: AcceptanceDecisionOutcome;
  note: string | null;
  attachmentIds: string[];
  signatureDataUrl: string | null;
  createdAt: Date;
}

export interface AcceptanceRoundView {
  id: string;
  roundNo: number;
  completedDate: string;
  inspectedAt: Date;
  inspectionLocation: string;
  content: string;
  otherMembers: string | null;
  photoAttachmentIds: string[];
  memberStepKeys: string[];
  outcome: AcceptanceOutcome;
  submittedBy: string;
  createdAt: Date;
  closedAt: Date | null;
  decisions: AcceptanceDecisionView[];
}

export interface ExecutionHistoryView {
  construction: ConstructionView | null;
  /** Oldest first; a closed round never changes (BR-S3-04). */
  acceptances: AcceptanceRoundView[];
  repairDraft: { note?: string; attachmentIds?: string[] } | null;
}

/**
 * Construction and acceptance of a repair record (SPEC B03–B09 v2 slice S3, T10–T16). Every action locks the record,
 * checks version and the shared action rules, and writes its rows plus audit in one transaction.
 */
@Injectable()
export class ConstructionService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly audit: AuditService,
  ) {}

  /** T10: plan dates and note; BQT and TVKT holders receive the plan in the app (BR-S3-01). */
  async start(actor: AuthenticatedUser, id: string, dto: StartConstructionDto): Promise<RepairRecordView> {
    return this.dataSource.transaction(async (manager) => {
      const record = await loadRecordForAction(manager, actor, id, dto.version, 'startConstruction');
      const errors = new FieldErrors();
      errors.when(dto.plannedEndDate < dto.startDate, 'plannedEndDate', 'Ngày dự kiến xong phải từ ngày bắt đầu.');
      validateText(errors, 'planNote', 'Ghi chú kế hoạch', dto.planNote, NOTE_MIN, NOTE_MAX);
      errors.throwIfAny();
      const repo = manager.getRepository(RepairConstruction);
      await repo.save(
        repo.create({
          recordId: record.id,
          startDate: dto.startDate,
          plannedEndDate: dto.plannedEndDate,
          planNote: dto.planNote.trim(),
          progressPercent: 0,
          startedBy: actor.id,
        }),
      );
      await notify(manager, {
        recipientIds: this.planRecipients(record),
        kind: 'CONSTRUCTION_PLAN',
        title: `Kế hoạch thi công ${record.code}`,
        body: [
          `Nhà thầu thực hiện: ${record.executingContractorName ?? '—'}.`,
          `Bắt đầu ${formatVnDate(dto.startDate)}, dự kiến xong ${formatVnDate(dto.plannedEndDate)}.`,
          `Ghi chú: ${dto.planNote.trim()}`,
        ].join('\n'),
        subjectType: SUBJECT_TYPE.REPAIR_RECORD,
        subjectId: record.id,
        buildingId: record.buildingId,
      });
      return this.commit(manager, actor, record, 'startConstruction', 'IN_CONSTRUCTION', dto.planNote.trim());
    });
  }

  /** T11: progress and note, with optional CONSTRUCTION files. */
  async update(actor: AuthenticatedUser, id: string, dto: UpdateConstructionDto): Promise<RepairRecordView> {
    return this.dataSource.transaction(async (manager) => {
      const record = await loadRecordForAction(manager, actor, id, dto.version, 'updateConstruction');
      const errors = new FieldErrors();
      validateText(errors, 'note', 'Ghi chú', dto.note, NOTE_MIN, NOTE_MAX);
      const attachmentIds = await this.ownFiles(manager, errors, record, dto.attachmentIds ?? [], 'attachmentIds', [
        'CONSTRUCTION',
      ]);
      errors.throwIfAny();
      const construction = await this.constructionOf(manager, record);
      construction.progressPercent = dto.progressPercent;
      await manager.getRepository(RepairConstruction).save(construction);
      const updates = manager.getRepository(RepairConstructionUpdate);
      await updates.save(
        updates.create({
          recordId: record.id,
          progressPercent: dto.progressPercent,
          note: dto.note.trim(),
          attachmentIds,
          actorId: actor.id,
        }),
      );
      return this.commit(manager, actor, record, 'updateConstruction', record.status, `${dto.progressPercent}%`);
    });
  }

  /** T12 (from IN_CONSTRUCTION) and T16 (from NEEDS_REPAIR): new minutes, every member pending. */
  async submitAcceptance(
    actor: AuthenticatedUser,
    id: string,
    action: Extract<RecordAction, 'submitAcceptance' | 'resubmitAcceptance'>,
    dto: SubmitAcceptanceDto,
  ): Promise<RepairRecordView> {
    return this.dataSource.transaction(async (manager) => {
      const record = await loadRecordForAction(manager, actor, id, dto.version, action);
      const construction = await this.constructionOf(manager, record);
      const errors = new FieldErrors();
      errors.when(
        construction.progressPercent !== 100,
        'progressPercent',
        'Tiến độ thi công phải đạt 100% trước khi gửi nghiệm thu.',
      );
      errors.when(
        dto.completedDate < construction.startDate || dto.completedDate > vnDate(new Date()),
        'completedDate',
        'Ngày hoàn thành phải từ ngày bắt đầu thi công đến hôm nay.',
      );
      validateText(errors, 'inspectionLocation', 'Địa điểm nghiệm thu', dto.inspectionLocation, 1, LOCATION_MAX);
      validateText(errors, 'content', 'Nội dung nghiệm thu', dto.content, CONTENT_MIN, CONTENT_MAX);
      errors.when(
        (dto.otherMembers ?? '').trim().length > NOTE_MAX,
        'otherMembers',
        `Thành phần khác tối đa ${NOTE_MAX} ký tự.`,
      );
      const photos = await this.ownFiles(manager, errors, record, dto.photoAttachmentIds, 'photoAttachmentIds', [
        'ACCEPTANCE',
        'CONSTRUCTION',
      ]);
      errors.when(photos.length === 0, 'photoAttachmentIds', 'Cần ít nhất 1 ảnh kết quả.');
      const members = acceptanceStepKeysOf(record);
      errors.when(members.length === 0, 'memberStepKeys', 'Hồ sơ chưa có thành phần nghiệm thu.');
      errors.throwIfAny();

      const rounds = manager.getRepository(RepairAcceptance);
      const roundNo = (await rounds.countBy({ recordId: record.id })) + 1;
      const round = await rounds.save(
        rounds.create({
          recordId: record.id,
          roundNo,
          completedDate: dto.completedDate,
          inspectedAt: new Date(dto.inspectedAt),
          inspectionLocation: dto.inspectionLocation.trim(),
          content: dto.content.trim(),
          otherMembers: dto.otherMembers?.trim() || null,
          photoAttachmentIds: photos,
          memberStepKeys: members,
          outcome: 'PENDING',
          submittedBy: actor.id,
        }),
      );
      construction.completedDate = dto.completedDate;
      await manager.getRepository(RepairConstruction).save(construction);
      record.currentAcceptanceId = round.id;
      return this.commit(manager, actor, record, action, 'PENDING_ACCEPTANCE', `Lượt nghiệm thu ${roundNo}`);
    });
  }

  /**
   * T13/T14: the actor decides the first member step they hold that is still open in the current round (BR-S3-02).
   * A failure closes the round at once; the round passes when every member passed.
   */
  async decide(
    actor: AuthenticatedUser,
    id: string,
    outcome: AcceptanceDecisionOutcome,
    dto: AcceptanceDecisionDto,
  ): Promise<RepairRecordView> {
    const action = outcome === 'PASSED' ? 'passAcceptance' : 'failAcceptance';
    return this.dataSource.transaction(async (manager) => {
      const record = await loadRecordForAction(manager, actor, id, dto.version, action);
      const rounds = manager.getRepository(RepairAcceptance);
      const round = record.currentAcceptanceId
        ? await rounds.findOne({ where: { id: record.currentAcceptanceId }, lock: { mode: 'pessimistic_write' } })
        : null;
      if (!round || round.outcome !== 'PENDING') throw conflict('Không có lượt nghiệm thu đang mở. Vui lòng tải lại.');
      if (dto.acceptanceId && dto.acceptanceId !== round.id)
        throw conflict('Lượt nghiệm thu đã thay đổi. Vui lòng tải lại.');
      const decisions = manager.getRepository(RepairAcceptanceDecision);
      const decided = (await decisions.findBy({ acceptanceId: round.id })).map((row) => row.stepKey);
      const stepKey = acceptanceStepsHeldBy(record, actor.id).find(
        (key) => round.memberStepKeys.includes(key) && !decided.includes(key),
      );
      if (!stepKey) {
        throw conflictWithReason('step_already_decided', 'Bạn đã quyết định trong lượt nghiệm thu này.');
      }

      const errors = new FieldErrors();
      const note = (dto.note ?? '').trim();
      if (outcome === 'FAILED') validateText(errors, 'note', 'Điểm cần khắc phục', note, NOTE_MIN, NOTE_MAX);
      else errors.when(note.length > NOTE_MAX, 'note', `Điểm cần lưu ý tối đa ${NOTE_MAX} ký tự.`);
      const signed = checkSignature(dto.signature);
      if (!signed.ok) errors.add('signature', signed.message);
      const attachmentIds = await this.ownFiles(manager, errors, record, dto.attachmentIds ?? [], 'attachmentIds', [
        'ACCEPTANCE',
      ]);
      errors.throwIfAny();
      if (!signed.ok) return toRecordView(record);

      const decision = await decisions.save(
        decisions.create({
          acceptanceId: round.id,
          recordId: record.id,
          stepKey,
          actorId: actor.id,
          outcome,
          note: note || null,
          attachmentIds,
        }),
      );
      const signatures = manager.getRepository(RepairSignature);
      await signatures.save(
        signatures.create({
          recordId: record.id,
          documentType: 'ACCEPTANCE_DECISION',
          documentId: decision.id,
          signerId: actor.id,
          mimeType: 'image/png',
          content: signed.content,
        }),
      );

      const allPassed =
        outcome === 'PASSED' && round.memberStepKeys.every((key) => [...decided, stepKey].includes(key));
      if (outcome === 'FAILED' || allPassed) {
        round.outcome = outcome === 'FAILED' ? 'FAILED' : 'PASSED';
        round.closedAt = new Date();
        await rounds.save(round);
      }
      const toStatus = outcome === 'FAILED' ? 'NEEDS_REPAIR' : allPassed ? 'PENDING_PAYMENT_REQUEST' : record.status;
      const label = approvalStepOf(record, stepKey)?.label ?? stepKey;
      return this.commit(manager, actor, record, action, toStatus, note ? `${label}: ${note}` : label);
    });
  }

  /** T15: repair work in progress, offered again when resubmitting. */
  async saveRepairEvidence(
    actor: AuthenticatedUser,
    id: string,
    dto: SaveRepairEvidenceDto,
  ): Promise<RepairRecordView> {
    return this.dataSource.transaction(async (manager) => {
      const record = await loadRecordForAction(manager, actor, id, dto.version, 'saveRepairEvidence');
      const errors = new FieldErrors();
      const note = dto.note?.trim();
      errors.when((note ?? '').length > NOTE_MAX, 'note', `Nội dung khắc phục tối đa ${NOTE_MAX} ký tự.`);
      const attachmentIds =
        dto.attachmentIds === undefined
          ? undefined
          : await this.ownFiles(manager, errors, record, dto.attachmentIds, 'attachmentIds', [
              'CONSTRUCTION',
              'ACCEPTANCE',
            ]);
      errors.throwIfAny();
      record.repairDraft = {
        ...(record.repairDraft ?? {}),
        ...(note === undefined ? {} : { note }),
        ...(attachmentIds === undefined ? {} : { attachmentIds }),
      };
      return this.commit(manager, actor, record, 'saveRepairEvidence', record.status);
    });
  }

  /** Construction, every acceptance round with its decisions and signatures, and the saved repair work. */
  async historyOf(record: RepairRecord): Promise<ExecutionHistoryView> {
    const [construction, updates, rounds, decisions, signatures] = await Promise.all([
      this.dataSource.getRepository(RepairConstruction).findOneBy({ recordId: record.id }),
      this.dataSource
        .getRepository(RepairConstructionUpdate)
        .find({ where: { recordId: record.id }, order: { createdAt: 'ASC', id: 'ASC' } }),
      this.dataSource
        .getRepository(RepairAcceptance)
        .find({ where: { recordId: record.id }, order: { roundNo: 'ASC' } }),
      this.dataSource
        .getRepository(RepairAcceptanceDecision)
        .find({ where: { recordId: record.id }, order: { createdAt: 'ASC', id: 'ASC' } }),
      this.dataSource
        .getRepository(RepairSignature)
        .findBy({ recordId: record.id, documentType: 'ACCEPTANCE_DECISION' }),
    ]);
    const signatureOf = new Map(signatures.map((row) => [row.documentId, signatureDataUrl(row.content)]));
    return {
      construction: construction
        ? {
            startDate: construction.startDate,
            plannedEndDate: construction.plannedEndDate,
            planNote: construction.planNote,
            progressPercent: construction.progressPercent,
            completedDate: construction.completedDate,
            startedBy: construction.startedBy,
            updates: updates.map((row) => ({
              id: row.id,
              progressPercent: row.progressPercent,
              note: row.note,
              attachmentIds: [...row.attachmentIds],
              actorId: row.actorId,
              createdAt: row.createdAt,
            })),
          }
        : null,
      acceptances: rounds.map((round) => ({
        id: round.id,
        roundNo: round.roundNo,
        completedDate: round.completedDate,
        inspectedAt: round.inspectedAt,
        inspectionLocation: round.inspectionLocation,
        content: round.content,
        otherMembers: round.otherMembers,
        photoAttachmentIds: [...round.photoAttachmentIds],
        memberStepKeys: [...round.memberStepKeys],
        outcome: round.outcome,
        submittedBy: round.submittedBy,
        createdAt: round.createdAt,
        closedAt: round.closedAt,
        decisions: decisions
          .filter((row) => row.acceptanceId === round.id)
          .map((row) => ({
            id: row.id,
            stepKey: row.stepKey,
            actorId: row.actorId,
            outcome: row.outcome,
            note: row.note,
            attachmentIds: [...row.attachmentIds],
            signatureDataUrl: signatureOf.get(row.id) ?? null,
            createdAt: row.createdAt,
          })),
      })),
      repairDraft: record.repairDraft,
    };
  }

  /** Holders of the record's BQT- and TVKT-role steps, in any stage of the snapshot. */
  private planRecipients(record: RepairRecord): string[] {
    const keys = new Set([
      ...record.approvalStepKeys,
      ...Object.values(record.workflowStageApprovalStepKeys ?? {}).flatMap((stepKeys) => stepKeys ?? []),
    ]);
    return [...keys]
      .filter((key) => PLAN_RECIPIENT_ROLES.includes(approvalStepOf(record, key)?.role ?? ''))
      .map((key) => stepHolderOf(record, key))
      .filter((userId): userId is string => Boolean(userId));
  }

  private async constructionOf(manager: EntityManager, record: RepairRecord): Promise<RepairConstruction> {
    const construction = await manager.getRepository(RepairConstruction).findOneBy({ recordId: record.id });
    if (!construction) throw conflict('Hồ sơ chưa bắt đầu thi công. Vui lòng tải lại.');
    return construction;
  }

  /** Files must belong to this record with one of the purposes; duplicates collapse. */
  private async ownFiles(
    manager: EntityManager,
    errors: FieldErrors,
    record: RepairRecord,
    ids: readonly string[],
    field: string,
    purposes: readonly string[],
  ): Promise<string[]> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return [];
    const rows = await manager.getRepository(Attachment).findBy({ id: In(unique) });
    const valid = rows.filter((row) => row.subjectId === record.id && purposes.includes(row.purpose));
    errors.when(valid.length !== unique.length, field, 'Tệp đính kèm không hợp lệ hoặc không thuộc hồ sơ này.');
    return unique;
  }

  private async commit(
    manager: EntityManager,
    actor: AuthenticatedUser,
    record: RepairRecord,
    action: RecordAction,
    toStatus: string,
    reason?: string,
  ): Promise<RepairRecordView> {
    const fromStatus = record.status;
    record.status = toStatus;
    record.version += 1;
    const saved = await manager.getRepository(RepairRecord).save(record);
    await this.audit.record(manager, {
      subjectType: SUBJECT_TYPE.REPAIR_RECORD,
      subjectId: saved.id,
      buildingId: saved.buildingId,
      action,
      actorId: actor.id,
      entityVersion: saved.version,
      fromStatus,
      toStatus: saved.status,
      ...(reason ? { reason } : {}),
    });
    return toRecordView(saved);
  }
}
