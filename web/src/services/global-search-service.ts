import { TASK_KIND_LABEL } from '@/domain/constants';
import type { MaintenanceItem, RepairRecord } from '@/domain/types';
import { getDb } from '@/storage/db';
import { subjectPath } from '@/utils/subject-link';
import { getMyTasks } from './tasks-service';
import { requireViewer } from './viewer';

export type GlobalSearchResultKind = 'REPAIR_RECORD' | 'MAINTENANCE_ITEM' | 'TASK';

export interface GlobalSearchResult {
  id: string;
  kind: GlobalSearchResultKind;
  kindLabel: string;
  code: string;
  title: string;
  subtitle: string;
  href: string;
}

const matches = (query: string, values: readonly string[]): boolean => values.some((value) => value.toLowerCase().includes(query));

const recordResult = (record: RepairRecord): GlobalSearchResult => ({
  id: record.id,
  kind: 'REPAIR_RECORD',
  kindLabel: 'Hồ sơ sửa chữa',
  code: record.code,
  title: record.title,
  subtitle: 'Mở chi tiết hồ sơ',
  href: subjectPath('REPAIR_RECORD', record.id),
});

const itemResult = (item: MaintenanceItem): GlobalSearchResult => ({
  id: item.id,
  kind: 'MAINTENANCE_ITEM',
  kindLabel: 'Hạng mục bảo trì',
  code: item.code,
  title: item.name,
  subtitle: 'Mở chi tiết hạng mục',
  href: subjectPath('MAINTENANCE_ITEM', item.id),
});

/** Searches scoped records, maintenance items and the current user's tasks. */
export const searchGlobal = async (rawQuery: string): Promise<GlobalSearchResult[]> => {
  const query = rawQuery.trim().toLowerCase();
  if (query.length < 2) return [];
  const viewer = await requireViewer();
  const db = getDb();
  const [records, items, tasks] = await Promise.all([
    db.records.where('buildingId').anyOf(viewer.buildingIds).toArray(),
    db.maintenanceItems.where('buildingId').anyOf(viewer.buildingIds).toArray(),
    getMyTasks(true),
  ]);
  const itemsById = new Map(items.map((item) => [item.id, item]));
  const recordResults = records
    .filter((record) => {
      const item = record.maintenanceItemId ? itemsById.get(record.maintenanceItemId) : undefined;
      return matches(query, [record.code, record.title, item?.code ?? '', item?.name ?? '']);
    })
    .map(recordResult);
  const itemResults = items.filter((item) => matches(query, [item.code, item.name, item.model ?? ''])).map(itemResult);
  const taskResults = tasks
    .filter((row) => matches(query, [row.subjectCode, row.subjectTitle, TASK_KIND_LABEL[row.task.kind]]))
    .map((row): GlobalSearchResult => ({
      id: row.task.id,
      kind: 'TASK',
      kindLabel: 'Công việc của tôi',
      code: row.subjectCode,
      title: row.subjectTitle,
      subtitle: TASK_KIND_LABEL[row.task.kind],
      href: subjectPath(row.task.subjectType, row.task.subjectId, row.tab),
    }));
  return [...recordResults, ...itemResults, ...taskResults].slice(0, 8);
};
