import type { ActionState } from '@/domain/actions';
import type { PaymentInstalment } from '@/domain/payment';
import { hasCapability } from '@/domain/permissions';
import type { RepairRecord, User } from '@/domain/types';
import { memberHolderId } from '../execution/execution-utils';

/** Holder of a PAYMENT step: the same resolution as any approval step of the record. */
export const paymentStepHolder = (record: RepairRecord, stepKey: string | null): string | undefined =>
  stepKey ? memberHolderId(record, stepKey) : undefined;

/** A2 / T19–T20: capability, then the holder of the instalment's current step (the server checks the same). */
export const decisionState = (viewer: User, record: RepairRecord, payment: PaymentInstalment): ActionState => {
  if (!hasCapability(viewer, 'PAYMENT_DECIDE')) return { allowed: false, reason: 'Bạn không có quyền duyệt thanh toán.' };
  if (paymentStepHolder(record, payment.currentStepKey) !== viewer.id) {
    return { allowed: false, reason: 'Chỉ người được giao ở bước duyệt thanh toán hiện tại mới quyết định được.' };
  }
  return { allowed: true };
};

/** A3 / T21: anyone holding PAYMENT_CONFIRM in the building (ADR-0001 Q4). */
export const transferState = (viewer: User): ActionState =>
  hasCapability(viewer, 'PAYMENT_CONFIRM')
    ? { allowed: true }
    : { allowed: false, reason: 'Chỉ BQT hoặc Kế toán (quyền xác nhận chuyển khoản) mới xác nhận được.' };
