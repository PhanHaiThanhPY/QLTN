import {
  APPROVAL_STATUSES,
  APPROVAL_STEPS,
  DEFAULT_APPROVAL_STEP_KEYS,
  OCCURRENCE_STATUS_LABEL,
  PLAN_STATUS_LABEL,
  REPAIR_FINAL_STATUSES,
  REPAIR_STATUS_LABEL,
} from './constants';
import type { ApprovalStepKey, OccurrenceStatus, PlanStatus, RepairStatus } from './constants';
import { denyReason } from './permissions';
import type { AssignedSubject, AssigneeSlot, Capability } from './permissions';
import type { User } from './types';

/**
 * Who may perform a step:
 * - a slot: only that assignee; null: anyone holding the capability in the building;
 * - APPROVAL_STEP: the assignee of the current approval step (derived from the status);
 * - ACCEPTANCE_PENDING: KT or TVKT who has not yet passed the current acceptance round.
 */
export type SlotRule = AssigneeSlot | null | 'APPROVAL_STEP' | 'ACCEPTANCE_PENDING';

export interface ActionDef<S extends string> {
  label: string;
  from: readonly S[];
  capability: Capability;
  slot: SlotRule;
}

export const APPROVAL_STEP_SLOT: Record<ApprovalStepKey, AssigneeSlot> = {
  TECH_CONFIRM: 'confirmer',
  TECH: 'consultant',
  BOARD: 'board',
};

export type ApprovalStep = (typeof APPROVAL_STEPS)[number];

/** Current approval step for a status, or undefined outside the chain. */
export const approvalStepsFor = (keys?: readonly ApprovalStepKey[]): ApprovalStep[] => {
  const order = keys && keys.length > 0 ? keys : DEFAULT_APPROVAL_STEP_KEYS;
  return order.map((key) => APPROVAL_STEPS.find((step) => step.key === key)).filter((step): step is ApprovalStep => Boolean(step));
};

export const approvalStepOf = (status: string, keys?: readonly ApprovalStepKey[]): ApprovalStep | undefined =>
  approvalStepsFor(keys).find((step) => step.status === status);

export const nextApprovalStep = (key: ApprovalStepKey, keys?: readonly ApprovalStepKey[]): ApprovalStep | undefined => {
  const chain = approvalStepsFor(keys);
  const index = chain.findIndex((step) => step.key === key);
  return chain[index + 1];
};

export interface RuleSubject extends AssignedSubject {
  status: string;
  approvalStepKeys?: readonly ApprovalStepKey[];
  pendingAcceptanceSlots?: readonly AssigneeSlot[];
}

export const resolveSlots = (rule: SlotRule, subject: RuleSubject): AssigneeSlot | readonly AssigneeSlot[] | null => {
  if (rule === 'APPROVAL_STEP') {
    const step = approvalStepOf(subject.status, subject.approvalStepKeys);
    return step ? APPROVAL_STEP_SLOT[step.key] : [];
  }
  if (rule === 'ACCEPTANCE_PENDING') return subject.pendingAcceptanceSlots ?? [];
  return rule;
};

const EDITABLE_PROPOSAL: readonly RepairStatus[] = ['PENDING_PROPOSAL', 'NEEDS_SUBMISSION_UPDATE', 'REJECTED_RESUBMITTABLE'];
/** Proposal can also be prepared while an emergency repair is under way (documents within the configured hours). */
const DRAFTABLE_PROPOSAL: readonly RepairStatus[] = [...EDITABLE_PROPOSAL, 'EMERGENCY_IN_PROGRESS'];
const OPEN_REPAIR = (Object.keys(REPAIR_STATUS_LABEL) as RepairStatus[]).filter(
  (status) => !REPAIR_FINAL_STATUSES.includes(status),
);

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
  approvePayment: { label: 'Duyệt thanh toán', from: ['PENDING_PAYMENT_APPROVAL'], capability: 'PAYMENT_DECIDE', slot: 'board' },
  requestPaymentUpdate: {
    label: 'Trả đề nghị thanh toán',
    from: ['PENDING_PAYMENT_APPROVAL'],
    capability: 'PAYMENT_DECIDE',
    slot: 'board',
  },
  recordPayment: { label: 'Ghi nhận thanh toán', from: ['PENDING_PAYMENT'], capability: 'PAYMENT_RECORD', slot: 'manager' },
  completeRecord: { label: 'Đóng hoàn tất', from: ['PENDING_PAYMENT'], capability: 'PAYMENT_RECORD', slot: 'manager' },
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
  if (!def.from.includes(subject.status)) {
    return { allowed: false, reason: `Không áp dụng khi đang ở trạng thái “${statusLabel(subject.status)}”.` };
  }
  return { allowed: true };
};
