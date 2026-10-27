import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { hasCapability } from '../../common/auth/scope';
import { forbidden } from '../../common/errors';

/** BR-F4-12: Kế toán and BQT see statements and reconciliation; BQL, KT, TVKT never. */
export const assertStatementView = (actor: AuthenticatedUser): void => {
  if (!hasCapability(actor, 'FUND_VIEW')) throw forbidden('Bạn không có quyền xem đối soát.');
};
