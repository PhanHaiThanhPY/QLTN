import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Activity, CircleHelp, Minimize2, RotateCcw, Send, ShieldCheck, Sparkles, Trash2, X } from 'lucide-react';
import { useLocation } from 'react-router';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { OCCURRENCE_STATUS_LABEL, REPAIR_STATUS_LABEL } from '@/domain/constants';
import type { OccurrenceStatus, RepairStatus } from '@/domain/constants';
import { Input } from '@/components/ui/input';
import { useServiceQuery } from '@/hooks/useServiceQuery';
import { listOccurrences } from '@/services/maintenance-service';
import type { OccurrenceFilters } from '@/services/maintenance-service';
import { listRecords } from '@/services/records-service';
import type { RecordFilters } from '@/services/records-service';
import { getDashboard } from '@/services/report-service';
import { getMyTasks } from '@/services/tasks-service';
import { getAssistantContext, getAssistantReply } from './assistant-context';
import { useSessionStore } from '@/store/session-store';
import { useUiStore } from '@/store/ui-store';

const REPLY_DELAY_MS = 500;

const AssistantAvatar = ({ small = false }: { small?: boolean }) => (
  <span className={`relative flex shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0c3a58] via-[#0d6871] to-[#38b8a1] text-white shadow-sm ${small ? 'size-9' : 'size-11'}`} aria-hidden>
    <span className={`${small ? 'text-[0.6rem]' : 'text-xs'} font-bold tracking-wide`}>AN</span>
    <Sparkles className={`absolute -right-1 -top-1 ${small ? 'size-3' : 'size-3.5'} rounded-full bg-[#d4f6ec] p-0.5 text-[#0d6871]`} />
  </span>
);

const scheduleFiltersFromSearch = (search: string): OccurrenceFilters => {
  const params = new URLSearchParams(search);
  const statusParam = params.get('status');
  const indicatorParam = params.get('indicator');
  const status: OccurrenceStatus | '' = statusParam && statusParam in OCCURRENCE_STATUS_LABEL ? (statusParam as OccurrenceStatus) : '';
  const indicator: OccurrenceFilters['indicator'] = indicatorParam === 'OVERDUE' || indicatorParam === 'UPCOMING' ? indicatorParam : '';
  return {
    buildingId: params.get('buildingId') || undefined,
    itemId: params.get('itemId') || undefined,
    assigneeId: params.get('assigneeId') || undefined,
    status,
    indicator,
    dateFrom: params.get('dateFrom') || undefined,
    dateTo: params.get('dateTo') || undefined,
    page: 1,
    pageSize: 5000,
  };
};

const recordFiltersFromSearch = (search: string): RecordFilters => {
  const params = new URLSearchParams(search);
  const statusParam = params.get('status');
  const status: RepairStatus | '' = statusParam && statusParam in REPAIR_STATUS_LABEL ? (statusParam as RepairStatus) : '';
  return {
    q: params.get('q') || undefined,
    buildingId: params.get('buildingId') || undefined,
    status,
    locationId: params.get('locationId') || undefined,
    assigneeId: params.get('assigneeId') || undefined,
    maintenanceItemId: params.get('maintenanceItemId') || undefined,
    dateFrom: params.get('dateFrom') || undefined,
    dateTo: params.get('dateTo') || undefined,
    overdue: params.get('overdue') === '1',
    page: 1,
    pageSize: 5000,
  };
};

export const AssistantPanel = () => {
  const { pathname, search } = useLocation();
  const context = getAssistantContext(pathname);
  const scheduleFilters = scheduleFiltersFromSearch(search);
  const recordFilters = recordFiltersFromSearch(search);
  const isOpen = useUiStore((state) => state.isAssistantOpen);
  const isCollapsed = useUiStore((state) => state.isAssistantCollapsed);
  const messages = useUiStore((state) => state.assistantMessages);
  const queuedPrompt = useUiStore((state) => state.assistantQueuedPrompt);
  const clearQueuedPrompt = useUiStore((state) => state.clearAssistantQueuedPrompt);
  const setCollapsed = useUiStore((state) => state.setAssistantCollapsed);
  const setOpen = useUiStore((state) => state.setAssistantOpen);
  const addMessage = useUiStore((state) => state.addAssistantMessage);
  const clearMessages = useUiStore((state) => state.clearAssistantMessages);
  const dashboardQuery = useServiceQuery(['dashboard'], getDashboard, isOpen && context.screen === 'dashboard');
  const tasksQuery = useServiceQuery(['tasks', 'mine', 'all'], () => getMyTasks(true), isOpen && context.screen === 'tasks');
  const scheduleQuery = useServiceQuery(['assistant-schedule', search], () => listOccurrences(scheduleFilters), isOpen && context.screen === 'schedule');
  const recordsQuery = useServiceQuery(['assistant-records', search], () => listRecords(recordFilters), isOpen && context.screen === 'records');
  const [prompt, setPrompt] = useState('');
  const [status, setStatus] = useState<'idle' | 'processing' | 'error'>('idle');
  const [lastPrompt, setLastPrompt] = useState('');
  const userId = useSessionStore((state) => state.userId);
  const replyTimerRef = useRef<number | null>(null);

  const cancelPendingReply = () => {
    if (replyTimerRef.current === null) return;
    window.clearTimeout(replyTimerRef.current);
    replyTimerRef.current = null;
  };

  // A reply computed for the previous account must never land in the next account's chat.
  useEffect(() => {
    setStatus('idle');
    return cancelPendingReply;
  }, [userId]);

  const sendPrompt = (value: string) => {
    const nextPrompt = value.trim();
    if (!nextPrompt || status === 'processing') return;
    setLastPrompt(nextPrompt);
    setPrompt('');
    setStatus('processing');
    try {
      addMessage({ id: `user-${crypto.randomUUID()}`, role: 'user', content: nextPrompt, context: context.label });
      cancelPendingReply();
      replyTimerRef.current = window.setTimeout(() => {
        replyTimerRef.current = null;
        try {
          const dashboard = dashboardQuery.data;
          const taskRows = tasksQuery.data ?? [];
          const openTasks = taskRows.filter((row) => row.task.status === 'OPEN');
          const reply = getAssistantReply(context, nextPrompt, {
            dashboard: dashboard
              ? {
                  openRepairCount: dashboard.openRepairCount,
                  overdueRepairCount: dashboard.overdueRepairCount,
                  completedRepairCount: dashboard.completedRepairCount,
                  myOpenTaskCount: dashboard.myOpenTaskCount,
                  upcomingMaintenanceCount: dashboard.upcomingMaintenance.length,
                  overdueMaintenanceCount: dashboard.overdueMaintenance.length,
                  pendingApprovalCount: dashboard.pendingApprovalCount,
                  pendingReviewCount: dashboard.pendingReviewCount,
                  needsInformationCount: dashboard.needsInformationCount,
                  pendingProposalCount: dashboard.pendingProposalCount,
                  unresolvedCount: dashboard.unresolvedCount,
                }
              : undefined,
            taskSummary: tasksQuery.data
              ? {
                  openCount: openTasks.length,
                  overdueCount: openTasks.filter((row) => row.isOverdue).length,
                  upcomingCount: openTasks.filter((row) => !row.isOverdue && Boolean(row.task.dueAt)).length,
                }
              : undefined,
            scheduleSummary: scheduleQuery.data
              ? {
                  total: scheduleQuery.data.total,
                  overdueCount: scheduleQuery.data.items.filter((row) => row.indicator === 'OVERDUE').length,
                  upcomingCount: scheduleQuery.data.items.filter((row) => row.indicator === 'UPCOMING').length,
                  pendingReviewCount: scheduleQuery.data.items.filter((row) => row.occurrence.status === 'PENDING_REVIEW').length,
                }
              : undefined,
            recordsSummary: recordsQuery.data
              ? {
                  total: recordsQuery.data.total,
                  overdueCount: recordsQuery.data.items.filter((row) => row.isOverdue).length,
                }
              : undefined,
          });
          addMessage({ id: `assistant-${crypto.randomUUID()}`, role: 'assistant', content: reply, context: context.label });
          setStatus('idle');
        } catch (error) {
          console.error('Assistant response failed:', error);
          setStatus('error');
        }
      }, REPLY_DELAY_MS);
    } catch (error) {
      console.error('Assistant response failed:', error);
      setStatus('error');
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    sendPrompt(prompt);
  };

  useEffect(() => {
    if (!queuedPrompt || !isOpen || isCollapsed) return;
    clearQueuedPrompt();
    sendPrompt(queuedPrompt);
  }, [clearQueuedPrompt, isCollapsed, isOpen, queuedPrompt]);

  if (!isOpen || isCollapsed) {
    return (
      <button type="button" onClick={() => setCollapsed(false)} className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full border border-accent/20 bg-surface px-2 py-2 pr-3 text-sm font-semibold text-ink shadow-[0_10px_30px_-12px_rgb(7_26_48_/_0.5)] transition-transform hover:-translate-y-0.5 lg:bottom-6 lg:right-7" aria-label="Mở trợ lý AI">
        <AssistantAvatar small />
        <span className="hidden sm:inline">An Nhi · AI</span>
      </button>
    );
  }

  return (
    <aside className="fixed inset-x-0 bottom-0 z-50 flex max-h-[min(76dvh,38rem)] flex-col border-t border-line bg-surface shadow-[0_-14px_40px_-24px_rgb(7_26_48_/_0.6)] lg:absolute lg:inset-y-0 lg:right-0 lg:left-auto lg:z-30 lg:h-full lg:max-h-none lg:w-[min(25rem,32vw)] lg:shrink-0 lg:border-l lg:border-t-0 lg:shadow-[-16px_0_36px_-28px_rgb(7_26_48_/_0.55)]" aria-label="Trợ lý AI">
      <div className="border-b border-line bg-[linear-gradient(110deg,rgba(15,143,149,0.12),transparent_60%),var(--surface)] px-3 py-2.5 sm:px-4">
        <div className="flex items-center gap-2.5">
          <span className="rounded-xl bg-white p-0.5 shadow-sm"><AssistantAvatar small /></span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2"><h2 className="text-sm font-bold text-ink">An Nhi · AI</h2><span className="size-1.5 rounded-full bg-good" /><Badge tone="info" className="text-[0.625rem]">Mô phỏng</Badge></div>
            <p className="mt-0.5 truncate text-[0.6875rem] text-ink-2">Ngữ cảnh: <span className="font-semibold text-ink">{context.label}</span></p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button variant="ghost" size="icon-sm" onClick={() => setCollapsed(true)} aria-label="Thu gọn trợ lý"><Minimize2 className="size-4" /></Button>
            {messages.length > 0 ? <Button variant="ghost" size="icon-sm" onClick={clearMessages} aria-label="Xóa lịch sử chat" title="Xóa lịch sử chat"><Trash2 className="size-4" /></Button> : null}
            <Button variant="ghost" size="icon-sm" className="lg:hidden" onClick={() => setOpen(false)} aria-label="Đóng trợ lý"><X className="size-4" /></Button>
          </div>
        </div>
        <div className="mt-1.5 flex items-center gap-1.5 text-[0.625rem] text-ink-3"><ShieldCheck className="size-3 text-good" /><span>Theo quyền và phạm vi tòa nhà</span></div>
      </div>
      <div className="scroll-thin min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-3 py-3 sm:px-4">
        <div className="relative overflow-hidden rounded-xl border border-accent/25 bg-gradient-to-br from-accent-soft via-surface to-surface p-3">
          <div className="absolute -right-8 -top-8 size-24 rounded-full bg-accent/10" aria-hidden />
          <div className="relative flex items-start gap-2"><span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-fg"><Sparkles className="size-3" /></span><div><p className="text-[0.8125rem] font-semibold leading-4 text-ink">Mình đang xem nhanh nhịp vận hành.</p><p className="mt-0.5 text-xs leading-4 text-ink-2">{context.description}</p></div></div>
          <div className="relative mt-2 flex items-center gap-1.5 text-[0.625rem] font-semibold text-accent"><Activity className="size-3" /> Gợi ý theo dữ liệu đang xem</div>
        </div>
        {messages.length > 0 ? (
          <div className="space-y-2" aria-label="Lịch sử trò chuyện">
            {messages.slice(-8).map((message) => (
              <div key={message.id} className={`flex gap-2 ${message.role === 'user' ? 'justify-end' : ''}`}>
                {message.role === 'assistant' ? <AssistantAvatar small /> : null}
                <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-4.5 ${message.role === 'user' ? 'bg-[#0b2b49] text-white' : 'bg-surface-2 text-ink'}`}>
                  {message.role === 'assistant' && message.context !== context.label ? <p className="mb-0.5 text-[0.625rem] font-semibold text-accent">Từ {message.context}</p> : null}
                  <p>{message.content}</p>
                </div>
              </div>
            ))}
          </div>
        ) : null}
        <div>
          <p className="mb-1.5 text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-ink-3">Gợi ý cho màn hình này</p>
          <div className="flex flex-wrap gap-1.5">
            {context.suggestions.map((suggestion) => <button key={suggestion} type="button" onClick={() => sendPrompt(suggestion)} className="rounded-full border border-line-2 bg-surface px-2.5 py-1 text-[0.6875rem] font-semibold text-ink-2 transition-colors hover:border-accent/40 hover:bg-accent-soft hover:text-accent">{suggestion}</button>)}
          </div>
        </div>
        {status === 'processing' ? <div className="flex items-center gap-2 text-xs text-ink-2"><span className="size-2 animate-pulse rounded-full bg-accent" />Đang xem dữ liệu và chuẩn bị phản hồi…</div> : null}
        {status === 'error' ? <div className="flex items-center justify-between gap-3 rounded-xl border border-crit/25 bg-crit-soft px-3 py-2 text-xs text-crit"><span>Chưa thể tạo phản hồi. Chức năng chính vẫn dùng bình thường.</span><button type="button" className="inline-flex shrink-0 items-center gap-1 font-semibold hover:underline" onClick={() => { setStatus('idle'); sendPrompt(lastPrompt); }}><RotateCcw className="size-3.5" />Thử lại</button></div> : null}
      </div>
      <div className="border-t border-line bg-surface px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 sm:px-4">
        <form onSubmit={handleSubmit} className="flex items-center gap-1.5 rounded-lg border border-line-2 bg-surface-2 p-1 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/10">
          <Input className="h-9 border-0 bg-transparent px-2 text-xs shadow-none focus-visible:ring-0" placeholder="Bạn muốn tôi hỗ trợ gì?" value={prompt} onChange={(event) => setPrompt(event.target.value)} aria-label="Nhập câu hỏi cho trợ lý AI" />
          <Button type="submit" size="icon-sm" className="shrink-0 rounded-lg" disabled={!prompt.trim() || status === 'processing'} aria-label="Gửi câu hỏi"><Send className="size-4" /></Button>
        </form>
        <p className="mt-1 flex items-center gap-1 text-[0.625rem] text-ink-3"><CircleHelp className="size-3" /> Chỉ đề xuất · bạn luôn xác nhận thao tác.</p>
      </div>
    </aside>
  );
};

export const AssistantHeaderButton = () => {
  const isOpen = useUiStore((state) => state.isAssistantOpen);
  const toggle = useUiStore((state) => state.toggleAssistant);
  return <Button variant={isOpen ? 'subtle' : 'outline'} size="icon-sm" onClick={toggle} aria-label="Mở chat AI" aria-expanded={isOpen} title="Chat AI"><Sparkles className="size-4 text-accent" /></Button>;
};
