import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { hasCapability } from '../../common/auth/scope';
import { conflictWithReason, forbiddenWithReason } from '../../common/errors';
import type { Capability } from '../../domain/permissions';
import type { RepairRecord } from './entities/repair-record.entity';

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
   * technical confirmer. Both keep the order capability → assignee → source status (SPEC B03–B09 §4).
   */
  slot: 'manager' | 'confirmer';
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
    throw forbiddenWithReason('not_step_assignee', 'Chỉ kỹ thuật xác nhận được giao mới thực hiện được bước này.');
  }
  if (!def.from.includes(record.status)) {
    throw conflictWithReason(
      'invalid_status_transition',
      `Hồ sơ đang ở trạng thái «${recordStatusLabel(record.status)}», không thực hiện được «${def.label}». Vui lòng tải lại.`,
    );
  }
}
