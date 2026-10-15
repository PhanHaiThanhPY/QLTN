import { useEffect, useMemo, useRef } from 'react';
import { BarChart3, RefreshCw } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { Notice } from '@/components/common/Notice';
import { PageHeader } from '@/components/common/PageHeader';
import { ErrorState, LoadingState } from '@/components/common/States';
import { Button } from '@/components/ui/button';
import { TabPanel, Tabs } from '@/components/ui/tabs';
import type { TabItem } from '@/components/ui/tabs';
import { OCCURRENCE_STATUS_LABEL, REPAIR_STATUS } from '@/domain/constants';
import type { OccurrenceStatus, RepairStatus } from '@/domain/constants';
import { forbidden } from '@/domain/errors';
import { hasCapability } from '@/domain/permissions';
import { useReferenceData } from '@/hooks/useReferenceData';
import { useQueryClient } from '@tanstack/react-query';
import type { ReportFilters } from '@/services/report-service';
import { MaintenanceReportPanel } from './components/MaintenanceReportPanel';
import { EquipmentReportPanel } from './components/EquipmentReportPanel';
import { RepairReportPanel } from './components/RepairReportPanel';
import { ReportFilterBar } from './components/ReportFilterBar';
import { ReportOverviewPanel } from './components/ReportOverviewPanel';

const TAB_ITEMS: TabItem[] = [
  { value: 'repair', label: 'Sửa chữa' },
  { value: 'maintenance', label: 'Bảo trì' },
  { value: 'equipment', label: 'Thiết bị' },
];

const REPORT_TABS = ['repair', 'maintenance', 'equipment'] as const;
type ReportTab = (typeof REPORT_TABS)[number];
const FILTER_KEYS = ['building', 'from', 'to', 'repairStatus', 'maintenanceStatus'] as const;
const STORAGE_KEY = 'qltn-report-filters';
const REPAIR_STATUS_VALUES = Object.values(REPAIR_STATUS) as RepairStatus[];
const MAINTENANCE_STATUS_VALUES = Object.keys(OCCURRENCE_STATUS_LABEL) as OccurrenceStatus[];

const toReportTab = (value: string | null): ReportTab => REPORT_TABS.find((tab) => tab === value) ?? 'repair';
const toRepairStatus = (value: string | null): RepairStatus | undefined => value && REPAIR_STATUS_VALUES.includes(value as RepairStatus) ? value as RepairStatus : undefined;
const toMaintenanceStatus = (value: string | null): OccurrenceStatus | undefined => value && MAINTENANCE_STATUS_VALUES.includes(value as OccurrenceStatus) ? value as OccurrenceStatus : undefined;

const filtersFromParams = (params: URLSearchParams): ReportFilters => ({
  buildingId: params.get('building') || undefined,
  dateFrom: params.get('from') || undefined,
  dateTo: params.get('to') || undefined,
  repairStatus: toRepairStatus(params.get('repairStatus')),
  maintenanceStatus: toMaintenanceStatus(params.get('maintenanceStatus')),
});

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const readStoredFilters = (): ReportFilters => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value)) return {};
    return {
      buildingId: typeof value.buildingId === 'string' ? value.buildingId : undefined,
      dateFrom: typeof value.dateFrom === 'string' ? value.dateFrom : undefined,
      dateTo: typeof value.dateTo === 'string' ? value.dateTo : undefined,
      repairStatus: typeof value.repairStatus === 'string' ? toRepairStatus(value.repairStatus) : undefined,
      maintenanceStatus: typeof value.maintenanceStatus === 'string' ? toMaintenanceStatus(value.maintenanceStatus) : undefined,
    };
  } catch (error) {
    console.error('Read report filters failed:', error);
    return {};
  }
};

const saveStoredFilters = (filters: ReportFilters): void => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
  } catch (error) {
    console.error('Save report filters failed:', error);
  }
};

const updateParams = (params: URLSearchParams, filters: ReportFilters): URLSearchParams => {
  const next = new URLSearchParams(params);
  const values: Record<(typeof FILTER_KEYS)[number], string | undefined> = {
    building: filters.buildingId,
    from: filters.dateFrom,
    to: filters.dateTo,
    repairStatus: filters.repairStatus,
    maintenanceStatus: filters.maintenanceStatus,
  };
  FILTER_KEYS.forEach((key) => {
    const value = values[key];
    if (value) next.set(key, value);
    else next.delete(key);
  });
  next.delete('item');
  return next;
};

/** Reports with an actionable overview and focused detail tabs. */
const ReportsPage = () => {
  const { data, isLoading, buildingName } = useReferenceData();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const restored = useRef(false);
  const touchStartY = useRef<number | null>(null);
  const tab = toReportTab(searchParams.get('tab'));
  const filters = useMemo(() => filtersFromParams(searchParams), [searchParams]);
  const viewer = data?.viewer;

  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    const hasUrlFilters = FILTER_KEYS.some((key) => searchParams.has(key));
    if (hasUrlFilters) return;
    const stored = readStoredFilters();
    if (Object.values(stored).some(Boolean)) setSearchParams((current) => updateParams(current, stored), { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const handleTouchStart = (event: TouchEvent) => {
      touchStartY.current = window.scrollY === 0 ? event.touches[0]?.clientY ?? null : null;
    };
    const handleTouchEnd = (event: TouchEvent) => {
      const startY = touchStartY.current;
      const endY = event.changedTouches[0]?.clientY;
      touchStartY.current = null;
      if (startY !== null && endY !== undefined && endY - startY > 72) void queryClient.invalidateQueries({ queryKey: ['svc'] });
    };
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [queryClient]);

  if (isLoading || !viewer) {
    return <div><PageHeader title="Báo cáo" /><LoadingState rows={5} /></div>;
  }
  if (!hasCapability(viewer, 'REPORT_VIEW')) {
    return <div><PageHeader title="Báo cáo" /><ErrorState error={forbidden('Vai trò của bạn không xem được báo cáo.')} /></div>;
  }

  const isRangeInvalid = Boolean(filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo);
  const scopeText = filters.buildingId ? buildingName(filters.buildingId) : (data.buildings ?? []).map((row) => row.name).join(', ');
  const changeFilters = (nextFilters: ReportFilters) => {
    saveStoredFilters(nextFilters);
    setSearchParams((current) => updateParams(current, nextFilters), { replace: true });
  };
  const openTab = (value: string) => {
    const nextTab = toReportTab(value);
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set('tab', nextTab);
      return next;
    }, { replace: true });
  };
  const filterByBuilding = (buildingId: string) => {
    changeFilters({ ...filters, buildingId });
    openTab('repair');
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Báo cáo" description="Nhìn nhanh khối lượng vận hành, điểm bất thường và danh sách cần xử lý theo đúng phạm vi đang xem." actions={<Button variant="outline" size="sm" className="min-h-11" onClick={() => void queryClient.invalidateQueries({ queryKey: ['svc'] })}><RefreshCw className="size-4" />Làm mới</Button>} />
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface px-4 py-2.5 text-sm shadow-none">
        <div className="flex min-w-0 items-center gap-2 text-ink-2"><BarChart3 className="size-4 shrink-0 text-accent" aria-hidden /><span>Phạm vi dữ liệu: <strong className="font-semibold text-ink">{scopeText || 'Các tòa nhà được cấp quyền'}</strong></span></div>
        <span className="text-xs font-medium text-accent">Bộ lọc được ghi nhớ</span>
      </div>
      <ReportFilterBar filters={filters} buildings={data.buildings ?? []} onChange={changeFilters} />
      {isRangeInvalid ? <Notice tone="warning">“Từ ngày” đang sau “Đến ngày” nên không có dữ liệu nào khớp.</Notice> : null}
      <ReportOverviewPanel filters={filters} buildings={data.buildings ?? []} onOpenTab={openTab} onFilterByBuilding={filterByBuilding} />
      <Tabs value={tab} onValueChange={openTab} items={TAB_ITEMS}>
        <TabPanel value="repair"><RepairReportPanel filters={filters} /></TabPanel>
        <TabPanel value="maintenance"><MaintenanceReportPanel filters={filters} /></TabPanel>
        <TabPanel value="equipment"><EquipmentReportPanel filters={filters} /></TabPanel>
      </Tabs>
    </div>
  );
};

export default ReportsPage;
