import { Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BUSINESS_WORKFLOW_STEPS } from '@/domain/constants';
import type { WorkflowApprovalStep, WorkflowStepBinding } from '@/domain/types';
import { BUSINESS_STEP_ICON, stepFor } from '../workflow-designer-meta';

interface WorkflowBusinessStepProps {
  binding: WorkflowStepBinding;
  approvalSteps: readonly WorkflowApprovalStep[];
  disabled: boolean;
  onRemove: () => void;
}

/** Business step card on the canvas, with the approval step it is bound to. */
export const WorkflowBusinessStep = ({ binding, approvalSteps, disabled, onRemove }: WorkflowBusinessStepProps) => {
  const step = BUSINESS_WORKFLOW_STEPS.find((item) => item.key === binding.businessStepKey);
  if (!step) return null;
  const Icon = BUSINESS_STEP_ICON[binding.businessStepKey];
  const approval = binding.approvalStepKey ? stepFor(binding.approvalStepKey, approvalSteps) : undefined;
  return (
    <div className="z-10 flex w-full max-w-[31rem] items-center">
      <div className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg border border-info/30 bg-info-soft px-2.5 py-2 shadow-sm">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-surface text-info"><Icon className="size-4" /></span>
        <span className="min-w-0 flex-1"><span className="flex items-center gap-2"><span className="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-info">Nghiệp vụ</span><Badge tone="outline" className="px-1.5 py-0 text-[0.6rem]">{step.actor}</Badge></span><span className="mt-0.5 block truncate text-xs font-semibold text-ink">{step.label}</span><span className="mt-0.5 block truncate text-2xs font-medium text-accent-strong">{approval ? `Gắn với: ${approval.label}` : 'Không yêu cầu phê duyệt'}</span></span>
        {!disabled ? <Button variant="ghost" size="icon-sm" aria-label={`Xóa ${step.label}`} onClick={onRemove}><Trash2 className="text-crit" /></Button> : null}
      </div>
    </div>
  );
};
