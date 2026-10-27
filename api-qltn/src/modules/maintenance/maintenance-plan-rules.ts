import { randomUUID } from 'crypto';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import type { FieldErrors } from '../../common/validation/field-errors';
import { isActiveUserInRole, type AssignmentContext } from '../records/record-assignment';
import type { MaintenancePlanFieldsDto } from './dto/maintenance-plan.dto';
import type { MaintenanceItem } from './entities/maintenance-item.entity';
import type { ChecklistTemplateItem } from './entities/maintenance-plan.entity';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const CHECKLIST_MAX = 50;
export const REASON_MIN = 5;
const REASON_MAX = 1000;

export const isValidDate = (value: string | undefined | null): value is string =>
  Boolean(value && ISO_DATE.test(value) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value);

/** BR-MT2-01: every 1–8 weeks or 1–24 months. */
export const validateSchedule = (errors: FieldErrors, unit: 'WEEK' | 'MONTH', every: number, field = 'every'): void => {
  const max = unit === 'WEEK' ? 8 : 24;
  errors.when(
    !Number.isInteger(every) || every < 1 || every > max,
    field,
    `Chu kỳ ${unit === 'WEEK' ? 'tuần' : 'tháng'} từ 1 đến ${max}.`,
  );
};

/** A date that must be a valid day not before `min`. */
export const validateDateFrom = (
  errors: FieldErrors,
  field: string,
  value: string,
  min: string,
  message: string,
): void => {
  if (!isValidDate(value)) errors.add(field, 'Ngày không hợp lệ.');
  else errors.when(value < min, field, message);
};

export const validateReason = (errors: FieldErrors, field: string, value: string): void => {
  const text = value.trim();
  errors.when(text.length < REASON_MIN, field, `Lý do cần tối thiểu ${REASON_MIN} ký tự.`);
  errors.when(text.length > REASON_MAX, field, `Lý do tối đa ${REASON_MAX} ký tự.`);
};

/** BR-MT2-02 performer: an active KT or BQL holding the item's building and location. */
export const isValidPerformer = (ctx: AssignmentContext, userId: string, item: MaintenanceItem): boolean =>
  isActiveUserInRole(ctx, userId, 'TECH_CONFIRMER', item.buildingId, item.locationId) ||
  isActiveUserInRole(ctx, userId, 'BQL', item.buildingId, item.locationId);

/** BR-MT2-02 reviewer: an active KT of the item's building and location. */
export const isValidReviewer = (ctx: AssignmentContext, userId: string, item: MaintenanceItem): boolean =>
  isActiveUserInRole(ctx, userId, 'TECH_CONFIRMER', item.buildingId, item.locationId);

/** The item must be in use and in the caller's building and location scope. */
export const validateItem = (
  errors: FieldErrors,
  actor: AuthenticatedUser,
  item: MaintenanceItem | null,
): item is MaintenanceItem => {
  const inScope =
    Boolean(item) &&
    actor.buildingIds.includes(item?.buildingId ?? '') &&
    (actor.locationIds.length === 0 || actor.locationIds.includes(item?.locationId ?? ''));
  errors.when(!inScope, 'itemId', 'Thiết bị không tồn tại hoặc ngoài phạm vi của bạn.');
  errors.when(inScope && !item?.active, 'itemId', 'Thiết bị đã ngừng dùng.');
  return inScope && Boolean(item?.active);
};

const numberOrNull = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

/**
 * BR-MT2-03: 1–50 items with at least one required; each named 3–200 characters; a measurement needs a unit (≤ 30)
 * and min ≤ max when both are set. Errors name the item ("Mục 3: cần đơn vị") on `checklist`.
 */
export const normalizeChecklist = (errors: FieldErrors, rows: readonly unknown[]): ChecklistTemplateItem[] => {
  errors.when(
    rows.length === 0 || rows.length > CHECKLIST_MAX,
    'checklist',
    `Danh mục kiểm có từ 1 đến ${CHECKLIST_MAX} mục.`,
  );
  const items = rows.map((raw, index): ChecklistTemplateItem => {
    const row = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
    const label = typeof row.label === 'string' ? row.label.trim() : '';
    const kind = row.kind === 'MEASUREMENT' ? 'MEASUREMENT' : 'CHECK';
    const unit = typeof row.unit === 'string' && row.unit.trim() ? row.unit.trim() : null;
    const min = numberOrNull(row.min);
    const max = numberOrNull(row.max);
    const at = `Mục ${index + 1}`;
    errors.when(label.length < 3 || label.length > 200, 'checklist', `${at}: tên mục từ 3 đến 200 ký tự.`);
    errors.when(kind === 'MEASUREMENT' && !unit, 'checklist', `${at}: cần đơn vị.`);
    errors.when(Boolean(unit && unit.length > 30), 'checklist', `${at}: đơn vị tối đa 30 ký tự.`);
    errors.when(min !== null && max !== null && min > max, 'checklist', `${at}: ngưỡng tối thiểu phải ≤ tối đa.`);
    return {
      id: typeof row.id === 'string' && row.id ? row.id : randomUUID(),
      label,
      required: row.required === true,
      kind,
      unit: kind === 'MEASUREMENT' ? unit : null,
      min: kind === 'MEASUREMENT' ? min : null,
      max: kind === 'MEASUREMENT' ? max : null,
      photoRequired: row.photoRequired === true,
    };
  });
  errors.when(
    rows.length > 0 && !items.some((item) => item.required),
    'checklist',
    'Danh mục kiểm cần ít nhất 1 mục bắt buộc.',
  );
  return items;
};

/** Name, people, contractor and checklist of a plan (BR-MT2-01..03), against the item's building and location. */
export const validatePlanFields = (
  errors: FieldErrors,
  ctx: AssignmentContext,
  item: MaintenanceItem,
  dto: MaintenancePlanFieldsDto,
): Pick<MaintenancePlanFieldsDto, 'name' | 'performerUserId' | 'reviewerUserId'> & {
  contractorName: string | null;
  checklist: ChecklistTemplateItem[];
} => {
  const name = dto.name.trim();
  errors.when(name.length < 3 || name.length > 120, 'name', 'Tên kế hoạch từ 3 đến 120 ký tự.');
  errors.when(
    !isValidPerformer(ctx, dto.performerUserId, item),
    'performerUserId',
    'Người thực hiện phải là KT hoặc BQL đang hoạt động của vị trí thiết bị.',
  );
  errors.when(
    dto.reviewerUserId === dto.performerUserId,
    'reviewerUserId',
    'Người xác nhận phải khác người thực hiện.',
  );
  errors.when(
    dto.reviewerUserId !== dto.performerUserId && !isValidReviewer(ctx, dto.reviewerUserId, item),
    'reviewerUserId',
    'Người xác nhận phải là KT đang hoạt động của vị trí thiết bị.',
  );
  errors.when((dto.contractorName ?? '').length > 200, 'contractorName', 'Nhà thầu tối đa 200 ký tự.');
  return {
    name,
    performerUserId: dto.performerUserId,
    reviewerUserId: dto.reviewerUserId,
    contractorName: dto.contractorName ?? null,
    checklist: normalizeChecklist(errors, dto.checklist),
  };
};
