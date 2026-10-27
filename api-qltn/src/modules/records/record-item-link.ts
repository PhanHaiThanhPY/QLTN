import type { EntityManager } from 'typeorm';
import type { FieldErrors } from '../../common/validation/field-errors';
import { MaintenanceItem } from '../maintenance/entities/maintenance-item.entity';

export const ITEM_REQUIRED = 'Chọn thiết bị/hạng mục, hoặc chọn “Không thuộc thiết bị cụ thể”.';
const ITEM_INVALID = 'Thiết bị không tồn tại, đã ngừng dùng hoặc thuộc tòa nhà khác.';
const ITEM_OR_NONE = 'Chọn một thiết bị hoặc “Không thuộc thiết bị cụ thể”, không chọn cả hai.';

/** The equipment choice of a record: one item of its building, or "Không thuộc thiết bị cụ thể" (BR-MT-09). */
export interface ItemChoice {
  maintenanceItemId: string | null;
  noMaintenanceItem: boolean;
  /** Location of the chosen item, used when the record has none yet (as the demo form does). */
  itemLocationId: string | null;
}

export interface ItemChoiceInput {
  maintenanceItemId?: string | null;
  noMaintenanceItem?: boolean;
}

/**
 * Applies an optional choice to the current one. A new item must exist, belong to the record's building and be in use;
 * the item already on the record stays acceptable after a deactivation, so an unrelated draft save never fails on it.
 */
export const resolveItemChoice = async (
  manager: EntityManager,
  errors: FieldErrors,
  buildingId: string,
  current: Pick<ItemChoice, 'maintenanceItemId' | 'noMaintenanceItem'>,
  input: ItemChoiceInput,
): Promise<ItemChoice> => {
  const choosesItem = typeof input.maintenanceItemId === 'string';
  errors.when(choosesItem && input.noMaintenanceItem === true, 'maintenanceItemId', ITEM_OR_NONE);
  if (choosesItem) {
    const id = input.maintenanceItemId as string;
    const item = await manager.getRepository(MaintenanceItem).findOneBy({ id });
    const usable = Boolean(item && item.buildingId === buildingId && (item.active || id === current.maintenanceItemId));
    errors.when(!usable, 'maintenanceItemId', ITEM_INVALID);
    return { maintenanceItemId: id, noMaintenanceItem: false, itemLocationId: item?.locationId ?? null };
  }
  const clearsItem = input.maintenanceItemId === null || input.noMaintenanceItem === true;
  return {
    maintenanceItemId: clearsItem ? null : current.maintenanceItemId,
    noMaintenanceItem: input.noMaintenanceItem ?? (clearsItem ? false : current.noMaintenanceItem),
    itemLocationId: null,
  };
};

/** T02: one of the two must be chosen, and a chosen item must still be in use. */
export const validateItemOnSubmit = async (
  manager: EntityManager,
  errors: FieldErrors,
  record: { maintenanceItemId: string | null; noMaintenanceItem: boolean },
): Promise<void> => {
  if (!record.maintenanceItemId) {
    errors.when(record.noMaintenanceItem !== true, 'maintenanceItemId', ITEM_REQUIRED);
    return;
  }
  const item = await manager.getRepository(MaintenanceItem).findOneBy({ id: record.maintenanceItemId });
  errors.when(!item?.active, 'maintenanceItemId', ITEM_INVALID);
};

/** Short item line of the record detail ("BOM-A01 · Bơm nước sinh hoạt" with a link, BR-MT-10). */
export interface RecordItemSummary {
  id: string;
  code: string;
  name: string;
  active: boolean;
}

export const recordItemSummary = async (
  manager: EntityManager,
  maintenanceItemId: string | null,
): Promise<RecordItemSummary | null> => {
  if (!maintenanceItemId) return null;
  const item = await manager.getRepository(MaintenanceItem).findOneBy({ id: maintenanceItemId });
  return item ? { id: item.id, code: item.code, name: item.name, active: item.active } : null;
};
