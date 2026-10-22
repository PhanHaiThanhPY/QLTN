import { Eye, Lightbulb, Plus } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input, NativeSelect } from '@/components/ui/input';
import type { ApprovalStepKey, BusinessWorkflowStepKey } from '@/domain/constants';
import type { RoleDefinition, WorkflowApprovalStep, WorkflowStageKey, WorkflowStepBinding } from '@/domain/types';
import { BUSINESS_STEP_ICON } from '../workflow-designer-meta';
import type { ApprovalStepDefinition, BusinessStepDefinition } from '../workflow-designer-meta';
import { BusinessLibraryStep } from './BusinessLibraryStep';
import { LibraryStep } from './LibraryStep';
import { SelectedStepPanel } from './SelectedStepPanel';

interface WorkflowLibraryProps {
  businessSteps: readonly BusinessStepDefinition[];
  stageKey: WorkflowStageKey;
  approvalSteps: readonly WorkflowApprovalStep[];
  roles: readonly RoleDefinition[];
  activeKeys: readonly ApprovalStepKey[];
  activeBindings: readonly WorkflowStepBinding[];
  selectedStep?: ApprovalStepDefinition;
  canEdit: boolean;
  onAdd: (key: ApprovalStepKey) => void;
  onAddCustomStep: (input: { label: string; role: RoleDefinition }) => void;
  onAddBusinessStep: (key: BusinessWorkflowStepKey) => void;
  onPreview: () => void;
}

/** Side library: selected step, approval steps and business steps of the stage. */
export const WorkflowLibrary = ({
  businessSteps,
  stageKey,
  approvalSteps,
  roles,
  activeKeys,
  activeBindings,
  selectedStep,
  canEdit,
  onAdd,
  onAddCustomStep,
  onAddBusinessStep,
  onPreview,
}: WorkflowLibraryProps) => {
  const requiredCapability = stageKey === 'PAYMENT' ? 'PAYMENT_DECIDE' : stageKey === 'ACCEPTANCE' ? 'ACCEPTANCE_DECIDE' : 'PROPOSAL_DECIDE';
  const approverRoles = roles.filter((role) => role.capabilities.includes(requiredCapability));
  const [customLabel, setCustomLabel] = useState('');
  const [customRoleId, setCustomRoleId] = useState(approverRoles[0]?.id ?? '');
  const selectedRole = approverRoles.find((role) => role.id === customRoleId);
  const addCustom = () => {
    if (!selectedRole || !customLabel.trim()) return;
    onAddCustomStep({ label: customLabel.trim(), role: selectedRole });
    setCustomLabel('');
  };

  return <aside className="min-w-0 space-y-4 rounded-xl border border-line bg-surface p-3 lg:max-h-[38rem] lg:overflow-y-auto">
    <SelectedStepPanel step={selectedStep} />
    <section>
      <div className="mb-2"><h3 className="text-sm font-semibold text-ink">Bước phê duyệt</h3><p className="mt-0.5 text-2xs text-ink-3">Bấm vào bước đã thêm để chọn và cấu hình.</p></div>
      <div className="space-y-2">
        {approvalSteps.map((step) => <LibraryStep key={step.key} step={step} used={activeKeys.includes(step.key)} disabled={!canEdit || activeKeys.includes(step.key)} onAdd={() => onAdd(step.key)} />)}
      </div>
    </section>
    <section className="rounded-lg border border-accent/25 bg-accent-soft/30 p-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink"><Plus className="size-4 text-accent" /> Tạo bước duyệt riêng</div>
      <p className="mb-3 text-2xs leading-relaxed text-ink-2">Bước này sẽ dùng đúng vai trò khách hàng chọn và được điều khiển khi hồ sơ chạy thật.</p>
      <div className="space-y-2">
        <Field label="Tên bước duyệt" htmlFor="custom-workflow-step-label">
          <Input id="custom-workflow-step-label" value={customLabel} disabled={!canEdit} onChange={(event) => setCustomLabel(event.target.value)} placeholder="Ví dụ: Giám đốc tài chính duyệt" />
        </Field>
        <Field label="Vai trò xử lý" htmlFor="custom-workflow-step-role" hint="Vai trò phải có quyền xử lý giai đoạn đang chọn.">
          <NativeSelect id="custom-workflow-step-role" value={customRoleId} disabled={!canEdit || approverRoles.length === 0} onChange={(event) => setCustomRoleId(event.target.value)}>
            {approverRoles.map((role) => <option key={role.id} value={role.id}>{role.name} · {role.code}</option>)}
          </NativeSelect>
        </Field>
        <Button size="sm" variant="outline" disabled={!canEdit || !customLabel.trim() || !selectedRole} onClick={addCustom}><Plus /> Thêm vào thư viện</Button>
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
  </aside>;
};
