import { ArrowUpRight, CheckCircle2, Clock3, ListChecks, TriangleAlert } from 'lucide-react';
import { Link } from 'react-router';
import { cn } from '@/lib/cn';
import type { OperationalSuggestion, OperationalSuggestionTone } from '../rules';

const TONE_CLASSES: Record<OperationalSuggestionTone, string> = {
  crit: 'bg-crit-soft text-crit',
  warn: 'bg-warn-soft text-warn',
  accent: 'bg-accent-soft text-accent',
  good: 'bg-good-soft text-good',
};

const ICONS = {
  crit: TriangleAlert,
  warn: Clock3,
  accent: ListChecks,
  good: CheckCircle2,
} as const;

interface AssistantSuggestionProps {
  suggestion: OperationalSuggestion;
  onDefer: (key: string) => void;
}

export const AssistantSuggestion = ({ suggestion, onDefer }: AssistantSuggestionProps) => {
  const Icon = ICONS[suggestion.tone];
  return (
    <article className="rounded-xl border border-line bg-surface p-4 transition-colors hover:border-accent/35 hover:bg-surface-2">
      <div className="flex items-start gap-3">
        <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', TONE_CLASSES[suggestion.tone])}><Icon className="size-4" aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2"><h3 className="text-sm font-bold text-ink">{suggestion.title}</h3><span className="tnum text-lg font-bold text-ink">{suggestion.count}</span></div>
          <p className="mt-1 text-sm leading-5 text-ink-2">{suggestion.description}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Link to={suggestion.href} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[#0b2b49] px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#123f5f]">Xem và xác nhận <ArrowUpRight className="size-3.5" aria-hidden /></Link>
            <button type="button" onClick={() => onDefer(suggestion.key)} className="min-h-9 rounded-lg px-3 py-2 text-xs font-semibold text-ink-2 hover:bg-surface-3">Để sau</button>
          </div>
        </div>
      </div>
    </article>
  );
};
