import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { BadgeCheck, Banknote, Download, FilePlus2, Wallet } from 'lucide-react';
import { Notice } from '@/components/common/Notice';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/States';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Input, NativeSelect } from '@/components/ui/input';
import { useReferenceData } from '@/hooks/useReferenceData';
import { useServiceQuery } from '@/hooks/useServiceQuery';
import { getRepairReport } from '@/services/report-service';
import type { ReportFilters } from '@/services/report-service';
import { todayVn } from '@/services/runtime';
import { downloadCsv } from '@/utils/csv';
import { formatVnd } from '@/utils/money';
import { StatCard, StatCardRow } from '@/components/ui/stat-card';
import { buildRepairCsv, reportFileName } from '../report-csv';
import { RepairRowsTable } from './RepairRowsTable';
import { StatusBars } from './StatusBars';

/** "Sửa chữa" tab of the report (spec 11.3). */
export const RepairReportPanel = ({ filters }: { filters: ReportFilters }) => {
  const lookup = useReferenceData();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'date' | 'status'>('date');
  const query = useServiceQuery(['reports', 'repair', filters], () => getRepairReport(filters));
  const report = query.data;
  const visibleRows = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('vi');
    return [...(report?.rows ?? [])]
      .filter((row) => !term || `${row.record.code} ${row.record.title}`.toLocaleLowerCase('vi').includes(term))
      .sort((a, b) => sort === 'status' ? a.record.status.localeCompare(b.record.status) : b.record.createdAt.localeCompare(a.record.createdAt));
  }, [report?.rows, search, sort]);

  if (query.isLoading) return <LoadingState rows={5} />;
  if (query.error || !report) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;

  const selectStatus = (status: string) => {
    const next = new URLSearchParams(params);
    if (filters.repairStatus === status) next.delete('repairStatus');
    else next.set('repairStatus', status);
    next.set('tab', 'repair');
    setParams(next, { replace: true });
  };

  const handleExport = () => {
    try {
      downloadCsv(reportFileName('bao-cao-sua-chua', todayVn()), buildRepairCsv({ ...report, rows: visibleRows }, lookup));
      toast.success(`Đã xuất ${visibleRows.length} dòng theo bộ lọc đang xem.`);
    } catch (error) {
      console.error('Export repair CSV failed:', error);
      toast.error('Không xuất được tệp CSV. Vui lòng thử lại.');
    }
  };

  return (
    <div className="space-y-4">
      <Notice tone="info" title="Kỳ lọc" className="rounded-lg px-3 py-2.5">
        Kỳ lọc: số lượng theo ngày tạo; giá trị duyệt theo ngày duyệt; đã thanh toán theo ngày thanh toán. Giá trị duyệt chỉ cộng tờ trình được
        duyệt của mỗi hồ sơ một lần.
      </Notice>
      <StatCardRow className="lg:grid-cols-4 xl:grid-cols-4">
        <StatCard compact icon={FilePlus2} value={report.createdCount} label="hồ sơ tạo trong kỳ" tone="accent" hint="Theo ngày tạo" />
        <StatCard compact icon={BadgeCheck} value={report.approvedCount} label="hồ sơ được duyệt" tone="good" hint="Theo ngày duyệt" />
        <StatCard compact icon={Banknote} value={formatVnd(report.approvedTotal)} label="tổng giá trị duyệt" tone="good" hint="Theo ngày duyệt" />
        <StatCard compact icon={Wallet} value={formatVnd(report.paidTotal)} label="tổng đã thanh toán" tone="accent" hint="Theo ngày thanh toán" />
      </StatCardRow>
      <Card className="shadow-none">
        <CardBody>
          <StatusBars title="Số hồ sơ theo trạng thái (theo ngày tạo)" rows={report.byStatus} selectedStatus={filters.repairStatus} onSelect={selectStatus} />
        </CardBody>
      </Card>
      <Card className="shadow-none">
        <CardHeader
          title="Danh sách hồ sơ trong kỳ"
          description={`${report.rows.length} hồ sơ tạo trong kỳ lọc`}
          actions={
            <Button variant="secondary" size="sm" onClick={handleExport} disabled={report.rows.length === 0}>
              <Download className="h-4 w-4" />
              Xuất CSV
            </Button>
          }
        />
        <CardBody>
          <div className="mb-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_12rem]">
            <Input className="h-11" placeholder="Tìm mã hoặc tên hồ sơ..." aria-label="Tìm hồ sơ sửa chữa" value={search} onChange={(event) => setSearch(event.target.value)} />
            <NativeSelect className="h-11" aria-label="Sắp xếp hồ sơ" value={sort} onChange={(event) => setSort(event.target.value as 'date' | 'status')}>
              <option value="date">Mới nhất trước</option>
              <option value="status">Theo trạng thái</option>
            </NativeSelect>
          </div>
          {report.rows.length === 0 ? (
            <EmptyState title="Không có hồ sơ trong kỳ lọc" description="Số 0 là chưa phát sinh hồ sơ theo kỳ và tòa nhà đang chọn." />
          ) : visibleRows.length === 0 ? (
            <EmptyState title="Không tìm thấy hồ sơ phù hợp" description="Thử đổi từ khóa tìm kiếm hoặc bỏ bộ lọc trạng thái." />
          ) : (
            <RepairRowsTable rows={visibleRows} buildingName={lookup.buildingName} />
          )}
        </CardBody>
      </Card>
    </div>
  );
};
