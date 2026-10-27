import type { Attachment, AuditEvent, MaintenanceItem } from '@/domain/types';
import type { RepairStatus } from '@/domain/constants';
import { apiRequest } from './http/client';
import { mapAttachment, mapAuditEvent, repairStatusOf } from './http/mappers';
import type { ApiAttachment, ApiAuditEvent } from './http/mappers';
import { mapMaintenanceItem } from './http/maintenance-item-mappers';
import type { ApiMaintenanceItem } from './http/maintenance-item-mappers';

/** Warranty state computed by the API (BR-MT-11), same names as the demo's `WarrantyState`. */
export type ApiWarrantyState = 'NONE' | 'ACTIVE' | 'EXPIRING' | 'EXPIRED';

/** Repair figures of an item (BR-MT-07, BR-MT-08); money is integer VND as a string, never a float. */
export interface ItemRepairStats {
  repairCount: number;
  openRepairCount: number;
  approvedTotalVnd: string;
}

export interface ApiItemRow extends ItemRepairStats {
  item: MaintenanceItem;
  warranty: ApiWarrantyState;
  needsAttention: boolean;
}

export interface ItemRepairRow {
  id: string;
  code: string;
  title: string;
  status: RepairStatus;
  createdAt: string;
  /** Null until the proposal is approved ("Chưa duyệt"). */
  approvedAmountVnd: string | null;
}

export interface ApiItemDetail extends ItemRepairStats {
  item: MaintenanceItem;
  warranty: ApiWarrantyState;
  repairs: ItemRepairRow[];
  documents: Attachment[];
  audit: AuditEvent[];
}

export interface ApiItemFilters {
  q?: string;
  buildingId?: string;
  type?: string;
  includeInactive?: boolean;
}

interface ApiItemRowBody extends ItemRepairStats {
  item: ApiMaintenanceItem;
  warranty: ApiWarrantyState;
  needsAttention: boolean;
}

interface ApiItemDetailBody extends ItemRepairStats {
  item: ApiMaintenanceItem;
  warranty: ApiWarrantyState;
  repairs: Array<Omit<ItemRepairRow, 'status'> & { status: string }>;
  documents: ApiAttachment[];
  audit: ApiAuditEvent[];
}

/** `GET /maintenance-items`: every item of the filters in scope; the screen pages and applies its quick views. */
export const listApiItems = async (filters: ApiItemFilters = {}): Promise<ApiItemRow[]> => {
  const rows = await apiRequest<ApiItemRowBody[]>('GET', '/maintenance-items', {
    query: {
      q: filters.q?.trim() || undefined,
      buildingId: filters.buildingId || undefined,
      type: filters.type || undefined,
      includeInactive: filters.includeInactive ? 1 : undefined,
    },
  });
  return rows.map((row) => ({ ...row, item: mapMaintenanceItem(row.item) }));
};

/** `GET /maintenance-items/:id`: the item page (figures, repairs, documents, history). */
export const getApiItemDetail = async (itemId: string): Promise<ApiItemDetail> => {
  const body = await apiRequest<ApiItemDetailBody>('GET', `/maintenance-items/${encodeURIComponent(itemId)}`);
  return {
    ...body,
    item: mapMaintenanceItem(body.item),
    repairs: body.repairs.map((row) => ({ ...row, status: repairStatusOf(row.status) })),
    documents: body.documents.map(mapAttachment),
    audit: body.audit.map(mapAuditEvent),
  };
};
