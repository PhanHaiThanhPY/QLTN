import { useState } from 'react';
import { Info } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/card';
import { StatusPill } from '@/components/ui/badge';
import { useCommand } from '@/hooks/useCommand';
import { toConfigPayload, toDraft } from '@/features/buildings/config-form';
import type { Building, BuildingConfig } from '@/domain/types';
import { useWorkflowDraft } from '../hooks/useWorkflowDraft';
import type { WorkflowTarget } from '../workflow-designer-meta';
import { WorkflowCanvas } from './WorkflowCanvas';
import { WorkflowCanvasToolbar } from './WorkflowCanvasToolbar';
import { WorkflowInfoPanel } from './WorkflowInfoPanel';
import { WorkflowLibrary } from './WorkflowLibrary';
import { WorkflowPreviewDialog } from './WorkflowPreviewDialog';

interface WorkflowDesignerCardProps {
  building: Building;
  config: BuildingConfig;
  workflowTargets: readonly WorkflowTarget[];
  canEdit: boolean;
}

/**
 * Workflow designer of one building. The parent remounts it per building + config version
 * (`key`), which resets the local draft after every save.
 */
export const WorkflowDesignerCard = ({ building, config, workflowTargets, canEdit }: WorkflowDesignerCardProps) => {
  const draft = useWorkflowDraft(config);
  const [previewOpen, setPreviewOpen] = useState(false);
  const command = useCommand({ successMessage: 'Đã lưu workflow theo phạm vi đã chọn.' });
  const { steps, stepBindings, availableSteps, availableBusinessSteps } = draft;

  const save = () => {
    if (steps.length === 0 || !draft.name.trim()) return;
    const workflowStages = draft.stages;
    const approvalStepKeys = draft.stages.find((stage) => stage.key === 'PROPOSAL')?.approvalStepKeys ?? steps;
    const targets = draft.scope === 'all' ? workflowTargets : workflowTargets.filter((target) => target.building.id === building.id);
    void command.execute({
      subjectType: 'BUILDING',
      subjectId: building.id,
      expectedVersion: config.version,
      action: 'updateWorkflowConfig',
      payload: {
        targets: targets.map((target) => ({
          buildingId: target.building.id,
          expectedVersion: target.config.version,
          values: {
            ...toConfigPayload({
              ...toDraft(target.config),
              workflowName: draft.name.trim(),
              workflowDescription: draft.description.trim(),
              approvalStepKeys,
            }, target.config.templateKey, false),
            workflowStages,
          },
        })),
      },
    });
  };

  const addFirstAvailableStep = () => {
    const [first] = availableSteps;
    if (first) draft.addStep(first.key);
  };

  return (
    <div className="min-w-0 space-y-4">
      <WorkflowInfoPanel
        building={building}
        name={draft.name}
        description={draft.description}
        scope={draft.scope}
        targetCount={workflowTargets.length}
        disabled={!canEdit}
        saving={command.isPending}
        onNameChange={draft.setName}
        onDescriptionChange={draft.setDescription}
        onScopeChange={draft.setScope}
        onCancel={draft.reset}
        onSave={save}
      />
      <Card className="min-w-0 overflow-hidden">
        <CardHeader
          title="2. Thiết kế luồng xử lý"
          description="Chọn giai đoạn, sau đó chọn một bước phê duyệt để thêm bước nghiệp vụ liên quan."
          actions={<StatusPill tone="good">Đang áp dụng · v{config.version || 1}</StatusPill>}
        />
        <div className="border-t border-line bg-surface-2 p-4 sm:p-5">
          <WorkflowCanvasToolbar
            stages={draft.stages}
            selectedStageKey={draft.selectedStageKey}
            currentStage={draft.currentStage}
            canUndo={draft.canUndo}
            canRedo={draft.canRedo}
            canEdit={canEdit}
            onUndo={draft.undo}
            onRedo={draft.redo}
            onPreview={() => setPreviewOpen(true)}
            onAdd={addFirstAvailableStep}
            onStageChange={draft.selectStage}
          />
          <div className="mt-4 grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="min-w-0">
              <WorkflowCanvas
                steps={steps}
                stepBindings={stepBindings.filter((binding) => availableBusinessSteps.some((step) => step.key === binding.businessStepKey))}
                selectedIndex={draft.selectedIndex}
                disabled={!canEdit}
                zoom={draft.zoom}
                onZoomChange={draft.setZoom}
                onSelect={draft.setSelectedIndex}
                onMove={draft.moveStep}
                onRemove={draft.removeStep}
                onRemoveBusinessStep={draft.removeBusinessStep}
              />
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-info/20 bg-info-soft px-3 py-2.5 text-xs text-info">
                <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>Hồ sơ mới sẽ chụp lại thứ tự này. Hồ sơ đang xử lý vẫn giữ workflow tại thời điểm phát sinh.</span>
              </div>
            </div>
            <WorkflowLibrary
              businessSteps={availableBusinessSteps}
              activeKeys={steps}
              activeBindings={stepBindings}
              selectedStep={draft.selectedStep}
              canEdit={canEdit}
              onAdd={draft.addStep}
              onAddBusinessStep={draft.addBusinessStep}
              onPreview={() => setPreviewOpen(true)}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 sm:px-5">
          <div className="text-xs text-ink-3">{steps.length} bước phê duyệt · {stepBindings.length} bước nghiệp vụ · {building.name}</div>
          <span className="text-xs text-ink-3">Cấu hình theo tòa nhà</span>
        </div>
      </Card>
      <WorkflowPreviewDialog open={previewOpen} onOpenChange={setPreviewOpen} name={draft.name} stages={draft.stages} />
    </div>
  );
};
