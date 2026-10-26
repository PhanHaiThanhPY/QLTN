import { z } from 'zod';
import { LIMITS, PRIORITY } from '@/domain/constants';
import { RECORD_ITEM_REQUIRED_MESSAGE } from '@/domain/record-item-link';
import { hasCapability } from '@/domain/permissions';
import type { RepairRecord, User } from '@/domain/types';

/** Select value standing for "Không thuộc thiết bị cụ thể" (payload `noMaintenanceItem: true`). */
export const NO_ITEM_VALUE = '__none__';

const trimmedLength = (min: number, max: number, label: string) =>
  z
    .string()
    .refine((value) => value.trim().length >= min, `${label} cần tối thiểu ${min} ký tự.`)
    .refine((value) => value.trim().length <= max, `${label} tối đa ${max} ký tự.`);

const maxLength = (max: number, label: string) => z.string().refine((value) => value.trim().length <= max, `${label} tối đa ${max} ký tự.`);

/** Draft rules: incomplete information can be saved and completed later (spec 5.4). */
export const recordDraftSchema = z.object({
  buildingId: z.string().min(1, 'Chọn tòa nhà.'),
  locationId: z.string(),
  maintenanceItemId: z.string(),
  title: maxLength(LIMITS.TITLE_MAX, 'Tên hồ sơ'),
  description: maxLength(LIMITS.DESCRIPTION_MAX, 'Mô tả'),
  priority: z.enum([PRIORITY.LOW, PRIORITY.NORMAL, PRIORITY.HIGH, PRIORITY.URGENT]),
  confirmationUserId: z.string(),
  consultantUserId: z.string(),
  boardUserId: z.string(),
});

/** Submit rules: all required fields must be complete before leaving DRAFT. */
export const recordSubmitSchema = recordDraftSchema.extend({
  locationId: z.string().min(1, 'Chọn vị trí.'),
  maintenanceItemId: z.string().min(1, RECORD_ITEM_REQUIRED_MESSAGE),
  title: trimmedLength(LIMITS.TITLE_MIN, LIMITS.TITLE_MAX, 'Tên hồ sơ'),
  description: z
    .string()
    .refine((value) => value.trim().length >= LIMITS.DESCRIPTION_MIN, `Mô tả hư hỏng cần tối thiểu ${LIMITS.DESCRIPTION_MIN} ký tự khi gửi.`)
    .refine((value) => value.trim().length <= LIMITS.DESCRIPTION_MAX, `Mô tả tối đa ${LIMITS.DESCRIPTION_MAX} ký tự.`),
  // Empty = "theo cấu hình tòa": the backend picks the INTAKE step's holder (RM-S2 BR-07).
  confirmationUserId: z.string(),
});

/** Backward-compatible name for consumers that only need the draft shape. */
export const recordFormSchema = recordDraftSchema;
export type RecordFormValues = z.infer<typeof recordDraftSchema>;

/** Assignee fields chosen on the form (manager = creator). */
export const ASSIGNEE_FIELDS = ['confirmationUserId'] as const;
export type AssigneeField = (typeof ASSIGNEE_FIELDS)[number];
export type RecordFormIntent = 'draft' | 'submit';

/** Active users of a building holding a role (candidate list for assignee selects). */
export const activeUsersInRole = (users: User[], role: User['role'], buildingId: string): User[] =>
  users.filter((user) => user.active && user.role === role && user.buildingIds.includes(buildingId));

/** Who may be chosen as confirmer: active users of the building who can confirm the site condition (KT, TVKT, BQT). */
export const activeConfirmersIn = (users: User[], buildingId: string): User[] =>
  users.filter((user) => user.buildingIds.includes(buildingId) && hasCapability(user, 'RECORD_CONFIRM'));

/** Equipment a new record is reported for (from the equipment page's "Báo sự cố"). */
export interface RecordItemPrefill {
  buildingId: string;
  locationId: string;
  maintenanceItemId: string;
}

export const defaultValuesFor = (
  record: RepairRecord | undefined,
  users: User[],
  defaultBuildingId: string,
  prefill?: RecordItemPrefill,
): RecordFormValues => {
  const buildingId = prefill?.buildingId ?? defaultBuildingId;
  const firstIn = (role: User['role']): string => activeUsersInRole(users, role, buildingId)[0]?.id ?? '';
  if (record) {
    return {
      buildingId: record.buildingId,
      locationId: record.locationId,
      maintenanceItemId: record.noMaintenanceItem ? NO_ITEM_VALUE : (record.maintenanceItemId ?? ''),
      title: record.title,
      description: record.description,
      priority: record.priority,
      confirmationUserId: record.confirmationUserId,
      consultantUserId: record.consultantUserId,
      boardUserId: record.boardUserId,
    };
  }
  return {
    buildingId,
    locationId: prefill?.locationId ?? '',
    maintenanceItemId: prefill?.maintenanceItemId ?? '',
    title: '',
    description: '',
    priority: 'NORMAL',
    confirmationUserId: '',
    consultantUserId: firstIn('TECH_CONSULTANT'),
    boardUserId: firstIn('OWNERS_BOARD'),
  };
};

/** Editable payload; assignees are only sent while the record is (or will be) a DRAFT. */
export const toRecordPayload = (values: RecordFormValues, includeAssignees: boolean): Record<string, unknown> => {
  const payload: Record<string, unknown> = {
    title: values.title.trim(),
    description: values.description.trim(),
    priority: values.priority,
    locationId: values.locationId,
    // The sentinel becomes the explicit "no item" flag; any other value replaces it.
    maintenanceItemId: values.maintenanceItemId === NO_ITEM_VALUE ? '' : values.maintenanceItemId,
    noMaintenanceItem: values.maintenanceItemId === NO_ITEM_VALUE,
  };
  if (includeAssignees) {
    // An empty choice is left out so the backend keeps the confirmer from the building configuration.
    for (const field of ASSIGNEE_FIELDS) if (values[field]) payload[field] = values[field];
  }
  return payload;
};
