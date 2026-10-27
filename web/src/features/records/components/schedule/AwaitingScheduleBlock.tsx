import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { ErrorState, LoadingState } from '@/components/common/States';
import { MaintenanceLocationTrail } from '@/features/maintenance/components/MaintenanceLocationTrail';
import { useReferenceData } from '@/hooks/useReferenceData';
import { useServiceQuery } from '@/hooks/useServiceQuery';
import { AWAITING_LIMIT, listAwaitingSchedule } from '@/services/schedule-service';
import type { ScheduleFilters } from '@/services/schedule-service';
import { formatDate, toVnDate } from '@/utils/date';

interface AwaitingScheduleBlockProps {
  filters: Pick<ScheduleFilters, 'buildingId' | 'locationId'>;
}

const BODY_ID = 'awaiting-schedule-body';

/** `/records` filtered on "Chờ thi công" and the chosen building, behind "Xem tất cả" (ui-brief §2.5). */
const allReadyHref = (buildingId: string | undefined): string => {
  const params = new URLSearchParams({ status: 'READY_FOR_CONSTRUCTION' });
  if (buildingId) params.set('buildingId', buildingId);
  return `/records?${params.toString()}`;
};

/**
 * "Chờ xếp lịch" (BR-B4-05): approved records whose construction has not started, under the building and location
 * filters only. Collapsible; open by default when it has records. Its error never blocks the calendar below.
 */
export const AwaitingScheduleBlock = ({ filters }: AwaitingScheduleBlockProps) => {
  const { data } = useReferenceData();
  const query = useServiceQuery(['repair-schedule', 'awaiting', filters], () => listAwaitingSchedule(filters));
  const total = query.data?.total ?? 0;
  // null until the reader toggles: follows the content until then (open with records, or to show its error).
  const [expanded, setExpanded] = useState<boolean | null>(null);
  const isOpen = expanded ?? (total > 0 || Boolean(query.error));

  const renderBody = () => {
    if (query.error) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
    if (!query.data) return <LoadingState rows={2} />;
    if (query.data.items.length === 0) return <p className="text-sm text-ink-3">Không có hồ sơ nào đang chờ xếp lịch.</p>;
    return (
      <>
        <ul className="divide-y divide-line">
          {query.data.items.map(({ record, readySince, contractorName }) => (
            <li key={record.id}>
              <Link to={`/records/${record.id}`} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2 text-sm hover:text-accent">
                <span className="font-medium text-accent">{record.code}</span>
                <span className="min-w-48 flex-1 font-medium text-ink">{record.title || '(Chưa đặt tên)'}</span>
                <MaintenanceLocationTrail data={data} buildingId={record.buildingId} locationId={record.locationId} compact />
                <span className="text-xs text-ink-2">
                  {readySince ? `Duyệt xong ${formatDate(toVnDate(readySince)).slice(0, 5)}` : null}
                  {readySince && contractorName ? ' · ' : null}
                  {contractorName ? `Nhà thầu: ${contractorName}` : null}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        {total > AWAITING_LIMIT ? (
          <Link to={allReadyHref(filters.buildingId)} className="mt-2 inline-block text-sm font-medium text-accent hover:underline">
            Xem tất cả {total} hồ sơ
          </Link>
        ) : null}
      </>
    );
  };

  const Chevron = isOpen ? ChevronDown : ChevronRight;
  return (
    <section className="mb-4 rounded-xl border border-line bg-surface">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={BODY_ID}
        onClick={() => setExpanded(!isOpen)}
        className="flex w-full flex-wrap items-center gap-x-2 gap-y-0.5 px-4 py-3 text-left text-sm"
      >
        <Chevron className="size-4 text-ink-3" aria-hidden />
        <span className="whitespace-nowrap font-semibold text-ink">Chờ xếp lịch ({total})</span>
        <span className="text-ink-3">— đã duyệt, chưa bắt đầu thi công</span>
      </button>
      {isOpen ? <div id={BODY_ID} className="border-t border-line px-4 py-2">{renderBody()}</div> : null}
    </section>
  );
};
