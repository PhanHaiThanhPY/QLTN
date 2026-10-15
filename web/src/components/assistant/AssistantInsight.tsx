import { useState } from 'react';
import { ChevronDown, ExternalLink, MessageCircleQuestion, Sparkles } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { useUiStore } from '@/store/ui-store';

interface AssistantInsightProps {
  context: string;
  summary: string;
  details: string;
  sourceHref: string;
  sourceLabel: string;
  suggestions: string[];
}

/** Compact, non-intrusive AI note tied to the visible screen and its current data. */
export const AssistantInsight = ({ context, summary, details, sourceHref, sourceLabel, suggestions }: AssistantInsightProps) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const setAssistantOpen = useUiStore((state) => state.setAssistantOpen);
  const queueAssistantPrompt = useUiStore((state) => state.queueAssistantPrompt);
  const askMore = (suggestion: string) => {
    queueAssistantPrompt(suggestion);
    setAssistantOpen(true);
  };

  return (
    <section className="relative overflow-hidden rounded-xl border border-accent/25 bg-[linear-gradient(105deg,rgba(15,143,149,0.1),transparent_35%),var(--surface)] shadow-card" aria-label="Nhận xét từ trợ lý">
      <span className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-accent via-[#3bb8a4] to-transparent" aria-hidden />
      <div className="flex items-start gap-2.5 px-3 py-2.5 sm:px-4">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#0b3c56] text-[#9bf1d2] shadow-sm"><Sparkles className="size-3.5" aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><p className="text-sm font-bold text-ink">Nhận xét từ An Nhi</p><span className="rounded-full bg-surface-3 px-2 py-0.5 text-[0.625rem] font-semibold text-ink-3">Mô phỏng · {context}</span></div>
          <p className="mt-0.5 text-xs leading-4.5 text-ink-2">{summary}</p>
          {isExpanded ? <p className="mt-1 text-[0.6875rem] leading-4 text-ink-3">{details}</p> : null}
          {isExpanded ? <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {suggestions.map((suggestion) => <button key={suggestion} type="button" onClick={() => askMore(suggestion)} className="min-h-8 rounded-full border border-line-2 bg-surface px-2.5 text-[0.6875rem] font-semibold text-ink-2 hover:border-accent/40 hover:bg-accent-soft hover:text-accent">{suggestion}</button>)}
            <Link to={sourceHref} className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"><ExternalLink className="size-3.5" />{sourceLabel}</Link>
          </div> : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="icon-sm" onClick={() => setAssistantOpen(true)} aria-label="Hỏi thêm trợ lý"><MessageCircleQuestion className="size-4" /></Button>
          <Button variant="ghost" size="icon-sm" onClick={() => setIsExpanded((value) => !value)} aria-label={isExpanded ? 'Thu gọn nhận xét' : 'Mở rộng nhận xét'}><ChevronDown className={`size-4 transition-transform ${isExpanded ? '' : '-rotate-90'}`} /></Button>
        </div>
      </div>
    </section>
  );
};
