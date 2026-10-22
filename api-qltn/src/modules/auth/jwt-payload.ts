import type { Role } from '../../domain/permissions';

/** Access-token claims. Scope and capabilities are NOT trusted from the token; they are re-read per request. */
export interface JwtPayload {
  sub: string;
  username: string;
  role: Role;
  jti: string;
}
