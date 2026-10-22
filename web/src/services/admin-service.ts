import Dexie from 'dexie';
import { IS_API_MODE } from '@/config/data-source';
import { forbidden } from '@/domain/errors';
import { hasCapability } from '@/domain/permissions';
import type { Department, DemoSettings, MaintenanceOccurrence, MaintenancePlan, RepairRecord, RoleDefinition, User } from '@/domain/types';
import { OCCURRENCE_FINAL_STATUSES, REPAIR_FINAL_STATUSES } from '@/domain/constants';
import { DB_NAME, getDb, setDb } from '@/storage/db';
import { getSeedInfo, seedDemo } from '@/mock/seed';
import type { SeedInfo } from '@/mock/seed';
import { apiList } from './http/client';
import { mapDepartment, mapRoleDefinition, mapUserProfile } from './http/mappers';
import type { ApiDepartment, ApiRole, ApiUser } from './http/mappers';
import { DEFAULT_SETTINGS, getSettings, saveSettings } from './settings-service';
import { broadcastChange } from './change-channel';
import { requireViewer } from './viewer';

const requireAdmin = async (): Promise<User> => {
  const viewer = await requireViewer();
  if (!hasCapability(viewer, 'ADMIN_VIEW')) throw forbidden('Chỉ ADMIN được vào trang quản trị demo.');
  return viewer;
};

export interface ManagerGap {
  subjectType: 'REPAIR_RECORD' | 'MAINTENANCE_OCCURRENCE' | 'MAINTENANCE_PLAN';
  subject: RepairRecord | MaintenanceOccurrence | MaintenancePlan;
}

export interface AdminOverview {
  users: User[];
  departments: Department[];
  roles: RoleDefinition[];
  settings: DemoSettings;
  seedInfo: SeedInfo | null;
  /** Open subjects whose managing BQL is inactive (ADMIN may replace the manager). */
  managerGaps: ManagerGap[];
  counts: Record<string, number>;
}

const byCode = (a: { code: string }, b: { code: string }): number => a.code.localeCompare(b.code);
const bySystemRoleFirst = (a: RoleDefinition, b: RoleDefinition): number =>
  Number(b.isSystem) - Number(a.isSystem) || a.code.localeCompare(b.code);

/** `GET /users` caps `limit` at 100; the screen shows every page until `meta.totalPages`. */
const USERS_PAGE_SIZE = 100;
/** Guard against a malformed `meta` (never expected): the screen would rather fail than loop forever. */
const MAX_USER_PAGES = 100;

const listApiUsers = async (): Promise<User[]> => {
  const rows: ApiUser[] = [];
  for (let page = 1; page <= MAX_USER_PAGES; page += 1) {
    const result = await apiList<ApiUser>('GET', '/users', { query: { page, limit: USERS_PAGE_SIZE } });
    rows.push(...result.data);
    // Technical debt: the employee screen should page on the server instead of loading every row.
    const totalPages = result.meta?.totalPages ?? 1;
    if (page >= totalPages) break;
  }
  return rows.map(mapUserProfile);
};

/**
 * Admin data in api mode: users/departments/roles come from api-qltn.
 * Demo-only blocks have no backend counterpart: settings fall back to defaults, no seed info,
 * no manager-gap scan and no per-subject counts.
 */
const getApiAdminOverview = async (): Promise<AdminOverview> => {
  const [users, departments, roles] = await Promise.all([
    listApiUsers(),
    apiList<ApiDepartment>('GET', '/departments').then((result) => result.data.map(mapDepartment)),
    apiList<ApiRole>('GET', '/roles').then((result) => result.data.map(mapRoleDefinition)),
  ]);
  return {
    users: users.sort(byCode),
    departments: departments.sort(byCode),
    roles: roles.sort(bySystemRoleFirst),
    settings: DEFAULT_SETTINGS,
    seedInfo: null,
    managerGaps: [],
    counts: {},
  };
};

export const getAdminOverview = async (): Promise<AdminOverview> => {
  const viewer = await requireAdmin();
  if (IS_API_MODE) return getApiAdminOverview();
  const db = getDb();
  const [users, departments, roles, settings, seedInfo, records, occurrences, plans, attachments, auditEvents] = await Promise.all([
    db.users.toArray(),
    db.departments.toArray(),
    db.roleDefs.toArray(),
    getSettings(),
    getSeedInfo(),
    db.records.where('buildingId').anyOf(viewer.buildingIds).toArray(),
    db.occurrences.where('buildingId').anyOf(viewer.buildingIds).toArray(),
    db.maintenancePlans.where('buildingId').anyOf(viewer.buildingIds).toArray(),
    db.attachments.count(),
    db.auditEvents.count(),
  ]);
  const inactive = new Set(users.filter((user) => !user.active).map((user) => user.id));
  const managerGaps: ManagerGap[] = [
    ...records
      .filter((row) => inactive.has(row.managerUserId) && !REPAIR_FINAL_STATUSES.includes(row.status))
      .map((subject) => ({ subjectType: 'REPAIR_RECORD' as const, subject })),
    ...occurrences
      .filter((row) => inactive.has(row.managerUserId) && !OCCURRENCE_FINAL_STATUSES.includes(row.status))
      .map((subject) => ({ subjectType: 'MAINTENANCE_OCCURRENCE' as const, subject })),
    ...plans.filter((row) => inactive.has(row.managerUserId)).map((subject) => ({ subjectType: 'MAINTENANCE_PLAN' as const, subject })),
  ];
  return {
    users: users.sort(byCode),
    departments: departments.sort(byCode),
    roles: roles.sort(bySystemRoleFirst),
    settings,
    seedInfo,
    managerGaps,
    counts: { records: records.length, occurrences: occurrences.length, plans: plans.length, attachments, auditEvents },
  };
};

export const updateDemoSettings = async (settings: DemoSettings): Promise<void> => {
  await requireAdmin();
  await saveSettings(settings);
  broadcastChange();
};

/** Clears all demo data and files and replays the seed (ADMIN, after confirmation). */
export const resetDemo = async (): Promise<SeedInfo> => {
  await requireAdmin();
  return seedDemo();
};

/** Last resort when the stored schema cannot be opened: delete the whole database. */
export const resetDatabase = async (): Promise<void> => {
  getDb().close();
  setDb(null);
  await Dexie.delete(DB_NAME);
};
