import { AppError, ERROR_CODE } from '@/domain/errors';
import { broadcastChange } from '../change-channel';
import type { Command, CommandResult } from '../command-engine';
import { apiRequest } from './client';
import { mapUserProfile, toCreateUserBody, toUpdateUserBody } from './mappers';
import type { ApiUser } from './mappers';

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

/** Actions wired to api-qltn. T2a covers account create/edit only; T2b/T2c add theirs. */
const API_COMMANDS: Readonly<Record<string, ApiCommandHandler>> = { createUser, updateUser };

export const API_UNSUPPORTED_MESSAGE = 'Thao tác này chưa nối API.';

export const isApiAction = (action: string): boolean => Object.hasOwn(API_COMMANDS, action);

/** Runs one command over REST; unregistered actions throw instead of being dropped. */
export const executeApiCommand = async (command: Command): Promise<CommandResult> => {
  const handler = isApiAction(command.action) ? API_COMMANDS[command.action] : undefined;
  if (!handler) throw new AppError(ERROR_CODE.VALIDATION_ERROR, API_UNSUPPORTED_MESSAGE);
  return handler(command);
};
