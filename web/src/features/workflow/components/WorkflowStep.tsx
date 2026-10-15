import { ArrowDown, ArrowRight, ArrowUp, Clock3, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { STEP_ICON, STEP_TONE } from '../workflow-designer-meta';
import type { ApprovalStepDefinition } from '../workflow-designer-meta';

interface WorkflowStepProps {
  step: ApprovalStepDefinition;
  index: number;
  selected: boolean;
  disabled: boolean;
  first: boolean;
  last: boolean;
  onSelect: () => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}

/** Selectable approval step card; shows move/remove actions while selected. */
export const WorkflowStep = ({ step, index, selected, disabled, first, last, onSelect, onMove, onRemove }: WorkflowStepProps) => {
  const Icon = STEP_ICON[step.key];
  return (
    <div className="z-10 flex w-full max-w-[31rem] items-center">
      <button type="button" aria-label={`Chọn bước ${index + 1}: ${step.label}`} aria-pressed={selected} disabled={disabled} onClick={onSelect} className={cn('group flex min-w-0 flex-1 items-center gap-2.5 rounded-lg border bg-surface px-2.5 py-2 text-left shadow-sm transition', selected ? 'border-accent ring-4 ring-accent/10' : 'border-line hover:border-accent/50', disabled && 'cursor-default opacity-80')}>
        <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-md', STEP_TONE[step.key])}><Icon className="size-4" /></span>
        <span className="min-w-0 flex-1"><span className="flex items-center gap-2"><span className="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-ink-3">Bước {index + 1}</span><Badge tone="outline" className="px-1.5 py-0 text-[0.6rem]">{step.actor}</Badge></span><span className="mt-0.5 block truncate text-xs font-semibold text-ink">{step.label}</span><span className="mt-0.5 flex items-center gap-1 text-2xs text-ink-3"><Clock3 className="size-3" />Duyệt theo vai trò</span></span>
        <ArrowRight className="size-4 shrink-0 text-ink-3" aria-hidden />
      </button>
      {selected && !disabled ? <div className="ml-1 flex shrink-0 items-center gap-0.5"><Button variant="ghost" size="icon-sm" aria-label={`Đưa ${step.actor} lên`} disabled={first} onClick={() => onMove(-1)}><ArrowUp /></Button><Button variant="ghost" size="icon-sm" aria-label={`Đưa ${step.actor} xuống`} disabled={last} onClick={() => onMove(1)}><ArrowDown /></Button><Button variant="ghost" size="icon-sm" aria-label={`Xóa ${step.actor}`} onClick={onRemove}><Trash2 className="text-crit" /></Button></div> : null}
    </div>
  );
};
