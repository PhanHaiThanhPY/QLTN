import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { effectiveCapabilities } from '../../domain/permissions';
import { User } from './entities/user.entity';

/** Public view of an account (never includes the password hash). */
export interface UserProfile extends AuthenticatedUser {
  jobTitle: string | null;
  email: string | null;
  phone: string | null;
  departmentName: string | null;
  roleDefId: string | null;
  roleName: string | null;
  isActive: boolean;
  lastLoginAt: Date | null;
  version: number;
}

export const USER_PROFILE_RELATIONS = { buildings: true, locations: true, department: true, roleDef: true } as const;

/** Builds the identity/profile of a user loaded with USER_PROFILE_RELATIONS. */
export function toUserProfile(user: User): UserProfile {
  return {
    id: user.id,
    code: user.code,
    username: user.username,
    fullName: user.fullName,
    role: user.role,
    capabilities: effectiveCapabilities(
      user.role,
      user.roleDef && !user.roleDef.isSystem ? user.roleDef.capabilities : null,
    ),
    buildingIds: user.buildings.map((b) => b.id).sort(),
    locationIds: user.locations.map((l) => l.id).sort(),
    departmentId: user.departmentId,
    jobTitle: user.jobTitle,
    email: user.email,
    phone: user.phone,
    departmentName: user.department?.name ?? null,
    roleDefId: user.roleDefId,
    roleName: user.roleDef?.name ?? null,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt,
    version: user.version,
  };
}

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private readonly users: Repository<User>) {}

  /** Account with its password hash, for credential checks only. Matches username or email. */
  findForLogin(login: string): Promise<User | null> {
    const value = login.trim().toLowerCase();
    return this.users
      .createQueryBuilder('u')
      .addSelect('u.passwordHash')
      .where('u.username = :value OR lower(u.email) = :value', { value })
      .getOne();
  }

  /** Account with its password hash by id (password change). */
  findWithPassword(id: string): Promise<User | null> {
    return this.users.createQueryBuilder('u').addSelect('u.passwordHash').where('u.id = :id', { id }).getOne();
  }

  /** Active account with scope, or null when missing/inactive. Called on every authenticated request. */
  async findActiveIdentity(id: string): Promise<AuthenticatedUser | null> {
    const profile = await this.getProfile(id);
    if (!profile?.isActive) return null;
    return {
      id: profile.id,
      code: profile.code,
      username: profile.username,
      fullName: profile.fullName,
      role: profile.role,
      capabilities: profile.capabilities,
      buildingIds: profile.buildingIds,
      locationIds: profile.locationIds,
      departmentId: profile.departmentId,
    };
  }

  async getProfile(id: string): Promise<UserProfile | null> {
    const user = await this.users.findOne({ where: { id }, relations: USER_PROFILE_RELATIONS });
    return user ? toUserProfile(user) : null;
  }

  async markLoggedIn(id: string): Promise<void> {
    // Plain UPDATE: a login must not bump the optimistic-lock version.
    await this.users
      .createQueryBuilder()
      .update()
      .set({ lastLoginAt: () => 'now()' })
      .where('id = :id', { id })
      .execute();
  }
}
