import { useMemo, useState } from 'react';
import { AlertCircle, CalendarDays, CheckCircle2, ClipboardList, Lightbulb, Search } from 'lucide-react';
import { Link } from 'react-router';
import { PageHeader } from '@/components/common/PageHeader';
import { AssistantInsight } from '@/components/assistant/AssistantInsight';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/States';
import { Card, CardBody } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input, NativeSelect } from '@/components/ui/input';
import { useReferenceData } from '@/hooks/useReferenceData';
import { useServiceQuery } from '@/hooks/useServiceQuery';
import { getMyTasks } from '@/services/tasks-service';
import { TASK_KIND_LABEL } from '@/domain/constants';
import { TaskCard } from './components/TaskCard';
import { TaskMetricCard } from './components/TaskMetricCard';
import { TaskTable } from './components/TaskTable';
import { TASK_TYPE_FILTER_LABEL, matchesTypeFilter } from './task-labels';
import type { TaskTypeFilter } from './task-labels';

const FILTER_OPTIONS = Object.keys(TASK_TYPE_FILTER_LABEL) as TaskTypeFilter[];
type DueFilter = 'ALL' | 'OVERDUE' | 'UPCOMING';

const matchesSearch = (row: Awaited<ReturnType<typeof getMyTasks>>[number], search: string): boolean => {
  const query = search.trim().toLowerCase();
  if (!query) return true;
  return [TASK_KIND_LABEL[row.task.kind], row.subjectCode, row.subjectTitle].join(' ').toLowerCase().includes(query);
};

/** "Công việc của tôi": repair and maintenance tasks assigned to the viewer. */
const TasksPage = () => {
  const [typeFilter, setTypeFilter] = useState<TaskTypeFilter>('ALL');
  const [showDone, setShowDone] = useState(false);
  const [search, setSearch] = useState('');
  const [dueFilter, setDueFilter] = useState<DueFilter>('ALL');
  const { buildingName, data: reference } = useReferenceData();
  const query = useServiceQuery(['tasks', 'mine', 'all'], () => getMyTasks(true));

  const allRows = query.data ?? [];
  const openCount = allRows.filter((row) => row.task.status === 'OPEN').length;
  const overdueCount = allRows.filter((row) => row.task.status === 'OPEN' && row.isOverdue).length;
  const upcomingCount = allRows.filter((row) => row.task.status === 'OPEN' && !row.isOverdue && Boolean(row.task.dueAt)).length;
  const rows = useMemo(() => allRows.filter((row) => {
    if (row.task.status !== (showDone ? 'DONE' : 'OPEN')) return false;
    if (!matchesTypeFilter(row.task.subjectType, typeFilter)) return false;
    if (!matchesSearch(row, search)) return false;
    if (dueFilter === 'OVERDUE' && !row.isOverdue) return false;
    if (dueFilter === 'UPCOMING' && (row.isOverdue || !row.task.dueAt)) return false;
    return true;
  }), [allRows, dueFilter, search, showDone, typeFilter]);
  const scopeCount = reference?.viewer.buildingIds.length ?? 0;
  const clearFilters = () => {
    setSearch('');
    setTypeFilter('ALL');
    setDueFilter('ALL');
  };

  const renderBody = () => {
    if (query.isLoading) return <LoadingState rows={5} />;
    if (query.error) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
    if (rows.length === 0) {
      return (
        <EmptyState
          title={showDone ? 'Không có công việc nào' : 'Không có việc nào đang chờ bạn'}
          description="Khi hồ sơ sửa chữa hoặc lượt bảo trì đến bước của bạn, công việc sẽ xuất hiện ở đây."
        />
      );
    }
    return (
      <>
        <Card className="hidden overflow-hidden shadow-none md:block">
          <TaskTable rows={rows} buildingName={buildingName} />
        </Card>
        <div className="space-y-2 md:hidden">
          {rows.map((row) => (
            <TaskCard key={row.task.id} row={row} buildingName={buildingName} />
          ))}
        </div>
      </>
    );
  };

  return (
    <div>
      <PageHeader
        title="Công việc của tôi"
        description={`${openCount} công việc được giao cho bạn${scopeCount > 0 ? ` tại ${scopeCount} tòa nhà` : ''}`}
        actions={<div className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-semibold text-ink-2"><CalendarDays className="size-4 text-accent" aria-hidden />Tháng 10, 2026</div>}
      />
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <TaskMetricCard icon={CheckCircle2} label="Cần xử lý hôm nay" value={openCount - overdueCount} hint="Việc đang mở" tone="good" onSelect={() => { setShowDone(false); setDueFilter('ALL'); }} />
        <TaskMetricCard icon={AlertCircle} label="Quá hạn" value={overdueCount} hint="Cần ưu tiên" tone="crit" onSelect={() => { setShowDone(false); setDueFilter('OVERDUE'); }} />
        <TaskMetricCard icon={CalendarDays} label="Sắp tới" value={upcomingCount} hint="Có hạn xử lý" tone="warn" onSelect={() => { setShowDone(false); setDueFilter('UPCOMING'); }} />
        <TaskMetricCard icon={ClipboardList} label="Tổng cộng" value={openCount} hint="Công việc đang mở" tone="neutral" onSelect={() => { setShowDone(false); setDueFilter('ALL'); }} />
      </div>
      <div className="mb-4">
        <AssistantInsight
          context="Công việc của tôi"
          summary={overdueCount > 0 ? `Nên bắt đầu với ${overdueCount} việc quá hạn, sau đó chuyển sang các việc có hạn gần nhất.` : 'Chưa có công việc quá hạn trong danh sách đang mở.'}
          details={`${openCount} công việc đang mở${upcomingCount > 0 ? ` · ${upcomingCount} việc có hạn xử lý` : ''}. Nhận xét này chỉ dựa trên bộ lọc và dữ liệu bạn đang xem.`}
          sourceHref="#task-search"
          sourceLabel="Xem danh sách nguồn"
          suggestions={['Sắp xếp việc cần làm', 'Soạn cập nhật tiến độ']}
        />
      </div>
      <Card className="mb-4 overflow-hidden shadow-none">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 pt-2 sm:px-5">
          <div className="flex items-center gap-5">
            <button type="button" onClick={() => setShowDone(false)} className={showDone ? 'border-b-2 border-transparent px-1 py-3 text-sm font-semibold text-ink-2' : 'border-b-2 border-accent px-1 py-3 text-sm font-semibold text-accent'}>Đang mở ({openCount})</button>
            <button type="button" onClick={() => setShowDone(true)} className={showDone ? 'border-b-2 border-accent px-1 py-3 text-sm font-semibold text-accent' : 'border-b-2 border-transparent px-1 py-3 text-sm font-semibold text-ink-2'}>Đã hoàn thành</button>
          </div>
        <Link to="/assistant" className="hidden items-center gap-1.5 text-sm font-semibold text-accent sm:inline-flex"><Lightbulb className="size-4" aria-hidden />An Nhi · AI</Link>
        </div>
        <CardBody className="p-4 sm:p-5">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1.7fr)_minmax(12rem,1fr)_minmax(12rem,1fr)_auto]">
            <Field label="Tìm kiếm" htmlFor="task-search">
              <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden /><Input id="task-search" className="pl-9" placeholder="Tìm công việc, mã hồ sơ..." value={search} onChange={(event) => setSearch(event.target.value)} /></div>
            </Field>
            <Field label="Loại công việc" htmlFor="task-type">
              <NativeSelect id="task-type" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as TaskTypeFilter)}>{FILTER_OPTIONS.map((option) => <option key={option} value={option}>{TASK_TYPE_FILTER_LABEL[option]}</option>)}</NativeSelect>
            </Field>
            <Field label="Hạn xử lý" htmlFor="task-due">
              <NativeSelect id="task-due" value={dueFilter} onChange={(event) => setDueFilter(event.target.value as DueFilter)}><option value="ALL">Tất cả hạn</option><option value="OVERDUE">Quá hạn</option><option value="UPCOMING">Sắp tới</option></NativeSelect>
            </Field>
            {(search || typeFilter !== 'ALL' || dueFilter !== 'ALL') ? <button type="button" onClick={clearFilters} className="self-end pb-2 text-sm font-semibold text-accent hover:underline">Xóa bộ lọc</button> : null}
          </div>
        </CardBody>
      </Card>
      {renderBody()}
    </div>
  );
};

export default TasksPage;
