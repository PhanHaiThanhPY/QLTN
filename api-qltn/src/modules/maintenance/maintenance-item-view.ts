import type { ItemCondition, MaintenanceItem } from './entities/maintenance-item.entity';

export interface MaintenanceItemView {
  id: string;
  code: string;
  buildingId: string;
  locationId: string;
  name: string;
  type: string;
  ownerUserId: string;
  model: string | null;
  supplier: string | null;
  installDate: string | null;
  warrantyUntil: string | null;
  description: string | null;
  documentIds: string[];
  condition: ItemCondition;
  conditionNote: string | null;
  active: boolean;
  deactivatedAt: Date | null;
  deactivationReason: string | null;
  createdBy: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export const toItemView = (item: MaintenanceItem): MaintenanceItemView => ({
  id: item.id,
  code: item.code,
  buildingId: item.buildingId,
  locationId: item.locationId,
  name: item.name,
  type: item.type,
  ownerUserId: item.ownerUserId,
  model: item.model,
  supplier: item.supplier,
  installDate: item.installDate,
  warrantyUntil: item.warrantyUntil,
  description: item.description,
  documentIds: [...item.documentIds],
  condition: item.condition,
  conditionNote: item.conditionNote,
  active: item.active,
  deactivatedAt: item.deactivatedAt,
  deactivationReason: item.deactivationReason,
  createdBy: item.createdBy,
  version: item.version,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
});
