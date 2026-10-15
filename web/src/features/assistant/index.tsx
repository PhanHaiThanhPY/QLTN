import { useMemo, useState } from 'react';
import { ArrowUpRight, CheckCircle2, CircleHelp, MessageCircle, ShieldCheck, Sparkles } from 'lucide-react';
import { Link } from 'react-router';
import { PageHeader } from '@/components/common/PageHeader';
import { ErrorState, LoadingState } from '@/components/common/States';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { useServiceQuery } from '@/hooks/useServiceQuery';
import { getDashboard } from '@/services/report-service';
import { useUiStore } from '@/store/ui-store';
import { buildDailyBrief, buildOperationalSuggestions } from './rules';
import { AssistantSuggestion } from './components/AssistantSuggestion';

/** A decision-first assistant screen backed by the existing operational rules and services. */
const AssistantPage = () => {
  const query = useServiceQuery(['operational-guidance'], getDashboard);
  const [deferredKeys, setDeferredKeys] = useState<string[]>([]);
  const setAssistantOpen = useUiStore((state) => state.setAssistantOpen);
  const queueAssistantPrompt = useUiStore((state) => state.queueAssistantPrompt);
  const suggestions = useMemo(() => (query.data ? buildOperationalSuggestions(query.data) : []), [query.data]);
  const visibleSuggestions = useMemo(() => suggestions.filter((suggestion) => !deferredKeys.includes(suggestion.key) && suggestion.key !== 'all-clear'), [deferredKeys, suggestions]);
  const brief = useMemo(() => (query.data ? buildDailyBrief(query.data) : null), [query.data]);

  const deferSuggestion = (key: string) => setDeferredKeys((keys) => [...keys, key]);
  const askToAdjust = () => {
    queueAssistantPrompt('Tôi muốn đổi thứ tự ưu tiên hôm nay. Hãy hỏi tôi điều gì cần được xử lý trước.');
    setAssistantOpen(true);
  };

  if (query.isLoading) return <LoadingState rows={5} />;
  if (query.error || !query.data || !brief) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;

  const hasVisibleWork = visibleSuggestions.length > 0;
  return (
    <div className="space-y-4">
      <PageHeader title="An Nhi · AI" description="Trợ lý vận hành theo quyền và phạm vi tòa nhà của bạn." />

      <section className="rounded-2xl bg-[linear-gradient(110deg,#08263e_0%,#0b5967_100%)] px-5 py-4 text-white shadow-[0_12px_28px_-22px_rgba(7,26,48,0.8)] sm:px-6 sm:py-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[0.6875rem] font-bold uppercase tracking-[0.16em] text-cyan-100/75">
            <Sparkles className="size-3.5 text-[#8af0c7]" aria-hidden />
            An Nhi · Brief trong ngày
          </div>
          <Badge tone="info" className="bg-white/10 text-[0.625rem] text-white">Mô phỏng</Badge>
        </div>
        <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <h2 className="text-xl font-bold leading-tight tracking-tight sm:text-[1.45rem]">{brief.headline}</h2>
            <p className="mt-1 text-sm leading-5 text-cyan-50/75">{brief.summary}</p>
          </div>
          {brief.nextStep ? <Link to={brief.nextStep.href} className="inline-flex min-h-9 shrink-0 items-center justify-center gap-1.5 self-start rounded-lg bg-white px-3 py-2 text-xs font-bold text-[#0b3c56] transition-transform hover:-translate-y-0.5 lg:self-auto">Mở việc này <ArrowUpRight className="size-3.5" aria-hidden /></Link> : null}
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-[0.6875rem] text-cyan-50/65"><ShieldCheck className="size-3.5 text-[#9bf1d2]" aria-hidden /> Bạn xác nhận · An Nhi chỉ chuẩn bị đề xuất.</p>
      </section>

      {hasVisibleWork ? (
        <section aria-labelledby="assistant-plan-title">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div><h2 id="assistant-plan-title" className="text-base font-bold text-ink">Kế hoạch đề xuất</h2><p className="mt-0.5 text-sm text-ink-2">Ưu tiên được sắp xếp từ hạn xử lý, trạng thái hồ sơ, lịch bảo trì và công việc của bạn.</p></div>
            <Button variant="outline" size="sm" onClick={askToAdjust}><MessageCircle className="size-3.5" aria-hidden /> Đổi thứ tự bằng hội thoại</Button>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">{visibleSuggestions.map((suggestion) => <AssistantSuggestion key={suggestion.key} suggestion={suggestion} onDefer={deferSuggestion} />)}</div>
        </section>
      ) : (
        <Card>
          <CardBody className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-good-soft text-good"><CheckCircle2 className="size-6" aria-hidden /></span>
            <div className="min-w-0 flex-1"><h2 className="font-bold text-ink">{brief.hasPriority ? 'Đã để các đề xuất sang một bên' : 'Không có việc nào cần ưu tiên ngay'}</h2><p className="mt-1 text-sm leading-5 text-ink-2">{brief.hasPriority ? 'Bạn có thể mở lại màn hình nghiệp vụ bất cứ lúc nào.' : brief.summary}</p></div>
            <Link to="/tasks" className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-line-2 bg-surface px-3 py-2 text-xs font-semibold text-ink hover:border-accent/35 hover:bg-accent-soft">Xem hoạt động <ArrowUpRight className="size-3.5" aria-hidden /></Link>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader title="Bạn luôn giữ quyền kiểm soát" description="Trợ lý chỉ chuẩn bị đề xuất từ dữ liệu đã được giới hạn theo quyền và phạm vi tòa nhà của bạn." />
        <CardBody className="grid gap-3 text-sm text-ink-2 sm:grid-cols-3">
          <p className="flex gap-2"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-good" aria-hidden />Mở việc để tự xem và quyết định.</p>
          <p className="flex gap-2"><MessageCircle className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />Nói tự nhiên nếu muốn đổi phương án.</p>
          <p className="flex gap-2"><CircleHelp className="mt-0.5 size-4 shrink-0 text-ink-3" aria-hidden />Để sau hoặc tự thao tác theo cách truyền thống.</p>
        </CardBody>
      </Card>
    </div>
  );
};

export default AssistantPage;
