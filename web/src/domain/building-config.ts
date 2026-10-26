import { ALERT_RULES, APPROVAL_STEPS, BUSINESS_WORKFLOW_STEPS, DEFAULT_PROPOSAL_STEP_KEYS, TASK_DUE_DAYS } from './constants';
import type { ApprovalStepKey, BusinessWorkflowStepKey, Role, TaskKind } from './constants';
import type { AssignmentRule, BuildingConfig, WorkflowApprovalStep, WorkflowStageConfig, WorkflowStageKey, WorkflowStepBinding } from './types';

/** Steps whose processing time each building can set (days). */
export const CONFIG_DUE_KINDS: readonly { kind: TaskKind; label: string }[] = [
  { kind: 'CONFIRM_RECORD', label: 'Kỹ thuật xác nhận hiện trạng' },
  { kind: 'APPROVE_PROPOSAL', label: 'Mỗi bước duyệt tờ trình' },
  { kind: 'REVIEW_ACCEPTANCE', label: 'Nghiệm thu' },
  { kind: 'APPROVE_PAYMENT', label: 'BQT duyệt thanh toán' },
  { kind: 'REVIEW_MAINTENANCE', label: 'Kiểm tra kết quả bảo trì' },
];

export type ConfigValues = Omit<BuildingConfig, 'buildingId' | 'version' | 'updatedAt' | 'updatedBy'>;

/** Workflow roles that can be resolved by a department assignment rule. */
export const ASSIGNMENT_ROLES: readonly Role[] = ['BQL', 'TECH_CONFIRMER', 'TECH_CONSULTANT', 'OWNERS_BOARD', 'ACCOUNTANT'];

const DEFAULT_VALUES: ConfigValues = {
  taskDueDays: { ...TASK_DUE_DAYS },
  approvalStepKeys: [...DEFAULT_PROPOSAL_STEP_KEYS],
  emergencyLimitVnd: 20_000_000,
  emergencyDocHours: 24,
  recentRepairDays: ALERT_RULES.RECENT_REPAIR_DAYS,
  repeatMinRecords: ALERT_RULES.REPEAT_MIN_RECORDS,
  priceRatio: ALERT_RULES.PRICE_RATIO,
};

export const DEFAULT_WORKFLOW_STAGES: readonly WorkflowStageConfig[] = [
  { key: 'INTAKE', label: 'Ghi nhận & xác nhận hiện trạng', description: 'Kiểm tra sự cố, ảnh hiện trường và xác nhận có cần sửa chữa.', businessStepKeys: ['CREATE_RECORD', 'SUBMIT_CONFIRMATION', 'CONFIRM_CONDITION'], approvalStepKeys: ['TECH_CONFIRM'], enabled: true },
  { key: 'PROPOSAL', label: 'Duyệt phương án & tờ trình', description: 'Đánh giá phương án, chi phí dự kiến và quyết định thực hiện.', businessStepKeys: ['PREPARE_PROPOSAL'], approvalStepKeys: [...DEFAULT_PROPOSAL_STEP_KEYS], enabled: true },
  { key: 'ACCEPTANCE', label: 'Nghiệm thu', description: 'Kiểm tra kết quả thi công trước khi chuyển sang thanh toán.', businessStepKeys: ['START_CONSTRUCTION', 'UPDATE_PROGRESS', 'SUBMIT_ACCEPTANCE', 'PASS_ACCEPTANCE'], approvalStepKeys: ['TECH_CONFIRM', 'TECH'], enabled: true },
  { key: 'PAYMENT', label: 'Hồ sơ & thanh toán', description: 'Kiểm tra bộ hồ sơ thanh toán và phê duyệt chi.', businessStepKeys: ['PREPARE_PAYMENT', 'APPROVE_PAYMENT', 'RECORD_PAYMENT', 'COMPLETE_RECORD'], approvalStepKeys: ['BOARD'], enabled: true },
];

export const defaultConfigValues = (): ConfigValues => ({
  ...DEFAULT_VALUES,
  taskDueDays: { ...DEFAULT_VALUES.taskDueDays },
  approvalStepKeys: [...DEFAULT_VALUES.approvalStepKeys],
});

const businessStepsForStage = (key: WorkflowStageKey): BusinessWorkflowStepKey[] => BUSINESS_WORKFLOW_STEPS.filter((step) => step.stage === key).map((step) => step.key);

/** Stored bindings, else defaults; a default step missing from the stage falls back to the stage's first step. */
export const workflowStepBindingsOf = (stage: WorkflowStageConfig): WorkflowStepBinding[] => {
  if (stage.stepBindings && stage.stepBindings.length > 0) return stage.stepBindings.map((binding) => ({ ...binding }));
  const keys = stage.businessStepKeys ?? businessStepsForStage(stage.key);
  return keys.map((businessStepKey) => {
    const preferred = BUSINESS_WORKFLOW_STEPS.find((step) => step.key === businessStepKey)?.defaultApprovalStepKey;
    const approvalStepKey = preferred && !stage.approvalStepKeys.includes(preferred) ? stage.approvalStepKeys[0] : preferred;
    return { businessStepKey, approvalStepKey };
  });
};

/** The proposal approval chain: the PROPOSAL stage's steps (BR-10, single source; mirrors api-qltn). */
export const proposalChainOf = (stages: readonly Pick<WorkflowStageConfig, 'key' | 'approvalStepKeys'>[]): ApprovalStepKey[] => [
  ...(stages.find((stage) => stage.key === 'PROPOSAL')?.approvalStepKeys ?? []),
];

/** Confirmer step of a record snapshot: the single INTAKE step (BR-06), KT for records created before RM-S2. */
export const intakeStepKeyOf = (stageKeys?: Partial<Record<WorkflowStageKey, readonly ApprovalStepKey[]>>): ApprovalStepKey =>
  stageKeys?.INTAKE?.[0] ?? 'TECH_CONFIRM';

const cloneWorkflowStages = (stages: readonly WorkflowStageConfig[]): WorkflowStageConfig[] => stages.map((stage) => ({
  ...stage,
  approvalStepKeys: [...stage.approvalStepKeys],
  businessStepKeys: workflowStepBindingsOf(stage).map((binding) => binding.businessStepKey),
  stepBindings: workflowStepBindingsOf(stage),
}));

/** Returns stage configuration, migrating the former single proposal chain to the new model. */
export const workflowStagesOf = (stages?: readonly WorkflowStageConfig[], legacyApprovalStepKeys?: readonly ApprovalStepKey[]): WorkflowStageConfig[] => {
  if (stages && stages.length > 0) return cloneWorkflowStages(stages);
  const migrated = cloneWorkflowStages(DEFAULT_WORKFLOW_STAGES);
  const legacy = approvalStepKeysOf(legacyApprovalStepKeys);
  const proposal = migrated.find((stage) => stage.key === 'PROPOSAL');
  // A stored chain without stages becomes the PROPOSAL stage (BR-10: one source for the chain).
  if (proposal && legacy.length > 0) proposal.approvalStepKeys = legacy;
  return migrated;
};

/**
 * Stages whose PROPOSAL stage carries `chain` (BR-10: editing the approval chain edits that stage). A business step
 * bound to a removed step moves to the chain's first step.
 */
export const withProposalChain = (stages: readonly WorkflowStageConfig[], chain: readonly ApprovalStepKey[]): WorkflowStageConfig[] =>
  cloneWorkflowStages(stages).map((stage) => (stage.key !== 'PROPOSAL'
    ? stage
    : {
      ...stage,
      approvalStepKeys: [...chain],
      stepBindings: (stage.stepBindings ?? []).map((binding) => (binding.approvalStepKey && !chain.includes(binding.approvalStepKey)
        ? { ...binding, approvalStepKey: chain[0] }
        : binding)),
    }));

export const workflowStageByKey = (stages: readonly WorkflowStageConfig[], key: WorkflowStageKey): WorkflowStageConfig =>
  stages.find((stage) => stage.key === key) ?? workflowStagesOf()[0];

type TemplateValues = Omit<ConfigValues, 'approvalStepKeys' | 'workflowStages'>;

/** Default stages with other approval steps per stage (templates such as AQUA), bindings kept valid. */
const stagesWith = (overrides: Partial<Record<WorkflowStageKey, readonly ApprovalStepKey[]>> = {}): WorkflowStageConfig[] =>
  DEFAULT_WORKFLOW_STAGES.map((stage) => {
    const approvalStepKeys = [...(overrides[stage.key] ?? stage.approvalStepKeys)];
    const stepBindings = workflowStepBindingsOf({ ...stage, approvalStepKeys, stepBindings: undefined });
    return { ...stage, approvalStepKeys, businessStepKeys: stepBindings.map((binding) => binding.businessStepKey), stepBindings };
  });

/** A template's values with its stages; the proposal chain is always the PROPOSAL stage (BR-10). */
const templateOf = (values: TemplateValues, overrides?: Partial<Record<WorkflowStageKey, readonly ApprovalStepKey[]>>): ConfigValues => {
  const workflowStages = stagesWith(overrides);
  return { ...values, workflowStages, approvalStepKeys: proposalChainOf(workflowStages) };
};

/** Shared configuration templates a building can copy (proposal 2.9); mirrors api-qltn `CONFIG_TEMPLATES`. */
export const CONFIG_TEMPLATES: readonly { key: string; name: string; description: string; values: ConfigValues }[] = [
  { key: 'STANDARD', name: 'Mẫu chung', description: 'Thời hạn và ngưỡng mặc định của hệ thống.', values: templateOf({ ...DEFAULT_VALUES, templateKey: 'STANDARD' }) },
  {
    key: 'RESIDENTIAL',
    name: 'Chung cư',
    description: 'Ưu tiên xử lý nhanh cho cư dân: thời hạn ngắn hơn, hạn mức khẩn cấp thấp hơn.',
    values: templateOf({
      templateKey: 'RESIDENTIAL',
      taskDueDays: { CONFIRM_RECORD: 2, APPROVE_PROPOSAL: 2, REVIEW_ACCEPTANCE: 2, APPROVE_PAYMENT: 3 },
      emergencyLimitVnd: 15_000_000,
      emergencyDocHours: 24,
      recentRepairDays: 90,
      repeatMinRecords: 2,
      priceRatio: 1.5,
    }),
  },
  {
    key: 'OFFICE',
    name: 'Tòa văn phòng',
    description: 'Hạng mục kỹ thuật lớn: hạn mức khẩn cấp cao hơn, thời hạn duyệt dài hơn.',
    values: templateOf({
      templateKey: 'OFFICE',
      taskDueDays: { CONFIRM_RECORD: 3, APPROVE_PROPOSAL: 4, REVIEW_ACCEPTANCE: 3, APPROVE_PAYMENT: 5 },
      emergencyLimitVnd: 50_000_000,
      emergencyDocHours: 48,
      recentRepairDays: 120,
      repeatMinRecords: 3,
      priceRatio: 1.3,
    }),
  },
  {
    key: 'AQUA',
    name: 'Aqua – theo quy trình Ban quản trị',
    description: 'TVKT xác nhận hiện trạng và thẩm định tờ trình, BQT phê duyệt; nghiệm thu gồm BQL, BQT và TVKT (D5-QT). Ngưỡng như mẫu Chung cư.',
    values: templateOf(
      {
        templateKey: 'AQUA',
        taskDueDays: { CONFIRM_RECORD: 2, APPROVE_PROPOSAL: 2, REVIEW_ACCEPTANCE: 2, APPROVE_PAYMENT: 3 },
        emergencyLimitVnd: 15_000_000,
        emergencyDocHours: 24,
        recentRepairDays: 90,
        repeatMinRecords: 2,
        priceRatio: 1.5,
      },
      { INTAKE: ['TECH'], PROPOSAL: ['TECH', 'BOARD'], ACCEPTANCE: ['MANAGER', 'BOARD', 'TECH'], PAYMENT: ['BOARD'] },
    ),
  },
];

export const templateValues = (key: string): ConfigValues | undefined => {
  const template = CONFIG_TEMPLATES.find((row) => row.key === key);
  return template
    ? {
      ...template.values,
      taskDueDays: { ...template.values.taskDueDays },
      approvalStepKeys: [...template.values.approvalStepKeys],
      workflowStages: cloneWorkflowStages(template.values.workflowStages ?? []),
    }
    : undefined;
};

export const approvalStepKeysOf = (
  keys?: readonly ApprovalStepKey[],
  definitions: readonly WorkflowApprovalStep[] = APPROVAL_STEPS,
): ApprovalStepKey[] => {
  const allowed = new Set(definitions.map((step) => step.key));
  const valid = keys !== undefined && keys.length > 0 && keys.length <= definitions.length && new Set(keys).size === keys.length && keys.every((key) => allowed.has(key));
  return valid ? [...(keys as readonly ApprovalStepKey[])] : [...DEFAULT_PROPOSAL_STEP_KEYS];
};

/** Normalizes the runtime approval chain while keeping the legacy fixed-step fallback. */
export const workflowApprovalStepsOf = (
  definitions?: readonly WorkflowApprovalStep[],
  keys?: readonly ApprovalStepKey[],
): WorkflowApprovalStep[] => {
  const available = definitions && definitions.length > 0 ? definitions : APPROVAL_STEPS;
  const selectedKeys = keys && keys.length > 0 ? keys : available.map((step) => step.key);
  return selectedKeys
    .map((key) => available.find((step) => step.key === key))
    .filter((step): step is WorkflowApprovalStep => Boolean(step))
    .map((step) => ({ ...step }));
};

/** Returns the complete library of system steps plus any customer-defined steps. */
export const workflowApprovalDefinitionsOf = (definitions?: readonly WorkflowApprovalStep[]): WorkflowApprovalStep[] => [
  ...APPROVAL_STEPS,
  ...(definitions ?? []).filter((step) => !APPROVAL_STEPS.some((fixed) => fixed.key === step.key)).map((step) => ({ ...step })),
];

/** Snapshots the configured approval order for every operational stage on a new record. */
export const workflowStageApprovalStepKeysOf = (
  stages?: readonly WorkflowStageConfig[],
  legacyApprovalStepKeys?: readonly ApprovalStepKey[],
): Partial<Record<WorkflowStageKey, ApprovalStepKey[]>> => Object.fromEntries(
  workflowStagesOf(stages, legacyApprovalStepKeys).map((stage) => [stage.key, [...stage.approvalStepKeys]]),
) as Partial<Record<WorkflowStageKey, ApprovalStepKey[]>>;

export const assignmentRulesOf = (rules?: readonly AssignmentRule[]): AssignmentRule[] =>
  (rules ?? [])
    .map((rule) => ({ ...rule, locationIds: rule.locationIds ? [...rule.locationIds] : undefined }))
    .sort((a, b) => a.priority - b.priority || a.role.localeCompare(b.role) || a.departmentId.localeCompare(b.departmentId));

export const CONFIG_LIMITS = {
  DUE_DAYS_MAX: 30,
  EMERGENCY_HOURS_MIN: 4,
  EMERGENCY_HOURS_MAX: 72,
  RECENT_DAYS_MAX: 730,
  REPEAT_MIN: 2,
  REPEAT_MAX: 10,
  PRICE_RATIO_MIN: 1.1,
  PRICE_RATIO_MAX: 5,
} as const;

export interface ConfigChange {
  label: string;
  from: string;
  to: string;
}

const money = (value: number): string => `${new Intl.NumberFormat('vi-VN').format(value)} ₫`;

/** Human readable differences between two configurations (preview before applying, and audit reason). */
export const diffConfig = (before: ConfigValues, after: ConfigValues): ConfigChange[] => {
  const changes: ConfigChange[] = [];
  const beforeApproval = approvalStepKeysOf(before.approvalStepKeys, before.workflowApprovalSteps);
  const afterApproval = approvalStepKeysOf(after.approvalStepKeys, after.workflowApprovalSteps);
  if (beforeApproval.join('|') !== afterApproval.join('|')) {
    const labels = (keys: readonly ApprovalStepKey[]): string =>
      keys.map((key) => [...(before.workflowApprovalSteps ?? []), ...(after.workflowApprovalSteps ?? []), ...APPROVAL_STEPS].find((step) => step.key === key)?.actor ?? key).join(' → ');
    changes.push({ label: 'Thứ tự chuỗi phê duyệt', from: labels(beforeApproval), to: labels(afterApproval) });
  }
  const beforeRules = assignmentRulesOf(before.assignmentRules);
  const afterRules = assignmentRulesOf(after.assignmentRules);
  if (JSON.stringify(beforeRules) !== JSON.stringify(afterRules)) {
    changes.push({ label: 'Quy tắc phân công workflow', from: `${beforeRules.length} quy tắc`, to: `${afterRules.length} quy tắc` });
  }
  for (const { kind, label } of CONFIG_DUE_KINDS) {
    const from = before.taskDueDays[kind];
    const to = after.taskDueDays[kind];
    if (from !== to) changes.push({ label: `Thời hạn: ${label}`, from: `${from ?? '—'} ngày`, to: `${to ?? '—'} ngày` });
  }
  const scalar: { label: string; pick: (values: ConfigValues) => string }[] = [
    { label: 'Hạn mức sửa chữa khẩn cấp', pick: (values) => money(values.emergencyLimitVnd) },
    { label: 'Thời hạn bổ sung hồ sơ khẩn cấp', pick: (values) => `${values.emergencyDocHours} giờ` },
    { label: 'Cảnh báo mới sửa đã hỏng', pick: (values) => `${values.recentRepairDays} ngày` },
    { label: 'Cảnh báo hỏng lặp lại', pick: (values) => `từ ${values.repeatMinRecords} hồ sơ / 12 tháng` },
    { label: 'Cảnh báo giá bất thường', pick: (values) => `> ${String(values.priceRatio).replace('.', ',')} lần trung bình` },
  ];
  for (const row of scalar) {
    const from = row.pick(before);
    const to = row.pick(after);
    if (from !== to) changes.push({ label: row.label, from, to });
  }
  return changes;
};
