import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface ViewOption<T extends string> {
  value: T;
  label: string;
  icon: LucideIcon;
}

interface ViewSwitchProps<T extends string> {
  value: T;
  options: readonly ViewOption<T>[];
  onChange: (value: T) => void;
  label: string;
}

/** Segmented control for switching how the same data is shown (list / calendar…). */
export const ViewSwitch = <T extends string>({ value, options, onChange, label }: ViewSwitchProps<T>) => (
  <div className="inline-flex max-w-full overflow-x-auto rounded-lg bg-surface-3 p-1" role="tablist" aria-label={label}>
    {options.map((option) => {
      const isActive = option.value === value;
      const Icon = option.icon;
      return (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={isActive}
          onClick={() => onChange(option.value)}
          className={cn(
            'inline-flex h-10 shrink-0 items-center gap-1.5 rounded-md px-3 text-[0.8125rem] font-semibold transition-colors',
            isActive ? 'bg-surface text-ink shadow-sm' : 'text-ink-2 hover:text-ink',
          )}
        >
          <Icon className={cn('size-4', isActive && 'text-accent')} aria-hidden />
          {option.label}
        </button>
      );
    })}
  </div>
);
