import type { EntityManager } from 'typeorm';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { hasCapability } from '../../common/auth/scope';
import { assertVersion, conflictWithReason, forbidden, notFound } from '../../common/errors';
import { MaintenanceItem } from './entities/maintenance-item.entity';
import { MaintenanceOccurrence, type OccurrenceStatus } from './entities/maintenance-occurrence.entity';
import { MaintenancePlan } from './entities/maintenance-plan.entity';

export const OCCURRENCE_NOT_FOUND = 'Không tìm thấy lượt bảo trì.';

/** BR-MT3-01 slots: who acts on each step. */
export type OccurrenceSlot = 'PERFORMER' | 'REVIEWER' | 'MANAGER';

export interface LockedOccurrence {
  occurrence: MaintenanceOccurrence;
  plan: MaintenancePlan;
  item: MaintenanceItem;
}

const STATUS_TEXT: Readonly<Record<OccurrenceStatus, string>> = {
  SCHEDULED: 'Đã lên lịch',
  IN_PROGRESS: 'Đang làm',
  PENDING_REVIEW: 'Chờ xác nhận',
  REWORK: 'Làm lại',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã hủy',
} as const;

const inItemPlace = (actor: AuthenticatedUser, item: MaintenanceItem): boolean =>
  actor.locationIds.length === 0 || actor.locationIds.includes(item.locationId);

/**
 * BR-MT3-13: locks the occurrence; out of the building 404; then only the slot's person (in the item's location, with
 * the slot's capability) may act, 403 otherwise; a stale version 409; a wrong status 409 naming the allowed ones.
 */
export const lockOccurrenceFor = async (
  manager: EntityManager,
  actor: AuthenticatedUser,
  id: string,
  version: number,
  slot: OccurrenceSlot,
  statuses: readonly OccurrenceStatus[],
): Promise<LockedOccurrence> => {
  const occurrence = await manager
    .getRepository(MaintenanceOccurrence)
    .findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
  if (!occurrence || !actor.buildingIds.includes(occurrence.buildingId)) throw notFound(OCCURRENCE_NOT_FOUND);
  const [plan, item] = await Promise.all([
    manager.getRepository(MaintenancePlan).findOneByOrFail({ id: occurrence.planId }),
    manager.getRepository(MaintenanceItem).findOneByOrFail({ id: occurrence.itemId }),
  ]);
  const allowed = {
    PERFORMER: occurrence.performerUserId === actor.id,
    REVIEWER: occurrence.reviewerUserId === actor.id && hasCapability(actor, 'MAINTENANCE_REVIEW'),
    MANAGER: plan.managerUserId === actor.id && hasCapability(actor, 'MAINTENANCE_MANAGE'),
  }[slot];
  if (!allowed || !inItemPlace(actor, item)) throw forbidden(SLOT_DENIED[slot]);
  assertVersion(occurrence.version, version);
  if (!statuses.includes(occurrence.status as OccurrenceStatus)) {
    throw conflictWithReason(
      'occurrence_status',
      `Lượt đang ở "${STATUS_TEXT[occurrence.status as OccurrenceStatus] ?? occurrence.status}"; thao tác này cần: ${statuses.map((row) => STATUS_TEXT[row]).join(', ')}.`,
    );
  }
  return { occurrence, plan, item };
};

const SLOT_DENIED: Readonly<Record<OccurrenceSlot, string>> = {
  PERFORMER: 'Chỉ người thực hiện của lượt làm được thao tác này.',
  REVIEWER: 'Chỉ người xác nhận của lượt làm được thao tác này.',
  MANAGER: 'Chỉ BQL quản lý kế hoạch làm được thao tác này.',
} as const;
