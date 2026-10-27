import type { EntityManager } from 'typeorm';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { vnDate } from '../../common/utils/vn-date';
import { FieldErrors } from '../../common/validation/field-errors';
import { Location } from '../buildings/entities/location.entity';
import { isActiveUserInRole, loadAssignmentContext } from '../records/record-assignment';
import type { MaintenanceItemFieldsDto } from './dto/maintenance-item.dto';
import { MaintenanceItem } from './entities/maintenance-item.entity';

export const DUPLICATE_CODE = 'Mã thiết bị đã có trong tòa này.';
const CODE_PATTERN = /^[A-Z0-9-]{2,30}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const REASON_MIN = 5;
const REASON_MAX = 1000;

/** Fields stored from a create or edit request, after validation. */
export type ItemFields = Pick<
  MaintenanceItem,
  | 'name'
  | 'type'
  | 'locationId'
  | 'ownerUserId'
  | 'model'
  | 'supplier'
  | 'installDate'
  | 'warrantyUntil'
  | 'description'
>;

const isValidDate = (value: string): boolean =>
  ISO_DATE.test(value) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

const lengthBetween = (errors: FieldErrors, field: string, label: string, value: string, min: number, max: number) => {
  if (value.length < min) errors.add(field, `${label} cần tối thiểu ${min} ký tự.`);
  else if (value.length > max) errors.add(field, `${label} tối đa ${max} ký tự.`);
};

const optionalMax = (
  errors: FieldErrors,
  field: string,
  label: string,
  value: string | null | undefined,
  max: number,
) => errors.when((value ?? '').length > max, field, `${label} tối đa ${max} ký tự.`);

/** BR-MT-01 code format; uniqueness is checked against the building by `assertUniqueCode`. */
export const validateCode = (errors: FieldErrors, code: string): void => {
  errors.when(!CODE_PATTERN.test(code), 'code', 'Mã gồm 2–30 ký tự viết hoa: chữ, số và dấu "-".');
};

export const assertUniqueCode = async (
  manager: EntityManager,
  errors: FieldErrors,
  buildingId: string,
  code: string,
): Promise<void> => {
  const taken = await manager.getRepository(MaintenanceItem).existsBy({ buildingId, code });
  errors.when(taken, 'code', DUPLICATE_CODE);
};

/** Reason or note of a state change (BR-MT-03, BR-MT-04). */
export const validateReason = (errors: FieldErrors, field: string, label: string, value: string): void =>
  lengthBetween(errors, field, label, value.trim(), REASON_MIN, REASON_MAX);

/**
 * BR-MT-01 fields of an item of `buildingId`: location in the building and in the caller's location scope, owner an
 * active BQL of that building and location, optional texts bounded, install date not after today and warranty not
 * before the install date.
 */
export const validateItemFields = async (
  manager: EntityManager,
  actor: AuthenticatedUser,
  errors: FieldErrors,
  buildingId: string,
  dto: MaintenanceItemFieldsDto,
): Promise<ItemFields> => {
  lengthBetween(errors, 'name', 'Tên thiết bị', dto.name, 3, 120);
  lengthBetween(errors, 'type', 'Loại', dto.type, 2, 60);
  const location = await manager.getRepository(Location).findOneBy({ id: dto.locationId });
  errors.when(!location || location.buildingId !== buildingId, 'locationId', 'Vị trí phải thuộc cùng tòa nhà.');
  errors.when(
    Boolean(location) && actor.locationIds.length > 0 && !actor.locationIds.includes(dto.locationId),
    'locationId',
    'Vị trí ngoài phạm vi khu vực của bạn.',
  );
  const assignment = await loadAssignmentContext(manager, buildingId);
  errors.when(
    !isActiveUserInRole(assignment, dto.ownerUserId, 'BQL', buildingId, location ? dto.locationId : null),
    'ownerUserId',
    'Người phụ trách phải là BQL cùng tòa, đúng khu vực và còn hoạt động.',
  );
  optionalMax(errors, 'model', 'Model', dto.model, 120);
  optionalMax(errors, 'supplier', 'Nhà cung cấp', dto.supplier, 120);
  optionalMax(errors, 'description', 'Thông tin kỹ thuật', dto.description, 2000);
  const installDate = dto.installDate ?? null;
  const warrantyUntil = dto.warrantyUntil ?? null;
  if (installDate && !isValidDate(installDate)) errors.add('installDate', 'Ngày lắp đặt không hợp lệ.');
  else
    errors.when(
      Boolean(installDate) && (installDate ?? '') > vnDate(new Date()),
      'installDate',
      'Ngày lắp đặt không được sau hôm nay.',
    );
  if (warrantyUntil && !isValidDate(warrantyUntil)) errors.add('warrantyUntil', 'Ngày bảo hành không hợp lệ.');
  else {
    errors.when(
      Boolean(installDate && warrantyUntil) && (warrantyUntil ?? '') < (installDate ?? ''),
      'warrantyUntil',
      'Bảo hành đến không được trước ngày lắp đặt.',
    );
  }
  return {
    name: dto.name,
    type: dto.type,
    locationId: dto.locationId,
    ownerUserId: dto.ownerUserId,
    model: dto.model ?? null,
    supplier: dto.supplier ?? null,
    installDate,
    warrantyUntil,
    description: dto.description ?? null,
  };
};
