import { useNavigate } from 'react-router';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Pagination } from '@/components/common/Pagination';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/States';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { hasCapability } from '@/domain/permissions';
import { useReferenceData } from '@/hooks/useReferenceData';
import { useServiceQuery } from '@/hooks/useServiceQuery';
import { listRecords } from '@/services/records-service';
import { RecordCardList } from './components/list/RecordCardList';
import { RecordFiltersBar } from './components/list/RecordFiltersBar';
import { RecordTable } from './components/list/RecordTable';
import { useRecordFilters } from './hooks/useRecordFilters';

/** Repair record list with URL-backed filters and pagination (spec 2). */
const RecordsPage = () => {
  const reference = useReferenceData();
  const navigate = useNavigate();
  const { filters, overdueOnly, setFilter, setPage, clear, hasFilters } = useRecordFilters();
  const query = useServiceQuery(['records', filters], () => listRecords(filters));
  const viewer = reference.data?.viewer;
  const canCreate = viewer ? hasCapability(viewer, 'RECORD_EDIT') : false;

  const renderBody = () => {
    if (query.isLoading || reference.isLoading) return <LoadingState rows={5} />;
    if (query.error) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
    const page = query.data;
    if (!page || page.items.length === 0) {
      return (
        <EmptyState
          title={hasFilters ? 'Không có hồ sơ phù hợp' : 'Chưa có hồ sơ sửa chữa'}
          description={hasFilters ? 'Thử đổi hoặc xóa bộ lọc.' : 'Hồ sơ sửa chữa trong phạm vi tòa nhà của bạn sẽ hiển thị ở đây.'}
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
