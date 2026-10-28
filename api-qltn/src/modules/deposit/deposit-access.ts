import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { hasCapability } from '../../common/auth/scope';
import { forbidden } from '../../common/errors';

/** BR-T1-12: BQL, BQT and Kế toán see invitations, offers and results; KT and TVKT do not. */
export const assertDepositView = (actor: AuthenticatedUser): void => {
  if (!hasCapability(actor, 'DEPOSIT_VIEW')) throw forbidden('Vai trò của bạn không xem được tiền gửi quỹ bảo trì.');
};

/** BR-T1-12: only a BQL of the fund's building writes. */
export const assertDepositManage = (actor: AuthenticatedUser): void => {
  if (!hasCapability(actor, 'DEPOSIT_MANAGE')) throw forbidden('Chỉ BQL được thao tác thư mời chào lãi.');
};

/** BR-T1-10: one BQT of the building decides a result. */
export const assertDepositApprove = (actor: AuthenticatedUser): void => {
  if (!hasCapability(actor, 'DEPOSIT_APPROVE')) throw forbidden('Chỉ BQT duyệt được kết quả chọn ngân hàng.');
};
