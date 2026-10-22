import type { Capability, Role } from '../../domain/permissions';

/** Identity attached to `req.user` after the JWT is verified and the account re-read from the database. */
export interface AuthenticatedUser {
  id: string;
  code: string;
  username: string;
  fullName: string;
  role: Role;
  /** Effective capabilities: the system role's set, narrowed by a custom role when assigned. */
  capabilities: Capability[];
  buildingIds: string[];
  /** Location scope inside the buildings; empty = anywhere in them. */
  locationIds: string[];
  departmentId: string | null;
}
