import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router';
import { AlertTriangle, CheckCircle2, Clock3, ListTodo, Plus } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Pagination } from '@/components/common/Pagination';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/States';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { StatCard, StatCardRow } from '@/components/ui/stat-card';
import { IS_API_MODE } from '@/config/data-source';
import { REPAIR_FINAL_STATUSES } from '@/domain/constants';
import { AppError, ERROR_CODE } from '@/domain/errors';
import { hasCapability } from '@/domain/permissions';
import { useReferenceData } from '@/hooks/useReferenceData';
import { useServiceQuery } from '@/hooks/useServiceQuery';
import { listRecords, getRecordSummary } from '@/services/records-service';
import { RecordCardList } from './components/list/RecordCardList';
import { RecordFiltersBar } from './components/list/RecordFiltersBar';
import { RecordSummaryCards } from './components/list/RecordSummaryCards';
import { RecordTable } from './components/list/RecordTable';
import { useRecordFilters } from './hooks/useRecordFilters';

/** Repair record list with URL-backed filters and pagination (spec 2). */
const RecordsPage = () => {
  const reference = useReferenceData();
  const navigate = useNavigate();
  const { filters, overdueOnly, setFilter, setPage, clear, hasFilters } = useRecordFilters();
  const query = useServiceQuery(['records', filters], () => listRecords(filters));
  // Mock counters read the demo database (unchanged); api counters come from one server query (D2-T4b).
  const summaryQuery = useServiceQuery(['records', 'summary'], () => listRecords({ page: 1, pageSize: 5000 }), !IS_API_MODE);
  const apiSummaryQuery = useServiceQuery(
    ['records', 'summary', 'api', filters.buildingId ?? ''],
    () => getRecordSummary({ buildingId: filters.buildingId }),
    IS_API_MODE,
  );
  const viewer = reference.data?.viewer;
  const canCreate = viewer ? hasCapability(viewer, 'RECORD_EDIT') : false;
  const summaryRows = summaryQuery.data?.items ?? [];
  const summary = useMemo(() => {
    const open = summaryRows.filter(({ record }) => !REPAIR_FINAL_STATUSES.includes(record.status));
    const overdue = summaryRows.filter(({ isOverdue }) => isOverdue);
    const needsAction = summaryRows.filter(({ record, isOverdue, needsReassignment }) =>
      isOverdue || needsReassignment || ['NEEDS_RECORD_UPDATE', 'NEEDS_SUBMISSION_UPDATE', 'NEEDS_PAYMENT_UPDATE', 'NEEDS_REPAIR', 'UNRESOLVED'].includes(record.status),
    );
    return {
      open: open.length,
      overdue: overdue.length,
      needsAction: needsAction.length,
      completed: summaryRows.filter(({ record }) => record.status === 'COMPLETED').length,
      attention: needsAction.slice(0, 4),
    };
  }, [summaryRows]);

  const renderBody = () => {
    if (query.isLoading || reference.isLoading) return <LoadingState rows={5} />;
    // No data is never "empty": a paused/aborted/failed query must say so and offer a retry.
    if (query.error || !query.data) {
      const error = query.error ?? new AppError(ERROR_CODE.NETWORK_ERROR, 'Không tải được danh sách hồ sơ. Vui lòng thử lại.');
      return <ErrorState error={error} onRetry={() => void query.refetch()} />;
    }
    const page = query.data;
    if (page.items.length === 0) {
      return hasFilters ? (
        <EmptyState
          title="Không có hồ sơ phù hợp"
          description="Thử đổi hoặc xóa bộ lọc."
          action={<Button variant="outline" size="sm" onClick={clear}>Xóa bộ lọc</Button>}
        />
      ) : (
        <EmptyState
          title="Chưa có hồ sơ sửa chữa"
          description="Hồ sơ sửa chữa trong phạm vi tòa nhà của bạn sẽ hiển thị ở đây."
          action={canCreate ? <Button onClick={() => navigate('/records/new')}>Tạo hồ sơ</Button> : null}
        />
      );
    }
    return (
      <>
        <div className="mb-3 flex items-center justify-between border-b border-line pb-3 text-sm">
          <span className="font-semibold text-ink">Danh sách hồ sơ</span>
          <span className="text-ink-2">{page.total} hồ sơ</span>
        </div>
        <RecordTable items={page.items} />
        <RecordCardList items={page.items} />
        <Pagination page={page.page} pageSize={page.pageSize} total={page.total} onPageChange={setPage} />
      </>
    );
  };

  return (
    <div>
      <PageHeader
        title="Hồ sơ sửa chữa"
        description="Theo dõi hồ sơ từ khi ghi nhận hư hỏng đến khi thanh toán và hoàn tất."
        actions={
          canCreate ? (
            <Button onClick={() => navigate('/records/new')}>
              <Plus className="h-4 w-4" />
              Tạo hồ sơ
            </Button>
          ) : null
        }
      />
      {!IS_API_MODE ? (
        <>
          <StatCardRow className="mb-4 xl:grid-cols-4">
            <StatCard compact icon={ListTodo} value={summaryQuery.isLoading ? '—' : summary.open} label="Hồ sơ đang mở" tone="info" hint="Cần theo dõi" />
            <StatCard compact icon={AlertTriangle} value={summaryQuery.isLoading ? '—' : summary.overdue} label="Quá hạn" tone="crit" hint="Ưu tiên xử lý" onClick={() => setFilter('overdue', '1')} />
            <StatCard compact icon={Clock3} value={summaryQuery.isLoading ? '—' : summary.needsAction} label="Cần xử lý" tone="warn" hint="Có cảnh báo hoặc thiếu bước" />
            <StatCard compact icon={CheckCircle2} value={summaryQuery.isLoading ? '—' : summary.completed} label="Hoàn tất" tone="good" hint="Đã kết thúc" />
          </StatCardRow>
          {summary.attention.length > 0 ? (
            <Card className="mb-4 border-warn/30 shadow-none">
              <CardHeader title={`Cần xử lý ngay (${summary.needsAction})`} description="Các hồ sơ quá hạn, thiếu phân công hoặc đang chờ bổ sung thông tin." actions={<button type="button" className="text-xs font-semibold text-accent hover:underline" onClick={() => setFilter('overdue', '1')}>Lọc hồ sơ quá hạn</button>} />
              <CardBody className="grid gap-2 pt-0 md:grid-cols-2">
                {summary.attention.map(({ record, isOverdue, needsReassignment }) => (
                  <Link key={record.id} to={`/records/${record.id}`} className="flex min-h-12 items-center justify-between gap-3 rounded-lg border border-line bg-surface-2 px-3 py-2 transition-colors hover:border-accent">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-ink">{record.code} · {record.title || 'Hồ sơ chưa đặt tên'}</span>
                      <span className="block truncate text-xs text-ink-2">{reference.data ? `${reference.data.buildings.find((building) => building.id === record.buildingId)?.name ?? 'Chưa gán tòa'} · ${reference.data.locations.find((location) => location.id === record.locationId)?.name ?? 'Chưa gán vị trí'}` : 'Đang tải vị trí'}</span>
                    </span>
                    <span className="shrink-0 text-right text-[0.6875rem] font-semibold text-crit">{isOverdue ? 'Quá hạn' : needsReassignment ? 'Cần phân công' : 'Cần cập nhật'}</span>
                  </Link>
                ))}
              </CardBody>
            </Card>
          ) : null}
        </>
      ) : apiSummaryQuery.data ? (
        // A failed counter query hides the row silently (secondary query); the list below still runs.
        <RecordSummaryCards summary={apiSummaryQuery.data} buildingId={filters.buildingId} />
      ) : null}
      {reference.data ? (
        <Card className="mb-4 shadow-none">
          <CardBody className="p-4">
            <RecordFiltersBar filters={filters} reference={reference.data} overdueOnly={overdueOnly} hasFilters={hasFilters} onChange={setFilter} onClear={clear} />
          </CardBody>
        </Card>
      ) : null}
      <Card className="shadow-none">
        <CardBody className="p-4 sm:p-5">{renderBody()}</CardBody>
      </Card>
    </div>
  );
};

export default RecordsPage;
