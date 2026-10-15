import { ALERT_RULES, APPROVAL_STEPS, BUSINESS_WORKFLOW_STEPS, DEFAULT_APPROVAL_STEP_KEYS, TASK_DUE_DAYS } from './constants';
import type { ApprovalStepKey, BusinessWorkflowStepKey, Role, TaskKind } from './constants';
import type { AssignmentRule, BuildingConfig, WorkflowStageConfig, WorkflowStageKey, WorkflowStepBinding } from './types';

/** Steps whose processing time each building can set (days). */
export const CONFIG_DUE_KINDS: readonly { kind: TaskKind; label: string }[] = [
  { kind: 'CONFIRM_RECORD', label: 'Kỹ thuật xác nhận hiện trạng' },
  { kind: 'APPROVE_PROPOSAL', label: 'Mỗi bước duyệt tờ trình' },
  { kind: 'REVIEW_ACCEPTANCE', label: 'Nghiệm thu' },
  { kind: 'APPROVE_PAYMENT', label: 'BQT duyệt thanh toán' },
];

export type ConfigValues = Omit<BuildingConfig, 'buildingId' | 'version' | 'updatedAt' | 'updatedBy'>;

/** Workflow roles that can be resolved by a department assignment rule. */
export const ASSIGNMENT_ROLES: readonly Role[] = ['BQL', 'TECH_CONFIRMER', 'TECH_CONSULTANT', 'OWNERS_BOARD'];

const DEFAULT_VALUES: ConfigValues = {
  taskDueDays: { ...TASK_DUE_DAYS },
  approvalStepKeys: [...DEFAULT_APPROVAL_STEP_KEYS],
  emergencyLimitVnd: 20_000_000,
  emergencyDocHours: 24,
  recentRepairDays: ALERT_RULES.RECENT_REPAIR_DAYS,
  repeatMinRecords: ALERT_RULES.REPEAT_MIN_RECORDS,
  priceRatio: ALERT_RULES.PRICE_RATIO,
};

export const DEFAULT_WORKFLOW_STAGES: readonly WorkflowStageConfig[] = [
  { key: 'INTAKE', label: 'Ghi nhận & xác nhận hiện trạng', description: 'Kiểm tra sự cố, ảnh hiện trường và xác nhận có cần sửa chữa.', businessStepKeys: ['CREATE_RECORD', 'SUBMIT_CONFIRMATION', 'CONFIRM_CONDITION'], approvalStepKeys: ['TECH_CONFIRM'], enabled: true },
  { key: 'PROPOSAL', label: 'Duyệt phương án & tờ trình', description: 'Đánh giá phương án, chi phí dự kiến và quyết định thực hiện.', businessStepKeys: ['PREPARE_PROPOSAL'], approvalStepKeys: ['TECH_CONFIRM', 'TECH', 'BOARD'], enabled: true },
  { key: 'ACCEPTANCE', label: 'Nghiệm thu', description: 'Kiểm tra kết quả thi công trước khi chuyển sang thanh toán.', businessStepKeys: ['START_CONSTRUCTION', 'UPDATE_PROGRESS', 'SUBMIT_ACCEPTANCE', 'PASS_ACCEPTANCE'], approvalStepKeys: ['TECH_CONFIRM', 'TECH'], enabled: true },
  { key: 'PAYMENT', label: 'Hồ sơ & thanh toán', description: 'Kiểm tra bộ hồ sơ thanh toán và phê duyệt chi.', businessStepKeys: ['PREPARE_PAYMENT', 'APPROVE_PAYMENT', 'RECORD_PAYMENT', 'COMPLETE_RECORD'], approvalStepKeys: ['BOARD'], enabled: true },
];

/** Shared configuration templates a building can copy (proposal 2.9). */
export const CONFIG_TEMPLATES: readonly { key: string; name: string; description: string; values: ConfigValues }[] = [
  { key: 'STANDARD', name: 'Mẫu chung', description: 'Thời hạn và ngưỡng mặc định của hệ thống.', values: { ...DEFAULT_VALUES, templateKey: 'STANDARD' } },
  {
    key: 'RESIDENTIAL',
    name: 'Chung cư',
    description: 'Ưu tiên xử lý nhanh cho cư dân: thời hạn ngắn hơn, hạn mức khẩn cấp thấp hơn.',
    values: {
      templateKey: 'RESIDENTIAL',
      taskDueDays: { CONFIRM_RECORD: 2, APPROVE_PROPOSAL: 2, REVIEW_ACCEPTANCE: 2, APPROVE_PAYMENT: 3 },
      approvalStepKeys: [...DEFAULT_APPROVAL_STEP_KEYS],
      emergencyLimitVnd: 15_000_000,
      emergencyDocHours: 24,
      recentRepairDays: 90,
      repeatMinRecords: 2,
      priceRatio: 1.5,
    },
  },
  {
    key: 'OFFICE',
    name: 'Tòa văn phòng',
    description: 'Hạng mục kỹ thuật lớn: hạn mức khẩn cấp cao hơn, thời hạn duyệt dài hơn.',
    values: {
      templateKey: 'OFFICE',
      taskDueDays: { CONFIRM_RECORD: 3, APPROVE_PROPOSAL: 4, REVIEW_ACCEPTANCE: 3, APPROVE_PAYMENT: 5 },
      approvalStepKeys: [...DEFAULT_APPROVAL_STEP_KEYS],
      emergencyLimitVnd: 50_000_000,
      emergencyDocHours: 48,
      recentRepairDays: 120,
      repeatMinRecords: 3,
      priceRatio: 1.3,
    },
  },
];

export const defaultConfigValues = (): ConfigValues => ({
  ...DEFAULT_VALUES,
  taskDueDays: { ...DEFAULT_VALUES.taskDueDays },
  approvalStepKeys: [...DEFAULT_VALUES.approvalStepKeys],
});

const businessStepsForStage = (key: WorkflowStageKey): BusinessWorkflowStepKey[] => BUSINESS_WORKFLOW_STEPS.filter((step) => step.stage === key).map((step) => step.key);

export const workflowStepBindingsOf = (stage: WorkflowStageConfig): WorkflowStepBinding[] => {
  if (stage.stepBindings && stage.stepBindings.length > 0) return stage.stepBindings.map((binding) => ({ ...binding }));
  const keys = stage.businessStepKeys ?? businessStepsForStage(stage.key);
  return keys.map((businessStepKey) => ({
    businessStepKey,
    approvalStepKey: BUSINESS_WORKFLOW_STEPS.find((step) => step.key === businessStepKey)?.defaultApprovalStepKey,
  }));
};

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
  // The original demo seed used TVKT → BQT. Treat that exact pair as the legacy
  // sample and present the customer-approved multi-stage preset instead.
  const legacyDemoPair = legacy.join('|') === 'TECH|BOARD';
  if (proposal && legacy.length > 0 && !legacyDemoPair) proposal.approvalStepKeys = legacy;
  return migrated;
};

export const workflowStageByKey = (stages: readonly WorkflowStageConfig[], key: WorkflowStageKey): WorkflowStageConfig =>
  stages.find((stage) => stage.key === key) ?? workflowStagesOf()[0];

export const templateValues = (key: string): ConfigValues | undefined => {
  const template = CONFIG_TEMPLATES.find((row) => row.key === key);
  return template
    ? { ...template.values, taskDueDays: { ...template.values.taskDueDays }, approvalStepKeys: [...template.values.approvalStepKeys] }
    : undefined;
};

export const approvalStepKeysOf = (keys?: readonly ApprovalStepKey[]): ApprovalStepKey[] => {
  const allowed = new Set(APPROVAL_STEPS.map((step) => step.key));
  const valid = keys !== undefined && keys.length > 0 && keys.length <= APPROVAL_STEPS.length && new Set(keys).size === keys.length && keys.every((key) => allowed.has(key));
  return valid ? [...(keys as readonly ApprovalStepKey[])] : [...DEFAULT_APPROVAL_STEP_KEYS];
};

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
  const beforeApproval = approvalStepKeysOf(before.approvalStepKeys);
  const afterApproval = approvalStepKeysOf(after.approvalStepKeys);
  if (beforeApproval.join('|') !== afterApproval.join('|')) {
    const labels = (keys: readonly ApprovalStepKey[]): string =>
      keys.map((key) => APPROVAL_STEPS.find((step) => step.key === key)?.actor ?? key).join(' → ');
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
