import { Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/cn';
import { STEP_ICON, STEP_TONE } from '../workflow-designer-meta';
import type { ApprovalStepDefinition } from '../workflow-designer-meta';

interface LibraryStepProps {
  step: ApprovalStepDefinition;
  used: boolean;
  disabled: boolean;
  onAdd: () => void;
}

/** Approval step entry in the library; adds it to the current stage. */
export const LibraryStep = ({ step, used, disabled, onAdd }: LibraryStepProps) => {
  const Icon = STEP_ICON[step.key];
  return <button type="button" disabled={disabled} onClick={onAdd} className="flex w-full items-center gap-2.5 rounded-lg border border-line bg-surface px-2.5 py-2.5 text-left transition hover:border-accent hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-70"><span className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg', STEP_TONE[step.key])}><Icon className="size-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold text-ink">{step.label}</span><span className="block text-2xs text-ink-3">Duyệt theo vai trò · {step.actor}</span></span>{used ? <Badge tone="good" className="text-2xs">Đã thêm</Badge> : <Plus className="size-4 shrink-0 text-accent" />}</button>;
};
