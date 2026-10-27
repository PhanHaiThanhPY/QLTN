import { randomUUID } from 'crypto';
import { EntityManager, In, Not } from 'typeorm';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import type { CodeCounterService } from '../../common/services/code-counter.service';
import { vnDate } from '../../common/utils/vn-date';
import type { WorkEntry } from '../../domain/maintenance-execution';
import { addDays, periodsBetween } from '../../domain/maintenance-schedule';
import { effectiveCapabilities, isRole } from '../../domain/permissions';
import type { FileStorage } from '../../modules/attachments/file-storage';
import { Attachment } from '../../modules/attachments/entities/attachment.entity';
import { SUBJECT_TYPE } from '../../modules/audit/entities/audit-event.entity';
import { MaintenanceItem } from '../../modules/maintenance/entities/maintenance-item.entity';
import {
  MaintenanceOccurrence,
  type OccurrenceStatus,
} from '../../modules/maintenance/entities/maintenance-occurrence.entity';
import { MaintenancePlan } from '../../modules/maintenance/entities/maintenance-plan.entity';
import { MaintenanceScheduleVersion } from '../../modules/maintenance/entities/maintenance-schedule-version.entity';
import { MaintenanceSubmission } from '../../modules/maintenance/entities/maintenance-submission.entity';
import type { RecordsService } from '../../modules/records/records.service';
import { User } from '../../modules/users/entities/user.entity';

/** A 1 × 1 PNG: a real image, so screens can show it. */
const SAMPLE_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
const DAY_MS = 24 * 60 * 60 * 1000;

interface Deps {
  codes: CodeCounterService;
  storage: FileStorage;
  records: RecordsService;
  now: Date;
}

/** Which demo plan shows which state (as web `mock/seed-maintenance.ts`); SCHEDULED ones come from the generator. */
const STATES: ReadonlyArray<{ itemCode: string; status: OccurrenceStatus; back: number }> = [
  { itemCode: 'TM-A01', status: 'IN_PROGRESS', back: 0 },
  { itemCode: 'TM-A01', status: 'CANCELLED', back: 1 },
  { itemCode: 'BOM-A01', status: 'COMPLETED', back: 0 },
  { itemCode: 'MPD-A01', status: 'PENDING_REVIEW', back: 0 },
  { itemCode: 'BC-A01', status: 'REWORK', back: 0 },
] as const;

const decisionOf = (status: OccurrenceStatus): 'CONFIRMED' | 'REWORK' | null => {
  if (status === 'COMPLETED') return 'CONFIRMED';
  if (status === 'REWORK') return 'REWORK';
  return null;
};

const actorOf = (user: User): AuthenticatedUser => {
  const role = isRole(user.role) ? user.role : 'BQL';
  return {
    id: user.id,
    code: user.code,
    username: user.username,
    fullName: user.fullName,
    role,
    capabilities: effectiveCapabilities(role, null),
    buildingIds: (user.buildings ?? []).map((building) => building.id),
    locationIds: (user.locations ?? []).map((location) => location.id),
    departmentId: user.departmentId ?? null,
  };
};

/**
 * SPEC MT-S3 BR-MT3-12: past occurrences of the demo plans in every state — one overdue in progress, one cancelled,
 * one completed whose failed item has a repair record, one pending review, one sent back. Added once (skipped when a
 * demo plan already has a submission or a started occurrence); never in production (the caller guards it).
 */
export const ensureMaintenanceExecutionDemo = async (manager: EntityManager, deps: Deps): Promise<number> => {
  const plans = await manager
    .getRepository(MaintenancePlan)
    .findBy({ name: In(STATES.map((row) => `Bảo trì định kỳ ${row.itemCode}`)) });
  if (plans.length === 0) return 0;
  const started = await manager.getRepository(MaintenanceOccurrence).exists({
    where: { planId: In(plans.map((plan) => plan.id)), status: Not(In(['SCHEDULED'])) },
  });
  if (started) return 0;
  const today = vnDate(deps.now);
  let created = 0;
  for (const state of STATES) {
    const plan = plans.find((row) => row.name === `Bảo trì định kỳ ${state.itemCode}`);
    if (!plan) continue;
    const [item, versions, performer, reviewer] = await Promise.all([
      manager.getRepository(MaintenanceItem).findOneByOrFail({ id: plan.itemId }),
      manager.getRepository(MaintenanceScheduleVersion).findBy({ planId: plan.id }),
      manager
        .getRepository(User)
        .findOneOrFail({ where: { id: plan.performerUserId }, relations: { buildings: true, locations: true } }),
      manager.getRepository(User).findOneByOrFail({ id: plan.reviewerUserId }),
    ]);
    const past = periodsBetween(versions, addDays(today, -400), addDays(today, -1)).reverse();
    const date = past[state.back];
    if (!date) continue;
    const occurrence = await manager.getRepository(MaintenanceOccurrence).save(
      manager.getRepository(MaintenanceOccurrence).create({
        code: await deps.codes.next(manager, 'BT', 4),
        planId: plan.id,
        itemId: plan.itemId,
        buildingId: plan.buildingId,
        scheduledDate: date,
        periodDate: date,
        periodKey: date,
        status: 'SCHEDULED',
        performerUserId: plan.performerUserId,
        reviewerUserId: plan.reviewerUserId,
        contractorName: plan.contractorName,
        checklist: plan.checklist,
        version: 1,
      }),
    );
    const photo = async (name: string): Promise<string> => {
      const key = randomUUID();
      await deps.storage.save(key, SAMPLE_PNG);
      const saved = await manager.getRepository(Attachment).save(
        manager.getRepository(Attachment).create({
          subjectType: SUBJECT_TYPE.MAINTENANCE_OCCURRENCE,
          subjectId: occurrence.id,
          buildingId: plan.buildingId,
          purpose: 'MAINTENANCE_RESULT',
          fileName: name,
          mimeType: 'image/png',
          sizeBytes: SAMPLE_PNG.length,
          contentRef: key,
          uploadedBy: performer.id,
        }),
      );
      return saved.id;
    };
    const startedAt = new Date(`${date}T08:30:00+07:00`);
    const failItem = plan.checklist.at(-1);
    const entries: WorkEntry[] = [];
    for (const row of plan.checklist) {
      const failed = state.status !== 'IN_PROGRESS' && row.id === failItem?.id;
      entries.push({
        itemId: row.id,
        result: failed ? 'FAIL' : 'PASS',
        value: null,
        note: failed ? `${row.label}: phát hiện bất thường, cần theo dõi.` : null,
        attachmentIds: failed ? [await photo(`${item.code} ${row.label}.png`)] : [],
      });
    }
    const general = state.status === 'IN_PROGRESS' ? [] : [await photo(`${item.code} tổng quan.png`)];
    occurrence.work = {
      entries,
      summary: state.status === 'IN_PROGRESS' ? null : 'Đã kiểm tra theo danh mục.',
      actualWorker: null,
      attachmentIds: general,
    };
    occurrence.startedAt = state.status === 'CANCELLED' ? null : startedAt;
    if (state.status === 'IN_PROGRESS') occurrence.status = 'IN_PROGRESS';
    if (state.status === 'CANCELLED') {
      Object.assign(occurrence, {
        status: 'CANCELLED',
        cancelReason: 'Thiết bị ngừng để thay phụ tùng.',
        cancelledAt: startedAt,
        work: { entries: [], summary: null, actualWorker: null, attachmentIds: [] },
      });
    } else if (state.status !== 'IN_PROGRESS') {
      const submittedAt = new Date(startedAt.getTime() + 3 * 60 * 60 * 1000);
      const reviewDueAt = new Date(submittedAt.getTime() + 2 * DAY_MS);
      const decision = decisionOf(state.status);
      const rework =
        state.status === 'REWORK' && failItem
          ? { [failItem.id]: 'Ảnh chưa rõ chỗ bất thường, chụp lại cận cảnh.' }
          : {};
      await manager.getRepository(MaintenanceSubmission).insert({
        occurrenceId: occurrence.id,
        round: 1,
        entries,
        summary: 'Đã kiểm tra theo danh mục.',
        contractorName: plan.contractorName,
        actualWorker: null,
        attachmentIds: general,
        submittedBy: performer.id,
        submittedAt,
        reviewDueAt,
        decision,
        decisionReason: state.status === 'REWORK' ? 'Bổ sung ảnh rõ hơn.' : null,
        reworkItems: rework,
        resolutions: {},
        decidedBy: decision ? reviewer.id : null,
        decidedAt: decision ? new Date(submittedAt.getTime() + DAY_MS) : null,
      });
      Object.assign(occurrence, {
        status: state.status,
        round: 1,
        submittedAt,
        reviewDueAt: state.status === 'PENDING_REVIEW' ? reviewDueAt : null,
        completedAt: state.status === 'COMPLETED' ? new Date(submittedAt.getTime() + DAY_MS) : null,
        rework,
      });
    }
    await manager.getRepository(MaintenanceOccurrence).save(occurrence);
    if (state.status === 'COMPLETED' && failItem) {
      const failed = entries.find((row) => row.itemId === failItem.id);
      await deps.records.createDraft(
        manager,
        actorOf(performer),
        {
          buildingId: plan.buildingId,
          locationId: item.locationId,
          maintenanceItemId: item.id,
          noMaintenanceItem: false,
          title: `${item.code}: ${failItem.label}`,
          description: failed?.note ?? '',
          priority: 'NORMAL',
        },
        {
          sourceOccurrenceId: occurrence.id,
          sourceChecklistItemId: failItem.id,
          auditReason: `Từ lượt bảo trì ${occurrence.code} · mục ${failItem.label}`,
          sitePhotos: async (tx, record) => {
            const files = await tx.getRepository(Attachment).findBy({ id: In(failed?.attachmentIds ?? []) });
            const copies = await tx.getRepository(Attachment).save(
              files.map((file) =>
                tx.getRepository(Attachment).create({
                  ...file,
                  id: undefined,
                  subjectType: SUBJECT_TYPE.REPAIR_RECORD,
                  subjectId: record.id,
                  purpose: 'SITE_PHOTO',
                }),
              ),
            );
            return copies.map((copy) => copy.id);
          },
        },
      );
    }
    created += 1;
  }
  return created;
};
