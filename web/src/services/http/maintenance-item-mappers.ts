import { ITEM_CONDITION } from '@/domain/constants';
import type { ItemCondition } from '@/domain/constants';
import { AppError, ERROR_CODE } from '@/domain/errors';
import type { MaintenanceItem } from '@/domain/types';
import { asOptionalString, asRecord, asString, asStringArray } from '@/domain/validation';
import { broadcastChange } from '../change-channel';
import type { Command, CommandResult } from '../command-engine';
import { apiRequest } from './client';
import type { ApiReferenceItem } from './mappers';
import { MISSING_VERSION_MESSAGE } from './version';

/** One item as returned by `api-qltn/src/modules/maintenance` (MT-S1). */
export interface ApiMaintenanceItem {
  id: string;
  code: string;
  buildingId: string;
  locationId: string;
  name: string;
  type: string;
  ownerUserId: string;
  model: string | null;
  supplier: string | null;
  installDate: string | null;
  warrantyUntil: string | null;
  description: string | null;
  documentIds: string[];
  condition: string;
  conditionNote: string | null;
  active: boolean;
  deactivatedAt: string | null;
  deactivationReason: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

const CONDITIONS = new Set<string>(Object.values(ITEM_CONDITION));
const conditionOf = (value: string): ItemCondition => (CONDITIONS.has(value) ? (value as ItemCondition) : 'UNKNOWN');

/** Backend item → web `MaintenanceItem`; null optional fields become absent as in the demo. */
export const mapMaintenanceItem = (row: ApiMaintenanceItem): MaintenanceItem => ({
  id: row.id,
  code: row.code,
  buildingId: row.buildingId,
  locationId: row.locationId,
  name: row.name,
  type: row.type,
  ownerUserId: row.ownerUserId,
  ...(row.model ? { model: row.model } : {}),
  ...(row.supplier ? { supplier: row.supplier } : {}),
  ...(row.installDate ? { installDate: row.installDate } : {}),
  ...(row.warrantyUntil ? { warrantyUntil: row.warrantyUntil } : {}),
  ...(row.description ? { description: row.description } : {}),
  documentIds: [...row.documentIds],
  condition: conditionOf(row.condition),
  ...(row.conditionNote ? { conditionNote: row.conditionNote } : {}),
  active: row.active,
  ...(row.deactivatedAt ? { deactivatedAt: row.deactivatedAt } : {}),
  ...(row.deactivationReason ? { deactivationReason: row.deactivationReason } : {}),
  version: row.version,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

/**
 * `GET /reference` item → `MaintenanceItem` for pickers, type suggestions and names. The address book carries no
 * owner, dates or version: those stay empty, and screens that edit an item read it from its own endpoint.
 */
export const mapReferenceItem = (row: ApiReferenceItem): MaintenanceItem => ({
  id: row.id,
  code: row.code,
  buildingId: row.buildingId,
  locationId: row.locationId,
  name: row.name,
  type: row.type,
  ownerUserId: '',
  documentIds: [],
  condition: 'UNKNOWN',
  active: row.active,
  version: 0,
  createdAt: '',
  updatedAt: '',
});

/** Editable fields of the item form; empty optional texts are sent as null so they can be cleared. */
const toItemFields = (payload: unknown) => {
  const row = asRecord(payload);
  return {
    name: asString(row.name),
    type: asString(row.type),
    locationId: asString(row.locationId),
    ownerUserId: asString(row.ownerUserId),
    model: asOptionalString(row.model) ?? null,
    supplier: asOptionalString(row.supplier) ?? null,
    installDate: asOptionalString(row.installDate) ?? null,
    warrantyUntil: asOptionalString(row.warrantyUntil) ?? null,
    description: asOptionalString(row.description) ?? null,
  };
};

const itemPath = (command: Command, suffix = ''): string => {
  const id = command.subjectId?.trim() ?? '';
  if (!id) throw new AppError(ERROR_CODE.NOT_FOUND, 'Không tìm thấy thiết bị.');
  return `/maintenance-items/${encodeURIComponent(id)}${suffix}`;
};

const versionOf = (command: Command): number => {
  if (command.expectedVersion === undefined) throw new AppError(ERROR_CODE.CONFLICT, MISSING_VERSION_MESSAGE);
  return command.expectedVersion;
};

const done = (item: ApiMaintenanceItem): CommandResult => {
  broadcastChange();
  return { ok: true, subjectId: item.id };
};

type ItemCommandHandler = (command: Command) => Promise<CommandResult>;

/**
 * The item commands the demo screens send through `useCommand`, as REST calls (MT-S1). `updateMaintenanceItem` never
 * sends the code: it cannot change (BR-MT-06).
 */
export const MAINTENANCE_ITEM_COMMANDS: Readonly<Record<string, ItemCommandHandler>> = {
  createMaintenanceItem: async (command) => {
    const row = asRecord(command.payload);
    const body = { ...toItemFields(row), buildingId: asString(row.buildingId), code: asString(row.code) };
    return done(await apiRequest<ApiMaintenanceItem>('POST', '/maintenance-items', { body }));
  },
  updateMaintenanceItem: async (command) =>
    done(
      await apiRequest<ApiMaintenanceItem>('PATCH', itemPath(command), {
        body: { ...toItemFields(command.payload), version: versionOf(command) },
      }),
    ),
  deactivateMaintenanceItem: async (command) =>
    done(
      await apiRequest<ApiMaintenanceItem>('POST', itemPath(command, '/deactivate'), {
        body: { version: versionOf(command), reason: asString(asRecord(command.payload).reason) },
      }),
    ),
  reactivateMaintenanceItem: async (command) =>
    done(
      await apiRequest<ApiMaintenanceItem>('POST', itemPath(command, '/reactivate'), {
        body: { version: versionOf(command), reason: asString(asRecord(command.payload).reason) },
      }),
    ),
  updateItemCondition: async (command) => {
    const row = asRecord(command.payload);
    return done(
      await apiRequest<ApiMaintenanceItem>('POST', itemPath(command, '/condition'), {
        body: { version: versionOf(command), condition: asString(row.condition), note: asString(row.note) },
      }),
    );
  },
  setItemDocuments: async (command) =>
    done(
      await apiRequest<ApiMaintenanceItem>('PUT', itemPath(command, '/documents'), {
        body: { version: versionOf(command), documentIds: asStringArray(asRecord(command.payload).documentIds) },
      }),
    ),
};
