import {
  APPROVAL_STATUSES,
  APPROVAL_STEPS,
  DEFAULT_PROPOSAL_STEP_KEYS,
  OCCURRENCE_STATUS_LABEL,
  PLAN_STATUS_LABEL,
  REPAIR_FINAL_STATUSES,
  REPAIR_STATUS_LABEL,
} from './constants';
import type { ApprovalStepKey, OccurrenceStatus, PlanStatus, RepairStatus } from './constants';
import { denyReason } from './permissions';
import type { AssignedSubject, AssigneeSlot, Capability } from './permissions';
import type { User, WorkflowApprovalStep } from './types';

/**
 * Who may perform a step:
 * - a slot: only that assignee; null: anyone holding the capability in the building;
 * - APPROVAL_STEP: the assignee of the current approval step (derived from the status);
 * - ACCEPTANCE_PENDING: a configured acceptance approver who has not yet decided.
 * - PAYMENT_APPROVAL: the configured approver for the current payment step.
 */
export type SlotRule = AssigneeSlot | null | 'APPROVAL_STEP' | 'ACCEPTANCE_PENDING' | 'PAYMENT_APPROVAL';

export interface ActionDef<S extends string> {
  label: string;
  from: readonly S[];
  capability: Capability;
  slot: SlotRule;
}

export const APPROVAL_STEP_SLOT: Partial<Record<ApprovalStepKey, AssigneeSlot>> = {
  TECH_CONFIRM: 'confirmer',
  TECH: 'consultant',
  BOARD: 'board',
  MANAGER: 'manager',
};

export type ApprovalStep = WorkflowApprovalStep;

/** Current approval step for a status, or undefined outside the chain. */
export const approvalStepsFor = (
  keys?: readonly ApprovalStepKey[],
  definitions?: readonly WorkflowApprovalStep[],
): ApprovalStep[] => {
  const order = keys && keys.length > 0 ? keys : DEFAULT_PROPOSAL_STEP_KEYS;
  const available = definitions && definitions.length > 0 ? definitions : APPROVAL_STEPS;
  return order
    .map((key) => available.find((step) => step.key === key))
    .filter((step): step is ApprovalStep => Boolean(step));
};

export const approvalStepOf = (
  status: string,
  keys?: readonly ApprovalStepKey[],
  definitions?: readonly WorkflowApprovalStep[],
  currentKey?: ApprovalStepKey,
): ApprovalStep | undefined => {
  const chain = approvalStepsFor(keys, definitions);
  if (currentKey) return chain.find((step) => step.key === currentKey);
  return chain.find((step) => step.status === status);
};

export const nextApprovalStep = (
  key: ApprovalStepKey,
  keys?: readonly ApprovalStepKey[],
  definitions?: readonly WorkflowApprovalStep[],
): ApprovalStep | undefined => {
  const chain = approvalStepsFor(keys, definitions);
  const index = chain.findIndex((step) => step.key === key);
  return chain[index + 1];
};

/** Permission check for a customer-defined approval step that has no legacy slot field. */
export const workflowApprovalReason = (user: User, subject: RuleSubject): string | null => {
  const step = approvalStepOf(subject.status, subject.approvalStepKeys, subject.workflowApprovalSteps, subject.currentApprovalStepKey);
  if (!step || APPROVAL_STEP_SLOT[step.key]) return null;
  const assignedId = subject.approvalAssigneeUserIds?.[step.key];
  const matchesRole = step.roleDefId ? user.roleDefId === step.roleDefId : user.role === step.role;
  if (!assignedId || assignedId !== user.id || !matchesRole) return `Chỉ ${step.label} được giao mới thực hiện được bước này.`;
  return null;
};

const assignedToStep = (user: User, subject: RuleSubject, step: ApprovalStep): boolean => {
  const assignedId = subject.approvalAssigneeUserIds?.[step.key];
  const matchesRole = step.roleDefId ? user.roleDefId === step.roleDefId : user.role === step.role;
  return Boolean(assignedId && assignedId === user.id && matchesRole);
};

/** Permission check for the configured acceptance chain. */
export const workflowAcceptanceReason = (user: User, subject: RuleSubject): string | null => {
  if (!subject.pendingApprovalStepKeys) return null;
  const steps = approvalStepsFor(subject.pendingApprovalStepKeys, subject.workflowApprovalSteps);
  if (steps.some((step) => assignedToStep(user, subject, step))) return null;
  return 'Chỉ người được giao trong chuỗi nghiệm thu mới thực hiện được bước này.';
};

/** Permission check for a configured payment approval chain. */
export const workflowPaymentReason = (user: User, subject: RuleSubject): string | null => {
  const step = approvalStepOf(subject.status, subject.currentPaymentApprovalStepKey ? [subject.currentPaymentApprovalStepKey] : subject.approvalStepKeys, subject.workflowApprovalSteps, subject.currentPaymentApprovalStepKey);
  if (!step || !subject.currentPaymentApprovalStepKey) return null;
  if (assignedToStep(user, subject, step)) return null;
  return `Chỉ ${step.label} được giao mới thực hiện được bước này.`;
};

export interface RuleSubject extends AssignedSubject {
  status: string;
  approvalStepKeys?: readonly ApprovalStepKey[];
  workflowApprovalSteps?: readonly WorkflowApprovalStep[];
  approvalAssigneeUserIds?: Readonly<Record<string, string>>;
  currentApprovalStepKey?: ApprovalStepKey;
  pendingAcceptanceSlots?: readonly AssigneeSlot[];
  pendingApprovalStepKeys?: readonly ApprovalStepKey[];
  currentPaymentApprovalStepKey?: ApprovalStepKey;
}

export const resolveSlots = (rule: SlotRule, subject: RuleSubject): AssigneeSlot | readonly AssigneeSlot[] | null => {
  if (rule === 'APPROVAL_STEP') {
    const step = approvalStepOf(subject.status, subject.approvalStepKeys, subject.workflowApprovalSteps, subject.currentApprovalStepKey);
    return step ? APPROVAL_STEP_SLOT[step.key] ?? null : [];
  }
  if (rule === 'ACCEPTANCE_PENDING') return subject.pendingApprovalStepKeys ? null : (subject.pendingAcceptanceSlots ?? []);
  if (rule === 'PAYMENT_APPROVAL') {
    const step = approvalStepOf(subject.status, subject.currentPaymentApprovalStepKey ? [subject.currentPaymentApprovalStepKey] : subject.approvalStepKeys, subject.workflowApprovalSteps, subject.currentPaymentApprovalStepKey);
    return step && !APPROVAL_STEP_SLOT[step.key] ? null : (APPROVAL_STEP_SLOT[step?.key ?? ''] ?? 'board');
  }
  return rule;
};

const EDITABLE_PROPOSAL: readonly RepairStatus[] = ['PENDING_PROPOSAL', 'NEEDS_SUBMISSION_UPDATE', 'REJECTED_RESUBMITTABLE'];
/** Proposal can also be prepared while an emergency repair is under way (documents within the configured hours). */
const DRAFTABLE_PROPOSAL: readonly RepairStatus[] = [...EDITABLE_PROPOSAL, 'EMERGENCY_IN_PROGRESS'];
const OPEN_REPAIR = (Object.keys(REPAIR_STATUS_LABEL) as RepairStatus[]).filter(
  (status) => !REPAIR_FINAL_STATUSES.includes(status),
);

/** Record statuses of a new advance (SPEC v2 §5.4 A1) and of its follow-up after acceptance (A1b, A2, A3). */
const ADVANCE_REQUEST: readonly RepairStatus[] = ['READY_FOR_CONSTRUCTION', 'IN_CONSTRUCTION', 'PENDING_ACCEPTANCE', 'NEEDS_REPAIR'];
const ADVANCE_FOLLOW_UP: readonly RepairStatus[] = [...ADVANCE_REQUEST, 'PENDING_PAYMENT_REQUEST', 'NEEDS_PAYMENT_UPDATE'];

export const REPAIR_ACTIONS = {
  saveRecordDraft: { label: 'Lưu nháp', from: ['DRAFT', 'NEEDS_RECORD_UPDATE'], capability: 'RECORD_EDIT', slot: 'manager' },
  submitRecord: { label: 'Gửi xác nhận', from: ['DRAFT', 'NEEDS_RECORD_UPDATE'], capability: 'RECORD_EDIT', slot: 'manager' },
  withdrawRecord: {
    label: 'Rút hồ sơ',
    from: ['DRAFT', 'NEEDS_RECORD_UPDATE', ...EDITABLE_PROPOSAL],
    capability: 'RECORD_EDIT',
    slot: 'manager',
  },
  requestRecordUpdate: { label: 'Trả bổ sung', from: ['PENDING_CONFIRMATION'], capability: 'RECORD_CONFIRM', slot: 'confirmer' },
  confirmRepair: { label: 'Xác nhận cần sửa', from: ['PENDING_CONFIRMATION'], capability: 'RECORD_CONFIRM', slot: 'confirmer' },
  closeNoRepair: { label: 'Đóng không cần sửa', from: ['PENDING_CONFIRMATION'], capability: 'RECORD_CONFIRM', slot: 'confirmer' },
  saveProposalDraft: { label: 'Lưu tờ trình nháp', from: DRAFTABLE_PROPOSAL, capability: 'RECORD_EDIT', slot: 'manager' },
  submitProposal: { label: 'Trình duyệt', from: ['PENDING_PROPOSAL', 'EMERGENCY_IN_PROGRESS'], capability: 'RECORD_EDIT', slot: 'manager' },
  resubmitProposal: {
    label: 'Trình lại',
    from: ['NEEDS_SUBMISSION_UPDATE', 'REJECTED_RESUBMITTABLE'],
    capability: 'RECORD_EDIT',
    slot: 'manager',
  },
  approveProposal: { label: 'Duyệt', from: APPROVAL_STATUSES, capability: 'PROPOSAL_DECIDE', slot: 'APPROVAL_STEP' },
  requestProposalUpdate: { label: 'Yêu cầu bổ sung', from: APPROVAL_STATUSES, capability: 'PROPOSAL_DECIDE', slot: 'APPROVAL_STEP' },
  rejectProposal: { label: 'Từ chối', from: APPROVAL_STATUSES, capability: 'PROPOSAL_DECIDE', slot: 'APPROVAL_STEP' },
  saveUnresolvedNotice: { label: 'Lưu thông báo', from: ['UNRESOLVED'], capability: 'RECORD_EDIT', slot: 'manager' },
  issueUnresolvedNotice: { label: 'Phát hành thông báo', from: ['UNRESOLVED'], capability: 'RECORD_EDIT', slot: 'manager' },
  startConstruction: { label: 'Bắt đầu thi công', from: ['READY_FOR_CONSTRUCTION'], capability: 'CONSTRUCTION', slot: 'manager' },
  startEmergencyRepair: {
    label: 'Xử lý khẩn cấp',
    from: ['DRAFT', 'PENDING_CONFIRMATION', 'PENDING_PROPOSAL'],
    capability: 'EMERGENCY_START',
    slot: 'manager',
  },
  updateConstruction: { label: 'Cập nhật tiến độ', from: ['IN_CONSTRUCTION', 'EMERGENCY_IN_PROGRESS'], capability: 'CONSTRUCTION', slot: 'manager' },
  submitAcceptance: { label: 'Gửi nghiệm thu', from: ['IN_CONSTRUCTION'], capability: 'CONSTRUCTION', slot: 'manager' },
  passAcceptance: { label: 'Nghiệm thu đạt', from: ['PENDING_ACCEPTANCE'], capability: 'ACCEPTANCE_DECIDE', slot: 'ACCEPTANCE_PENDING' },
  failAcceptance: {
    label: 'Nghiệm thu không đạt',
    from: ['PENDING_ACCEPTANCE'],
    capability: 'ACCEPTANCE_DECIDE',
    slot: 'ACCEPTANCE_PENDING',
  },
  saveRepairEvidence: { label: 'Lưu nội dung khắc phục', from: ['NEEDS_REPAIR'], capability: 'CONSTRUCTION', slot: 'manager' },
  resubmitAcceptance: { label: 'Gửi nghiệm thu lại', from: ['NEEDS_REPAIR'], capability: 'CONSTRUCTION', slot: 'manager' },
  savePaymentDraft: {
    label: 'Lưu đề nghị nháp',
    from: ['PENDING_PAYMENT_REQUEST', 'NEEDS_PAYMENT_UPDATE'],
    capability: 'PAYMENT_RECORD',
    slot: 'manager',
  },
  submitPaymentRequest: {
    label: 'Gửi đề nghị thanh toán',
    from: ['PENDING_PAYMENT_REQUEST', 'NEEDS_PAYMENT_UPDATE'],
    capability: 'PAYMENT_RECORD',
    slot: 'manager',
  },
  approvePayment: { label: 'Duyệt thanh toán', from: ['PENDING_PAYMENT_APPROVAL', 'PENDING_CUSTOM_PAYMENT_APPROVAL'], capability: 'PAYMENT_DECIDE', slot: 'PAYMENT_APPROVAL' },
  requestPaymentUpdate: {
    label: 'Trả đề nghị thanh toán',
    from: ['PENDING_PAYMENT_APPROVAL', 'PENDING_CUSTOM_PAYMENT_APPROVAL'],
    capability: 'PAYMENT_DECIDE',
    slot: 'PAYMENT_APPROVAL',
  },
  recordPayment: { label: 'Ghi nhận thanh toán', from: ['PENDING_PAYMENT'], capability: 'PAYMENT_RECORD', slot: 'manager' },
  completeRecord: { label: 'Đóng hoàn tất', from: ['PENDING_PAYMENT'], capability: 'PAYMENT_RECORD', slot: 'manager' },
  // B03–B09 v2 S4 (api mode): transfers confirmed by any PAYMENT_CONFIRM holder, advances alongside the record.
  confirmPaymentTransfer: { label: 'Xác nhận đã chuyển khoản', from: ['PENDING_PAYMENT'], capability: 'PAYMENT_CONFIRM', slot: null },
  submitAdvanceRequest: { label: 'Đề nghị tạm ứng', from: ADVANCE_REQUEST, capability: 'PAYMENT_RECORD', slot: 'manager' },
  resubmitAdvanceRequest: { label: 'Gửi lại đề nghị tạm ứng', from: ADVANCE_FOLLOW_UP, capability: 'PAYMENT_RECORD', slot: 'manager' },
  approveAdvance: { label: 'Duyệt tạm ứng', from: ADVANCE_FOLLOW_UP, capability: 'PAYMENT_DECIDE', slot: 'PAYMENT_APPROVAL' },
  requestAdvanceUpdate: { label: 'Trả đề nghị tạm ứng', from: ADVANCE_FOLLOW_UP, capability: 'PAYMENT_DECIDE', slot: 'PAYMENT_APPROVAL' },
  confirmAdvanceTransfer: { label: 'Xác nhận chuyển khoản tạm ứng', from: ADVANCE_FOLLOW_UP, capability: 'PAYMENT_CONFIRM', slot: null },
  reassignRepair: { label: 'Giao lại', from: OPEN_REPAIR, capability: 'REASSIGN', slot: 'manager' },
} as const satisfies Record<string, ActionDef<RepairStatus>>;
export type RepairAction = keyof typeof REPAIR_ACTIONS;

const OPEN_OCCURRENCE: readonly OccurrenceStatus[] = ['SCHEDULED', 'IN_PROGRESS', 'PENDING_REVIEW', 'REWORK'];

export const OCCURRENCE_ACTIONS = {
  startMaintenance: { label: 'Bắt đầu', from: ['SCHEDULED'], capability: 'MAINTENANCE_MANAGE', slot: 'manager' },
  saveMaintenanceProgress: {
    label: 'Lưu tiến độ',
    from: ['IN_PROGRESS', 'REWORK'],
    capability: 'MAINTENANCE_MANAGE',
    slot: 'manager',
  },
  submitMaintenance: { label: 'Gửi kết quả', from: ['IN_PROGRESS', 'REWORK'], capability: 'MAINTENANCE_MANAGE', slot: 'manager' },
  rescheduleMaintenance: { label: 'Đổi lịch', from: ['SCHEDULED'], capability: 'MAINTENANCE_MANAGE', slot: 'manager' },
  acknowledgeScheduleChange: {
    label: 'Giữ lượt này',
    from: ['SCHEDULED'],
    capability: 'MAINTENANCE_MANAGE',
    slot: 'manager',
  },
  cancelMaintenance: {
    label: 'Hủy lượt',
    from: ['SCHEDULED', 'IN_PROGRESS', 'REWORK'],
    capability: 'MAINTENANCE_MANAGE',
    slot: 'manager',
  },
  createRepairFromMaintenance: {
    label: 'Tạo hồ sơ sửa chữa',
    from: ['IN_PROGRESS', 'PENDING_REVIEW', 'REWORK'],
    capability: 'MAINTENANCE_MANAGE',
    slot: 'manager',
  },
  requestMaintenanceRework: {
    label: 'Yêu cầu làm lại',
    from: ['PENDING_REVIEW'],
    capability: 'MAINTENANCE_REVIEW',
    slot: 'confirmer',
  },
  confirmMaintenance: { label: 'Xác nhận hoàn tất', from: ['PENDING_REVIEW'], capability: 'MAINTENANCE_REVIEW', slot: 'confirmer' },
  reassignMaintenance: { label: 'Giao lại', from: OPEN_OCCURRENCE, capability: 'REASSIGN', slot: 'manager' },
} as const satisfies Record<string, ActionDef<OccurrenceStatus>>;
export type OccurrenceAction = keyof typeof OCCURRENCE_ACTIONS;

const ALL_PLAN: readonly PlanStatus[] = ['DRAFT', 'ACTIVE', 'PAUSED'];

export const PLAN_ACTIONS = {
  updateMaintenancePlan: { label: 'Sửa kế hoạch', from: ALL_PLAN, capability: 'MAINTENANCE_MANAGE', slot: 'manager' },
  activateMaintenancePlan: { label: 'Kích hoạt', from: ['DRAFT', 'PAUSED'], capability: 'MAINTENANCE_MANAGE', slot: 'manager' },
  pauseMaintenancePlan: { label: 'Tạm dừng', from: ['ACTIVE'], capability: 'MAINTENANCE_MANAGE', slot: 'manager' },
  changeMaintenanceSchedule: {
    label: 'Đổi chu kỳ',
    from: ['ACTIVE', 'PAUSED'],
    capability: 'MAINTENANCE_MANAGE',
    slot: 'manager',
  },
  createManualOccurrence: {
    label: 'Tạo lượt bù',
    from: ['ACTIVE', 'PAUSED'],
    capability: 'MAINTENANCE_MANAGE',
    slot: 'manager',
  },
} as const satisfies Record<string, ActionDef<PlanStatus>>;
export type PlanAction = keyof typeof PLAN_ACTIONS;

export interface ActionState {
  allowed: boolean;
  reason?: string;
}

const statusLabel = (status: string): string =>
  (REPAIR_STATUS_LABEL as Record<string, string>)[status] ??
  (OCCURRENCE_STATUS_LABEL as Record<string, string>)[status] ??
  (PLAN_STATUS_LABEL as Record<string, string>)[status] ??
  status;

/** Shared guard used by UI (disabled reason) and by the command engine (rejection). */
export const evaluateAction = <S extends string>(
  def: ActionDef<S>,
  user: User,
  subject: RuleSubject & { status: S },
): ActionState => {
  const reason = denyReason(user, subject, def.capability, resolveSlots(def.slot, subject));
  if (reason) return { allowed: false, reason };
  if (def.slot === 'APPROVAL_STEP') {
    const approvalReason = workflowApprovalReason(user, subject);
    if (approvalReason) return { allowed: false, reason: approvalReason };
  }
  if (def.slot === 'ACCEPTANCE_PENDING') {
    const acceptanceReason = workflowAcceptanceReason(user, subject);
    if (acceptanceReason) return { allowed: false, reason: acceptanceReason };
  }
  if (def.slot === 'PAYMENT_APPROVAL') {
    const paymentReason = workflowPaymentReason(user, subject);
    if (paymentReason) return { allowed: false, reason: paymentReason };
  }
  if (!def.from.includes(subject.status)) {
    return { allowed: false, reason: `Không áp dụng khi đang ở trạng thái “${statusLabel(subject.status)}”.` };
  }
  return { allowed: true };
};
