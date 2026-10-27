import type { SelectQueryBuilder } from 'typeorm';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import type { RepairRecord } from './entities/repair-record.entity';
import { statusesOfGroup, type RecordStatusGroup } from './record-status-groups';

/** Placeholder scope for an account without buildings, so `IN (:...scope)` stays valid SQL. */
export const NO_BUILDING = '00000000-0000-0000-0000-000000000000';

export interface RecordScopeFilters {
  buildingId?: string;
  locationId?: string;
  statusGroup?: RecordStatusGroup;
}

/** A `buildingId` outside the caller's buildings answers an empty list, never a 404 (no existence leak). */
export const isOutOfScope = (actor: AuthenticatedUser, buildingId: string | undefined): boolean =>
  Boolean(buildingId && !actor.buildingIds.includes(buildingId));

/**
 * Building scope plus the building, location and status-group filters of `GET /records` on alias `r`. The record
 * list and the construction schedule share it so the same filters select the same records (B4-S1 BR-B4-03).
 */
export const applyRecordScope = (
  qb: SelectQueryBuilder<RepairRecord>,
  actor: AuthenticatedUser,
  filters: RecordScopeFilters,
): SelectQueryBuilder<RepairRecord> => {
  qb.andWhere(
    filters.buildingId ? 'r.building_id = :buildingId' : 'r.building_id IN (:...scope)',
    filters.buildingId
      ? { buildingId: filters.buildingId }
      : { scope: actor.buildingIds.length > 0 ? actor.buildingIds : [NO_BUILDING] },
  );
  if (filters.statusGroup) {
    qb.andWhere('r.status IN (:...statuses)', { statuses: statusesOfGroup(filters.statusGroup) });
  }
  if (filters.locationId) qb.andWhere('r.location_id = :locationId', { locationId: filters.locationId });
  return qb;
};
