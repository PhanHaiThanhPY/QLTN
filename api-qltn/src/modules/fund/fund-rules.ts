import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { hasCapability } from '../../common/auth/scope';
import { forbidden } from '../../common/errors';
import type { FieldErrors } from '../../common/validation/field-errors';

/** Money is integer VND with at most 15 digits (bigint), never a float. */
const VND_DIGITS_MAX = 15;
export const REASON_MIN = 10;
export const REASON_MAX = 1000;
export const NOTE_MAX = 1000;

export const isVnd = (value: string | null | undefined, allowZero = false): value is string =>
  typeof value === 'string' &&
  /^\d+$/.test(value) &&
  value.replace(/^0+/, '').length <= VND_DIGITS_MAX &&
  (allowZero || BigInt(value) > 0n);

/** Normalised integer VND ("0050" → "50"). */
export const vnd = (value: string): string => BigInt(value).toString();

export const validateReason = (errors: FieldErrors, value: string | undefined, field = 'reason'): void => {
  const length = (value ?? '').trim().length;
  errors.when(length < REASON_MIN, field, `Lý do cần tối thiểu ${REASON_MIN} ký tự.`);
  errors.when(length > REASON_MAX, field, `Lý do tối đa ${REASON_MAX} ký tự.`);
};

/** BR-F3-14: Kế toán and BQT read the fund; BQL never (D-F3-6). */
export const assertFundView = (actor: AuthenticatedUser): void => {
  if (!hasCapability(actor, 'FUND_VIEW')) throw forbidden('Bạn không có quyền xem sổ quỹ.');
};

/** BR-F3-14: only Kế toán writes money documents. */
export const assertFundOperate = (actor: AuthenticatedUser): void => {
  if (!hasCapability(actor, 'FUND_OPERATE')) throw forbidden('Chỉ kế toán được ghi chứng từ quỹ.');
};

/** BR-F3-14: BQT approves. */
export const assertFundApprove = (actor: AuthenticatedUser): void => {
  if (!hasCapability(actor, 'FUND_APPROVE')) throw forbidden('Chỉ BQT được duyệt.');
};
