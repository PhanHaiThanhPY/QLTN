import { cn } from '@/lib/cn';
import { ITEM_QUICK_FILTERS } from '../../utils/item-list';
import type { ItemQuickFilter } from '../../utils/item-list';

interface ItemQuickFilterBarProps {
  value: ItemQuickFilter;
  counts: Record<ItemQuickFilter, number>;
  onChange: (value: ItemQuickFilter) => void;
}

/** Filters that need a decision get a red count so problems stand out before any click. */
const ALERTING: readonly ItemQuickFilter[] = ['attention', 'overdue'];

/** One-click views with live counts (all, needs action, overdue, repairing, warranty ending). */
export const ItemQuickFilterBar = ({ value, counts, onChange }: ItemQuickFilterBarProps) => (
  <div role="radiogroup" aria-label="Lọc nhanh thiết bị" className="scroll-thin -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
    {ITEM_QUICK_FILTERS.map((entry) => {
      const isActive = entry.value === value;
      const isAlert = ALERTING.includes(entry.value) && counts[entry.value] > 0;
      return (
        <button
          key={entry.value}
          type="button"
          role="radio"
          aria-checked={isActive}
          onClick={() => onChange(entry.value)}
          className={cn(
            'flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
            isActive ? 'border-accent bg-accent text-accent-fg' : 'border-line bg-surface text-ink-2 hover:border-accent hover:text-ink',
          )}
        >
          {entry.label}
          <span
            className={cn(
              'tnum rounded-full px-1.5 py-px text-[0.6875rem]',
              isActive && 'bg-surface/25 text-accent-fg',
              !isActive && isAlert && 'bg-crit-soft text-crit',
              !isActive && !isAlert && 'bg-surface-3 text-ink-2',
            )}
          >
            {counts[entry.value]}
          </span>
        </button>
      );
    })}
  </div>
);
