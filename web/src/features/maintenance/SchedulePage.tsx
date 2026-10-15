import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router';
import { AlertTriangle, CalendarDays, CalendarRange, CheckCircle2, Clock3, List } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { AssistantInsight } from '@/components/assistant/AssistantInsight';
import { Card, CardBody } from '@/components/ui/card';
import { StatCard, StatCardRow } from '@/components/ui/stat-card';
import { ViewSwitch } from '@/components/ui/view-switch';
import type { ViewOption } from '@/components/ui/view-switch';
import type { OccurrenceStatus } from '@/domain/constants';
import type { IsoDate } from '@/domain/types';
import { OCCURRENCE_STATUS_LABEL } from '@/domain/constants';
import { todayVn } from '@/services/runtime';
import { listOccurrences } from '@/services/maintenance-service';
import { useServiceQuery } from '@/hooks/useServiceQuery';
import { RefreshScheduleButton } from './components/RefreshScheduleButton';
import { ScheduleCalendarView } from './components/ScheduleCalendarView';
import { EMPTY_SCHEDULE_FILTERS, ScheduleFilters } from './components/ScheduleFilters';
import type { ScheduleFilterValues } from './components/ScheduleFilters';
import { ScheduleListView } from './components/ScheduleListView';
import { ScheduleWeekView } from './components/ScheduleWeekView';
import { MaintenanceLocationTrail } from './components/MaintenanceLocationTrail';
import { OccurrenceFlags } from './components/OccurrenceFlags';
import { OccurrenceStatusBadge } from '@/components/common/StatusBadge';
import { subjectPath } from '@/utils/subject-link';
import { useMaintenanceScreen } from './hooks/useMaintenanceScreen';

type ScheduleView = 'list' | 'month' | 'week';

const VIEW_OPTIONS: readonly ViewOption<ScheduleView>[] = [
  { value: 'list', label: 'Danh sách', icon: List },
  { value: 'week', label: 'Tuần', icon: CalendarRange },
  { value: 'month', label: 'Tháng', icon: CalendarDays },
];

/** `calendar` is the legacy name of the month view, kept so old links still work. */
const VIEW_BY_PARAM: ReadonlyMap<string, ScheduleView> = new Map<string, ScheduleView>([
  ['list', 'list'],
  ['week', 'week'],
  ['month', 'month'],
  ['calendar', 'month'],
]);

const INSIGHT_BY_INDICATOR = {
  OVERDUE: 'Bạn đang lọc các lượt quá hạn; hãy kiểm tra người phụ trách và ngày dự kiến trước khi cập nhật.',
  UPCOMING: 'Bạn đang lọc các lượt sắp đến hạn; có thể rà soát năng lực và khoảng trống trước khi sắp xếp.',
  '': 'Lịch hiện tại có thể được rà soát theo tuần để nhận biết khoảng trống, lịch trùng và các lượt cần theo dõi.',
} as const satisfies Record<ScheduleFilterValues['indicator'], string>;

const isStatus = (value: string | null): value is OccurrenceStatus => value !== null && value in OCCURRENCE_STATUS_LABEL;

const FILTER_KEYS = ['buildingId', 'locationId', 'itemId', 'assigneeId', 'status', 'indicator', 'dateFrom', 'dateTo'] as const;
const MONTH_RE = /^\d{4}-\d{2}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Filters live in the URL (same names as OccurrenceFilters) so dashboard links open a filtered list. */
const filtersFromParams = (params: URLSearchParams): ScheduleFilterValues => {
  const indicator = params.get('indicator');
  const status = params.get('status');
  return {
    ...EMPTY_SCHEDULE_FILTERS,
    buildingId: params.get('buildingId') ?? '',
    locationId: params.get('locationId') ?? '',
    itemId: params.get('itemId') ?? '',
    assigneeId: params.get('assigneeId') ?? '',
    status: isStatus(status) ? status : '',
    indicator: indicator === 'OVERDUE' || indicator === 'UPCOMING' ? indicator : '',
    dateFrom: params.get('dateFrom') ?? '',
    dateTo: params.get('dateTo') ?? '',
  };
};

const SchedulePage = () => {
  const { data, itemName } = useMaintenanceScreen();
  const [params, setParams] = useSearchParams();
  const viewParam = params.get('view');
  const view: ScheduleView = VIEW_BY_PARAM.get(viewParam ?? '') ?? 'list';
  const filters = filtersFromParams(params);
  const page = Math.max(1, Number(params.get('page')) || 1);
  const monthParam = params.get('month') ?? '';
  const month = MONTH_RE.test(monthParam) ? monthParam : todayVn().slice(0, 7);
  const weekParam = params.get('week') ?? '';
  const week = (DATE_RE.test(weekParam) ? weekParam : todayVn()) as IsoDate;
  const summaryQuery = useServiceQuery(['maintenance', 'occurrences', 'summary', filters], () => listOccurrences({ ...filters, page: 1, pageSize: 5000 }));
  const summaryRows = summaryQuery.data?.items ?? [];
  const summary = useMemo(() => {
    const attention = summaryRows
      .filter(({ occurrence, indicator, needsReassignment }) => indicator === 'OVERDUE' || occurrence.status === 'PENDING_REVIEW' || needsReassignment)
      .slice(0, 4);
    return {
      overdue: summaryRows.filter(({ indicator }) => indicator === 'OVERDUE').length,
      today: summaryRows.filter(({ occurrence }) => occurrence.scheduledDate === todayVn() && occurrence.status !== 'COMPLETED').length,
      upcoming: summaryRows.filter(({ indicator }) => indicator === 'UPCOMING').length,
      pendingReview: summaryRows.filter(({ occurrence }) => occurrence.status === 'PENDING_REVIEW').length,
      attention,
    };
  }, [summaryRows]);

  const update = (mutate: (next: URLSearchParams) => void) => {
    const next = new URLSearchParams(params);
    mutate(next);
    setParams(next, { replace: true });
  };
  const setView = (nextView: ScheduleView) => update((next) => next.set('view', nextView));
  const setPage = (nextPage: number) => update((next) => next.set('page', String(nextPage)));
  const setMonth = (nextMonth: string) => update((next) => next.set('month', nextMonth));
  const setWeek = (nextWeek: IsoDate) => update((next) => next.set('week', nextWeek));
  const handleFilters = (nextFilters: ScheduleFilterValues) =>
    update((next) => {
      FILTER_KEYS.forEach((key) => {
        if (nextFilters[key]) next.set(key, nextFilters[key]);
        else next.delete(key);
      });
      next.delete('page');
    });

  return (
    <div>
      <div className="mb-4">
        <AssistantInsight
          context="Lịch bảo trì"
          summary={INSIGHT_BY_INDICATOR[filters.indicator]}
          details="Tôi chưa tự đổi lịch hoặc tạo lịch hẹn. Hãy dùng bộ lọc và chế độ xem để kiểm tra dữ liệu nguồn trước khi xác nhận thay đổi."
          sourceHref="#schedule-filters"
          sourceLabel="Xem lịch nguồn"
          suggestions={['Kiểm tra lịch trùng', 'Tóm tắt tuần này']}
        />
      </div>
      <PageHeader
        title="Lịch bảo trì"
        description="Theo dõi các lượt bảo trì theo kế hoạch tại các block / tòa nhà của bạn."
        actions={<RefreshScheduleButton viewer={data?.viewer} />}
      />
      <StatCardRow className="mb-4 xl:grid-cols-4">
        <StatCard compact icon={AlertTriangle} value={summaryQuery.isLoading ? '—' : summary.overdue} label="Quá hạn" tone="crit" hint="Cần xử lý trước" />
        <StatCard compact icon={Clock3} value={summaryQuery.isLoading ? '—' : summary.today} label="Cần làm hôm nay" tone="warn" hint="Chưa hoàn tất" />
        <StatCard compact icon={CalendarDays} value={summaryQuery.isLoading ? '—' : summary.upcoming} label="7 ngày tới" tone="info" hint="Đã lên lịch" />
        <StatCard compact icon={CheckCircle2} value={summaryQuery.isLoading ? '—' : summary.pendingReview} label="Chờ kiểm tra" tone="accent" hint="Cần xác nhận kết quả" />
      </StatCardRow>
      {summary.attention.length > 0 ? (
        <Card className="mb-4 border-warn/30 shadow-none">
          <CardBody className="p-3.5 sm:p-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-ink">Cần xử lý ngay ({summary.attention.length})</h2>
                <p className="text-xs text-ink-2">Ưu tiên các lượt quá hạn, chờ kiểm tra hoặc cần phân công lại.</p>
              </div>
              <span className="text-xs text-ink-3">Trong phạm vi đang lọc</span>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {summary.attention.map(({ occurrence, indicator, needsReassignment, pendingSince }) => (
                <Link key={occurrence.id} to={subjectPath('MAINTENANCE_OCCURRENCE', occurrence.id)} className="flex min-h-12 items-center justify-between gap-3 rounded-lg border border-line bg-surface-2 px-3 py-2 hover:border-accent">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-ink">{occurrence.code} · {itemName(occurrence.itemId)}</span>
                    <span className="mt-0.5 block truncate text-xs text-ink-2"><MaintenanceLocationTrail data={data} buildingId={occurrence.buildingId} itemId={occurrence.itemId} compact /></span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <OccurrenceStatusBadge status={occurrence.status} />
                    <OccurrenceFlags occurrence={occurrence} indicator={indicator} needsReassignment={needsReassignment} pendingSince={pendingSince} />
                  </span>
                </Link>
              ))}
            </div>
          </CardBody>
        </Card>
      ) : null}
      <Card className="mb-4 shadow-none">
        <CardBody id="schedule-filters" className="space-y-3 p-3.5 sm:p-4">
          <ScheduleFilters value={filters} onChange={handleFilters} showDates={view === 'list'} />
          <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 border-t border-line pt-2.5 text-xs text-ink-2">
            <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-accent" />Bảo trì</span>
            <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-warn" />Lịch hẹn</span>
            <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-good" />Hoàn tất</span>
          </div>
        </CardBody>
      </Card>
      <Card className="shadow-none">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
          <ViewSwitch label="Kiểu hiển thị" value={view} options={VIEW_OPTIONS} onChange={setView} />
          <p className="text-xs text-ink-3">{view === 'list' ? 'Mỗi dòng: Block / Tòa → Tầng → Phòng' : 'Theo ngày và vị trí bảo trì'}</p>
        </div>
        <div className="p-4">
          {view === 'list' ? <ScheduleListView filters={filters} page={page} onPageChange={setPage} /> : null}
          {view === 'week' ? (
            <ScheduleWeekView filters={filters} weekStart={week} today={todayVn()} onWeekChange={setWeek} />
          ) : null}
          {view === 'month' ? <ScheduleCalendarView filters={filters} month={month} onMonthChange={setMonth} /> : null}
        </div>
      </Card>
    </div>
  );
};

export default SchedulePage;
