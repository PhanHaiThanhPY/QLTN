import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, In } from 'typeorm';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { formatVnDateTime, vnDate } from '../../common/utils/vn-date';
import { FieldErrors } from '../../common/validation/field-errors';
import {
  CLOSED_POST_REVIEW_REJECTED,
  EMERGENCY_IN_PROGRESS,
  isWithinEmergencyLimit,
  type EmergencyInfo,
} from '../../domain/emergency';
import { VND_PATTERN } from '../../domain/proposal-quote';
import { AuditService } from '../audit/audit.service';
import { SUBJECT_TYPE } from '../audit/entities/audit-event.entity';
import { Attachment } from '../attachments/entities/attachment.entity';
import { BuildingConfig } from '../buildings/entities/building-config.entity';
import { notify } from '../notifications/notify';
import type { ClosePostReviewRejectedDto, StartEmergencyRepairDto } from './dto/emergency.dto';
import { RepairConstruction } from './entities/repair-construction.entity';
import { RepairRecord } from './entities/repair-record.entity';
import { recordStatusLabel, type RecordAction } from './record-actions';
import { loadAssignmentContext } from './record-assignment';
import { loadRecordForAction, validateText } from './record-loader';
import { proposalChainStepsOf, stepHolderOf } from './record-steps';
import { toRecordView, type RepairRecordView } from './record-view';
import { RecordsService } from './records.service';

const TEXT_MIN = 5;
const TEXT_MAX = 1000;
const CONTRACTOR_MIN = 2;
const CONTRACTOR_MAX = 200;
const HOUR_MS = 3_600_000;
const vndFormatter = new Intl.NumberFormat('vi-VN');
const vnd = (value: string): string => `${vndFormatter.format(BigInt(value))} ₫`;

/**
 * Emergency repair (SPEC B06-S1): E-T1 starts the work before approval within the building's limit, E-T2 closes a
 * record whose post-review was refused. Like the other record actions, each locks the record, checks the shared
 * rules and version, and writes its rows, notices and audit in one transaction (BR-E-10).
 */
@Injectable()
export class EmergencyService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly audit: AuditService,
    private readonly records: RecordsService,
  ) {}

  /** E-T1 (BR-E-01…04): limit check, emergency data, construction and proposal draft opened, approvers notified. */
  async start(actor: AuthenticatedUser, id: string, dto: StartEmergencyRepairDto): Promise<RepairRecordView> {
    return this.dataSource.transaction(async (manager) => {
      const record = await loadRecordForAction(manager, actor, id, dto.version, 'startEmergencyRepair');
      // BR-E-01: from DRAFT the record must be complete as for T01; later statuses already passed it.
      if (record.status === 'DRAFT') {
        await this.records.assertSubmittable(manager, await loadAssignmentContext(manager, record.buildingId), record);
      }
      const config = await manager.getRepository(BuildingConfig).findOneByOrFail({ buildingId: record.buildingId });
      const limitVnd = String(config.emergencyLimitVnd);
      const errors = new FieldErrors();
      validateText(errors, 'reason', 'Lý do phải xử lý ngay', dto.reason, TEXT_MIN, TEXT_MAX);
      validateText(errors, 'contractorName', 'Nhà thầu thực hiện', dto.contractorName, CONTRACTOR_MIN, CONTRACTOR_MAX);
      const validAmount = VND_PATTERN.test(dto.estimatedAmountVnd) && BigInt(dto.estimatedAmountVnd) > 0n;
      errors.when(!validAmount, 'estimatedAmountVnd', 'Chi phí dự kiến phải là số nguyên VND lớn hơn 0.');
      errors.when(
        validAmount && !isWithinEmergencyLimit(dto.estimatedAmountVnd, limitVnd),
        'estimatedAmountVnd',
        `Chi phí dự kiến vượt hạn mức khẩn cấp của tòa (${vnd(limitVnd)}). Hãy đi quy trình duyệt thông thường.`,
      );
      const now = new Date();
      const today = vnDate(now);
      errors.when(dto.plannedEndDate < today, 'plannedEndDate', 'Ngày dự kiến xong không được trước hôm nay.');
      errors.throwIfAny();

      const reason = dto.reason.trim();
      const contractorName = dto.contractorName.trim();
      const docsDueAt = new Date(now.getTime() + config.emergencyDocHours * HOUR_MS);
      const fromStatus = record.status;
      const info: EmergencyInfo = {
        reason,
        contractorName,
        estimatedAmountVnd: dto.estimatedAmountVnd,
        plannedEndDate: dto.plannedEndDate,
        limitVnd,
        docsDueAt: docsDueAt.toISOString(),
        fromStatus,
        startedBy: actor.id,
        startedAt: now.toISOString(),
        docsSubmittedAt: null,
        lateReason: null,
        proposedAmountVnd: null,
        postReviewOutcome: null,
        postReviewRejection: null,
        closeDecision: null,
      };
      record.emergency = info;
      record.executingContractorName = contractorName;
      // BR-E-03: construction opened today at 0 %, and a proposal draft prefilled with the contractor and the reason.
      const constructions = manager.getRepository(RepairConstruction);
      await constructions.save(
        constructions.create({
          recordId: record.id,
          startDate: today,
          plannedEndDate: dto.plannedEndDate,
          planNote: reason,
          progressPercent: 0,
          startedBy: actor.id,
        }),
      );
      const draft = { ...(record.proposalDraft ?? {}) };
      if (!draft.contractors?.length) {
        draft.contractors = [
          { name: contractorName, unitPricesVnd: [], otherCostVnd: '0', taxVnd: '0', quotationAttachmentIds: [] },
        ];
        draft.proposedContractorIndex = 0;
      }
      if (!draft.requestContent) draft.requestContent = reason;
      record.proposalDraft = draft;

      await notify(manager, {
        recipientIds: this.approverIds(record).filter((userId) => userId !== actor.id),
        kind: 'EMERGENCY_STARTED',
        title: `Xử lý khẩn cấp ${record.code}`,
        body: `Hồ sơ ${record.code} đang xử lý khẩn cấp: ${reason}. Hạn bổ sung tờ trình: ${formatVnDateTime(docsDueAt)}.`,
        subjectType: SUBJECT_TYPE.REPAIR_RECORD,
        subjectId: record.id,
        buildingId: record.buildingId,
      });
      const auditReason = [
        `Từ «${recordStatusLabel(fromStatus)}»`,
        `chi phí dự kiến ${vnd(dto.estimatedAmountVnd)}`,
        `hạn mức ${vnd(limitVnd)}`,
        `hạn bổ sung ${formatVnDateTime(docsDueAt)}`,
      ].join('; ');
      return this.commit(manager, actor, record, 'startEmergencyRepair', EMERGENCY_IN_PROGRESS, auditReason);
    });
  }

  /** E-T2 (BR-E-08): the BOARD holder records how the cost is handled and closes the record; nothing is paid. */
  async closePostReviewRejected(
    actor: AuthenticatedUser,
    id: string,
    dto: ClosePostReviewRejectedDto,
  ): Promise<RepairRecordView> {
    return this.dataSource.transaction(async (manager) => {
      const record = await loadRecordForAction(manager, actor, id, dto.version, 'closePostReviewRejected');
      const errors = new FieldErrors();
      validateText(errors, 'reason', 'Quyết định xử lý chi phí', dto.reason, TEXT_MIN, TEXT_MAX);
      const attachmentIds = [...new Set(dto.attachmentIds ?? [])];
      await this.checkDecisionFiles(manager, errors, record, attachmentIds);
      errors.throwIfAny();
      const reason = dto.reason.trim();
      if (record.emergency) {
        record.emergency = {
          ...record.emergency,
          closeDecision: { reason, attachmentIds, decidedBy: actor.id, decidedAt: new Date().toISOString() },
        };
      }
      return this.commit(manager, actor, record, 'closePostReviewRejected', CLOSED_POST_REVIEW_REJECTED, reason);
    });
  }

  /** BR-E-04: the INTAKE holder and every holder of the proposal chain, each once. */
  private approverIds(record: RepairRecord): string[] {
    const chainHolders = proposalChainStepsOf(record).map((step) => stepHolderOf(record, step.key));
    return [...new Set([record.confirmationUserId, ...chainHolders])].filter((userId): userId is string =>
      Boolean(userId),
    );
  }

  private async checkDecisionFiles(
    manager: EntityManager,
    errors: FieldErrors,
    record: RepairRecord,
    ids: readonly string[],
  ): Promise<void> {
    if (ids.length === 0) return;
    const rows = await manager.getRepository(Attachment).findBy({ id: In([...ids]) });
    const valid = rows.filter((row) => row.subjectId === record.id && row.purpose === 'BOARD_DECISION');
    errors.when(
      valid.length !== ids.length,
      'attachmentIds',
      'Tệp quyết định không hợp lệ hoặc không thuộc hồ sơ này.',
    );
  }

  private async commit(
    manager: EntityManager,
    actor: AuthenticatedUser,
    record: RepairRecord,
    action: RecordAction,
    toStatus: string,
    reason: string,
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
      reason,
    });
    return toRecordView(saved);
  }
}
