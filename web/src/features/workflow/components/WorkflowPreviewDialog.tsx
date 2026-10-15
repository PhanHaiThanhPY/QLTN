import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { BUSINESS_WORKFLOW_STEPS } from '@/domain/constants';
import type { WorkflowStageConfig } from '@/domain/types';
import { workflowStepBindingsOf } from '@/domain/building-config';
import { BUSINESS_STEP_ICON, DEFAULT_WORKFLOW_NAME, STEP_ICON, stepFor } from '../workflow-designer-meta';
import { WorkflowPreviewRow } from './WorkflowPreviewRow';

interface WorkflowPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  stages: readonly WorkflowStageConfig[];
}

/** Read-only preview of every enabled stage in order. */
export const WorkflowPreviewDialog = ({ open, onOpenChange, name, stages }: WorkflowPreviewDialogProps) => (
  <Dialog
    open={open}
    onOpenChange={onOpenChange}
    title="Xem trước workflow"
    description={name || DEFAULT_WORKFLOW_NAME}
    size="md"
    footer={<Button onClick={() => onOpenChange(false)}>Đóng</Button>}
  >
    <div className="space-y-3">
      {stages.filter((stage) => stage.enabled).map((stage) => (
        <section key={stage.key} className="rounded-xl border border-line bg-surface-2 p-3">
          <div className="mb-2">
            <p className="text-sm font-semibold text-ink">{stage.label}</p>
            <p className="text-xs text-ink-2">{stage.description}</p>
          </div>
          <div className="space-y-2">
            {workflowStepBindingsOf(stage).map((binding, index) => {
              const businessStep = BUSINESS_WORKFLOW_STEPS.find((step) => step.key === binding.businessStepKey);
              if (!businessStep) return null;
              const approval = binding.approvalStepKey ? stepFor(binding.approvalStepKey) : undefined;
              const approvalNote = approval ? ` · Gắn với ${approval.label}` : ' · Không yêu cầu phê duyệt';
              return (
                <WorkflowPreviewRow
                  key={`${stage.key}-business-${binding.businessStepKey}`}
                  icon={BUSINESS_STEP_ICON[binding.businessStepKey]}
                  label={`${index + 1}. ${businessStep.label}`}
                  description={`${businessStep.actor}${approvalNote}`}
                  tone="good"
                />
              );
            })}
            {stage.approvalStepKeys.map((key, index) => {
              const step = stepFor(key);
              return (
                <WorkflowPreviewRow
                  key={`${stage.key}-${key}`}
                  icon={STEP_ICON[key]}
                  label={`${index + 1}. ${step.label}`}
                  description={`Người thực hiện: ${step.actor}`}
                  tone="accent"
                />
              );
            })}
          </div>
        </section>
      ))}
    </div>
  </Dialog>
);
