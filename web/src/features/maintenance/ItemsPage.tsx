import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { AlertTriangle, CheckCircle2, Clock3, Wrench } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/States';
import { Button } from '@/components/ui/button';
import { StatCard, StatCardRow } from '@/components/ui/stat-card';
import { hasCapability } from '@/domain/permissions';
import { useServiceQuery } from '@/hooks/useServiceQuery';
import { listItemOverview } from '@/services/maintenance-service';
import { todayVn } from '@/services/runtime';
import { ItemFormDialog } from './components/ItemFormDialog';
import { ItemAttentionPanel } from './components/item/ItemAttentionPanel';
import { ItemListFilters } from './components/item-list/ItemListFilters';
import type { ItemListFilterValues } from './components/item-list/ItemListFilters';
import { ItemListTable } from './components/item-list/ItemListTable';
import { ItemQuickFilterBar } from './components/item-list/ItemQuickFilterBar';
import { useMaintenanceScreen } from './hooks/useMaintenanceScreen';
import { countQuickFilters, isItemQuickFilter, isItemSort, visibleItemRows } from './utils/item-list';
import type { ItemQuickFilter } from './utils/item-list';
import type { AttentionItem } from './utils/item-insights';

const PARAM = { q: 'q', building: 'building', type: 'type', sort: 'sort', view: 'view', inactive: 'inactive' } as const;

/** Equipment list: problems first (quick views with counts), every filter kept in the URL. */
const ItemsPage = () => {
  const { data, userName, buildingName, locationName } = useMaintenanceScreen();
  const [params, setParams] = useSearchParams();
  const [isCreating, setIsCreating] = useState(false);
  const sortParam = params.get(PARAM.sort);
  const viewParam = params.get(PARAM.view);
  const values: ItemListFilterValues = {
    q: params.get(PARAM.q) ?? '',
    buildingId: params.get(PARAM.building) ?? '',
    type: params.get(PARAM.type) ?? '',
    sort: isItemSort(sortParam) ? sortParam : 'next',
    includeInactive: params.get(PARAM.inactive) === '1',
  };
  const view: ItemQuickFilter = isItemQuickFilter(viewParam) ? viewParam : 'all';
  const serviceFilters = { q: values.q, buildingId: values.buildingId, type: values.type, includeInactive: values.includeInactive };
  const query = useServiceQuery(['maintenance', 'items', serviceFilters], () => listItemOverview(serviceFilters));
  const viewer = data?.viewer;
  const canCreate = Boolean(viewer && hasCapability(viewer, 'MAINTENANCE_MANAGE'));
  const today = todayVn();

  const types = useMemo(() => [...new Set((data?.items ?? []).map((item) => item.type))].sort((a, b) => a.localeCompare(b, 'vi')), [data?.items]);
  const rows = query.data;
  const counts = useMemo(() => countQuickFilters(rows ?? [], today), [rows, today]);
  const visible = useMemo(() => visibleItemRows(rows ?? [], view, values.sort, today), [rows, view, values.sort, today]);
  const attentionItems = useMemo<AttentionItem[]>(() => (rows ?? [])
    .filter((row) => row.overdueCount > 0 || row.openRepairCount > 0 || row.item.condition === 'NEEDS_ATTENTION')
    .slice(0, 4)
    .map((row): AttentionItem => ({
      key: row.item.id,
      tone: row.overdueCount > 0 ? 'crit' : row.openRepairCount > 0 ? 'info' : 'warn',
      title: row.overdueCount > 0 ? `${row.item.code} có ${row.overdueCount} lượt quá hạn` : row.openRepairCount > 0 ? `${row.item.code} đang có ${row.openRepairCount} hồ sơ sửa chữa` : `${row.item.code} cần kiểm tra tình trạng`,
      detail: `${buildingName(row.item.buildingId)} · ${locationName(row.item.locationId)}`,
      to: `/maintenance/items/${row.item.id}`,
    })), [rows, buildingName, locationName]);

  const update = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setParams(next, { replace: true });
  };
  const updateFilters = (patch: Partial<ItemListFilterValues>) => {
    const mapped: Record<string, string> = {};
    if (patch.q !== undefined) mapped[PARAM.q] = patch.q;
    if (patch.buildingId !== undefined) mapped[PARAM.building] = patch.buildingId;
    if (patch.type !== undefined) mapped[PARAM.type] = patch.type;
    if (patch.sort !== undefined) mapped[PARAM.sort] = patch.sort === 'next' ? '' : patch.sort;
    if (patch.includeInactive !== undefined) mapped[PARAM.inactive] = patch.includeInactive ? '1' : '';
    update(mapped);
  };
  const clearAll = () => setParams(new URLSearchParams(), { replace: true });

  const renderBody = () => {
    if (query.isLoading || !viewer) return <LoadingState />;
    if (query.error) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
    if (visible.length === 0) {
      return (
        <EmptyState
          title="Không có thiết bị phù hợp"
          description="Thử bỏ bớt điều kiện lọc hoặc chọn “Tất cả”."
          action={<Button variant="secondary" onClick={clearAll}>Xóa bộ lọc</Button>}
        />
      );
    }
    return <ItemListTable rows={visible} today={today} locationName={locationName} buildingName={buildingName} userName={userName} />;
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Thiết bị"
        description="Tình trạng, lịch bảo trì kế tiếp và sửa chữa đang mở của từng thiết bị."
        actions={
          canCreate ? (
            <Button onClick={() => setIsCreating(true)}>
              <Plus className="h-4 w-4" />
              Thêm thiết bị
            </Button>
          ) : null
        }
      />
      <StatCardRow className="mb-4 xl:grid-cols-4">
        <StatCard compact icon={CheckCircle2} value={query.isLoading ? '—' : counts.all} label="Thiết bị" tone="accent" hint="Trong phạm vi đang lọc" />
        <StatCard compact icon={AlertTriangle} value={query.isLoading ? '—' : counts.attention} label="Cần xử lý" tone="warn" hint="Có cảnh báo liên quan" onClick={() => update({ [PARAM.view]: 'attention' })} />
        <StatCard compact icon={Clock3} value={query.isLoading ? '—' : counts.overdue} label="Quá hạn bảo trì" tone="crit" hint="Lượt chưa hoàn tất" onClick={() => update({ [PARAM.view]: 'overdue' })} />
        <StatCard compact icon={Wrench} value={query.isLoading ? '—' : counts.repairing} label="Đang sửa chữa" tone="info" hint="Có hồ sơ đang mở" onClick={() => update({ [PARAM.view]: 'repairing' })} />
      </StatCardRow>
      {!query.isLoading ? <ItemAttentionPanel items={attentionItems} /> : null}
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-3">Lọc nhanh</p>
        <p className="text-xs text-ink-3">Ưu tiên vấn đề trước</p>
      </div>
      <ItemQuickFilterBar value={view} counts={counts} onChange={(next) => update({ [PARAM.view]: next === 'all' ? '' : next })} />
      <ItemListFilters values={values} buildings={data?.buildings ?? []} types={types} onChange={updateFilters} />
      {rows && !query.isLoading ? (
        <p className="text-xs text-ink-3" aria-live="polite">
          Hiển thị {visible.length}/{rows.length} thiết bị
        </p>
      ) : null}
      {renderBody()}
      {isCreating && viewer ? <ItemFormDialog viewer={viewer} onClose={() => setIsCreating(false)} /> : null}
    </div>
  );
};

export default ItemsPage;
