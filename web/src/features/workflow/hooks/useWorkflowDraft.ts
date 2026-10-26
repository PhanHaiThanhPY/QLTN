import { useMemo, useState } from 'react';
import { ACCEPTANCE_ONLY_STEP_KEYS, APPROVAL_STEPS, BUSINESS_WORKFLOW_STEPS } from '@/domain/constants';
import type { ApprovalStepKey, BusinessWorkflowStepKey } from '@/domain/constants';
import type { BuildingConfig, RoleDefinition, WorkflowApprovalStep, WorkflowStageConfig, WorkflowStageKey, WorkflowStepBinding } from '@/domain/types';
import { workflowStagesOf, workflowStepBindingsOf } from '@/domain/building-config';
import { DEFAULT_WORKFLOW_DESCRIPTION, DEFAULT_WORKFLOW_NAME } from '../workflow-designer-meta';
import type { WorkflowScope } from '../workflow-designer-meta';

const INITIAL_STAGE_KEY: WorkflowStageKey = 'PROPOSAL';

const initialSelectionOf = (stages: readonly WorkflowStageConfig[]): number | null =>
  stages.find((stage) => stage.key === INITIAL_STAGE_KEY)?.approvalStepKeys.length ? 0 : null;

/**
 * Local, unsaved workflow draft of one building config: stages, approval-step undo/redo,
 * selection and the info fields. The parent remounts the designer per building + config version,
 * so the initial values are read once.
 */
export const useWorkflowDraft = (config: BuildingConfig) => {
  const [initialStages] = useState(() => workflowStagesOf(config.workflowStages, config.approvalStepKeys));
  const [initialApprovalSteps] = useState<WorkflowApprovalStep[]>(() => [
    ...APPROVAL_STEPS,
    ...(config.workflowApprovalSteps ?? []).filter((step) => !APPROVAL_STEPS.some((fixed) => fixed.key === step.key)),
  ]);
  const [approvalSteps, setApprovalSteps] = useState<WorkflowApprovalStep[]>(initialApprovalSteps);
  const [stages, setStages] = useState<WorkflowStageConfig[]>(initialStages);
  const [selectedStageKey, setSelectedStageKey] = useState<WorkflowStageKey>(INITIAL_STAGE_KEY);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(() => initialSelectionOf(initialStages));
  const [past, setPast] = useState<ApprovalStepKey[][]>([]);
  const [future, setFuture] = useState<ApprovalStepKey[][]>([]);
  const [name, setName] = useState(config.workflowName ?? DEFAULT_WORKFLOW_NAME);
  const [description, setDescription] = useState(config.workflowDescription ?? DEFAULT_WORKFLOW_DESCRIPTION);
  const [scope, setScope] = useState<WorkflowScope>('current');
  const [zoom, setZoom] = useState(1);

  const currentStage = stages.find((stage) => stage.key === selectedStageKey) ?? stages[0];
  const steps = currentStage?.approvalStepKeys ?? [];
  const stepBindings = currentStage ? workflowStepBindingsOf(currentStage) : [];
  const selectedStep = selectedIndex === null ? undefined : approvalSteps.find((step) => step.key === steps[selectedIndex]);
  // «BQL nghiệm thu» is offered only in the ACCEPTANCE stage (ADR-0001 R3).
  const availableSteps = useMemo(
    () =>
      approvalSteps.filter(
        (step) =>
          !steps.includes(step.key) &&
          (currentStage?.key === 'ACCEPTANCE' || !ACCEPTANCE_ONLY_STEP_KEYS.includes(step.key)),
      ),
    [approvalSteps, steps, currentStage?.key],
  );
  const availableBusinessSteps = useMemo(
    () => BUSINESS_WORKFLOW_STEPS.filter((step) => step.stage === currentStage?.key),
    [currentStage?.key],
  );

  const replaceCurrentSteps = (next: ApprovalStepKey[]) =>
    setStages((current) => current.map((stage) => (stage.key === selectedStageKey ? { ...stage, approvalStepKeys: next } : stage)));

  const selectStage = (key: WorkflowStageKey) => {
    setSelectedStageKey(key);
    const next = stages.find((stage) => stage.key === key)?.approvalStepKeys ?? [];
    setSelectedIndex(next.length > 0 ? 0 : null);
  };
  const updateSteps = (next: ApprovalStepKey[]) => {
    setPast((current) => [...current, steps]);
    setFuture([]);
    setStages((current) => current.map((stage) => stage.key === selectedStageKey
      ? {
        ...stage,
        approvalStepKeys: next,
        stepBindings: (stage.stepBindings ?? []).map((binding) => next.includes(binding.approvalStepKey ?? '') ? binding : { ...binding, approvalStepKey: undefined }),
      }
      : stage));
    setSelectedIndex(next.length > 0 ? Math.min(selectedIndex ?? 0, next.length - 1) : null);
  };
  const addStep = (key: ApprovalStepKey) => updateSteps([...steps, key]);
  const addCustomStep = (input: { label: string; role: RoleDefinition }): void => {
    const key = `CUSTOM_${Date.now()}`;
    const step: WorkflowApprovalStep = {
      key,
      label: input.label.trim(),
      actor: input.role.name,
      role: input.role.baseRole,
      roleDefId: input.role.isSystem ? undefined : input.role.id,
      status: 'PENDING_CUSTOM_APPROVAL',
    };
    setApprovalSteps((current) => [...current, step]);
    addStep(key);
  };
  const updateStepBindings = (next: WorkflowStepBinding[]) => {
    setStages((current) =>
      current.map((stage) =>
        stage.key === selectedStageKey
          ? { ...stage, businessStepKeys: next.map((binding) => binding.businessStepKey), stepBindings: next }
          : stage,
      ),
    );
  };
  const addBusinessStep = (key: BusinessWorkflowStepKey) => {
    if (!selectedStep) return;
    updateStepBindings([...stepBindings, { businessStepKey: key, approvalStepKey: selectedStep.key }]);
  };
  const removeBusinessStep = (key: BusinessWorkflowStepKey) =>
    updateStepBindings(stepBindings.filter((binding) => binding.businessStepKey !== key));
  const removeStep = (index: number) => {
    if (steps.length <= 1) return;
    const key = steps[index];
    updateSteps(steps.filter((_, current) => current !== index));
    if (stepBindings.some((binding) => binding.approvalStepKey === key)) {
      updateStepBindings(stepBindings.map((binding) => (binding.approvalStepKey === key ? { ...binding, approvalStepKey: undefined } : binding)));
    }
  };
  const moveStep = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= steps.length) return;
    const next = [...steps];
    [next[index], next[target]] = [next[target], next[index]];
    updateSteps(next);
    setSelectedIndex(target);
  };
  const undo = () => {
    const previous = past.at(-1);
    if (!previous) return;
    setFuture((current) => [steps, ...current]);
    setPast((current) => current.slice(0, -1));
    replaceCurrentSteps(previous);
    setSelectedIndex(previous.length > 0 ? 0 : null);
  };
  const redo = () => {
    const next = future[0];
    if (!next) return;
    setPast((current) => [...current, steps]);
    setFuture((current) => current.slice(1));
    replaceCurrentSteps(next);
    setSelectedIndex(next.length > 0 ? 0 : null);
  };
  /** Drops every unsaved change and returns to the saved config. */
  const reset = () => {
    setStages(initialStages);
    setApprovalSteps(initialApprovalSteps);
    setSelectedStageKey(INITIAL_STAGE_KEY);
    setSelectedIndex(initialSelectionOf(initialStages));
    setPast([]);
    setFuture([]);
    setName(config.workflowName ?? DEFAULT_WORKFLOW_NAME);
    setDescription(config.workflowDescription ?? DEFAULT_WORKFLOW_DESCRIPTION);
    setScope('current');
    setZoom(1);
  };

  return {
    stages,
    selectedStageKey,
    currentStage,
    steps,
    approvalSteps,
    stepBindings,
    selectedIndex,
    selectedStep,
    availableSteps,
    availableBusinessSteps,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    name,
    description,
    scope,
    zoom,
    setName,
    setDescription,
    setScope,
    setZoom,
    setSelectedIndex,
    selectStage,
    addStep,
    addCustomStep,
    addBusinessStep,
    removeBusinessStep,
    removeStep,
    moveStep,
    undo,
    redo,
    reset,
  };
};
