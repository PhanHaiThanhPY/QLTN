import { ITEM_CONDITION, LIMITS } from '@/domain/constants';
import type { ItemCondition } from '@/domain/constants';
import { assertNoFieldErrors, forbidden, invalidTransition, notFound } from '@/domain/errors';
import { canAccessLocation, hasCapability } from '@/domain/permissions';
import type { MaintenanceItem } from '@/domain/types';
import { FieldErrorCollector, asOptionalString, asRecord, asString, asStringArray } from '@/domain/validation';
import type { Command, CommandHandler } from '../command-engine';
import { assertBuildingScope, assertLocationScope, assertScopeAndVersion } from '../command-context';
import type { CommandContext } from '../command-context';
import { newId } from '../runtime';
import { commitSimple } from './maintenance-helpers';
import { assertOwnAttachments, isActiveUserInRole } from './repair-helpers';

export const isItemCondition = (value: unknown): value is ItemCondition =>
  typeof value === 'string' && (Object.values(ITEM_CONDITION) as string[]).includes(value);

const requireManage = (ctx: CommandContext): void => {
  if (!hasCapability(ctx.actor, 'MAINTENANCE_MANAGE')) throw forbidden('Chỉ BQL được quản lý hạng mục bảo trì.');
};

const loadItem = async (ctx: CommandContext, command: Command): Promise<MaintenanceItem> => {
  const item = command.subjectId ? await ctx.db.maintenanceItems.get(command.subjectId) : undefined;
  assertScopeAndVersion(ctx, item, command.expectedVersion);
  const current = item as MaintenanceItem;
  assertLocationScope(ctx, current.buildingId, current.locationId);
  return current;
};

type EditableItemFields = Pick<
  MaintenanceItem,
  'code' | 'name' | 'type' | 'locationId' | 'description' | 'ownerUserId' | 'model' | 'supplier' | 'installDate' | 'warrantyUntil'
>;

/** Optional date field: empty = not set, otherwise must be a valid YYYY-MM-DD. */
const optionalDate = (errors: FieldErrorCollector, field: string, value: unknown, label: string): string | undefined => {
  const text = asOptionalString(value);
  if (text) errors.date(field, text, label);
  return text;
};

/** Validates editable item fields; code must be unique inside the building (spec 6.4). */
const validateFields = async (
  ctx: CommandContext,
  buildingId: string,
  payload: Record<string, unknown>,
  currentId?: string,
): Promise<EditableItemFields> => {
  const code = asString(payload.code).toUpperCase();
  const errors = new FieldErrorCollector()
    .text('code', 'Mã hạng mục', code, 2, 30)
    .title('name', 'Tên hạng mục', payload.name)
    .text('type', 'Loại', payload.type, 2, 60);
  const location = await ctx.db.locations.get(asString(payload.locationId));
  errors.when(location?.buildingId !== buildingId, 'locationId', 'Vị trí phải thuộc cùng tòa nhà.');
  errors.when(Boolean(location) && !canAccessLocation(ctx.actor, buildingId, location?.id), 'locationId', 'Vị trí ngoài phạm vi khu vực của bạn.');
  errors.when(!isActiveUserInRole(ctx, asString(payload.ownerUserId), 'BQL', buildingId, location?.id), 'ownerUserId', 'Đầu mối phải là BQL cùng tòa, đúng khu vực và còn hoạt động.');
  const duplicate = await ctx.db.maintenanceItems
    .where('buildingId')
    .equals(buildingId)
    .filter((row) => row.code === code && row.id !== currentId)
    .count();
  errors.when(duplicate > 0, 'code', 'Mã hạng mục đã tồn tại trong tòa nhà.');
  const model = asOptionalString(payload.model);
  const supplier = asOptionalString(payload.supplier);
  errors.when((model ?? '').length > LIMITS.MODEL_MAX, 'model', `Model tối đa ${LIMITS.MODEL_MAX} ký tự.`);
  errors.when((supplier ?? '').length > LIMITS.SUPPLIER_MAX, 'supplier', `Nhà cung cấp tối đa ${LIMITS.SUPPLIER_MAX} ký tự.`);
  const installDate = optionalDate(errors, 'installDate', payload.installDate, 'Ngày lắp/thay');
  const warrantyUntil = optionalDate(errors, 'warrantyUntil', payload.warrantyUntil, 'Hạn bảo hành');
  errors.when(
    errors.isEmpty && Boolean(installDate && warrantyUntil) && (warrantyUntil as string) < (installDate as string),
    'warrantyUntil',
    'Hạn bảo hành không được trước ngày lắp/thay.',
  );
  assertNoFieldErrors(errors.errors);
  return {
    code,
    name: asString(payload.name),
    type: asString(payload.type),
    locationId: asString(payload.locationId),
    description: asOptionalString(payload.description),
    ownerUserId: asString(payload.ownerUserId),
    model,
    supplier,
    installDate,
    warrantyUntil,
  };
};

const createMaintenanceItem: CommandHandler = async (ctx, command) => {
  const payload = asRecord(command.payload);
  const buildingId = asString(payload.buildingId);
  assertBuildingScope(ctx, buildingId);
  requireManage(ctx);
  const fields = await validateFields(ctx, buildingId, payload);
  const item: MaintenanceItem = {
    id: newId('itm'),
    buildingId,
    ...fields,
    documentIds: [],
    condition: 'UNKNOWN',
    active: true,
    version: 1,
    createdAt: ctx.now,
    updatedAt: ctx.now,
  };
  await commitSimple(ctx, 'MAINTENANCE_ITEM', null, item, 'createMaintenanceItem');
  return { ok: true, subjectId: item.id };
};

const updateMaintenanceItem: CommandHandler = async (ctx, command) => {
  const item = await loadItem(ctx, command);
  requireManage(ctx);
  if (!item.active) throw invalidTransition('Hạng mục đã vô hiệu hóa, không thể sửa.');
  // MD-06 / MT-S1 BR-MT-06: a code in the payload is ignored, the item keeps its own.
  const fields = await validateFields(ctx, item.buildingId, { ...asRecord(command.payload), code: item.code }, item.id);
  await commitSimple(ctx, 'MAINTENANCE_ITEM', item, { ...item, ...fields }, 'updateMaintenanceItem');
  return { ok: true, subjectId: item.id };
};

const deactivateMaintenanceItem: CommandHandler = async (ctx, command) => {
  const item = await loadItem(ctx, command);
  requireManage(ctx);
  if (!item.active) throw invalidTransition('Hạng mục đã vô hiệu hóa.');
  const reason = asString(asRecord(command.payload).reason);
  const activePlans = await ctx.db.maintenancePlans
    .where('itemId')
    .equals(item.id)
    .filter((plan) => plan.status === 'ACTIVE')
    .count();
  const errors = new FieldErrorCollector()
    .reason('reason', reason)
    .when(activePlans > 0, 'plans', 'Cần tạm dừng các kế hoạch đang hoạt động của hạng mục trước khi vô hiệu hóa.');
  assertNoFieldErrors(errors.errors);
  await commitSimple(ctx, 'MAINTENANCE_ITEM', item, { ...item, active: false }, 'deactivateMaintenanceItem', reason);
  return { ok: true, subjectId: item.id };
};

/** Replaces the item's document list (ITEM_DOCUMENT files already uploaded to this item). */
const setItemDocuments: CommandHandler = async (ctx, command) => {
  const item = await loadItem(ctx, command);
  requireManage(ctx);
  if (!item.active) throw invalidTransition('Hạng mục đã vô hiệu hóa, không thể sửa.');
  const documentIds = await assertOwnAttachments(
    ctx,
    asStringArray(asRecord(command.payload).documentIds),
    'MAINTENANCE_ITEM',
    item.id,
    'documentIds',
    ['ITEM_DOCUMENT'],
  );
  await commitSimple(ctx, 'MAINTENANCE_ITEM', item, { ...item, documentIds }, 'setItemDocuments');
  return { ok: true, subjectId: item.id };
};

/** Shared by updateItemCondition and confirmMaintenance; always requires a note and audit. */
export const applyItemCondition = async (
  ctx: CommandContext,
  itemId: string,
  condition: ItemCondition,
  note: string,
  action: string,
): Promise<void> => {
  const item = await ctx.db.maintenanceItems.get(itemId);
  if (!item) throw notFound('Không tìm thấy hạng mục.');
  await commitSimple(ctx, 'MAINTENANCE_ITEM', item, { ...item, condition, conditionNote: note }, action, note);
};

const updateItemCondition: CommandHandler = async (ctx, command) => {
  const item = await loadItem(ctx, command);
  if (!hasCapability(ctx.actor, 'ITEM_CONDITION')) throw forbidden('Vai trò của bạn không cập nhật được tình trạng hạng mục.');
  const payload = asRecord(command.payload);
  const note = asString(payload.note);
  const errors = new FieldErrorCollector().reason('note', note, 'Ghi chú tình trạng');
  errors.when(!isItemCondition(payload.condition), 'condition', 'Tình trạng không hợp lệ.');
  assertNoFieldErrors(errors.errors);
  await commitSimple(
    ctx,
    'MAINTENANCE_ITEM',
    item,
    { ...item, condition: payload.condition as ItemCondition, conditionNote: note },
    'updateItemCondition',
    note,
  );
  return { ok: true, subjectId: item.id };
};

export const maintenanceItemHandlers: Record<string, CommandHandler> = {
  createMaintenanceItem,
  updateMaintenanceItem,
  deactivateMaintenanceItem,
  updateItemCondition,
  setItemDocuments,
};
