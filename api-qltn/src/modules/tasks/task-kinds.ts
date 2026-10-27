import type { DueKind } from '../../domain/building-config';
import type { RecordAction } from '../records/record-actions';

/**
 * Task kinds of the repair flow (SPEC TK-S1 BR-TK-02). Names follow the SPEC table; `tab` is the record tab that
 * opens (web `TASK_KIND_TAB`); `dueKind` names the snapshotted due days, absent for kinds without a deadline
 * (D-TK-3); `action` is the record action that does the task, so a task exists only where that action is allowed.
 */
export const REPAIR_TASK_KINDS = {
  CONFIRM_RECORD: { label: 'Xác nhận hồ sơ', tab: 'overview', dueKind: 'CONFIRM_RECORD', action: 'confirmRepair' },
  UPDATE_RECORD: { label: 'Bổ sung hồ sơ', tab: 'overview', action: 'submitRecord' },
  PREPARE_PROPOSAL: { label: 'Soạn tờ trình', tab: 'approval', action: 'saveProposalDraft' },
  SUBMIT_EMERGENCY_DOCS: { label: 'Nộp hồ sơ khẩn cấp', tab: 'approval', action: 'submitProposal' },
  APPROVE_PROPOSAL: {
    label: 'Duyệt tờ trình',
    tab: 'approval',
    dueKind: 'APPROVE_PROPOSAL',
    action: 'approveProposal',
  },
  START_CONSTRUCTION: { label: 'Bắt đầu thi công', tab: 'construction', action: 'startConstruction' },
  UPDATE_CONSTRUCTION: { label: 'Gửi nghiệm thu', tab: 'construction', action: 'submitAcceptance' },
  REVIEW_ACCEPTANCE: { label: 'Nghiệm thu', tab: 'acceptance', dueKind: 'REVIEW_ACCEPTANCE', action: 'passAcceptance' },
  FIX_DEFECT: { label: 'Khắc phục và gửi nghiệm thu lại', tab: 'acceptance', action: 'resubmitAcceptance' },
  PREPARE_PAYMENT_REQUEST: { label: 'Lập đề nghị thanh toán', tab: 'payment', action: 'submitPaymentRequest' },
  APPROVE_PAYMENT: { label: 'Duyệt thanh toán', tab: 'payment', dueKind: 'APPROVE_PAYMENT', action: 'approvePayment' },
  RECORD_PAYMENT: { label: 'Ghi nhận chuyển khoản', tab: 'payment', action: 'confirmPaymentTransfer' },
  APPROVE_ADVANCE: { label: 'Duyệt tạm ứng', tab: 'payment', dueKind: 'APPROVE_PAYMENT', action: 'approveAdvance' },
  RECORD_ADVANCE_PAYMENT: { label: 'Ghi nhận chuyển khoản tạm ứng', tab: 'payment', action: 'confirmAdvanceTransfer' },
  CLOSE_POST_REVIEW: { label: 'Đóng hồ sơ không duyệt hậu kiểm', tab: 'approval', action: 'closePostReviewRejected' },
  REASSIGN_REQUIRED: { label: 'Cần phân công lại', tab: 'overview' },
} as const satisfies Record<string, { label: string; tab: string; dueKind?: DueKind; action?: RecordAction }>;

export type RepairTaskKind = keyof typeof REPAIR_TASK_KINDS;

/** Manager tasks chosen by the record status alone (BR-TK-02); each status is a source status of the task's action. */
export const MANAGER_TASK_BY_STATUS: Readonly<Record<string, RepairTaskKind>> = {
  NEEDS_RECORD_UPDATE: 'UPDATE_RECORD',
  PENDING_PROPOSAL: 'PREPARE_PROPOSAL',
  NEEDS_SUBMISSION_UPDATE: 'PREPARE_PROPOSAL',
  REJECTED_RESUBMITTABLE: 'PREPARE_PROPOSAL',
  EMERGENCY_IN_PROGRESS: 'SUBMIT_EMERGENCY_DOCS',
  READY_FOR_CONSTRUCTION: 'START_CONSTRUCTION',
  IN_CONSTRUCTION: 'UPDATE_CONSTRUCTION',
  NEEDS_REPAIR: 'FIX_DEFECT',
  PENDING_PAYMENT_REQUEST: 'PREPARE_PAYMENT_REQUEST',
  NEEDS_PAYMENT_UPDATE: 'PREPARE_PAYMENT_REQUEST',
};

/**
 * Actions that move a record on, with the task name and the result shown in "Đã hoàn thành" (BR-TK-06). Draft saves,
 * progress updates and withdrawals are left out (BR-TK-01).
 */
export const COMPLETED_ACTIONS: Readonly<Partial<Record<RecordAction, { task: string; result: string }>>> = {
  submitRecord: { task: 'Gửi xác nhận hồ sơ', result: 'Đã gửi' },
  confirmRepair: { task: 'Xác nhận hồ sơ', result: 'Đã xác nhận cần sửa' },
  requestRecordUpdate: { task: 'Xác nhận hồ sơ', result: 'Yêu cầu bổ sung' },
  closeNoRepair: { task: 'Xác nhận hồ sơ', result: 'Đóng không cần sửa' },
  startEmergencyRepair: { task: 'Xử lý khẩn cấp', result: 'Đã cho làm trước' },
  submitProposal: { task: 'Soạn tờ trình', result: 'Đã trình duyệt' },
  resubmitProposal: { task: 'Soạn tờ trình', result: 'Đã trình lại' },
  approveProposal: { task: 'Duyệt tờ trình', result: 'Đã duyệt' },
  requestProposalUpdate: { task: 'Duyệt tờ trình', result: 'Yêu cầu bổ sung' },
  rejectProposal: { task: 'Duyệt tờ trình', result: 'Từ chối' },
  closePostReviewRejected: { task: 'Đóng hồ sơ không duyệt hậu kiểm', result: 'Đã đóng' },
  startConstruction: { task: 'Bắt đầu thi công', result: 'Đã bắt đầu' },
  submitAcceptance: { task: 'Gửi nghiệm thu', result: 'Đã gửi' },
  resubmitAcceptance: { task: 'Khắc phục và gửi nghiệm thu lại', result: 'Đã gửi lại' },
  passAcceptance: { task: 'Nghiệm thu', result: 'Đạt' },
  failAcceptance: { task: 'Nghiệm thu', result: 'Không đạt' },
  submitPaymentRequest: { task: 'Lập đề nghị thanh toán', result: 'Đã gửi' },
  approvePayment: { task: 'Duyệt thanh toán', result: 'Đã duyệt' },
  requestPaymentUpdate: { task: 'Duyệt thanh toán', result: 'Yêu cầu bổ sung' },
  confirmPaymentTransfer: { task: 'Ghi nhận chuyển khoản', result: 'Đã chuyển khoản' },
  completeRecord: { task: 'Đóng hồ sơ hoàn tất', result: 'Đã đóng' },
  submitAdvanceRequest: { task: 'Đề nghị tạm ứng', result: 'Đã gửi' },
  resubmitAdvanceRequest: { task: 'Đề nghị tạm ứng', result: 'Đã gửi lại' },
  approveAdvance: { task: 'Duyệt tạm ứng', result: 'Đã duyệt' },
  requestAdvanceUpdate: { task: 'Duyệt tạm ứng', result: 'Yêu cầu bổ sung' },
  confirmAdvanceTransfer: { task: 'Ghi nhận chuyển khoản tạm ứng', result: 'Đã chuyển khoản' },
};
