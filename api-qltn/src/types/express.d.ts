import type { AuthenticatedUser } from '../common/auth/authenticated-user';

declare global {
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface User extends AuthenticatedUser {}
    interface Request {
      correlationId?: string;
    }
  }
}

export {};
