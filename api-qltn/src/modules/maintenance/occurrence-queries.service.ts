import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { Brackets, DataSource, In } from 'typeorm';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { notFound } from '../../common/errors';
import { Clock } from '../../common/services/clock.service';
import { vnDate } from '../../common/utils/vn-date';
import { overdueDays, type WorkEntry } from '../../domain/maintenance-execution';
import { addDays } from '../../domain/maintenance-schedule';
import { toAttachmentView, type AttachmentView } from '../attachments/attachment-view';
import { Attachment } from '../attachments/entities/attachment.entity';
import { AuditService, type AuditEventView } from '../audit/audit.service';
import { SUBJECT_TYPE } from '../audit/entities/audit-event.entity';
import { RepairRecord } from '../records/entities/repair-record.entity';
import type { ListOccurrencesQueryDto } from './dto/maintenance-execution.dto';
import { MaintenanceItem } from './entities/maintenance-item.entity';
import { MaintenanceOccurrence, type OccurrenceWork } from './entities/maintenance-occurrence.entity';
import { MaintenancePlan } from './entities/maintenance-plan.entity';
import { MaintenanceSubmission } from './entities/maintenance-submission.entity';
import { INACTIVE_RECORD_STATUSES } from './maintenance-execution.service';
import { toOccurrenceView, type OccurrenceView } from './maintenance-plan-views';
import { OCCURRENCE_NOT_FOUND } from './occurrence-access';

const TO_DO = ['SCHEDULED', 'IN_PROGRESS', 'REWORK'] as const;
const OPEN = [...TO_DO, 'PENDING_REVIEW'] as const;
const LIST_LIMIT = 500;
const AUDIT_LIMIT = 100;
const NEXT_DAYS = 7;

/** BR-MT3-11: "Quá hạn N ngày" for work still to do, "Quá hạn xác nhận" for a late review. */
export interface OccurrenceTiming {
  overdueDays: number;
  reviewOverdue: boolean;
}

export interface OccurrenceExecutionView extends OccurrenceView, OccurrenceTiming {
  work: OccurrenceWork;
  round: number;
  rework: Record<string, string>;
  startedAt: Date | null;
  submittedAt: Date | null;
  reviewDueAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
}

export interface SubmissionView {
  round: number;
  entries: WorkEntry[];
  summary: string;
  contractorName: string | null;
  actualWorker: string | null;
  attachmentIds: string[];
  submittedBy: string;
  submittedAt: Date;
  reviewDueAt: Date;
  decision: 'REWORK' | 'CONFIRMED' | null;
  decisionReason: string | null;
  reworkItems: Record<string, string>;
  resolutions: Record<string, string>;
  conditionAfter: string | null;
  conditionNote: string | null;
  decidedBy: string | null;
  decidedAt: Date | null;
}

export interface LinkedRepair {
  id: string;
  code: string;
  status: string;
  /** Checklist item the record was made from. */
  itemId: string | null;
  /** False once withdrawn or closed as no repair (D-MT3-5). */
  inForce: boolean;
}

export interface OccurrenceDetailView {
  occurrence: OccurrenceExecutionView;
  plan: { id: string; code: string; name: string; managerUserId: string };
  item: { id: string; code: string; name: string; locationId: string; condition: string; active: boolean };
  submissions: SubmissionView[];
  repairs: LinkedRepair[];
  files: Record<string, AttachmentView>;
  audit: AuditEventView[];
}

export interface OccurrenceRow extends OccurrenceTiming {
  id: string;
  code: string;
  status: string;
  scheduledDate: string;
  reviewDueAt: Date | null;
  isMakeup: boolean;
  performerUserId: string;
  reviewerUserId: string;
  buildingId: string;
  plan: { id: string; code: string; name: string };
  item: { id: string; code: string; name: string; locationId: string };
  version: number;
}

/** AC-MT3.16 cards, counted on the server over the same scope as the rows. */
export interface OccurrenceCounts {
  overdue: number;
  today: number;
  next7: number;
  pendingReview: number;
}

export interface OccurrenceList {
  rows: OccurrenceRow[];
  counts: OccurrenceCounts;
}

const timingOf = (
  row: Pick<MaintenanceOccurrence, 'status' | 'scheduledDate' | 'reviewDueAt'>,
  today: string,
  now: Date,
): OccurrenceTiming => ({
  overdueDays: (TO_DO as readonly string[]).includes(row.status) ? overdueDays(row.scheduledDate, today) : 0,
  reviewOverdue:
    row.status === 'PENDING_REVIEW' && Boolean(row.reviewDueAt && row.reviewDueAt.getTime() < now.getTime()),
});

/** Reading occurrences (SPEC MT-S3 BR-MT3-11, BR-MT3-13, AC-MT3.16): anyone with VIEW, inside their buildings. */
@Injectable()
export class OccurrenceQueriesService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly audit: AuditService,
    private readonly clock: Clock,
  ) {}

  async getDetail(actor: AuthenticatedUser, id: string): Promise<OccurrenceDetailView> {
    const occurrence = await this.dataSource.getRepository(MaintenanceOccurrence).findOneBy({ id });
    if (!occurrence || !actor.buildingIds.includes(occurrence.buildingId)) throw notFound(OCCURRENCE_NOT_FOUND);
    const now = this.clock.now();
    const [plan, item, submissions, repairs, audit] = await Promise.all([
      this.dataSource.getRepository(MaintenancePlan).findOneByOrFail({ id: occurrence.planId }),
      this.dataSource.getRepository(MaintenanceItem).findOneByOrFail({ id: occurrence.itemId }),
      this.dataSource
        .getRepository(MaintenanceSubmission)
        .find({ where: { occurrenceId: id }, order: { round: 'DESC' } }),
      this.dataSource
        .getRepository(RepairRecord)
        .find({ where: { sourceOccurrenceId: id }, order: { createdAt: 'ASC' } }),
      this.audit.listForSubject(SUBJECT_TYPE.MAINTENANCE_OCCURRENCE, id, { page: 1, limit: AUDIT_LIMIT }),
    ]);
    const fileIds = [
      ...occurrence.work.attachmentIds,
      ...occurrence.work.entries.flatMap((entry) => entry.attachmentIds),
      ...submissions.flatMap((row) => [...row.attachmentIds, ...row.entries.flatMap((entry) => entry.attachmentIds)]),
    ];
    const files = fileIds.length
      ? await this.dataSource.getRepository(Attachment).findBy({ id: In([...new Set(fileIds)]) })
      : [];
    return {
      occurrence: {
        ...toOccurrenceView(occurrence),
        ...timingOf(occurrence, vnDate(now), now),
        work: occurrence.work,
        round: occurrence.round,
        rework: occurrence.rework,
        startedAt: occurrence.startedAt,
        submittedAt: occurrence.submittedAt,
        reviewDueAt: occurrence.reviewDueAt,
        completedAt: occurrence.completedAt,
        cancelledAt: occurrence.cancelledAt,
      },
      plan: { id: plan.id, code: plan.code, name: plan.name, managerUserId: plan.managerUserId },
      item: {
        id: item.id,
        code: item.code,
        name: item.name,
        locationId: item.locationId,
        condition: item.condition,
        active: item.active,
      },
      submissions: submissions.map((row) => ({
        round: row.round,
        entries: row.entries,
        summary: row.summary,
        contractorName: row.contractorName,
        actualWorker: row.actualWorker,
        attachmentIds: row.attachmentIds,
        submittedBy: row.submittedBy,
        submittedAt: row.submittedAt,
        reviewDueAt: row.reviewDueAt,
        decision: row.decision,
        decisionReason: row.decisionReason,
        reworkItems: row.reworkItems,
        resolutions: row.resolutions,
        conditionAfter: row.conditionAfter,
        conditionNote: row.conditionNote,
        decidedBy: row.decidedBy,
        decidedAt: row.decidedAt,
      })),
      repairs: repairs.map((row) => ({
        id: row.id,
        code: row.code,
        status: row.status,
        itemId: row.sourceChecklistItemId,
        inForce: !(INACTIVE_RECORD_STATUSES as readonly string[]).includes(row.status),
      })),
      files: Object.fromEntries(files.map((file) => [file.id, toAttachmentView(file)])),
      audit: audit.data,
    };
  }

  /**
   * "Lượt bảo trì" list (ui-brief §2.5). "Việc của tôi": open occurrences the caller performs, or reviews while they
   * wait for review. Late ones first, then by scheduled day.
   */
  async list(actor: AuthenticatedUser, query: ListOccurrencesQueryDto): Promise<OccurrenceList> {
    const buildingIds = query.buildingId
      ? actor.buildingIds.filter((id) => id === query.buildingId)
      : actor.buildingIds;
    if (buildingIds.length === 0) return { rows: [], counts: { overdue: 0, today: 0, next7: 0, pendingReview: 0 } };
    const now = this.clock.now();
    const today = vnDate(now);
    const base = this.dataSource
      .getRepository(MaintenanceOccurrence)
      .createQueryBuilder('o')
      .where('o.building_id IN (:...buildingIds)', { buildingIds });
    if (query.scope === 'mine') {
      base.andWhere(
        new Brackets((mine) =>
          mine
            .where('o.performer_user_id = :me AND o.status IN (:...open)', { me: actor.id, open: [...OPEN] })
            .orWhere('o.reviewer_user_id = :me AND o.status = :pending', { pending: 'PENDING_REVIEW' }),
        ),
      );
    }
    const scoped = await base.getMany();
    const counted = scoped.map((row) => ({ row, timing: timingOf(row, today, now) }));
    const toDo = (status: string) => (TO_DO as readonly string[]).includes(status);
    const nextEnd = addDays(today, NEXT_DAYS);
    const counts: OccurrenceCounts = {
      overdue: counted.filter(({ timing }) => timing.overdueDays > 0 || timing.reviewOverdue).length,
      today: counted.filter(({ row }) => toDo(row.status) && row.scheduledDate === today).length,
      next7: counted.filter(({ row }) => toDo(row.status) && row.scheduledDate > today && row.scheduledDate <= nextEnd)
        .length,
      pendingReview: counted.filter(({ row }) => row.status === 'PENDING_REVIEW').length,
    };
    const inBucket = ({ row, timing }: (typeof counted)[number]): boolean => {
      switch (query.bucket) {
        case 'OVERDUE':
          return timing.overdueDays > 0 || timing.reviewOverdue;
        case 'TODAY':
          return toDo(row.status) && row.scheduledDate === today;
        case 'NEXT_7':
          return toDo(row.status) && row.scheduledDate > today && row.scheduledDate <= nextEnd;
        case 'PENDING_REVIEW':
          return row.status === 'PENDING_REVIEW';
        default:
          return true;
      }
    };
    const picked = counted
      .filter(inBucket)
      .filter(({ row }) => !query.status || row.status === query.status)
      .filter(
        ({ row }) => (!query.from || row.scheduledDate >= query.from) && (!query.to || row.scheduledDate <= query.to),
      )
      .sort((a, b) => {
        const lateA = a.timing.overdueDays > 0 || a.timing.reviewOverdue ? 0 : 1;
        const lateB = b.timing.overdueDays > 0 || b.timing.reviewOverdue ? 0 : 1;
        return (
          lateA - lateB ||
          a.row.scheduledDate.localeCompare(b.row.scheduledDate) ||
          a.row.code.localeCompare(b.row.code)
        );
      })
      .slice(0, LIST_LIMIT);
    const planIds = [...new Set(picked.map(({ row }) => row.planId))];
    const itemIds = [...new Set(picked.map(({ row }) => row.itemId))];
    const [plans, items] = await Promise.all([
      planIds.length ? this.dataSource.getRepository(MaintenancePlan).findBy({ id: In(planIds) }) : [],
      itemIds.length ? this.dataSource.getRepository(MaintenanceItem).findBy({ id: In(itemIds) }) : [],
    ]);
    const rows = picked.flatMap(({ row, timing }): OccurrenceRow[] => {
      const plan = plans.find((candidate) => candidate.id === row.planId);
      const item = items.find((candidate) => candidate.id === row.itemId);
      if (!plan || !item) return [];
      return [
        {
          id: row.id,
          code: row.code,
          status: row.status,
          scheduledDate: row.scheduledDate,
          reviewDueAt: row.reviewDueAt,
          isMakeup: row.isMakeup,
          performerUserId: row.performerUserId,
          reviewerUserId: row.reviewerUserId,
          buildingId: row.buildingId,
          plan: { id: plan.id, code: plan.code, name: plan.name },
          item: { id: item.id, code: item.code, name: item.name, locationId: item.locationId },
          version: row.version,
          ...timing,
        },
      ];
    });
    return { rows, counts };
  }
}
