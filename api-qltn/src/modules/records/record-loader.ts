import type { EntityManager } from 'typeorm';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { assertVersion, notFound } from '../../common/errors';
import type { FieldErrors } from '../../common/validation/field-errors';
import { RepairRecord } from './entities/repair-record.entity';
import { assertRecordAction, type RecordAction } from './record-actions';

/**
 * Locks the record, hides records outside the caller's buildings or location scope (404), enforces the
 * version then the shared action rules.
 */
export const loadRecordForAction = async (
  manager: EntityManager,
  actor: AuthenticatedUser,
  id: string,
  version: number,
  action: RecordAction,
): Promise<RepairRecord> => {
  const record = await manager
    .getRepository(RepairRecord)
    .findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
  if (!record || !actor.buildingIds.includes(record.buildingId)) throw notFound('Không tìm thấy hồ sơ.');
  const outsideLocations =
    Boolean(record.locationId) && actor.locationIds.length > 0 && !actor.locationIds.includes(record.locationId ?? '');
  if (outsideLocations) throw notFound('Không tìm thấy hồ sơ.');
  assertVersion(record.version, version);
  assertRecordAction(actor, record, action);
  return record;
};

/** Trimmed length between `min` and `max`, with the screen's wording. */
export const validateText = (
  errors: FieldErrors,
  field: string,
  label: string,
  value: string | null | undefined,
  min: number,
  max: number,
): void => {
  const text = (value ?? '').trim();
  if (text.length < min) errors.add(field, `${label} cần tối thiểu ${min} ký tự.`);
  else if (text.length > max) errors.add(field, `${label} tối đa ${max} ký tự.`);
};
