import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CalendarClock, CalendarDays, CheckCircle2, ClipboardList, Lightbulb } from 'lucide-react';
import { Link } from 'react-router';
import { PageHeader } from '@/components/common/PageHeader';
import { AssistantInsight } from '@/components/assistant/AssistantInsight';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/States';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { IS_API_MODE } from '@/config/data-source';
import { useOnline } from '@/hooks/useOnline';
import { useReferenceData } from '@/hooks/useReferenceData';
import { useServiceQuery } from '@/hooks/useServiceQuery';
import { getMyTaskBoard } from '@/services/my-tasks-service';
import { cn } from '@/lib/cn';
import { ContinueTaskCard } from './components/ContinueTaskCard';
import { DoneTaskTable } from './components/DoneTaskTable';
import { TaskCard } from './components/TaskCard';
import { TaskFilterBar } from './components/TaskFilterBar';
import { TaskMetricCard } from './components/TaskMetricCard';
import { TaskTable } from './components/TaskTable';
import { NO_FILTERS, compareTasks, countTasks, fold, hasFilters, matchesFilters, vnDayLabel } from './task-list';
import type { DueFilter, TaskFilters } from './task-list';

type TaskTab = 'open' | 'done';

const tabClass = (active: boolean): string =>
  cn('border-b-2 px-1 py-3 text-sm font-semibold', active ? 'border-accent text-accent' : 'border-transparent text-ink-2');

/** "Công việc của tôi" (SPEC TK-S1): repair tasks from the API in api mode, the demo's stored tasks in mock mode. */
const TasksPage = () => {
  const [tab, setTab] = useState<TaskTab>('open');
  const [filters, setFilters] = useState<TaskFilters>(NO_FILTERS);
  const { buildingName, locationName, data: reference } = useReferenceData();
  const online = useOnline();
  const query = useServiceQuery(['tasks', 'board'], getMyTaskBoard);
  const { refetch } = query;

  // A task finished in another tab disappears when the person comes back (ui-brief §4).
  useEffect(() => {
    const onFocus = () => void refetch();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refetch]);

  const board = query.data;
  const today = board?.today ?? '';
  const now = useMemo(() => new Date(query.dataUpdatedAt || Date.now()), [query.dataUpdatedAt]);
  const open = useMemo(() => [...(board?.open ?? [])].sort(compareTasks), [board?.open]);
  const done = useMemo(() => board?.done ?? [], [board?.done]);
  const counts = useMemo(() => countTasks(open, done.length, today), [open, done.length, today]);
  const labels = useMemo(() => [...new Set(open.map((row) => row.label))].sort((a, b) => a.localeCompare(b, 'vi')), [open]);
  const rows = useMemo(() => open.filter((row) => matchesFilters(row, filters, today)), [open, filters, today]);
  const doneRows = useMemo(() => {
    const search = fold(filters.search);
    return done.filter((row) => (!search || fold(`${row.code} ${row.title} ${row.label}`).includes(search)) && (!filters.buildingId || row.buildingId === filters.buildingId));
  }, [done, filters.search, filters.buildingId]);
  const buildings = useMemo(() => (reference?.buildings ?? []).filter((row) => reference?.viewer.buildingIds.includes(row.id)), [reference]);
  const buildingCount = new Set(open.map((row) => row.buildingId)).size;
  const filtered = hasFilters(filters);

  const update = (patch: Partial<TaskFilters>) => setFilters((current) => ({ ...current, ...patch }));
  const showDue = (due: DueFilter) => {
    setTab('open');
    update({ due });
  };
  const clear = () => setFilters(NO_FILTERS);

  const renderOpen = () => {
    if (rows.length === 0 && filtered) {
      return <EmptyState title="Không có việc phù hợp." action={<Button variant="secondary" onClick={clear}>Xóa bộ lọc</Button>} />;
    }
    if (rows.length === 0) {
      return <EmptyState title="Không có việc nào đang chờ bạn" description="Khi một hồ sơ sửa chữa đến bước của bạn, việc sẽ xuất hiện ở đây." />;
    }
    const [first, ...rest] = rows;
    const continueCard = filtered ? null : (
      <ContinueTaskCard row={first} now={now} today={today} place={`${buildingName(first.buildingId)}${first.locationId ? ` · ${locationName(first.locationId)}` : ''}`} />
    );
    const phoneRows = filtered ? rows : rest;
    return (
      <>
        <Card className="hidden overflow-hidden shadow-none md:block">
          <TaskTable rows={rows} buildingName={buildingName} locationName={locationName} now={now} today={today} />
        </Card>
        <div className="space-y-2 md:hidden">
          {continueCard}
          {phoneRows.length > 0 && continueCard ? <h2 className="pt-2 text-sm font-semibold text-ink-2">Việc khác của bạn</h2> : null}
          {phoneRows.map((row) => <TaskCard key={row.id} row={row} now={now} today={today} buildingName={buildingName} />)}
        </div>
      </>
    );
  };

  const renderBody = () => {
    if (query.isLoading) return <LoadingState rows={5} />;
    if (query.error || !board) {
      return <ErrorState error={query.error ?? new Error('Không tải được công việc.')} onRetry={() => void refetch()} />;
    }
    if (tab === 'open') return renderOpen();
    if (doneRows.length === 0) return <EmptyState title="Bạn chưa hoàn thành việc nào trong 30 ngày qua." />;
    return (
      <Card className="overflow-hidden shadow-none md:block">
        <DoneTaskTable rows={doneRows} />
      </Card>
    );
  };

  return (
    <div>
      <PageHeader
        title="Công việc của tôi"
        description={counts.open > 0 ? `${counts.open} việc đang chờ bạn tại ${buildingCount} tòa nhà` : 'Không có việc nào đang chờ bạn'}
        actions={
          today ? (
            <div className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-semibold text-ink-2">
              <CalendarDays className="size-4 text-accent" aria-hidden />
              Hôm nay, {vnDayLabel(today)}
            </div>
          ) : null
        }
      />
      {online ? null : <p className="mb-3 text-xs text-ink-3">Đang mất kết nối, danh sách có thể chưa mới nhất.</p>}
      <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <TaskMetricCard icon={ClipboardList} label="Đang mở" value={counts.open} hint="Việc đang chờ bạn" tone="neutral" pressed={tab === 'open' && filters.due === 'ALL'} onSelect={() => showDue('ALL')} />
        <TaskMetricCard icon={AlertCircle} label="Quá hạn" value={counts.overdue} hint="Cần làm trước" tone="crit" pressed={tab === 'open' && filters.due === 'OVERDUE'} onSelect={() => showDue('OVERDUE')} />
        <TaskMetricCard icon={CalendarClock} label="Đến hạn hôm nay" value={counts.dueToday} hint="Chưa quá hạn" tone="warn" pressed={tab === 'open' && filters.due === 'TODAY'} onSelect={() => showDue('TODAY')} />
        <TaskMetricCard icon={CheckCircle2} label="Đã hoàn thành (30 ngày)" value={counts.done} hint="Việc bạn đã làm" tone="good" pressed={tab === 'done'} onSelect={() => setTab('done')} />
      </div>
      <div className="mb-4">
        <AssistantInsight
          context="Công việc của tôi"
          summary={counts.overdue > 0 ? `Nên bắt đầu với ${counts.overdue} việc quá hạn, sau đó chuyển sang các việc có hạn gần nhất.` : 'Chưa có công việc quá hạn trong danh sách đang mở.'}
          details={`${counts.open} việc đang mở${counts.dueToday > 0 ? ` · ${counts.dueToday} việc đến hạn hôm nay` : ''}. Nhận xét này chỉ dựa trên bộ lọc và dữ liệu bạn đang xem.`}
          sourceHref="#task-search"
          sourceLabel="Xem danh sách nguồn"
          suggestions={['Sắp xếp việc cần làm', 'Soạn cập nhật tiến độ']}
        />
      </div>
      <Card className="mb-4 overflow-hidden shadow-none">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 pt-2 sm:px-5">
          <div className="flex items-center gap-5" role="tablist" aria-label="Công việc">
            <button type="button" role="tab" aria-selected={tab === 'open'} onClick={() => setTab('open')} className={tabClass(tab === 'open')}>Đang mở ({counts.open})</button>
            <button type="button" role="tab" aria-selected={tab === 'done'} onClick={() => setTab('done')} className={tabClass(tab === 'done')}>Đã hoàn thành ({counts.done})</button>
          </div>
          <Link to="/assistant" className="hidden items-center gap-1.5 text-sm font-semibold text-accent sm:inline-flex"><Lightbulb className="size-4" aria-hidden />An Nhi · AI</Link>
        </div>
        <CardBody className="p-4 sm:p-5">
          <TaskFilterBar filters={filters} buildings={buildings} labels={labels} showSubject={!IS_API_MODE} onChange={update} onClear={clear} />
        </CardBody>
      </Card>
      {renderBody()}
    </div>
  );
};

export default TasksPage;
