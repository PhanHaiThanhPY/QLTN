import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { hasCapability } from '../../common/auth/scope';
import { conflictWithReason, forbiddenWithReason } from '../../common/errors';
import type { Capability } from '../../domain/permissions';
import type { RepairRecord } from './entities/repair-record.entity';
import { acceptanceStepsHeldBy, currentStepKeyOf, PROPOSAL_APPROVAL_STATUSES, stepHolderOf } from './record-steps';

/** Statuses where the manager prepares or reworks a proposal (T04–T06). */
export const PROPOSAL_EDIT_STATUSES: readonly string[] = [
  'PENDING_PROPOSAL',
  'NEEDS_SUBMISSION_UPDATE',
  'REJECTED_RESUBMITTABLE',
];

/** Vietnamese labels of every repair status, mirroring web `REPAIR_STATUS_LABEL`. */
export const RECORD_STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Nháp',
  PENDING_CONFIRMATION: 'Chờ xác nhận',
  NEEDS_RECORD_UPDATE: 'Cần bổ sung thông tin',
  PENDING_PROPOSAL: 'Chờ lập tờ trình',
  EMERGENCY_IN_PROGRESS: 'Đang xử lý khẩn cấp',
  PENDING_TECH_APPROVAL: 'Chờ kỹ thuật duyệt',
  PENDING_TECH_REVIEW: 'Chờ TVKT thẩm định',
  PENDING_BOARD_APPROVAL: 'Chờ BQT duyệt',
  PENDING_CUSTOM_APPROVAL: 'Chờ phê duyệt theo workflow',
  PENDING_CUSTOM_PAYMENT_APPROVAL: 'Chờ duyệt thanh toán theo workflow',
  NEEDS_SUBMISSION_UPDATE: 'Cần bổ sung tờ trình',
  REJECTED_RESUBMITTABLE: 'Từ chối và được trình lại',
  READY_FOR_CONSTRUCTION: 'Chờ thi công',
  IN_CONSTRUCTION: 'Đang thi công',
  PENDING_ACCEPTANCE: 'Chờ nghiệm thu',
  NEEDS_REPAIR: 'Cần khắc phục',
  PENDING_PAYMENT_REQUEST: 'Chờ đề nghị thanh toán',
  PENDING_PAYMENT_APPROVAL: 'Chờ duyệt thanh toán',
  NEEDS_PAYMENT_UPDATE: 'Cần bổ sung thanh toán',
  PENDING_PAYMENT: 'Chờ thanh toán',
  COMPLETED: 'Hoàn tất',
  CLOSED_NO_REPAIR: 'Đóng vì không cần sửa',
  UNRESOLVED: 'Chưa xử lý',
  CLOSED_WITHDRAWN: 'Đóng do rút hồ sơ',
};

export const recordStatusLabel = (status: string): string => RECORD_STATUS_LABEL[status] ?? status;

export interface RecordActionDef {
  label: string;
  /** Source statuses the action may start from. */
  from: readonly string[];
  capability: Capability;
  /**
   * Who may act, as the demo's `slot`: `manager` = the record's managing BQL, `confirmer` = the assigned
   * confirmer; both check capability → assignee → source status. `approvalStep` = holder of the step the proposal
   * waits on, checked capability → source status → holder, since outside those statuses there is no current step
   * (SPEC B03–B09 §4). `acceptanceMember` = holder of an ACCEPTANCE step of the snapshot, checked the same way; the
   * service then refuses a member who already decided in the round (409 `step_already_decided`).
   */
  slot: 'manager' | 'confirmer' | 'approvalStep' | 'acceptanceMember';
}

/**
 * One row per record transition; later stages add their own row instead of duplicating
 * the permission/status guard. Source statuses mirror web `REPAIR_ACTIONS`.
 */
export const RECORD_ACTIONS = {
  saveRecordDraft: {
    label: 'Lưu nháp',
    from: ['DRAFT', 'NEEDS_RECORD_UPDATE'],
    capability: 'RECORD_EDIT',
    slot: 'manager',
  },
  submitRecord: {
    label: 'Gửi xác nhận',
    from: ['DRAFT', 'NEEDS_RECORD_UPDATE'],
    capability: 'RECORD_EDIT',
    slot: 'manager',
  },
  withdrawRecord: {
    label: 'Rút hồ sơ',
    from: ['DRAFT', 'NEEDS_RECORD_UPDATE', 'PENDING_PROPOSAL', 'NEEDS_SUBMISSION_UPDATE', 'REJECTED_RESUBMITTABLE'],
    capability: 'RECORD_EDIT',
    slot: 'manager',
  },
  requestRecordUpdate: {
    label: 'Trả bổ sung',
    from: ['PENDING_CONFIRMATION'],
    capability: 'RECORD_CONFIRM',
    slot: 'confirmer',
  },
  confirmRepair: {
    label: 'Xác nhận cần sửa',
    from: ['PENDING_CONFIRMATION'],
    capability: 'RECORD_CONFIRM',
    slot: 'confirmer',
  },
  closeNoRepair: {
    label: 'Đóng không cần sửa',
    from: ['PENDING_CONFIRMATION'],
    capability: 'RECORD_CONFIRM',
    slot: 'confirmer',
  },
  saveProposalDraft: {
    label: 'Lưu nháp tờ trình',
    from: PROPOSAL_EDIT_STATUSES,
    capability: 'RECORD_EDIT',
    slot: 'manager',
  },
  submitProposal: {
    label: 'Trình duyệt',
    from: ['PENDING_PROPOSAL'],
    capability: 'RECORD_EDIT',
    slot: 'manager',
  },
  resubmitProposal: {
    label: 'Trình lại',
    from: ['NEEDS_SUBMISSION_UPDATE', 'REJECTED_RESUBMITTABLE'],
    capability: 'RECORD_EDIT',
    slot: 'manager',
  },
  approveProposal: {
    label: 'Duyệt tờ trình',
    from: PROPOSAL_APPROVAL_STATUSES,
    capability: 'PROPOSAL_DECIDE',
    slot: 'approvalStep',
  },
  requestProposalUpdate: {
    label: 'Yêu cầu bổ sung tờ trình',
    from: PROPOSAL_APPROVAL_STATUSES,
    capability: 'PROPOSAL_DECIDE',
    slot: 'approvalStep',
  },
  rejectProposal: {
    label: 'Từ chối tờ trình',
    from: PROPOSAL_APPROVAL_STATUSES,
    capability: 'PROPOSAL_DECIDE',
    slot: 'approvalStep',
  },
  startConstruction: {
    label: 'Bắt đầu thi công',
    from: ['READY_FOR_CONSTRUCTION'],
    capability: 'CONSTRUCTION',
    slot: 'manager',
  },
  updateConstruction: {
    label: 'Cập nhật thi công',
    from: ['IN_CONSTRUCTION'],
    capability: 'CONSTRUCTION',
    slot: 'manager',
  },
  submitAcceptance: {
    label: 'Gửi nghiệm thu',
    from: ['IN_CONSTRUCTION'],
    capability: 'CONSTRUCTION',
    slot: 'manager',
  },
  passAcceptance: {
    label: 'Nghiệm thu đạt',
    from: ['PENDING_ACCEPTANCE'],
    capability: 'ACCEPTANCE_DECIDE',
    slot: 'acceptanceMember',
  },
  failAcceptance: {
    label: 'Nghiệm thu không đạt',
    from: ['PENDING_ACCEPTANCE'],
    capability: 'ACCEPTANCE_DECIDE',
    slot: 'acceptanceMember',
  },
  saveRepairEvidence: {
    label: 'Lưu nội dung khắc phục',
    from: ['NEEDS_REPAIR'],
    capability: 'CONSTRUCTION',
    slot: 'manager',
  },
  resubmitAcceptance: {
    label: 'Gửi nghiệm thu lại',
    from: ['NEEDS_REPAIR'],
    capability: 'CONSTRUCTION',
    slot: 'manager',
  },
} as const satisfies Record<string, RecordActionDef>;

export type RecordAction = keyof typeof RECORD_ACTIONS;

/** Capability → assignee of the slot → source status; a refusal carries a stable `details.reason`. */
export function assertRecordAction(actor: AuthenticatedUser, record: RepairRecord, action: RecordAction): void {
  const def: RecordActionDef = RECORD_ACTIONS[action];
  if (!hasCapability(actor, def.capability)) {
    throw forbiddenWithReason('missing_capability', 'Bạn không có quyền thực hiện thao tác này.');
  }
  if (def.slot === 'manager' && actor.id !== record.managerUserId) {
    throw forbiddenWithReason('not_record_manager', 'Chỉ BQL quản lý được giao mới thực hiện được bước này.');
  }
  if (def.slot === 'confirmer' && actor.id !== record.confirmationUserId) {
    throw forbiddenWithReason(
      'not_step_assignee',
      'Chỉ người xác nhận hiện trạng được giao mới thực hiện được bước này.',
    );
  }
  if (!def.from.includes(record.status)) {
    throw conflictWithReason(
      'invalid_status_transition',
      `Hồ sơ đang ở trạng thái «${recordStatusLabel(record.status)}», không thực hiện được «${def.label}». Vui lòng tải lại.`,
    );
  }
  if (def.slot === 'acceptanceMember' && acceptanceStepsHeldBy(record, actor.id).length === 0) {
    throw forbiddenWithReason('not_step_assignee', 'Bạn không phải thành phần nghiệm thu của hồ sơ này.');
  }
  if (def.slot === 'approvalStep') {
    const key = currentStepKeyOf(record);
    if (!key || stepHolderOf(record, key) !== actor.id) {
      throw forbiddenWithReason('not_step_assignee', 'Chỉ người được giao ở bước duyệt hiện tại mới quyết định được.');
    }
  }
}
