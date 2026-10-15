import { Eye, Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { APPROVAL_STEPS } from '@/domain/constants';
import type { ApprovalStepKey, BusinessWorkflowStepKey } from '@/domain/constants';
import type { WorkflowStepBinding } from '@/domain/types';
import { BUSINESS_STEP_ICON } from '../workflow-designer-meta';
import type { ApprovalStepDefinition, BusinessStepDefinition } from '../workflow-designer-meta';
import { BusinessLibraryStep } from './BusinessLibraryStep';
import { LibraryStep } from './LibraryStep';
import { SelectedStepPanel } from './SelectedStepPanel';

interface WorkflowLibraryProps {
  businessSteps: readonly BusinessStepDefinition[];
  activeKeys: readonly ApprovalStepKey[];
  activeBindings: readonly WorkflowStepBinding[];
  selectedStep?: ApprovalStepDefinition;
  canEdit: boolean;
  onAdd: (key: ApprovalStepKey) => void;
  onAddBusinessStep: (key: BusinessWorkflowStepKey) => void;
  onPreview: () => void;
}

/** Side library: selected step, approval steps and business steps of the stage. */
export const WorkflowLibrary = ({
  businessSteps,
  activeKeys,
  activeBindings,
  selectedStep,
  canEdit,
  onAdd,
  onAddBusinessStep,
  onPreview,
}: WorkflowLibraryProps) => (
  <aside className="min-w-0 space-y-4 rounded-xl border border-line bg-surface p-3 lg:max-h-[34rem] lg:overflow-y-auto">
    <SelectedStepPanel step={selectedStep} />
    <section>
      <div className="mb-2"><h3 className="text-sm font-semibold text-ink">Bước phê duyệt</h3><p className="mt-0.5 text-2xs text-ink-3">Bấm vào bước đã thêm để chọn và cấu hình.</p></div>
      <div className="space-y-2">
        {APPROVAL_STEPS.map((step) => <LibraryStep key={step.key} step={step} used={activeKeys.includes(step.key)} disabled={!canEdit || activeKeys.includes(step.key)} onAdd={() => onAdd(step.key)} />)}
      </div>
    </section>
    <section>
      <div className="mb-2"><h3 className="text-sm font-semibold text-ink">Bước nghiệp vụ của giai đoạn</h3><p className="mt-0.5 text-2xs text-ink-3">{selectedStep ? `Gắn vào ${selectedStep.label}` : 'Chọn một bước phê duyệt trước'}</p></div>
      <div className="space-y-2">
        {businessSteps.map((step) => <BusinessLibraryStep key={step.key} step={step} icon={BUSINESS_STEP_ICON[step.key]} approvalLabel={selectedStep?.label} used={activeBindings.some((binding) => binding.businessStepKey === step.key)} disabled={!canEdit || !selectedStep || activeBindings.some((binding) => binding.businessStepKey === step.key)} onAdd={() => onAddBusinessStep(step.key)} />)}
      </div>
    </section>
    <section className="rounded-lg border border-accent/20 bg-accent-soft/40 p-3">
      <div className="flex items-center gap-2 text-xs font-semibold text-accent-strong"><Lightbulb className="size-4" /> Cách thiết kế</div>
      <p className="mt-1.5 text-2xs leading-relaxed text-ink-2">1. Thêm vai trò phê duyệt. 2. Chọn vai trò trên luồng. 3. Gắn các bước nghiệp vụ phù hợp.</p>
      <Button variant="link" size="sm" className="mt-1" onClick={onPreview}><Eye /> Xem luồng hiện tại</Button>
    </section>
  </aside>
);
