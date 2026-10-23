import { SYSTEM_ACTOR_ID } from '@/domain/constants';
import type { SubjectType } from '@/domain/constants';
import { AppError, ERROR_CODE, conflict, forbidden } from '@/domain/errors';
import type { CommandSuccess, DemoSettings, User } from '@/domain/types';
import { IS_API_MODE } from '@/config/data-source';
import { getDb } from '@/storage/db';
import type { CommandContext } from './command-context';
import { broadcastChange } from './change-channel';
import { executeApiCommand } from './http/command-adapter';
import { getSessionUserId, now, todayVn } from './runtime';
import { getSettings, saveSettings } from './settings-service';

export interface Command {
  commandId: string;
  subjectType: SubjectType;
  /** Empty when creating a new subject. */
  subjectId?: string;
  /** Required for edit, transition, decision and reassignment commands. */
  expectedVersion?: number;
  action: string;
  payload: unknown;
}

export type CommandResult = CommandSuccess;
export type CommandHandler = (ctx: CommandContext, command: Command) => Promise<CommandResult>;

const handlers = new Map<string, CommandHandler>();

export const registerHandlers = (entries: Record<string, CommandHandler>): void => {
  Object.entries(entries).forEach(([action, handler]) => handlers.set(action, handler));
};

const SYSTEM_USER: User = {
  id: SYSTEM_ACTOR_ID,
  code: 'SYSTEM',
  fullName: 'Hệ thống',
  role: 'ADMIN',
  buildingIds: [],
  active: true,
  version: 1,
};

/** Stable JSON with sorted keys so equal payloads hash equally. */
const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(',')}}`;
};

/** FNV-1a; synchronous on purpose (async crypto would end the IndexedDB transaction). */
const hashPayload = (command: Command): string => {
  const text = stableStringify([command.action, command.subjectType, command.subjectId, command.payload]);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16);
};

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

interface RunOptions {
  actorId: string | null;
  triggeredBy?: string;
  /** System commands skip the demo latency/failure switches. */
  isSystem: boolean;
}

const run = async (command: Command, options: RunOptions): Promise<CommandResult> => {
  const handler = handlers.get(command.action);
  if (!handler) throw new AppError(ERROR_CODE.VALIDATION_ERROR, `Thao tác không được hỗ trợ: ${command.action}`);

  let settings: DemoSettings | null = null;
  if (!options.isSystem) {
    settings = await getSettings();
    if (settings.latencyMs > 0) await sleep(settings.latencyMs);
    if (settings.failNextCommand) await saveSettings({ ...settings, failNextCommand: false });
  }

  const db = getDb();
  const payloadHash = hashPayload(command);
  const result = await db.transaction('rw', db.tables, async () => {
    const users = await db.users.toArray();
    const usersById = new Map(users.map((user) => [user.id, user]));
    const configs = await db.buildingConfigs.toArray();
    const assignmentRulesByBuilding = new Map(configs.map((config) => [config.buildingId, config.assignmentRules ?? []]));
    const actor = options.isSystem ? SYSTEM_USER : usersById.get(options.actorId ?? '');
    if (!actor || !actor.active) throw forbidden('Phiên demo không hợp lệ hoặc tài khoản đã ngừng hoạt động.');

    const previous = await db.commandLogs.get(command.commandId);
    if (previous) {
      if (previous.actorId !== actor.id || previous.payloadHash !== payloadHash) {
        throw conflict('Mã lệnh đã được dùng cho một thao tác khác.');
      }
      return previous.result;
    }

    const instant = now();
    const ctx: CommandContext = {
      db,
      actor,
      isSystem: options.isSystem,
      triggeredBy: options.triggeredBy,
      commandId: command.commandId,
      now: instant.toISOString(),
      today: todayVn(),
      usersById,
      assignmentRulesByBuilding,
    };
    const outcome = await handler(ctx, command);
    await db.commandLogs.add({
      commandId: command.commandId,
      actorId: actor.id,
      action: command.action,
      payloadHash,
      result: outcome,
      createdAt: ctx.now,
    });
    if (settings?.failNextCommand) {
      // Simulated failure after all writes: the whole transaction rolls back.
      throw new AppError(ERROR_CODE.NETWORK_ERROR, 'Lỗi kết nối mô phỏng. Chưa có thay đổi nào được lưu, hãy thử lại.');
    }
    return outcome;
  });
  broadcastChange();
  return result;
};

/**
 * Executes a business command as the demo session user (actor never comes from the payload).
 * In api mode the REST adapter runs instead of the Dexie handlers; mock keeps the old path.
 */
export const executeCommand = (command: Command): Promise<CommandResult> => {
  if (IS_API_MODE) return executeApiCommand(command);
  return run(command, { actorId: getSessionUserId(), isSystem: false });
};

/** Executes a command as SYSTEM, e.g. schedule generation triggered by opening a screen. */
export const executeSystemCommand = (command: Command, triggeredBy?: string): Promise<CommandResult> => {
  // No server-side background commands are wired yet; hooks skip this call in api mode.
  if (IS_API_MODE) return executeApiCommand(command);
  return run(command, { actorId: null, triggeredBy, isSystem: true });
};
