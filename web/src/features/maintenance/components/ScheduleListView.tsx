import { EmptyState, ErrorState, LoadingState } from '@/components/common/States';
import { Pagination } from '@/components/common/Pagination';
import { useServiceQuery } from '@/hooks/useServiceQuery';
import { listOccurrences } from '@/services/maintenance-service';
import type { ScheduleFilterValues } from './ScheduleFilters';
import { OccurrenceTable } from './OccurrenceTable';

interface ScheduleListViewProps {
  filters: ScheduleFilterValues;
  page: number;
  onPageChange: (page: number) => void;
}

export const ScheduleListView = ({ filters, page, onPageChange }: ScheduleListViewProps) => {
  const query = useServiceQuery(['maintenance', 'occurrences', filters, page], () => listOccurrences({ ...filters, page }));
  if (query.isLoading) return <LoadingState />;
  if (query.error) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const result = query.data;
  if (!result || result.total === 0) {
    return <EmptyState title="Không có lượt bảo trì phù hợp" description="Thử bỏ bớt bộ lọc hoặc đổi khoảng ngày." />;
  }
  return (
    <>
      <OccurrenceTable rows={result.items} />
      <Pagination page={result.page} pageSize={result.pageSize} total={result.total} onPageChange={onPageChange} />
    </>
  );
};
