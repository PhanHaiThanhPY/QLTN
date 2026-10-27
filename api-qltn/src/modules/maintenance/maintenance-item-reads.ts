import type { DataSource } from 'typeorm';
import { In } from 'typeorm';
import { vnDate } from '../../common/utils/vn-date';
import { warrantyState, type WarrantyState } from '../../domain/warranty';
import { toAttachmentView, type AttachmentView } from '../attachments/attachment-view';
import { Attachment } from '../attachments/entities/attachment.entity';
import { RepairRecord } from '../records/entities/repair-record.entity';
import { RECORD_FINAL_STATUSES } from '../records/record-status-groups';
import type { MaintenanceItem } from './entities/maintenance-item.entity';
import { toItemView, type MaintenanceItemView } from './maintenance-item-view';

/**
 * D-MT-1: a repair counts once it was sent, except "Đóng vì không cần sửa" and "Đóng do rút hồ sơ" (the item was not
 * broken, or the report was taken back).
 */
export const UNCOUNTED_REPAIR_STATUSES = ['DRAFT', 'CLOSED_NO_REPAIR', 'CLOSED_WITHDRAWN'] as const;

/** Repair figures of one item (BR-MT-07, BR-MT-08). Money is integer VND as a string. */
export interface ItemRepairStats {
  repairCount: number;
  /** Counted repairs not in a final status ("Đang sửa chữa"). */
  openRepairCount: number;
  /** Sum of the counted repairs' approved amounts, each record once (D-MT-2). */
  approvedTotalVnd: string;
}

export interface ItemListRowView extends ItemRepairStats {
  item: MaintenanceItemView;
  warranty: WarrantyState;
  /** "Cần xử lý": an open repair, condition "Cần chú ý" or a warranty ending within 30 days (BR-MT-07). */
  needsAttention: boolean;
}

export interface ItemRepairView {
  id: string;
  code: string;
  title: string;
  status: string;
  createdAt: Date;
  approvedAmountVnd: string | null;
}

export interface ItemDetailView extends ItemRepairStats {
  item: MaintenanceItemView;
  warranty: WarrantyState;
  /** Counted repairs linked to the item, newest first. */
  repairs: ItemRepairView[];
  documents: AttachmentView[];
}

const ZERO_STATS: ItemRepairStats = { repairCount: 0, openRepairCount: 0, approvedTotalVnd: '0' };

/** One grouped query for every item id; the sum stays in the database as an exact numeric. */
export const repairStatsOf = async (
  dataSource: DataSource,
  itemIds: readonly string[],
): Promise<Map<string, ItemRepairStats>> => {
  if (itemIds.length === 0) return new Map();
  const rows = await dataSource
    .getRepository(RepairRecord)
    .createQueryBuilder('r')
    .select('r.maintenance_item_id', 'itemId')
    .addSelect('COUNT(*)', 'repairCount')
    .addSelect('COUNT(*) FILTER (WHERE r.status NOT IN (:...finalStatuses))', 'openRepairCount')
    .addSelect('COALESCE(SUM(r.approved_amount_vnd), 0)::text', 'approvedTotalVnd')
    .where('r.maintenance_item_id IN (:...itemIds)', { itemIds })
    .andWhere('r.status NOT IN (:...uncounted)', { uncounted: [...UNCOUNTED_REPAIR_STATUSES] })
    .setParameter('finalStatuses', [...RECORD_FINAL_STATUSES])
    .groupBy('r.maintenance_item_id')
    .getRawMany<{ itemId: string; repairCount: string; openRepairCount: string; approvedTotalVnd: string }>();
  return new Map(
    rows.map((row) => [
      row.itemId,
      {
        repairCount: Number(row.repairCount),
        openRepairCount: Number(row.openRepairCount),
        approvedTotalVnd: row.approvedTotalVnd,
      },
    ]),
  );
};

export const statsOf = (stats: Map<string, ItemRepairStats>, itemId: string): ItemRepairStats =>
  stats.get(itemId) ?? ZERO_STATS;

export const needsAttention = (item: MaintenanceItem, stats: ItemRepairStats, warranty: WarrantyState): boolean =>
  stats.openRepairCount > 0 || item.condition === 'NEEDS_ATTENTION' || warranty === 'EXPIRING';

export const toListRow = (item: MaintenanceItem, stats: ItemRepairStats, today: string): ItemListRowView => {
  const warranty = warrantyState(item.warrantyUntil, today);
  return { item: toItemView(item), ...stats, warranty, needsAttention: needsAttention(item, stats, warranty) };
};

/** Detail figures, repair rows and documents of one item already checked for scope. */
export const itemDetailOf = async (dataSource: DataSource, item: MaintenanceItem): Promise<ItemDetailView> => {
  const [stats, repairs, documents] = await Promise.all([
    repairStatsOf(dataSource, [item.id]),
    dataSource
      .getRepository(RepairRecord)
      .createQueryBuilder('r')
      .where('r.maintenance_item_id = :itemId', { itemId: item.id })
      .andWhere('r.status NOT IN (:...uncounted)', { uncounted: [...UNCOUNTED_REPAIR_STATUSES] })
      .orderBy('r.created_at', 'DESC')
      .addOrderBy('r.code', 'DESC')
      .getMany(),
    item.documentIds.length
      ? dataSource.getRepository(Attachment).findBy({ id: In(item.documentIds) })
      : Promise.resolve([]),
  ]);
  const order = new Map(item.documentIds.map((id, index) => [id, index]));
  return {
    item: toItemView(item),
    ...statsOf(stats, item.id),
    warranty: warrantyState(item.warrantyUntil, vnDate(new Date())),
    repairs: repairs.map((record) => ({
      id: record.id,
      code: record.code,
      title: record.title,
      status: record.status,
      createdAt: record.createdAt,
      approvedAmountVnd: record.approvedAmountVnd,
    })),
    documents: documents.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)).map(toAttachmentView),
  };
};
