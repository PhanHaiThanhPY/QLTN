import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Plus, Wrench } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { PageHeader } from '@/components/common/PageHeader';
import { Pagination } from '@/components/common/Pagination';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/States';
import { Button } from '@/components/ui/button';
import { StatCard, StatCardRow } from '@/components/ui/stat-card';
import { hasCapability } from '@/domain/permissions';
import { useOnline } from '@/hooks/useOnline';
import { useServiceQuery } from '@/hooks/useServiceQuery';
import { listApiItems } from '@/services/maintenance-items-api';
import { todayVn } from '@/services/runtime';
import { ItemFormDialog } from '../components/ItemFormDialog';
import { ItemListFilters } from '../components/item-list/ItemListFilters';
import type { ItemListFilterValues } from '../components/item-list/ItemListFilters';
import { ItemQuickFilterBar } from '../components/item-list/ItemQuickFilterBar';
import { useMaintenanceScreen } from '../hooks/useMaintenanceScreen';
import { isItemQuickFilter } from '../utils/item-list';
import type { ItemQuickFilter, ItemSort } from '../utils/item-list';
import { API_QUICK_FILTERS, API_SORTS, ITEM_PAGE_SIZE, countApiQuickFilters, visibleApiRows } from './item-api-ui';
import { ItemApiTable } from './ItemApiTable';

const PARAM = { q: 'q', building: 'building', type: 'type', sort: 'sort', view: 'view', inactive: 'inactive', page: 'page' } as const;

const isApiSort = (value: string | null): value is ItemSort => API_SORTS.some((entry) => entry.value === value);
const isApiView = (value: string | null): value is ItemQuickFilter =>
  isItemQuickFilter(value) && API_QUICK_FILTERS.some((entry) => entry.value === value);

/** Equipment list on real data (SPEC MT-S1 BR-MT-07, ui-brief §2.1); every filter lives in the URL. */
const ItemsApiPage = () => {
  const { data, buildingName, locationName } = useMaintenanceScreen();
  const [params, setParams] = useSearchParams();
  const [isCreating, setIsCreating] = useState(false);
  const online = useOnline();
  const sortParam = params.get(PARAM.sort);
  const viewParam = params.get(PARAM.view);
  const values: ItemListFilterValues = {
    q: params.get(PARAM.q) ?? '',
    buildingId: params.get(PARAM.building) ?? '',
    type: params.get(PARAM.type) ?? '',
    sort: isApiSort(sortParam) ? sortParam : 'code',
    includeInactive: params.get(PARAM.inactive) === '1',
  };
  const view: ItemQuickFilter = isApiView(viewParam) ? viewParam : 'all';
  const page = Math.max(1, Number(params.get(PARAM.page)) || 1);
  const { q, buildingId, type, includeInactive } = values;
  const serviceFilters = useMemo(() => ({ q, buildingId, type, includeInactive }), [q, buildingId, type, includeInactive]);
  const query = useServiceQuery(['maintenance', 'items', 'api', serviceFilters], () => listApiItems(serviceFilters));
  const viewer = data?.viewer;
  const canCreate = Boolean(viewer && hasCapability(viewer, 'MAINTENANCE_MANAGE'));
  const today = todayVn();

  const types = useMemo(() => [...new Set((data?.items ?? []).map((item) => item.type))].sort((a, b) => a.localeCompare(b, 'vi')), [data?.items]);
  const rows = query.data;
  const counts = useMemo(() => countApiQuickFilters(rows ?? []), [rows]);
  const activeCount = useMemo(() => (rows ?? []).filter((row) => row.item.active).length, [rows]);
  const visible = useMemo(() => visibleApiRows(rows ?? [], view, values.sort), [rows, view, values.sort]);
  const pageRows = visible.slice((page - 1) * ITEM_PAGE_SIZE, page * ITEM_PAGE_SIZE);
  const hasFilters = Boolean(q || buildingId || type || includeInactive || view !== 'all');

  const update = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    if (!(PARAM.page in patch)) next.delete(PARAM.page);
    setParams(next, { replace: true });
  };
  const updateFilters = (patch: Partial<ItemListFilterValues>) => {
    const mapped: Record<string, string> = {};
    if (patch.q !== undefined) mapped[PARAM.q] = patch.q;
    if (patch.buildingId !== undefined) mapped[PARAM.building] = patch.buildingId;
    if (patch.type !== undefined) mapped[PARAM.type] = patch.type;
    if (patch.sort !== undefined) mapped[PARAM.sort] = patch.sort === 'code' ? '' : patch.sort;
    if (patch.includeInactive !== undefined) mapped[PARAM.inactive] = patch.includeInactive ? '1' : '';
    update(mapped);
  };
  const clearAll = () => setParams(new URLSearchParams(), { replace: true });
  const createButton = canCreate ? (
    <Button disabled={!online} onClick={() => setIsCreating(true)}>
      <Plus className="h-4 w-4" />
      Thêm thiết bị
    </Button>
  ) : null;

  const renderBody = () => {
    if (query.isLoading || !viewer) return <LoadingState rows={6} />;
    if (query.error || !rows) {
      return <ErrorState error={query.error ?? new Error('Không tải được danh sách thiết bị.')} onRetry={() => void query.refetch()} />;
    }
    if (rows.length === 0 && !hasFilters) return <EmptyState title="Chưa có thiết bị nào." action={createButton} />;
    if (visible.length === 0) {
      return (
        <EmptyState
          title="Không có thiết bị phù hợp."
          action={<Button variant="secondary" onClick={clearAll}>Xóa bộ lọc</Button>}
        />
      );
    }
    return (
      <>
        <ItemApiTable rows={pageRows} today={today} locationName={locationName} buildingName={buildingName} />
        <Pagination page={page} pageSize={ITEM_PAGE_SIZE} total={visible.length} onPageChange={(next) => update({ [PARAM.page]: next > 1 ? String(next) : '' })} />
      </>
    );
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Thiết bị" description="Danh mục thiết bị của các tòa trong phạm vi của bạn." actions={createButton} />
      {online ? null : <p className="text-xs text-ink-3">Đang mất kết nối — chưa lưu được thay đổi.</p>}
      <StatCardRow className="mb-4 xl:grid-cols-3">
        <StatCard compact icon={CheckCircle2} value={query.isLoading ? '—' : activeCount} label="Thiết bị" tone="accent" hint="Đang dùng, trong phạm vi đang lọc" />
        <StatCard compact icon={AlertTriangle} value={query.isLoading ? '—' : counts.attention} label="Cần xử lý" tone="warn" hint="Sửa chữa đang mở, cần chú ý hoặc sắp hết bảo hành" onClick={() => update({ [PARAM.view]: 'attention' })} />
        <StatCard compact icon={Wrench} value={query.isLoading ? '—' : counts.repairing} label="Đang sửa chữa" tone="info" hint="Có hồ sơ chưa kết thúc" onClick={() => update({ [PARAM.view]: 'repairing' })} />
      </StatCardRow>
      <ItemQuickFilterBar value={view} counts={counts} filters={API_QUICK_FILTERS} onChange={(next) => update({ [PARAM.view]: next === 'all' ? '' : next })} />
      <ItemListFilters
        values={values}
        buildings={data?.buildings ?? []}
        types={types}
        sorts={API_SORTS}
        searchPlaceholder="Mã hoặc tên thiết bị…"
        showInactiveToggle
        onChange={updateFilters}
      />
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

export default ItemsApiPage;
