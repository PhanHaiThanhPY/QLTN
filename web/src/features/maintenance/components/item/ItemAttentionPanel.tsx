import { AlertTriangle, ChevronRight, Info, OctagonAlert } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router';
import { cn } from '@/lib/cn';
import type { AttentionItem, AttentionTone } from '../../utils/item-insights';

const TONE_STYLE = {
  crit: { icon: OctagonAlert, chip: 'bg-crit-soft text-crit' },
  warn: { icon: AlertTriangle, chip: 'bg-warn-soft text-warn' },
  info: { icon: Info, chip: 'bg-info-soft text-info' },
} as const satisfies Record<AttentionTone, { icon: LucideIcon; chip: string }>;

/** "Cần xử lý" list: every row links to the record or occurrence that needs action. */
export const ItemAttentionPanel = ({ items }: { items: AttentionItem[] }) => {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="item-attention-title" className="rounded-xl border border-warn/30 bg-warn-soft/40 p-2.5 sm:p-3">
      <h2 id="item-attention-title" className="mb-2 text-xs font-semibold text-ink">
        Cần xử lý ({items.length})
      </h2>
      <ul className="grid gap-2 md:grid-cols-2">
        {items.map((entry) => {
          const style = TONE_STYLE[entry.tone];
          const Icon = style.icon;
          return (
            <li key={entry.key}>
              <Link
                to={entry.to}
                className="group flex h-full items-start gap-2 rounded-lg border border-line bg-surface px-2.5 py-2 transition-colors hover:border-accent"
              >
                <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-lg', style.chip)} aria-hidden>
                  <Icon className="size-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold text-ink">{entry.title}</span>
                  <span className="mt-0.5 block truncate text-[0.6875rem] text-ink-2">{entry.detail}</span>
                </span>
                <ChevronRight className="mt-1 size-4 shrink-0 text-ink-3 group-hover:text-accent" aria-hidden />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
};
