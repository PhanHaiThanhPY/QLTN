import type { EntityManager } from 'typeorm';
import { notFound } from '../../common/errors';
import type { AssignmentRule, WorkflowApprovalStep } from '../../domain/building-config';
import type { Role } from '../../domain/permissions';
import { BuildingConfig } from '../buildings/entities/building-config.entity';
import { User } from '../users/entities/user.entity';

/** Who may hold a step: assignment rules, building/location scope and active accounts (mirrors the web demo). */
export interface AssignmentContext {
  users: User[];
  rules: AssignmentRule[];
}

export const canAccessLocation = (user: User, buildingId: string, locationId: string | null): boolean => {
  if (!user.buildings.some((building) => building.id === buildingId)) return false;
  const locationIds = user.locations.map((location) => location.id);
  return !locationId || locationIds.length === 0 || locationIds.includes(locationId);
};

const rulesFor = (ctx: AssignmentContext, role: Role, locationId: string | null): AssignmentRule[] =>
  ctx.rules
    .filter((rule) => rule.role === role)
    .filter(
      (rule) =>
        !locationId || !rule.locationIds || rule.locationIds.length === 0 || rule.locationIds.includes(locationId),
    )
    .sort((a, b) => a.priority - b.priority);

const byCode = (a: User, b: User): number => a.code.localeCompare(b.code);

/** Mirrors web `isActiveUserInRole`: active, right role, in the building/location and matching the assignment rules. */
export const isActiveUserInRole = (
  ctx: AssignmentContext,
  userId: string | null,
  role: Role,
  buildingId: string,
  locationId: string | null,
): boolean => {
  const user = userId ? ctx.users.find((row) => row.id === userId) : undefined;
  if (!user || !user.isActive || user.role !== role || !canAccessLocation(user, buildingId, locationId)) return false;
  const rules = ctx.rules.filter((rule) => rule.role === role);
  if (rules.length === 0) return true;
  return rulesFor(ctx, role, locationId).some((rule) => rule.departmentId === user.departmentId);
};

/** Mirrors web `isActiveUserForApprovalStep`: active, in the area, and holding the step's role. */
export const isActiveUserForApprovalStep = (
  ctx: AssignmentContext,
  userId: string | null | undefined,
  step: WorkflowApprovalStep,
  buildingId: string,
  locationId: string | null,
): boolean => {
  const user = userId ? ctx.users.find((row) => row.id === userId) : undefined;
  if (!user || !user.isActive || !canAccessLocation(user, buildingId, locationId)) return false;
  if (step.roleDefId) return user.roleDefId === step.roleDefId;
  return isActiveUserInRole(ctx, user.id, step.role, buildingId, locationId);
};

/** Mirrors web `firstActiveInRole`: the first active user selected by the building assignment rules. */
export const firstActiveInRole = (
  ctx: AssignmentContext,
  role: Role,
  buildingId: string,
  locationId: string | null,
): string | undefined => {
  const candidates = ctx.users
    .filter((user) => user.isActive && user.role === role && canAccessLocation(user, buildingId, locationId))
    .sort(byCode);
  const rules = ctx.rules.filter((rule) => rule.role === role);
  if (rules.length === 0) return candidates[0]?.id;
  for (const rule of rulesFor(ctx, role, locationId)) {
    const match = candidates.find((user) => user.departmentId === rule.departmentId);
    if (match) return match.id;
  }
  return undefined;
};

export const firstActiveForApprovalStep = (
  ctx: AssignmentContext,
  step: WorkflowApprovalStep,
  buildingId: string,
  locationId: string | null,
): string | undefined => {
  if (step.roleDefId) {
    return ctx.users
      .filter(
        (user) => user.isActive && user.roleDefId === step.roleDefId && canAccessLocation(user, buildingId, locationId),
      )
      .sort(byCode)[0]?.id;
  }
  return firstActiveInRole(ctx, step.role, buildingId, locationId);
};

export const defaultWorkflowApprovers = (
  ctx: AssignmentContext,
  steps: readonly WorkflowApprovalStep[],
  buildingId: string,
  locationId: string | null,
): Record<string, string> =>
  Object.fromEntries(
    steps
      // The MANAGER step always follows the record's manager, so it is never snapshotted.
      .filter((step) => step.key !== 'MANAGER')
      .map((step) => [step.key, firstActiveForApprovalStep(ctx, step, buildingId, locationId)] as const)
      .filter((entry): entry is readonly [string, string] => Boolean(entry[1])),
  );

/** Users of the building (with buildings and locations) and its assignment rules. */
export const loadAssignmentContext = async (manager: EntityManager, buildingId: string): Promise<AssignmentContext> => {
  const config = await manager.getRepository(BuildingConfig).findOneBy({ buildingId });
  if (!config) throw notFound('Tòa nhà chưa có cấu hình.');
  const users = await manager
    .getRepository(User)
    .createQueryBuilder('u')
    .leftJoinAndSelect('u.buildings', 'b')
    .leftJoinAndSelect('u.locations', 'l')
    .where('EXISTS (SELECT 1 FROM user_buildings ub WHERE ub.user_id = u.id AND ub.building_id = :buildingId)', {
      buildingId,
    })
    .getMany();
  return { users, rules: config.assignmentRules ?? [] };
};
