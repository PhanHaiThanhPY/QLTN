import { AppError, ERROR_CODE } from '@/domain/errors';
import { broadcastChange } from '../change-channel';
import type { Command, CommandResult } from '../command-engine';
import { apiRequest } from './client';
import {
  mapDepartment,
  mapRoleDefinition,
  mapUserProfile,
  toCreateDepartmentBody,
  toCreateRoleBody,
  toCreateUserBody,
  toUpdateDepartmentBody,
  toUpdateRoleBody,
  toUpdateUserBody,
} from './mappers';
import type { ApiDepartment, ApiRole, ApiUser } from './mappers';

/**
 * Command adapter for `VITE_DATA_SOURCE=api` (plan decision D4).
 * A table `action -> REST call`; a writing screen keeps using `useCommand` unchanged.
 * Only actions listed here are wired; anything else fails loudly instead of silently doing nothing.
 */
type ApiCommandHandler = (command: Command) => Promise<CommandResult>;

/** `POST /users` — the backend derives `username` from `code` and hashes the password. */
const createUser: ApiCommandHandler = async (command) => {
  const body = toCreateUserBody(command.payload);
  const created = await apiRequest<ApiUser>('POST', '/users', { body });
  const user = mapUserProfile(created);
  // Same signal as a Dexie write, so every open screen refetches the list.
  broadcastChange();
  return { ok: true, subjectId: user.id };
};

/** `PATCH /users/:id` — `version` is the optimistic lock; a stale one answers 409 (mapped to CONFLICT). */
const updateUser: ApiCommandHandler = async (command) => {
  const id = command.subjectId?.trim() ?? '';
  if (!id) throw new AppError(ERROR_CODE.NOT_FOUND, 'Không tìm thấy tài khoản.');
  const body = toUpdateUserBody(command.payload, command.expectedVersion);
  const updated = await apiRequest<ApiUser>('PATCH', `/users/${encodeURIComponent(id)}`, { body });
  const user = mapUserProfile(updated);
  broadcastChange();
  return { ok: true, subjectId: user.id };
};

/** `POST /departments` — scope, duplicate code and validation are enforced by the backend. */
const createDepartment: ApiCommandHandler = async (command) => {
  const body = toCreateDepartmentBody(command.payload);
  const created = await apiRequest<ApiDepartment>('POST', '/departments', { body });
  const department = mapDepartment(created);
  broadcastChange();
  return { ok: true, subjectId: department.id };
};

/** `PATCH /departments/:id` — `version` is the optimistic lock; a stale one answers 409 (mapped to CONFLICT). */
const updateDepartment: ApiCommandHandler = async (command) => {
  const id = command.subjectId?.trim() ?? '';
  if (!id) throw new AppError(ERROR_CODE.NOT_FOUND, 'Không tìm thấy bộ phận.');
  const body = toUpdateDepartmentBody(command.payload, command.expectedVersion);
  const updated = await apiRequest<ApiDepartment>('PATCH', `/departments/${encodeURIComponent(id)}`, { body });
  const department = mapDepartment(updated);
  broadcastChange();
  return { ok: true, subjectId: department.id };
};

/**
 * `POST /roles` — the backend supports `sourceRoleId` natively: it copies the source role's base role and
 * capabilities, and returns the new custom role. The web "sao chép vai trò" therefore needs no extra round-trip.
 */
const createRoleDef: ApiCommandHandler = async (command) => {
  const body = toCreateRoleBody(command.payload);
  const created = await apiRequest<ApiRole>('POST', '/roles', { body });
  const role = mapRoleDefinition(created);
  broadcastChange();
  return { ok: true, subjectId: role.id };
};

/** `PATCH /roles/:id` — custom roles only (system roles answer a field error); stale version answers 409. */
const updateRoleDef: ApiCommandHandler = async (command) => {
  const id = command.subjectId?.trim() ?? '';
  if (!id) throw new AppError(ERROR_CODE.NOT_FOUND, 'Không tìm thấy vai trò.');
  const body = toUpdateRoleBody(command.payload, command.expectedVersion);
  const updated = await apiRequest<ApiRole>('PATCH', `/roles/${encodeURIComponent(id)}`, { body });
  const role = mapRoleDefinition(updated);
  broadcastChange();
  return { ok: true, subjectId: role.id };
};

/** Actions wired to api-qltn. T2a covers accounts; T2b adds departments and custom roles. */
const API_COMMANDS: Readonly<Record<string, ApiCommandHandler>> = {
  createUser,
  updateUser,
  createDepartment,
  updateDepartment,
  createRoleDef,
  updateRoleDef,
};

export const API_UNSUPPORTED_MESSAGE = 'Thao tác này chưa nối API.';

export const isApiAction = (action: string): boolean => Object.hasOwn(API_COMMANDS, action);

/** Runs one command over REST; unregistered actions throw instead of being dropped. */
export const executeApiCommand = async (command: Command): Promise<CommandResult> => {
  const handler = isApiAction(command.action) ? API_COMMANDS[command.action] : undefined;
  if (!handler) throw new AppError(ERROR_CODE.VALIDATION_ERROR, API_UNSUPPORTED_MESSAGE);
  return handler(command);
};
