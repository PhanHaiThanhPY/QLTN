import { toast } from 'sonner';
import { BadgeCheck, Banknote, Download, FilePlus2, Wallet } from 'lucide-react';
import { Notice } from '@/components/common/Notice';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/States';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
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
  const query = useServiceQuery(['reports', 'repair', filters], () => getRepairReport(filters));

  if (query.isLoading) return <LoadingState rows={5} />;
  if (query.error || !query.data) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const report = query.data;

  const handleExport = () => {
    try {
      downloadCsv(reportFileName('bao-cao-sua-chua', todayVn()), buildRepairCsv(report, lookup));
      toast.success(`Đã xuất ${report.rows.length} dòng ra CSV.`);
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
        <StatCard icon={FilePlus2} value={report.createdCount} label="hồ sơ tạo trong kỳ" tone="accent" hint="Theo ngày tạo" />
        <StatCard icon={BadgeCheck} value={report.approvedCount} label="hồ sơ được duyệt" tone="good" hint="Theo ngày duyệt" />
        <StatCard icon={Banknote} value={formatVnd(report.approvedTotal)} label="tổng giá trị duyệt" tone="good" hint="Theo ngày duyệt" />
        <StatCard icon={Wallet} value={formatVnd(report.paidTotal)} label="tổng đã thanh toán" tone="accent" hint="Theo ngày thanh toán" />
      </StatCardRow>
      <Card className="shadow-none">
        <CardBody>
          <StatusBars title="Số hồ sơ theo trạng thái (theo ngày tạo)" rows={report.byStatus} />
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
          {report.rows.length === 0 ? (
            <EmptyState title="Không có hồ sơ trong kỳ lọc" />
          ) : (
            <RepairRowsTable rows={report.rows} buildingName={lookup.buildingName} />
          )}
        </CardBody>
      </Card>
    </div>
  );
};
