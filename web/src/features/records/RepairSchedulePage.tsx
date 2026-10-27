import { CalendarDays, CalendarRange, List } from 'lucide-react';
import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState } from '@/components/common/States';
import { Pagination } from '@/components/common/Pagination';
import { Card, CardBody } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input, NativeSelect } from '@/components/ui/input';
import { ViewSwitch } from '@/components/ui/view-switch';
import type { ViewOption } from '@/components/ui/view-switch';
import { REPAIR_STATUS_GROUP_LABEL } from '@/domain/constants';
import type { RepairStatusGroup } from '@/domain/constants';
import type { IsoDate } from '@/domain/types';
import { useReferenceData } from '@/hooks/useReferenceData';
import { useServiceQuery } from '@/hooks/useServiceQuery';
import { todayVn } from '@/services/runtime';
import { listSchedule } from '@/services/schedule-service';
import type { ScheduleFilters } from '@/services/schedule-service';
import { AwaitingScheduleBlock } from './components/schedule/AwaitingScheduleBlock';
import { RepairScheduleTable } from './components/schedule/RepairScheduleTable';
import { RepairScheduleMonthView } from './components/schedule/RepairScheduleMonthView';
import { RepairScheduleWeekView } from './components/schedule/RepairScheduleWeekView';
import { ScheduleGridNotices } from './components/schedule/ScheduleGridNotices';
import { ScheduleLoadState } from './components/schedule/ScheduleLoadState';
import { EMPTY_SCHEDULE_HINT, mondayOf } from './components/schedule/repair-schedule-ui';

const STATUS_GROUP_OPTIONS = Object.entries(REPAIR_STATUS_GROUP_LABEL) as [RepairStatusGroup, string][];
type ScheduleView = 'list' | 'week' | 'month';

/** List filters: the shared ones plus the list-only date range (D-B4-4). */
interface ListFilters extends ScheduleFilters {
  dateFrom: IsoDate | '';
  dateTo: IsoDate | '';
}

const VIEW_OPTIONS: readonly ViewOption<ScheduleView>[] = [
  { value: 'list', label: 'Danh sách', icon: List },
  { value: 'week', label: 'Tuần', icon: CalendarRange },
  { value: 'month', label: 'Tháng', icon: CalendarDays },
];

const RepairSchedulePage = () => {
  const reference = useReferenceData();
  const today = todayVn();
  const [filters, setFilters] = useState<ListFilters>({ buildingId: '', locationId: '', statusGroup: '', dateFrom: '', dateTo: '' });
  const [view, setView] = useState<ScheduleView>('list');
  const [weekStart, setWeekStart] = useState<IsoDate>(mondayOf(today));
  const [month, setMonth] = useState(today.slice(0, 7));
  const [page, setPage] = useState(1);
  const { dateFrom, dateTo, buildingId, locationId, statusGroup } = filters;
  const gridFilters = useMemo<ScheduleFilters>(() => ({ buildingId, locationId, statusGroup }), [buildingId, locationId, statusGroup]);
  const awaitingFilters = useMemo(() => ({ buildingId, locationId }), [buildingId, locationId]);
  const query = useServiceQuery(
    ['repair-schedule', 'list', filters, page],
    () => listSchedule({ ...gridFilters, from: dateFrom || undefined, to: dateTo || undefined, page }),
    view === 'list',
  );
  const locations = (reference.data?.locations ?? []).filter((location) => !filters.buildingId || location.buildingId === filters.buildingId);

  const update = <K extends keyof ListFilters>(key: K, value: ListFilters[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };

  const renderBody = () => {
    if (view === 'week') return <RepairScheduleWeekView filters={gridFilters} weekStart={weekStart} today={today} onWeekChange={setWeekStart} />;
    if (view === 'month') return <RepairScheduleMonthView filters={gridFilters} month={month} today={today} onMonthChange={setMonth} />;
    if (!query.data) {
      return <ScheduleLoadState isLoading={query.isLoading || reference.isLoading} error={query.error} hasData={false} rows={5} onRetry={() => void query.refetch()} />;
    }
    if (query.data.total === 0) return <EmptyState title="Chưa có việc thi công phù hợp" description={EMPTY_SCHEDULE_HINT} />;
    return (
      <>
        <ScheduleGridNotices shown={query.data.total} total={query.data.total} />
        <div className="mb-3 flex items-center justify-between border-b border-line pb-3 text-sm">
          <span className="font-semibold text-ink">Lịch thi công</span>
          <span className="text-ink-2">{query.data.total} hồ sơ</span>
        </div>
        <RepairScheduleTable items={query.data.items} />
        <Pagination page={query.data.page} pageSize={query.data.pageSize} total={query.data.total} onPageChange={setPage} />
      </>
    );
  };

  return (
    <div>
      <PageHeader
        title="Lịch sửa chữa"
        description="Theo dõi thời gian thi công của các hồ sơ sửa chữa."
        actions={<CalendarDays className="hidden size-5 text-accent sm:block" aria-hidden />}
      />
      <Card className="mb-4 shadow-none">
        <CardBody className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Block / tòa nhà" htmlFor="repair-schedule-building">
            <NativeSelect id="repair-schedule-building" value={filters.buildingId ?? ''} onChange={(event) => update('buildingId', event.target.value)}>
              <option value="">Tất cả block / tòa</option>
              {(reference.data?.buildings ?? []).map((building) => <option key={building.id} value={building.id}>{building.name}</option>)}
            </NativeSelect>
          </Field>
          <Field label="Phòng / vị trí" htmlFor="repair-schedule-location">
            <NativeSelect id="repair-schedule-location" value={filters.locationId ?? ''} onChange={(event) => update('locationId', event.target.value)}>
              <option value="">Tất cả vị trí</option>
              {locations.map((location) => <option key={location.id} value={location.id}>{location.name} · Tầng {location.floor}</option>)}
            </NativeSelect>
          </Field>
          <Field label="Nhóm trạng thái" htmlFor="repair-schedule-status">
            <NativeSelect id="repair-schedule-status" value={filters.statusGroup ?? ''} onChange={(event) => update('statusGroup', event.target.value as RepairStatusGroup | '')}>
              <option value="">Tất cả trạng thái</option>
              {STATUS_GROUP_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </NativeSelect>
          </Field>
          {view === 'list' ? (
            <>
              <Field label="Từ ngày" htmlFor="repair-schedule-from">
                <Input id="repair-schedule-from" type="date" value={filters.dateFrom} onChange={(event) => update('dateFrom', event.target.value)} />
              </Field>
              <Field label="Đến ngày" htmlFor="repair-schedule-to">
                <Input id="repair-schedule-to" type="date" value={filters.dateTo} onChange={(event) => update('dateTo', event.target.value)} />
              </Field>
            </>
          ) : null}
        </CardBody>
      </Card>
      <AwaitingScheduleBlock filters={awaitingFilters} />
      <Card className="shadow-none">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
          <ViewSwitch label="Kiểu hiển thị lịch sửa chữa" value={view} options={VIEW_OPTIONS} onChange={setView} />
          <p className="text-xs text-ink-3">{view === 'list' ? 'Danh sách hồ sơ theo thời gian thi công' : 'Lịch thi công theo ngày'}</p>
        </div>
        <CardBody className="p-4 sm:p-5">{renderBody()}</CardBody>
      </Card>
    </div>
  );
};

export default RepairSchedulePage;
