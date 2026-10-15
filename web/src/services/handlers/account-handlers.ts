import { OCCURRENCE_FINAL_STATUSES, REPAIR_FINAL_STATUSES, ROLE_LABEL } from '@/domain/constants';
import { assertNoFieldErrors, conflict, forbidden, invalidTransition, notFound, validationError } from '@/domain/errors';
import { APPROVER_SLOTS, CAPABILITY, hasCapability, roleCapabilities, slotUserId } from '@/domain/permissions';
import type { Capability } from '@/domain/permissions';
import { desiredOccurrenceTasks, desiredRepairTasks } from '@/domain/task-rules';
import type { Department, RoleDefinition, User } from '@/domain/types';
import { FieldErrorCollector, asOptionalString, asRecord, asString, asStringArray } from '@/domain/validation';
import type { Command, CommandHandler } from '../command-engine';
import type { CommandContext } from '../command-context';
import { nextCode, syncTasks, writeAudit } from '../command-context';
import { newId } from '../runtime';
import { occurrenceTaskDueAt } from './maintenance-helpers';

/** Account changes are global: audited under a pseudo building id. */
const GLOBAL_SCOPE = 'GLOBAL';

const requireAccountManager = (ctx: CommandContext): void => {
  if (!hasCapability(ctx.actor, 'ACCOUNT_MANAGE')) throw forbidden('Chỉ quản trị viên chung quản lý tài khoản và vai trò.');
};

const audit = (ctx: CommandContext, subjectId: string, action: string, version: number, reason?: string) =>
  writeAudit(ctx, { subjectType: 'ACCOUNT', subjectId, buildingId: GLOBAL_SCOPE, action, entityVersion: version, reason });

const isCapability = (value: string): value is Capability => (Object.values(CAPABILITY) as string[]).includes(value);

/** A custom role may only keep permissions of its system role (never add), and always keeps VIEW. */
const parseCapabilities = (base: RoleDefinition, raw: unknown): Capability[] => {
  const allowed = roleCapabilities(base.baseRole);
  const picked = [...new Set(asStringArray(raw))];
  const invalid = picked.filter((value) => !isCapability(value) || !allowed.includes(value));
  if (invalid.length > 0) {
    throw validationError({ capabilities: `Không thể cấp quyền ngoài vai trò gốc “${ROLE_LABEL[base.baseRole]}”.` });
  }
  const capabilities = picked.filter(isCapability);
  if (!capabilities.includes('VIEW')) capabilities.unshift('VIEW');
  return capabilities;
};

const loadRole = async (ctx: CommandContext, id: string): Promise<RoleDefinition> => {
  const role = await ctx.db.roleDefs.get(id);
  if (!role) throw notFound('Không tìm thấy vai trò.');
  return role;
};

/** Copies a role (system or custom) into a new custom role; users are never copied. */
const createRoleDef: CommandHandler = async (ctx, command) => {
  requireAccountManager(ctx);
  const payload = asRecord(command.payload);
  const source = await loadRole(ctx, asString(payload.sourceRoleId));
  const name = asString(payload.name);
  const errors = new FieldErrorCollector().text('name', 'Tên vai trò', name, 3, 80);
  const duplicate = await ctx.db.roleDefs.filter((row) => row.name.toLowerCase() === name.toLowerCase()).count();
  errors.when(duplicate > 0, 'name', 'Tên vai trò đã tồn tại.');
  assertNoFieldErrors(errors.errors);
  const role: RoleDefinition = {
    id: newId('rol'),
    code: await nextCode(ctx, 'VT', 2),
    name,
    baseRole: source.baseRole,
    capabilities: parseCapabilities(source, payload.capabilities ?? source.capabilities),
    isSystem: false,
    sourceRoleId: source.id,
    version: 1,
    createdAt: ctx.now,
    updatedAt: ctx.now,
  };
  await ctx.db.roleDefs.add(role);
  await audit(ctx, role.id, 'createRoleDef', 1, `Sao chép từ ${source.name}`);
  return { ok: true, subjectId: role.id, data: { code: role.code } };
};

/** Edits a custom role and refreshes the permissions of every user holding it. */
const updateRoleDef: CommandHandler = async (ctx, command) => {
  requireAccountManager(ctx);
  const role = await loadRole(ctx, command.subjectId ?? '');
  if (role.isSystem) throw invalidTransition('Vai trò hệ thống không sửa được; hãy sao chép thành vai trò mới.');
  if (command.expectedVersion !== role.version) throw conflict();
  const payload = asRecord(command.payload);
  const name = asString(payload.name);
  assertNoFieldErrors(new FieldErrorCollector().text('name', 'Tên vai trò', name, 3, 80).errors);
  const next: RoleDefinition = { ...role, name, capabilities: parseCapabilities(role, payload.capabilities), version: role.version + 1, updatedAt: ctx.now };
  await ctx.db.roleDefs.put(next);
  const holders = await ctx.db.users.filter((user) => user.roleDefId === role.id).toArray();
  for (const user of holders) {
    const updated: User = { ...user, capabilities: next.capabilities, version: user.version + 1 };
    await ctx.db.users.put(updated);
    ctx.usersById.set(updated.id, updated);
  }
  // Narrowed permissions may leave holders unable to act on steps they hold.
  if (holders.length > 0) await resyncAssignments(ctx, new Set(holders.map((user) => user.id)));
  await audit(ctx, role.id, 'updateRoleDef', next.version, `${holders.length} tài khoản được cập nhật quyền`);
  return { ok: true, subjectId: role.id };
};

/** Re-evaluates open tasks where these users hold a step (no longer assignable → "Cần phân công lại"). */
const resyncAssignments = async (ctx: CommandContext, userIds: Set<string>): Promise<void> => {
  const involves = (ids: (string | undefined)[]) => ids.some((id) => id !== undefined && userIds.has(id));
  const records = await ctx.db.records.filter((row) => !REPAIR_FINAL_STATUSES.includes(row.status)).toArray();
  for (const record of records) {
    const slots = [record.managerUserId, record.confirmationUserId, ...APPROVER_SLOTS.map((slot) => slotUserId(record, slot))];
    if (!involves(slots)) continue;
    await syncTasks(ctx, {
      subjectType: 'REPAIR_RECORD',
      subjectId: record.id,
      buildingId: record.buildingId,
      desired: desiredRepairTasks(record, ctx.usersById),
      dueAt: record.dueAt,
      closeReason: 'REASSIGNED',
      subjectLabel: `${record.code} – ${record.title}`,
    });
  }
  const occurrences = await ctx.db.occurrences.filter((row) => !OCCURRENCE_FINAL_STATUSES.includes(row.status)).toArray();
  for (const occurrence of occurrences) {
    if (!involves([occurrence.managerUserId, occurrence.confirmationUserId])) continue;
    const item = await ctx.db.maintenanceItems.get(occurrence.itemId);
    await syncTasks(ctx, {
      subjectType: 'MAINTENANCE_OCCURRENCE',
      subjectId: occurrence.id,
      buildingId: occurrence.buildingId,
      desired: desiredOccurrenceTasks(occurrence, ctx.usersById, item?.locationId),
      dueAt: occurrenceTaskDueAt(occurrence),
      closeReason: 'REASSIGNED',
      subjectLabel: occurrence.code,
    });
  }
};

interface UserFields {
  fullName: string;
  role: RoleDefinition;
  buildingIds: string[];
  departmentId?: string;
  jobTitle?: string;
  email?: string;
  phone?: string;
  locationIds: string[];
}

/**
 * Buildings must stay inside the administrator's own scope (no access to other buildings is granted).
 * `keptBuildingIds` are buildings the account already has outside that scope: they are preserved as is.
 */
const parseUserFields = async (
  ctx: CommandContext,
  payload: Record<string, unknown>,
  requireDepartment: boolean,
  keptBuildingIds: readonly string[] = [],
): Promise<UserFields> => {
  const fullName = asString(payload.fullName);
  const picked = asStringArray(payload.buildingIds).filter((id) => !keptBuildingIds.includes(id));
  const buildingIds = [...new Set([...keptBuildingIds, ...picked])];
  const locationIds = [...new Set(asStringArray(payload.locationIds))];
  const departmentId = asOptionalString(payload.departmentId);
  const department = departmentId ? await ctx.db.departments.get(departmentId) : undefined;
  const locations = await ctx.db.locations.bulkGet(locationIds);
  const errors = new FieldErrorCollector().text('fullName', 'Họ tên', fullName, 3, 80);
  errors.when(buildingIds.length === 0, 'buildingIds', 'Chọn ít nhất một tòa nhà.');
  errors.when(picked.some((id) => !ctx.actor.buildingIds.includes(id)), 'buildingIds', 'Chỉ gán tòa trong phạm vi của bạn.');
  errors.when(requireDepartment && !departmentId, 'departmentId', 'Cần chọn bộ phận.');
  errors.when(Boolean(departmentId) && !department, 'departmentId', 'Bộ phận không tồn tại.');
  errors.when(Boolean(department && department.buildingIds.length > 0 && !buildingIds.every((id) => department.buildingIds.includes(id))), 'departmentId', 'Bộ phận không phụ trách toàn bộ tòa nhà đã chọn.');
  errors.when(locations.some((location) => !location), 'locationIds', 'Khu vực được chọn không tồn tại.');
  errors.when(locations.some((location) => location && !buildingIds.includes(location.buildingId)), 'locationIds', 'Khu vực phải nằm trong tòa nhà được giao.');
  const role = await ctx.db.roleDefs.get(asString(payload.roleDefId));
  errors.when(!role, 'roleDefId', 'Cần chọn vai trò.');
  assertNoFieldErrors(errors.errors);
  return {
    fullName,
    role: role as RoleDefinition,
    buildingIds,
    departmentId,
    jobTitle: asOptionalString(payload.jobTitle),
    email: asOptionalString(payload.email),
    phone: asOptionalString(payload.phone),
    locationIds,
  };
};

const roleFields = (role: RoleDefinition): Pick<User, 'role' | 'roleDefId' | 'capabilities'> => ({
  role: role.baseRole,
  roleDefId: role.isSystem ? undefined : role.id,
  capabilities: role.isSystem ? undefined : [...role.capabilities],
});

const createUser: CommandHandler = async (ctx, command) => {
  requireAccountManager(ctx);
  const payload = asRecord(command.payload);
  const code = asString(payload.code).toUpperCase();
  const errors = new FieldErrorCollector().text('code', 'Mã tài khoản', code, 2, 20);
  errors.when((await ctx.db.users.where('code').equals(code).count()) > 0, 'code', 'Mã tài khoản đã tồn tại.');
  assertNoFieldErrors(errors.errors);
  const fields = await parseUserFields(ctx, payload, true);
  const user: User = {
    id: newId('usr'),
    code,
    fullName: fields.fullName,
    departmentId: fields.departmentId,
    jobTitle: fields.jobTitle,
    email: fields.email,
    phone: fields.phone,
    buildingIds: fields.buildingIds,
    locationIds: fields.locationIds,
    active: true,
    ...roleFields(fields.role),
    version: 1,
  };
  await ctx.db.users.add(user);
  await audit(ctx, user.id, 'createUser', 1, `${code} – ${fields.role.name}`);
  return { ok: true, subjectId: user.id };
};

/** Fields that decide which open steps an account may still hold. */
const affectsAssignments = (before: User, after: User): boolean => {
  const sameList = (a: readonly string[] = [], b: readonly string[] = []) => a.length === b.length && a.every((id) => b.includes(id));
  return (
    before.active !== after.active ||
    before.role !== after.role ||
    before.roleDefId !== after.roleDefId ||
    !sameList(before.capabilities, after.capabilities) ||
    !sameList(before.buildingIds, after.buildingIds) ||
    !sameList(before.locationIds, after.locationIds)
  );
};

/**
 * Edits an account. The system role cannot change while it holds steps (only custom roles of the same system role).
 * Deactivating or narrowing scope/permissions moves open steps the account can no longer do to "Cần phân công lại".
 */
const updateUser: CommandHandler = async (ctx, command: Command) => {
  requireAccountManager(ctx);
  const user = await ctx.db.users.get(command.subjectId ?? '');
  if (!user) throw notFound('Không tìm thấy tài khoản.');
  if (command.expectedVersion === undefined) throw conflict('Thiếu phiên bản dữ liệu (expectedVersion). Vui lòng tải lại.');
  if (command.expectedVersion !== user.version) throw conflict();
  const payload = asRecord(command.payload);
  const outsideScope = user.buildingIds.filter((id) => !ctx.actor.buildingIds.includes(id));
  const fields = await parseUserFields(ctx, payload, false, outsideScope);
  const active = typeof payload.active === 'boolean' ? payload.active : user.active;
  const errors = new FieldErrorCollector();
  errors.when(fields.role.baseRole !== user.role, 'roleDefId', `Chỉ đổi sang vai trò cùng gốc “${ROLE_LABEL[user.role]}”; muốn đổi vai trò gốc hãy tạo tài khoản mới.`);
  errors.when(!active && user.id === ctx.actor.id, 'active', 'Không thể tự ngừng hoạt động tài khoản đang dùng.');
  assertNoFieldErrors(errors.errors);
  const next: User = {
    ...user,
    fullName: fields.fullName,
    departmentId: fields.departmentId ?? user.departmentId,
    jobTitle: fields.jobTitle ?? user.jobTitle,
    email: fields.email ?? user.email,
    phone: fields.phone ?? user.phone,
    buildingIds: fields.buildingIds,
    locationIds: fields.locationIds,
    active,
    ...roleFields(fields.role),
    version: user.version + 1,
  };
  await ctx.db.users.put(next);
  ctx.usersById.set(next.id, next);
  if (affectsAssignments(user, next)) await resyncAssignments(ctx, new Set([next.id]));
  await audit(ctx, user.id, active ? 'updateUser' : 'deactivateUser', next.version, `${next.code} – ${fields.role.name}`);
  return { ok: true, subjectId: user.id };
};

interface DepartmentFields {
  code: string;
  name: string;
  description?: string;
  buildingIds: string[];
}

const parseDepartmentFields = (ctx: CommandContext, payload: Record<string, unknown>): DepartmentFields => {
  const code = asString(payload.code).toUpperCase();
  const name = asString(payload.name);
  const buildingIds = [...new Set(asStringArray(payload.buildingIds))];
  const errors = new FieldErrorCollector().text('code', 'Mã bộ phận', code, 2, 20).text('name', 'Tên bộ phận', name, 3, 80);
  errors.when(buildingIds.length === 0, 'buildingIds', 'Chọn ít nhất một tòa nhà.');
  errors.when(buildingIds.some((id) => !ctx.actor.buildingIds.includes(id)), 'buildingIds', 'Chỉ gán tòa trong phạm vi của bạn.');
  assertNoFieldErrors(errors.errors);
  return { code, name, description: asOptionalString(payload.description), buildingIds };
};

const createDepartment: CommandHandler = async (ctx, command) => {
  requireAccountManager(ctx);
  const fields = parseDepartmentFields(ctx, asRecord(command.payload));
  const duplicate = await ctx.db.departments.where('code').equals(fields.code).count();
  if (duplicate > 0) throw validationError({ code: 'Mã bộ phận đã tồn tại.' });
  const department: Department = { id: newId('dep'), ...fields };
  await ctx.db.departments.add(department);
  await audit(ctx, department.id, 'createDepartment', 1, `${department.code} – ${department.name}`);
  return { ok: true, subjectId: department.id };
};

const updateDepartment: CommandHandler = async (ctx, command) => {
  requireAccountManager(ctx);
  const department = await ctx.db.departments.get(command.subjectId ?? '');
  if (!department) throw notFound('Không tìm thấy bộ phận.');
  const fields = parseDepartmentFields(ctx, asRecord(command.payload));
  const duplicate = await ctx.db.departments.where('code').equals(fields.code).count();
  if (duplicate > 1 || (duplicate === 1 && department.code !== fields.code)) throw validationError({ code: 'Mã bộ phận đã tồn tại.' });
  const members = await ctx.db.users.where('departmentId').equals(department.id).toArray();
  const outsideScope = members.some((user) => user.buildingIds.some((buildingId) => !fields.buildingIds.includes(buildingId)));
  if (outsideScope) throw validationError({ buildingIds: 'Không thể thu hẹp phạm vi: bộ phận đang có nhân viên ngoài phạm vi mới.' });
  const next: Department = { ...department, ...fields };
  await ctx.db.departments.put(next);
  await audit(ctx, next.id, 'updateDepartment', 1, `${next.code} – ${next.name}`);
  return { ok: true, subjectId: next.id };
};

export const accountHandlers: Record<string, CommandHandler> = { createRoleDef, updateRoleDef, createUser, updateUser, createDepartment, updateDepartment };
