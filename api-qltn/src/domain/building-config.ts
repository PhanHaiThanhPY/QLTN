/**
 * Building configuration rules, ported from web/src/domain/building-config.ts and
 * web/src/services/handlers/building-handlers.ts. Pure functions: no database access.
 */
import type { FieldErrorDetail } from '../common/validation/validation-error.factory';
import { FieldErrors } from '../common/validation/field-errors';
import { type Capability, type Role, ROLES, roleCapabilities } from './permissions';

export const WORKFLOW_STAGE_KEYS = ['INTAKE', 'PROPOSAL', 'ACCEPTANCE', 'PAYMENT'] as const;
export type WorkflowStageKey = (typeof WORKFLOW_STAGE_KEYS)[number];

export interface WorkflowApprovalStep {
  key: string;
  label: string;
  actor: string;
  role: Role;
  roleDefId?: string;
  /** Repair status while the record waits on this step. */
  status: string;
}

export interface WorkflowStepBinding {
  businessStepKey: string;
  approvalStepKey?: string;
}

export interface WorkflowStageConfig {
  key: WorkflowStageKey;
  label: string;
  description: string;
  approvalStepKeys: string[];
  businessStepKeys: string[];
  stepBindings: WorkflowStepBinding[];
  enabled: boolean;
}

export interface AssignmentRule {
  departmentId: string;
  role: Role;
  locationIds?: string[];
  priority: number;
}

export const DUE_KINDS = [
  'CONFIRM_RECORD',
  'APPROVE_PROPOSAL',
  'REVIEW_ACCEPTANCE',
  'APPROVE_PAYMENT',
  'REVIEW_MAINTENANCE',
] as const;
export type DueKind = (typeof DUE_KINDS)[number];
export type TaskDueDays = Record<DueKind, number>;

/** Steps whose processing time each building can set (days). */
export const CONFIG_DUE_KINDS: readonly { kind: DueKind; label: string }[] = [
  { kind: 'CONFIRM_RECORD', label: 'Kỹ thuật xác nhận hiện trạng' },
  { kind: 'APPROVE_PROPOSAL', label: 'Mỗi bước duyệt tờ trình' },
  { kind: 'REVIEW_ACCEPTANCE', label: 'Nghiệm thu' },
  { kind: 'APPROVE_PAYMENT', label: 'BQT duyệt thanh toán' },
  { kind: 'REVIEW_MAINTENANCE', label: 'Kiểm tra kết quả bảo trì' },
];

/** Built-in approval steps. Buildings choose and order a subset and may add custom steps. */
export const APPROVAL_STEPS: readonly WorkflowApprovalStep[] = [
  {
    key: 'TECH_CONFIRM',
    status: 'PENDING_TECH_APPROVAL',
    role: 'TECH_CONFIRMER',
    actor: 'KT',
    label: 'Kỹ thuật duyệt',
  },
  { key: 'TECH', status: 'PENDING_TECH_REVIEW', role: 'TECH_CONSULTANT', actor: 'TVKT', label: 'TVKT thẩm định' },
  { key: 'BOARD', status: 'PENDING_BOARD_APPROVAL', role: 'OWNERS_BOARD', actor: 'BQT', label: 'BQT duyệt' },
];
export const CUSTOM_APPROVAL_STATUS = 'PENDING_CUSTOM_APPROVAL';
export const DEFAULT_APPROVAL_STEP_KEYS: readonly string[] = ['TECH'];

/** Lifecycle steps that can be enabled for each workflow stage. */
export const BUSINESS_WORKFLOW_STEPS: readonly {
  key: string;
  label: string;
  description: string;
  actor: string;
  stage: WorkflowStageKey;
  defaultApprovalStepKey?: string;
}[] = [
  {
    key: 'CREATE_RECORD',
    label: 'Tạo hồ sơ & lưu nháp',
    description: 'BQL ghi nhận yêu cầu và hoàn thiện thông tin ban đầu.',
    actor: 'BQL',
    stage: 'INTAKE',
  },
  {
    key: 'SUBMIT_CONFIRMATION',
    label: 'Gửi xác nhận hiện trạng',
    description: 'Chuyển hồ sơ cho kỹ thuật kiểm tra tại hiện trường.',
    actor: 'BQL',
    stage: 'INTAKE',
  },
  {
    key: 'CONFIRM_CONDITION',
    label: 'Kỹ thuật xác nhận hiện trạng',
    description: 'Kiểm tra sự cố, ảnh hiện trường và kết luận nhu cầu sửa chữa.',
    actor: 'KT',
    stage: 'INTAKE',
    defaultApprovalStepKey: 'TECH_CONFIRM',
  },
  {
    key: 'PREPARE_PROPOSAL',
    label: 'Lập tờ trình',
    description: 'BQL chuẩn bị phương án, chi phí dự kiến và hồ sơ trình duyệt.',
    actor: 'BQL',
    stage: 'PROPOSAL',
    defaultApprovalStepKey: 'TECH',
  },
  {
    key: 'START_CONSTRUCTION',
    label: 'Bắt đầu thi công',
    description: 'BQL xác nhận đủ điều kiện và mở giai đoạn thi công.',
    actor: 'BQL',
    stage: 'ACCEPTANCE',
  },
  {
    key: 'UPDATE_PROGRESS',
    label: 'Cập nhật tiến độ',
    description: 'Ghi nhận tiến độ thực hiện cho đến khi hoàn thành.',
    actor: 'BQL',
    stage: 'ACCEPTANCE',
  },
  {
    key: 'SUBMIT_ACCEPTANCE',
    label: 'Gửi nghiệm thu',
    description: 'Chuyển kết quả thi công sang bước nghiệm thu.',
    actor: 'BQL',
    stage: 'ACCEPTANCE',
  },
  {
    key: 'PASS_ACCEPTANCE',
    label: 'Nghiệm thu đạt',
    description: 'KT và TVKT kiểm tra kết quả trước khi thanh toán.',
    actor: 'KT + TVKT',
    stage: 'ACCEPTANCE',
    defaultApprovalStepKey: 'TECH',
  },
  {
    key: 'PREPARE_PAYMENT',
    label: 'Lập đề nghị thanh toán',
    description: 'BQL tổng hợp chứng từ và gửi đề nghị thanh toán.',
    actor: 'BQL',
    stage: 'PAYMENT',
  },
  {
    key: 'APPROVE_PAYMENT',
    label: 'BQT duyệt thanh toán',
    description: 'BQT kiểm tra hồ sơ và quyết định thanh toán.',
    actor: 'BQT',
    stage: 'PAYMENT',
    defaultApprovalStepKey: 'BOARD',
  },
  {
    key: 'RECORD_PAYMENT',
    label: 'Ghi nhận thanh toán',
    description: 'Ghi nhận khoản chi đã được thực hiện.',
    actor: 'BQL',
    stage: 'PAYMENT',
  },
  {
    key: 'COMPLETE_RECORD',
    label: 'Đóng hoàn tất',
    description: 'Hệ thống đóng hồ sơ sau khi hoàn thành thanh toán.',
    actor: 'Hệ thống',
    stage: 'PAYMENT',
  },
];
const BUSINESS_STEP_KEYS = new Set(BUSINESS_WORKFLOW_STEPS.map((step) => step.key));

export const DEFAULT_WORKFLOW_STAGES: readonly Omit<WorkflowStageConfig, 'stepBindings'>[] = [
  {
    key: 'INTAKE',
    label: 'Ghi nhận & xác nhận hiện trạng',
    description: 'Kiểm tra sự cố, ảnh hiện trường và xác nhận có cần sửa chữa.',
    businessStepKeys: ['CREATE_RECORD', 'SUBMIT_CONFIRMATION', 'CONFIRM_CONDITION'],
    approvalStepKeys: ['TECH_CONFIRM'],
    enabled: true,
  },
  {
    key: 'PROPOSAL',
    label: 'Duyệt phương án & tờ trình',
    description: 'Đánh giá phương án, chi phí dự kiến và quyết định thực hiện.',
    businessStepKeys: ['PREPARE_PROPOSAL'],
    approvalStepKeys: ['TECH_CONFIRM', 'TECH', 'BOARD'],
    enabled: true,
  },
  {
    key: 'ACCEPTANCE',
    label: 'Nghiệm thu',
    description: 'Kiểm tra kết quả thi công trước khi chuyển sang thanh toán.',
    businessStepKeys: ['START_CONSTRUCTION', 'UPDATE_PROGRESS', 'SUBMIT_ACCEPTANCE', 'PASS_ACCEPTANCE'],
    approvalStepKeys: ['TECH_CONFIRM', 'TECH'],
    enabled: true,
  },
  {
    key: 'PAYMENT',
    label: 'Hồ sơ & thanh toán',
    description: 'Kiểm tra bộ hồ sơ thanh toán và phê duyệt chi.',
    businessStepKeys: ['PREPARE_PAYMENT', 'APPROVE_PAYMENT', 'RECORD_PAYMENT', 'COMPLETE_RECORD'],
    approvalStepKeys: ['BOARD'],
    enabled: true,
  },
];

/** Workflow roles that a department assignment rule can resolve. */
export const ASSIGNMENT_ROLES: readonly Role[] = [
  'BQL',
  'TECH_CONFIRMER',
  'TECH_CONSULTANT',
  'OWNERS_BOARD',
  'ACCOUNTANT',
];

export const CONFIG_LIMITS = {
  DUE_DAYS_MAX: 30,
  EMERGENCY_HOURS_MIN: 4,
  EMERGENCY_HOURS_MAX: 72,
  RECENT_DAYS_MIN: 7,
  RECENT_DAYS_MAX: 730,
  REPEAT_MIN: 2,
  REPEAT_MAX: 10,
  PRICE_RATIO_MIN: 1.1,
  PRICE_RATIO_MAX: 5,
} as const;

/** Every configurable value of a building. Money is a decimal string (VND, integer). */
export interface ConfigValues {
  templateKey: string | null;
  workflowName: string | null;
  workflowDescription: string | null;
  taskDueDays: TaskDueDays;
  approvalStepKeys: string[];
  workflowApprovalSteps: WorkflowApprovalStep[];
  workflowStages: WorkflowStageConfig[];
  assignmentRules: AssignmentRule[];
  emergencyLimitVnd: string;
  emergencyDocHours: number;
  recentRepairDays: number;
  repeatMinRecords: number;
  priceRatio: number;
}

const DEFAULT_DUE_DAYS: TaskDueDays = {
  CONFIRM_RECORD: 3,
  APPROVE_PROPOSAL: 3,
  REVIEW_ACCEPTANCE: 3,
  APPROVE_PAYMENT: 3,
  REVIEW_MAINTENANCE: 2,
};

export const stepBindingsOf = (stage: Pick<WorkflowStageConfig, 'businessStepKeys'>): WorkflowStepBinding[] =>
  stage.businessStepKeys.map((businessStepKey) => {
    const approvalStepKey = BUSINESS_WORKFLOW_STEPS.find(
      (step) => step.key === businessStepKey,
    )?.defaultApprovalStepKey;
    return approvalStepKey ? { businessStepKey, approvalStepKey } : { businessStepKey };
  });

export const defaultWorkflowStages = (): WorkflowStageConfig[] =>
  DEFAULT_WORKFLOW_STAGES.map((stage) => ({
    ...stage,
    approvalStepKeys: [...stage.approvalStepKeys],
    businessStepKeys: [...stage.businessStepKeys],
    stepBindings: stepBindingsOf(stage),
  }));

export interface TemplateDefinition {
  key: string;
  name: string;
  description: string;
  taskDueDays: Partial<TaskDueDays>;
  emergencyLimitVnd: string;
  emergencyDocHours: number;
  recentRepairDays: number;
  repeatMinRecords: number;
  priceRatio: number;
}

/** Shared configuration templates a building can copy. */
export const CONFIG_TEMPLATES: readonly TemplateDefinition[] = [
  {
    key: 'STANDARD',
    name: 'Mẫu chung',
    description: 'Thời hạn và ngưỡng mặc định của hệ thống.',
    taskDueDays: {},
    emergencyLimitVnd: '20000000',
    emergencyDocHours: 24,
    recentRepairDays: 90,
    repeatMinRecords: 2,
    priceRatio: 1.5,
  },
  {
    key: 'RESIDENTIAL',
    name: 'Chung cư',
    description: 'Ưu tiên xử lý nhanh cho cư dân: thời hạn ngắn hơn, hạn mức khẩn cấp thấp hơn.',
    taskDueDays: { CONFIRM_RECORD: 2, APPROVE_PROPOSAL: 2, REVIEW_ACCEPTANCE: 2, APPROVE_PAYMENT: 3 },
    emergencyLimitVnd: '15000000',
    emergencyDocHours: 24,
    recentRepairDays: 90,
    repeatMinRecords: 2,
    priceRatio: 1.5,
  },
  {
    key: 'OFFICE',
    name: 'Tòa văn phòng',
    description: 'Hạng mục kỹ thuật lớn: hạn mức khẩn cấp cao hơn, thời hạn duyệt dài hơn.',
    taskDueDays: { CONFIRM_RECORD: 3, APPROVE_PROPOSAL: 4, REVIEW_ACCEPTANCE: 3, APPROVE_PAYMENT: 5 },
    emergencyLimitVnd: '50000000',
    emergencyDocHours: 48,
    recentRepairDays: 120,
    repeatMinRecords: 3,
    priceRatio: 1.3,
  },
];

/** Full configuration from a template (workflow parts reset to the defaults); undefined for an unknown key. */
export const templateValues = (key: string): ConfigValues | undefined => {
  const template = CONFIG_TEMPLATES.find((row) => row.key === key);
  if (!template) return undefined;
  return {
    templateKey: template.key,
    workflowName: null,
    workflowDescription: null,
    taskDueDays: { ...DEFAULT_DUE_DAYS, ...template.taskDueDays },
    approvalStepKeys: [...DEFAULT_APPROVAL_STEP_KEYS],
    workflowApprovalSteps: APPROVAL_STEPS.map((step) => ({ ...step })),
    workflowStages: defaultWorkflowStages(),
    assignmentRules: [],
    emergencyLimitVnd: template.emergencyLimitVnd,
    emergencyDocHours: template.emergencyDocHours,
    recentRepairDays: template.recentRepairDays,
    repeatMinRecords: template.repeatMinRecords,
    priceRatio: template.priceRatio,
  };
};

/** System steps always stay available; custom steps follow, without overriding a system key. */
export const approvalDefinitionsOf = (custom: readonly WorkflowApprovalStep[]): WorkflowApprovalStep[] => [
  ...APPROVAL_STEPS.map((step) => ({ ...step })),
  ...custom.filter((step) => !APPROVAL_STEPS.some((fixed) => fixed.key === step.key)).map((step) => ({ ...step })),
];

export const sortAssignmentRules = (rules: readonly AssignmentRule[]): AssignmentRule[] =>
  rules
    .map((rule) => ({ ...rule, ...(rule.locationIds ? { locationIds: [...rule.locationIds] } : {}) }))
    .sort(
      (a, b) => a.priority - b.priority || a.role.localeCompare(b.role) || a.departmentId.localeCompare(b.departmentId),
    );

/** Capability an approval step needs, by the stage it is used in. */
export const stageCapability = (stage: WorkflowStageKey): Capability => {
  if (stage === 'PAYMENT') return 'PAYMENT_DECIDE';
  if (stage === 'ACCEPTANCE') return 'ACCEPTANCE_DECIDE';
  return 'PROPOSAL_DECIDE';
};

/** Capabilities each approval step key needs across the stages that use it (PROPOSAL_DECIDE when unused). */
export const requiredStepCapabilities = (stages: readonly WorkflowStageConfig[], stepKey: string): Capability[] => {
  const needed = new Set<Capability>();
  for (const stage of stages) if (stage.approvalStepKeys.includes(stepKey)) needed.add(stageCapability(stage.key));
  return needed.size > 0 ? [...needed] : ['PROPOSAL_DECIDE'];
};

const isUnique = (values: readonly string[]) => new Set(values).size === values.length;

/**
 * Cross-field rules on a complete configuration (shape and ranges are checked by the DTO).
 * Database-dependent rules (departments, locations, custom roles) are checked by the service.
 */
export function validateConfigRules(values: ConfigValues): FieldErrorDetail[] {
  const errors = new FieldErrors();
  const steps = values.workflowApprovalSteps;

  errors.when(steps.length === 0, 'workflowApprovalSteps', 'Cần ít nhất một bước duyệt.');
  errors.when(!isUnique(steps.map((s) => s.key)), 'workflowApprovalSteps', 'Mã bước duyệt không được trùng nhau.');
  steps.forEach((step, index) => {
    const fixed = APPROVAL_STEPS.some((s) => s.key === step.key);
    errors.when(
      fixed && step.roleDefId !== undefined,
      `workflowApprovalSteps.${index}.roleDefId`,
      'Bước hệ thống không dùng roleDefId.',
    );
    errors.when(
      !ROLES.includes(step.role),
      `workflowApprovalSteps.${index}.role`,
      'Cần chọn vai trò hệ thống hoặc vai trò tùy chỉnh.',
    );
    if (!step.roleDefId) {
      for (const capability of requiredStepCapabilities(values.workflowStages, step.key)) {
        errors.when(
          !roleCapabilities(step.role).includes(capability),
          `workflowApprovalSteps.${index}.role`,
          `Vai trò được chọn không có quyền ${capability}.`,
        );
      }
    }
  });

  const stepKeys = new Set(steps.map((s) => s.key));
  const chain = values.approvalStepKeys;
  errors.when(
    chain.length === 0 || !isUnique(chain) || chain.some((key) => !stepKeys.has(key)),
    'approvalStepKeys',
    'Chuỗi phê duyệt cần ít nhất một bước, không trùng bước và chỉ dùng vai trò đã cấu hình.',
  );

  errors.when(
    !isUnique(values.workflowStages.map((s) => s.key)),
    'workflowStages',
    'Các giai đoạn workflow không được trùng nhau.',
  );
  values.workflowStages.forEach((stage, index) => {
    const path = `workflowStages.${index}`;
    errors.when(
      stage.approvalStepKeys.length === 0 ||
        !isUnique(stage.approvalStepKeys) ||
        stage.approvalStepKeys.some((key) => !stepKeys.has(key)),
      `${path}.approvalStepKeys`,
      'Mỗi giai đoạn cần ít nhất một bước duyệt đã cấu hình và không được trùng bước.',
    );
    errors.when(
      !isUnique(stage.businessStepKeys) || stage.businessStepKeys.some((key) => !BUSINESS_STEP_KEYS.has(key)),
      `${path}.businessStepKeys`,
      'Các bước nghiệp vụ trong một giai đoạn phải hợp lệ và không được trùng nhau.',
    );
    const bound = stage.stepBindings.map((b) => b.businessStepKey);
    errors.when(
      !isUnique(bound) || bound.some((key) => !BUSINESS_STEP_KEYS.has(key)),
      `${path}.stepBindings`,
      'Mỗi bước nghiệp vụ chỉ được gắn một lần trong giai đoạn.',
    );
    errors.when(
      stage.stepBindings.some(
        (b) => b.approvalStepKey !== undefined && !stage.approvalStepKeys.includes(b.approvalStepKey),
      ),
      `${path}.stepBindings`,
      'Bước nghiệp vụ chỉ được gắn với bước phê duyệt đang có trong giai đoạn.',
    );
  });

  const ruleKeys = values.assignmentRules.map(
    (rule) => `${rule.departmentId}|${rule.role}|${[...(rule.locationIds ?? [])].sort().join(',')}`,
  );
  errors.when(!isUnique(ruleKeys), 'assignmentRules', 'Không được tạo quy tắc phân công trùng nhau.');
  values.assignmentRules.forEach((rule, index) => {
    errors.when(
      !ASSIGNMENT_ROLES.includes(rule.role),
      `assignmentRules.${index}.role`,
      'Vai trò phân công không hợp lệ.',
    );
  });

  return [...errors.list];
}

export interface ConfigChange {
  label: string;
  from: string;
  to: string;
}

const money = (value: string): string => `${BigInt(value).toLocaleString('vi-VN')} ₫`;

/** Human-readable differences between two configurations (preview and audit reason). */
export function diffConfig(before: ConfigValues, after: ConfigValues): ConfigChange[] {
  const changes: ConfigChange[] = [];
  const allSteps = [...before.workflowApprovalSteps, ...after.workflowApprovalSteps];
  const labels = (keys: readonly string[]) =>
    keys.map((key) => allSteps.find((step) => step.key === key)?.actor ?? key).join(' → ');
  if (before.approvalStepKeys.join('|') !== after.approvalStepKeys.join('|')) {
    changes.push({
      label: 'Thứ tự chuỗi phê duyệt',
      from: labels(before.approvalStepKeys),
      to: labels(after.approvalStepKeys),
    });
  }
  if (JSON.stringify(before.workflowStages) !== JSON.stringify(after.workflowStages)) {
    changes.push({
      label: 'Các giai đoạn workflow',
      from: `${before.workflowStages.length} giai đoạn`,
      to: `${after.workflowStages.length} giai đoạn`,
    });
  }
  if (JSON.stringify(before.workflowApprovalSteps) !== JSON.stringify(after.workflowApprovalSteps)) {
    changes.push({
      label: 'Thư viện bước duyệt',
      from: `${before.workflowApprovalSteps.length} bước`,
      to: `${after.workflowApprovalSteps.length} bước`,
    });
  }
  const beforeRules = sortAssignmentRules(before.assignmentRules);
  const afterRules = sortAssignmentRules(after.assignmentRules);
  if (JSON.stringify(beforeRules) !== JSON.stringify(afterRules)) {
    changes.push({
      label: 'Quy tắc phân công workflow',
      from: `${beforeRules.length} quy tắc`,
      to: `${afterRules.length} quy tắc`,
    });
  }
  for (const { kind, label } of CONFIG_DUE_KINDS) {
    const from = before.taskDueDays[kind];
    const to = after.taskDueDays[kind];
    if (from !== to) changes.push({ label: `Thời hạn: ${label}`, from: `${from} ngày`, to: `${to} ngày` });
  }
  const scalar: { label: string; pick: (values: ConfigValues) => string }[] = [
    { label: 'Hạn mức sửa chữa khẩn cấp', pick: (v) => money(v.emergencyLimitVnd) },
    { label: 'Thời hạn bổ sung hồ sơ khẩn cấp', pick: (v) => `${v.emergencyDocHours} giờ` },
    { label: 'Cảnh báo mới sửa đã hỏng', pick: (v) => `${v.recentRepairDays} ngày` },
    { label: 'Cảnh báo hỏng lặp lại', pick: (v) => `từ ${v.repeatMinRecords} hồ sơ / 12 tháng` },
    { label: 'Cảnh báo giá bất thường', pick: (v) => `> ${String(v.priceRatio).replace('.', ',')} lần trung bình` },
  ];
  for (const row of scalar) {
    const from = row.pick(before);
    const to = row.pick(after);
    if (from !== to) changes.push({ label: row.label, from, to });
  }
  return changes;
}
