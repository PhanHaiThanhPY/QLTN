import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/common/PageHeader';
import { Pagination } from '@/components/common/Pagination';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/States';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useReferenceData } from '@/hooks/useReferenceData';
import { isAppError } from '@/domain/errors';
import { AUDIT_PAGE_SIZE, exportAuditEvents, listAuditEvents, type AuditLogFilters } from '@/services/http/audit-log-api';
import { todayVn } from '@/services/runtime';
import { addDays } from '@/utils/date';
import { downloadBlob } from '@/utils/download';
import { AuditFiltersBar } from './components/AuditFiltersBar';
import { AuditLogTable } from './components/AuditLogTable';

/** Default period: the last 7 days, today included (SPEC AD-S1 §3 step 2). */
export const defaultAuditFilters = (today: string): AuditLogFilters => ({
  buildingId: '',
  dateFrom: addDays(today, -6),
  dateTo: today,
  actorId: '',
  subjectType: '',
  action: '',
  subjectCode: '',
});

/** "nhat-ky-thao-tac-YYYYMMDD-HHmm.csv" in local time, the name the API also uses (BR-07). */
const exportFileName = (at: Date): string => {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `nhat-ky-thao-tac-${at.getFullYear()}${pad(at.getMonth() + 1)}${pad(at.getDate())}-${pad(at.getHours())}${pad(at.getMinutes())}.csv`;
};

/** "Nhật ký thao tác": every change in the viewer's scope, filtered, paged by 50 and exportable (api mode). */
const AuditLogPage = () => {
  const viewer = useCurrentUser();
  const { data: reference } = useReferenceData();
  const [filters, setFilters] = useState<AuditLogFilters>(() => defaultAuditFilters(todayVn()));
  const [page, setPage] = useState(1);
  const [isExporting, setIsExporting] = useState(false);
  const query = useQuery({
    queryKey: ['audit-events', filters, page],
    queryFn: () => listAuditEvents(filters, page),
    placeholderData: keepPreviousData,
  });

  const change = (patch: Partial<AuditLogFilters>) => {
    setFilters((current) => ({ ...current, ...patch }));
    setPage(1);
  };
  const reset = () => {
    setFilters(defaultAuditFilters(todayVn()));
    setPage(1);
  };
  const exportCsv = async () => {
    setIsExporting(true);
    try {
      downloadBlob(exportFileName(new Date()), await exportAuditEvents(filters));
      toast.success('Đã xuất nhật ký thao tác.');
    } catch (error) {
      console.error('Audit log export failed:', error);
      toast.error(isAppError(error) ? error.message : 'Không xuất được nhật ký. Vui lòng thử lại.');
    } finally {
      setIsExporting(false);
    }
  };

  const rows = query.data?.rows ?? [];
  const total = query.data?.total ?? 0;
  return (
    <div className="space-y-4">
      <PageHeader
        title="Nhật ký thao tác"
        description="Ai làm gì, lúc nào, với đối tượng nào trong phạm vi của bạn. Nhật ký chỉ đọc, không sửa hay xóa được."
        actions={
          <Button variant="secondary" isLoading={isExporting} disabled={total === 0} onClick={() => void exportCsv()}>
            <Download /> Xuất CSV
          </Button>
        }
      />
      <Card>
        <CardBody>
          <AuditFiltersBar filters={filters} reference={reference} onChange={change} onReset={reset} />
        </CardBody>
      </Card>
      <Card>
        <CardBody className="space-y-3">
          <p className="text-sm text-ink-2">{query.isLoading ? 'Đang tải…' : `${total} dòng`}</p>
          {query.isLoading ? <LoadingState rows={6} /> : null}
          {query.error ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : null}
          {!query.isLoading && !query.error && rows.length === 0 ? (
            <EmptyState title="Không có thao tác nào" description="Thử mở rộng khoảng thời gian hoặc bỏ bớt bộ lọc." />
          ) : null}
          {rows.length > 0 ? <AuditLogTable rows={rows} viewer={viewer} /> : null}
          {total > AUDIT_PAGE_SIZE ? (
            <Pagination page={page} pageSize={AUDIT_PAGE_SIZE} total={total} onPageChange={setPage} />
          ) : null}
        </CardBody>
      </Card>
    </div>
  );
};

export default AuditLogPage;
