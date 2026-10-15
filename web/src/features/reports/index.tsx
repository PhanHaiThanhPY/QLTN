import { useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { Notice } from '@/components/common/Notice';
import { PageHeader } from '@/components/common/PageHeader';
import { ErrorState, LoadingState } from '@/components/common/States';
import { TabPanel, Tabs } from '@/components/ui/tabs';
import type { TabItem } from '@/components/ui/tabs';
import { forbidden } from '@/domain/errors';
import { hasCapability } from '@/domain/permissions';
import { useReferenceData } from '@/hooks/useReferenceData';
import type { ReportFilters } from '@/services/report-service';
import { MaintenanceReportPanel } from './components/MaintenanceReportPanel';
import { EquipmentReportPanel } from './components/EquipmentReportPanel';
import { RepairReportPanel } from './components/RepairReportPanel';
import { ReportFilterBar } from './components/ReportFilterBar';

const TAB_ITEMS: TabItem[] = [
  { value: 'repair', label: 'Sửa chữa' },
  { value: 'maintenance', label: 'Bảo trì' },
  { value: 'equipment', label: 'Thiết bị' },
];

const REPORT_TABS = ['repair', 'maintenance', 'equipment'] as const;
type ReportTab = (typeof REPORT_TABS)[number];
const toReportTab = (value: string | null): ReportTab => REPORT_TABS.find((tab) => tab === value) ?? 'repair';

const DESCRIPTION = 'Số liệu tính từ cùng dữ liệu demo, chỉ trong tòa nhà của bạn. Xuất CSV theo bộ lọc hiện tại.';

/** Reports with Repair / Maintenance tabs (spec 11.3); roles without REPORT_VIEW see no-permission. */
const ReportsPage = () => {
  const { data, isLoading, buildingName } = useReferenceData();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState<ReportFilters>({});
  const tab = toReportTab(searchParams.get('tab'));
  const viewer = data?.viewer;

  if (isLoading || !viewer) {
    return (
      <div>
        <PageHeader title="Báo cáo" />
        <LoadingState rows={5} />
      </div>
    );
  }
  if (!hasCapability(viewer, 'REPORT_VIEW')) {
    return (
      <div>
        <PageHeader title="Báo cáo" />
        <ErrorState error={forbidden('Vai trò của bạn không xem được báo cáo.')} />
      </div>
    );
  }

  const isRangeInvalid = Boolean(filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo);
  const scopeText = filters.buildingId ? buildingName(filters.buildingId) : (data?.buildings ?? []).map((row) => row.name).join(', ');

  return (
    <div className="space-y-5">
      <PageHeader title="Báo cáo" description={DESCRIPTION} />
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface px-4 py-2.5 text-sm shadow-none">
        <div className="flex min-w-0 items-center gap-2 text-ink-2"><BarChart3 className="size-4 shrink-0 text-accent" aria-hidden /><span>Phạm vi dữ liệu: <strong className="font-semibold text-ink">{scopeText}</strong></span></div>
        <span className="text-xs font-medium text-accent">Theo bộ lọc hiện tại</span>
      </div>
      <ReportFilterBar filters={filters} buildings={data?.buildings ?? []} onChange={setFilters} />
      {isRangeInvalid ? <Notice tone="warning">“Từ ngày” đang sau “Đến ngày” nên không có dữ liệu nào khớp.</Notice> : null}
      <Tabs value={tab} onValueChange={(value) => setSearchParams({ tab: value }, { replace: true })} items={TAB_ITEMS}>
        <TabPanel value="repair">
          <RepairReportPanel filters={filters} />
        </TabPanel>
        <TabPanel value="maintenance">
          <MaintenanceReportPanel filters={filters} />
        </TabPanel>
        <TabPanel value="equipment">
          <EquipmentReportPanel filters={filters} />
        </TabPanel>
      </Tabs>
    </div>
  );
};

export default ReportsPage;
