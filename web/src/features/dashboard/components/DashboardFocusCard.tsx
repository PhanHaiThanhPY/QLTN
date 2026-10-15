import { ArrowUpRight, CheckCircle2, Clock3, MessageCircle, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import type { DashboardData } from '@/services/report-service';
import { useUiStore } from '@/store/ui-store';
import { buildDailyBrief } from '@/features/assistant/rules';

interface DashboardFocusCardProps {
  data: DashboardData;
  viewerName?: string;
}

const getGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Chào buổi sáng';
  if (hour < 18) return 'Chào buổi chiều';
  return 'Chào buổi tối';
};
/** Calm daily brief that turns scoped operational data into one safe next decision. */
export const DashboardFocusCard = ({ data, viewerName }: DashboardFocusCardProps) => {
  const brief = useMemo(() => buildDailyBrief(data, viewerName), [data, viewerName]);
  const [isDeferred, setIsDeferred] = useState(false);
  const setAssistantOpen = useUiStore((state) => state.setAssistantOpen);
  const queueAssistantPrompt = useUiStore((state) => state.queueAssistantPrompt);
  const nextStep = brief.hasPriority ? brief.nextStep : undefined;

  const askToAdjust = () => {
    queueAssistantPrompt('Đổi thứ tự ưu tiên hôm nay và giải thích vì sao bạn đề xuất thứ tự mới.');
    setAssistantOpen(true);
  };

  const openAssistant = () => {
    queueAssistantPrompt('Tóm tắt ngắn gọn hôm nay tôi cần làm gì và việc nào có thể để sau.');
    setAssistantOpen(true);
  };

  return (
    <section className="overflow-hidden rounded-xl bg-[linear-gradient(110deg,#08263e_0%,#0b5967_100%)] text-white shadow-[0_12px_28px_-22px_rgba(7,26,48,0.8)]">
      <div className="px-4 py-3 sm:px-5 sm:py-3.5">
        <div className="flex flex-col gap-1 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[0.625rem] font-bold uppercase tracking-[0.14em] text-cyan-100/70">
              <Sparkles className="size-3.5 text-[#8af0c7]" aria-hidden />
              An Nhi · Brief trong ngày
            </div>
            <h2 className="mt-0.5 max-w-3xl text-[1.2rem] font-bold leading-tight tracking-[-0.03em] sm:text-[1.35rem]">{brief.headline}</h2>
            <p className="mt-0.5 max-w-2xl text-xs leading-5 text-cyan-50/75">{brief.summary}</p>
          </div>
          <div className="hidden shrink-0 items-center gap-2 text-[0.625rem] text-cyan-50/65 lg:flex">
            <Clock3 className="size-3.5" aria-hidden />
            {getGreeting().replace('Chào ', '')} · Đã kiểm tra trong phạm vi quyền của bạn
          </div>
        </div>

        {isDeferred ? (
          <div className="mt-2 flex items-center justify-between gap-3 border-t border-white/15 pt-2.5">
            <p className="flex min-w-0 items-center gap-2 truncate text-xs text-cyan-50/80"><CheckCircle2 className="size-4 shrink-0 text-[#8af0c7]" aria-hidden />Đã để đề xuất sang một bên.</p>
            <Button variant="outline" size="sm" onClick={() => setIsDeferred(false)}>Xem lại</Button>
          </div>
        ) : null}
        {!isDeferred && nextStep ? (
          <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-white/15 pt-2.5">
            <p className="mr-auto min-w-0 truncate text-xs text-cyan-50/80"><span className="mr-1 text-[0.5625rem] font-bold uppercase tracking-[0.12em] text-cyan-100/55">Ưu tiên:</span><span className="font-semibold text-white">{nextStep.title}</span></p>
            <Link to={nextStep.href} className="inline-flex min-h-8 items-center gap-1.5 whitespace-nowrap rounded-lg bg-white px-3 py-1.5 text-[0.6875rem] font-bold text-[#0b3c56] transition-transform hover:-translate-y-0.5">Mở việc <ArrowUpRight className="size-3.5" aria-hidden /></Link>
            <Button variant="outline" size="sm" onClick={askToAdjust}><MessageCircle className="size-3.5" aria-hidden /> Đổi cách xử lý</Button>
            <Button variant="ghost" size="sm" className="text-cyan-50 hover:bg-white/10 hover:text-white" onClick={() => setIsDeferred(true)}>Để sau</Button>
          </div>
        ) : null}
        {!isDeferred && !nextStep ? (
          <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-white/15 pt-2.5">
            <p className="mr-auto flex items-center gap-2 text-xs text-cyan-50/80"><CheckCircle2 className="size-4 shrink-0 text-[#8af0c7]" aria-hidden />Chưa có việc cần ưu tiên ngay.</p>
            <Link to="/tasks" className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-white/20 px-3 py-1.5 text-[0.6875rem] font-semibold text-white hover:bg-white/10">Xem hoạt động <ArrowUpRight className="size-3.5" aria-hidden /></Link>
            <Button variant="outline" size="sm" onClick={openAssistant}><MessageCircle className="size-3.5" aria-hidden /> Hỏi An Nhi</Button>
          </div>
        ) : null}
      </div>
    </section>
  );
};
