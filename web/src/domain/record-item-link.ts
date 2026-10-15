import type { RepairRecord } from './types';

/**
 * How a repair record relates to equipment (customer decision: "thiết bị hoặc hạng mục" is mandatory when
 * reporting an incident). LINKED = an item is set, NONE = explicitly "Không thuộc thiết bị cụ thể"
 * (structural repairs: walls, ceilings…), UNLINKED = not decided yet (only allowed while drafting).
 */
export const RECORD_ITEM_LINK = {
  LINKED: 'LINKED',
  NONE: 'NONE',
  UNLINKED: 'UNLINKED',
} as const;
export type RecordItemLink = (typeof RECORD_ITEM_LINK)[keyof typeof RECORD_ITEM_LINK];

export const RECORD_ITEM_REQUIRED_MESSAGE = 'Chọn thiết bị/hạng mục, hoặc chọn “Không thuộc thiết bị cụ thể”.';

export const recordItemLink = (record: Pick<RepairRecord, 'maintenanceItemId' | 'noMaintenanceItem'>): RecordItemLink => {
  if (record.maintenanceItemId) return RECORD_ITEM_LINK.LINKED;
  if (record.noMaintenanceItem === true) return RECORD_ITEM_LINK.NONE;
  return RECORD_ITEM_LINK.UNLINKED;
};
