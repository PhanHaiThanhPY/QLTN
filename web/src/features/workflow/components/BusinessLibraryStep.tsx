import { Plus } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { BusinessStepDefinition } from '../workflow-designer-meta';

interface BusinessLibraryStepProps {
  step: BusinessStepDefinition;
  icon: LucideIcon;
  approvalLabel?: string;
  used: boolean;
  disabled: boolean;
  onAdd: () => void;
}

/** Business step entry in the library; binds it to the selected approval step. */
export const BusinessLibraryStep = ({ step, icon: Icon, approvalLabel, used, disabled, onAdd }: BusinessLibraryStepProps) => (
  <button type="button" disabled={disabled} onClick={onAdd} className="flex w-full items-center gap-2.5 rounded-lg border border-line bg-surface px-2.5 py-2.5 text-left transition hover:border-info hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-70">
    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-info-soft text-info"><Icon className="size-4" /></span>
    <span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold text-ink">{step.label}</span><span className="block text-2xs leading-4 text-ink-3">{step.description} · {step.actor}</span>{!used && approvalLabel ? <span className="mt-0.5 block truncate text-2xs font-medium text-accent-strong">Gắn vào: {approvalLabel}</span> : null}</span>
    {used ? <Badge tone="good" className="shrink-0 text-2xs">Đã thêm</Badge> : <Plus className="size-4 shrink-0 text-info" />}
  </button>
);
