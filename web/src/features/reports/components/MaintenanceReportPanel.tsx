import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { AlarmClock, Ban, CalendarClock, CalendarDays, CheckCircle2, ClipboardList, Download, Hourglass, Link2, Percent, TriangleAlert } from 'lucide-react';
import { Notice } from '@/components/common/Notice';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/States';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Input, NativeSelect } from '@/components/ui/input';
import { useReferenceData } from '@/hooks/useReferenceData';
import { useServiceQuery } from '@/hooks/useServiceQuery';
import { getMaintenanceReport } from '@/services/report-service';
import type { ReportFilters } from '@/services/report-service';
import { todayVn } from '@/services/runtime';
import { downloadCsv } from '@/utils/csv';
import { StatCard, StatCardRow } from '@/components/ui/stat-card';
import { buildMaintenanceCsv, reportFileName } from '../report-csv';
import { MaintenanceRowsTable } from './MaintenanceRowsTable';
import { StatusBars } from './StatusBars';

const formatRate = (rate: number | null): string => (rate === null ? 'Chưa có dữ liệu' : `${Math.round(rate * 1000) / 10}%`);

/** "Bảo trì" tab of the report (spec 11.3), period by scheduledDate. */
export const MaintenanceReportPanel = ({ filters }: { filters: ReportFilters }) => {
  const lookup = useReferenceData();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'date' | 'status'>('date');
  const query = useServiceQuery(['reports', 'maintenance', filters], () => getMaintenanceReport(filters));
  const report = query.data;
  const visibleRows = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('vi');
    return [...(report?.rows ?? [])]
      .filter((row) => !term || `${row.code} ${lookup.itemName(row.itemId)}`.toLocaleLowerCase('vi').includes(term))
      .sort((a, b) => sort === 'status' ? a.status.localeCompare(b.status) : a.scheduledDate.localeCompare(b.scheduledDate));
  }, [lookup, report?.rows, search, sort]);

  if (query.isLoading) return <LoadingState rows={5} />;
  if (query.error || !report) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const today = todayVn();

  const selectStatus = (status: string) => {
    const next = new URLSearchParams(params);
    if (filters.maintenanceStatus === status) next.delete('maintenanceStatus');
    else next.set('maintenanceStatus', status);
    next.set('tab', 'maintenance');
    setParams(next, { replace: true });
  };

  const handleExport = () => {
    try {
      downloadCsv(reportFileName('bao-cao-bao-tri', today), buildMaintenanceCsv({ ...report, rows: visibleRows }, lookup, today));
      toast.success(`Đã xuất ${visibleRows.length} dòng theo bộ lọc đang xem.`);
    } catch (error) {
      console.error('Export maintenance CSV failed:', error);
      toast.error('Không xuất được tệp CSV. Vui lòng thử lại.');
    }
  };

  return (
    <div className="space-y-4">
      <Notice tone="info" title="Kỳ lọc" className="rounded-lg px-3 py-2.5">
        Kỳ lọc theo ngày dự kiến của lượt bảo trì. Tỷ lệ hoàn thành = lượt hoàn thành / lượt không bị hủy trong kỳ.
      </Notice>
      <StatCardRow className="lg:grid-cols-4 xl:grid-cols-4">
        <StatCard compact icon={CalendarDays} value={report.dueCount} label="lượt đến hạn" tone="accent" />
        <StatCard compact icon={CheckCircle2} value={report.completedCount} label="lượt hoàn thành" tone="good" />
        <StatCard compact icon={AlarmClock} value={report.overdueCount} label="lượt quá hạn" tone={report.overdueCount > 0 ? 'crit' : 'neutral'} />
        <StatCard compact icon={Percent} value={formatRate(report.completionRate)} label="tỷ lệ hoàn thành" tone="good" />
      </StatCardRow>
      <div className="border-y border-line py-3">
        <div className="grid grid-cols-2 gap-x-5 gap-y-4 sm:grid-cols-3 lg:grid-cols-6">
            {[
              { icon: CalendarClock, label: 'Hoàn thành trễ', value: report.lateCompletedCount },
              { icon: Ban, label: 'Đã hủy', value: report.cancelledCount },
              { icon: Hourglass, label: 'Đang mở', value: report.openCount },
              { icon: ClipboardList, label: 'Kế hoạch hoạt động', value: report.activePlanCount },
              { icon: TriangleAlert, label: 'Phát hiện hư hỏng', value: report.issueCount },
              { icon: Link2, label: 'Hồ sơ liên kết', value: report.linkedRepairCount },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center gap-2">
                <Icon className="size-4 shrink-0 text-accent" aria-hidden />
                <div className="min-w-0"><p className="truncate text-xs text-ink-2">{label}</p><p className="mt-0.5 text-base font-bold tabular-nums text-ink">{value}</p></div>
              </div>
            ))}
        </div>
      </div>
      <Card className="shadow-none">
        <CardBody className="p-4 sm:p-5">
          <StatusBars title="Số lượt theo trạng thái (theo ngày dự kiến)" rows={report.byStatus} selectedStatus={filters.maintenanceStatus} onSelect={selectStatus} />
        </CardBody>
      </Card>
      <Card className="shadow-none">
        <CardHeader
          title="Danh sách lượt trong kỳ"
          description={`${report.rows.length} lượt có ngày dự kiến trong kỳ lọc`}
          actions={
            <Button variant="secondary" size="sm" onClick={handleExport} disabled={report.rows.length === 0}>
              <Download className="h-4 w-4" />
              Xuất CSV
            </Button>
          }
        />
        <CardBody>
          <div className="mb-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_12rem]">
            <Input className="h-11" placeholder="Tìm mã hoặc thiết bị..." aria-label="Tìm lượt bảo trì" value={search} onChange={(event) => setSearch(event.target.value)} />
            <NativeSelect className="h-11" aria-label="Sắp xếp lượt bảo trì" value={sort} onChange={(event) => setSort(event.target.value as 'date' | 'status')}>
              <option value="date">Ngày dự kiến</option>
              <option value="status">Theo trạng thái</option>
            </NativeSelect>
          </div>
          {report.rows.length === 0 ? (
            <EmptyState title="Không có lượt bảo trì trong kỳ lọc" description="Số 0 là chưa phát sinh lượt theo kỳ và tòa nhà đang chọn." />
          ) : visibleRows.length === 0 ? (
            <EmptyState title="Không tìm thấy lượt phù hợp" description="Thử đổi từ khóa tìm kiếm hoặc bỏ bộ lọc trạng thái." />
          ) : (
            <MaintenanceRowsTable rows={visibleRows} today={today} buildingName={lookup.buildingName} itemName={lookup.itemName} />
          )}
        </CardBody>
      </Card>
    </div>
  );
};
