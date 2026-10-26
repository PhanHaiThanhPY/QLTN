import { IS_API_MODE } from '@/config/data-source';
import { approvalStepKeysOf, assignmentRulesOf, defaultConfigValues, workflowApprovalDefinitionsOf } from '@/domain/building-config';
import { forbidden } from '@/domain/errors';
import { hasCapability } from '@/domain/permissions';
import type { AuditEvent, Building, BuildingConfig, Location, RoleDefinition, User } from '@/domain/types';
import { getDb } from '@/storage/db';
import { apiList, apiRequest } from './http/client';
import { mapAuditEvent, mapBuilding, mapBuildingConfig, mapLocation, mapRoleDefinition } from './http/mappers';
import type { ApiAuditEvent, ApiBuilding, ApiBuildingConfig, ApiLocation, ApiRole } from './http/mappers';
import { now } from './runtime';
import { requireViewer } from './viewer';

export interface BuildingSettings {
  buildings: Building[];
  building: Building;
  config: BuildingConfig;
  locations: Location[];
  audit: AuditEvent[];
  /** Edit locations and configuration (BQL of the building, administrator). */
  canConfigure: boolean;
  /** Add buildings, rename them (administrator). */
  canManage: boolean;
}

/**
 * "Tầng, khu vực, vị trí": needs `LOCATION_MANAGE` only, so BQL keeps it after matrix v2 (DF-11). The building
 * history is readable with `LOCATION_MANAGE` too (PD-13), so BQL sees the same history as ADMIN, read-only.
 */
export interface LocationSettings {
  buildings: Building[];
  building: Building;
  locations: Location[];
  audit: AuditEvent[];
  canEdit: boolean;
}

export interface WorkflowIndexItem {
  building: Building;
  config: BuildingConfig;
}

export interface WorkflowIndex {
  buildings: Building[];
  workflows: WorkflowIndexItem[];
  roles: RoleDefinition[];
  canConfigure: boolean;
}

/** `GET /buildings/:id/audit` is paginated; the screen shows the whole history like the mock branch. */
const AUDIT_PAGE_SIZE = 100;
/** Guard against a malformed `meta` (never expected): the screen would rather fail than loop forever. */
const MAX_AUDIT_PAGES = 50;

const sortLocations = (rows: Location[]): Location[] =>
  rows.sort((a, b) => a.floor.localeCompare(b.floor, 'vi', { numeric: true }) || a.name.localeCompare(b.name));

const canConfigureOf = (viewer: User): boolean => hasCapability(viewer, 'BUILDING_CONFIG');
const canManageOf = (viewer: User): boolean => hasCapability(viewer, 'ACCOUNT_MANAGE');

const listApiBuildings = async (): Promise<Building[]> => {
  const rows = await apiList<ApiBuilding>('GET', '/buildings');
  return rows.data.map(mapBuilding).sort((a, b) => a.code.localeCompare(b.code));
};

const listApiAudit = async (buildingId: string): Promise<AuditEvent[]> => {
  const rows: ApiAuditEvent[] = [];
  for (let page = 1; page <= MAX_AUDIT_PAGES; page += 1) {
    const result = await apiList<ApiAuditEvent>('GET', `/buildings/${encodeURIComponent(buildingId)}/audit`, {
      query: { page, limit: AUDIT_PAGE_SIZE },
    });
    rows.push(...result.data);
    // Technical debt: history should page on the server instead of loading every row.
    if (page >= (result.meta?.totalPages ?? 1)) break;
  }
  // The backend already sorts newest first, which is what the timeline expects.
  return rows.map(mapAuditEvent);
};

/** One building's settings; the config comes from the stored row (every backend building has one). */
const apiSettingsFor = async (
  viewer: User,
  buildings: Building[],
  building: Building,
): Promise<BuildingSettings> => {
  const [config, locations, audit] = await Promise.all([
    apiRequest<ApiBuildingConfig>('GET', `/buildings/${encodeURIComponent(building.id)}/config`).then(mapBuildingConfig),
    apiList<ApiLocation>('GET', `/buildings/${encodeURIComponent(building.id)}/locations`, {
      query: { includeInactive: true },
    }).then((result) => result.data.map(mapLocation)),
    listApiAudit(building.id),
  ]);
  return {
    buildings,
    building,
    config,
    locations: sortLocations(locations),
    audit,
    canConfigure: canConfigureOf(viewer),
    canManage: canManageOf(viewer),
  };
};

const pickBuilding = (buildings: Building[], buildingId?: string): Building => {
  const building = buildings.find((row) => row.id === buildingId) ?? buildings[0];
  if (!building) throw forbidden('Bạn chưa được gán tòa nhà nào.');
  return building;
};

/** Api mode: the backend already limits `/buildings` to the caller's scope; pick like the mock branch. */
const getApiBuildingSettings = async (viewer: User, buildingId?: string): Promise<BuildingSettings> => {
  const buildings = await listApiBuildings();
  const building = pickBuilding(buildings, buildingId);
  return apiSettingsFor(viewer, buildings, building);
};

/** Api mode: configurations of the viewer's buildings (`GET /building-configs`). */
const listApiBuildingConfigs = async (): Promise<BuildingConfig[]> => {
  const rows = await apiList<ApiBuildingConfig>('GET', '/building-configs');
  return rows.data.map(mapBuildingConfig);
};

/** Api mode: all building workflows plus the role catalogue for the designer (read-only in T2c). */
const getApiWorkflowIndex = async (viewer: User): Promise<WorkflowIndex> => {
  if (!hasCapability(viewer, 'BUILDING_CONFIG')) throw forbidden('Vai trò của bạn không xem được cấu hình tòa nhà.');
  const first = await getApiBuildingSettings(viewer);
  const [roles, settings] = await Promise.all([
    apiList<ApiRole>('GET', '/roles').then((result) => result.data.map(mapRoleDefinition)),
    Promise.all(first.buildings.map((building) => (
      building.id === first.building.id ? Promise.resolve(first) : apiSettingsFor(viewer, first.buildings, building)
    ))),
  ]);
  return {
    buildings: first.buildings,
    workflows: settings.map(({ building, config }) => ({ building, config })),
    roles: roles.sort((a, b) => Number(b.isSystem) - Number(a.isSystem) || a.code.localeCompare(b.code)),
    canConfigure: first.canConfigure,
  };
};

/** "Tòa nhà & cấu hình" for one building in the viewer's scope (first one by code when none is given). */
export const getBuildingSettings = async (buildingId?: string): Promise<BuildingSettings> => {
  const viewer = await requireViewer();
  if (!hasCapability(viewer, 'BUILDING_CONFIG')) throw forbidden('Vai trò của bạn không xem được cấu hình tòa nhà.');
  if (IS_API_MODE) return getApiBuildingSettings(viewer, buildingId);
  const db = getDb();
  const buildings = (await db.buildings.bulkGet(viewer.buildingIds))
    .filter((row): row is Building => Boolean(row))
    .sort((a, b) => a.code.localeCompare(b.code));
  const building = pickBuilding(buildings, buildingId);
  const [stored, locations, audit] = await Promise.all([
    db.buildingConfigs.get(building.id),
    db.locations.where('buildingId').equals(building.id).toArray(),
    db.auditEvents.where('[subjectType+subjectId]').equals(['BUILDING', building.id]).sortBy('createdAt'),
  ]);
  const config: BuildingConfig = stored
    ? { ...stored, workflowApprovalSteps: workflowApprovalDefinitionsOf(stored.workflowApprovalSteps), approvalStepKeys: approvalStepKeysOf(stored.approvalStepKeys, workflowApprovalDefinitionsOf(stored.workflowApprovalSteps)), assignmentRules: assignmentRulesOf(stored.assignmentRules) }
    : {
        buildingId: building.id,
        ...defaultConfigValues(),
        assignmentRules: [],
        version: 0,
        updatedAt: now().toISOString(),
        updatedBy: viewer.id,
      };
  return {
    buildings,
    building,
    config,
    locations: locations.sort((a, b) => a.floor.localeCompare(b.floor, 'vi', { numeric: true }) || a.name.localeCompare(b.name)),
    audit: audit.reverse(),
    canConfigure: true,
    canManage: hasCapability(viewer, 'ACCOUNT_MANAGE'),
  };
};

const listLocationsOf = async (building: Building): Promise<Location[]> => {
  if (IS_API_MODE) {
    const result = await apiList<ApiLocation>('GET', `/buildings/${encodeURIComponent(building.id)}/locations`, {
      query: { includeInactive: true },
    });
    return sortLocations(result.data.map(mapLocation));
  }
  return sortLocations(await getDb().locations.where('buildingId').equals(building.id).toArray());
};

const listLocationAuditOf = async (building: Building): Promise<AuditEvent[]> => {
  if (IS_API_MODE) return listApiAudit(building.id);
  const rows = await getDb().auditEvents.where('[subjectType+subjectId]').equals(['BUILDING', building.id]).sortBy('createdAt');
  return rows.reverse();
};

/** Locations of one building in scope (first one by code when none is given) with the building history. */
export const getLocationSettings = async (buildingId?: string): Promise<LocationSettings> => {
  const viewer = await requireViewer();
  if (!hasCapability(viewer, 'LOCATION_MANAGE')) throw forbidden('Vai trò của bạn không quản lý được vị trí.');
  const buildings = IS_API_MODE
    ? await listApiBuildings()
    : (await getDb().buildings.bulkGet(viewer.buildingIds))
        .filter((row): row is Building => Boolean(row))
        .sort((a, b) => a.code.localeCompare(b.code));
  const building = pickBuilding(buildings, buildingId);
  const [locations, audit] = await Promise.all([listLocationsOf(building), listLocationAuditOf(building)]);
  return { buildings, building, locations, audit, canEdit: true };
};

/** Configurations of the viewer's buildings (to copy one building's settings to another). */
export const listBuildingConfigs = async (): Promise<BuildingConfig[]> => {
  const viewer = await requireViewer();
  if (IS_API_MODE) return listApiBuildingConfigs();
  const rows = await getDb().buildingConfigs.bulkGet(viewer.buildingIds);
  return rows
    .filter((row): row is BuildingConfig => Boolean(row))
    .map((row) => ({ ...row, workflowApprovalSteps: workflowApprovalDefinitionsOf(row.workflowApprovalSteps), approvalStepKeys: approvalStepKeysOf(row.approvalStepKeys, workflowApprovalDefinitionsOf(row.workflowApprovalSteps)), assignmentRules: assignmentRulesOf(row.assignmentRules) }));
};

/** Lists the building-scoped workflows before the user enters the visual designer. */
export const getWorkflowIndex = async (): Promise<WorkflowIndex> => {
  const viewer = await requireViewer();
  if (IS_API_MODE) return getApiWorkflowIndex(viewer);
  const first = await getBuildingSettings();
  const roles = (await getDb().roleDefs.toArray()).sort((a, b) => Number(b.isSystem) - Number(a.isSystem) || a.code.localeCompare(b.code));
  const settings = await Promise.all(first.buildings.map((building) => (
    building.id === first.building.id ? Promise.resolve(first) : getBuildingSettings(building.id)
  )));
  return {
    buildings: first.buildings,
    workflows: settings.map(({ building, config }) => ({ building, config })),
    roles,
    canConfigure: first.canConfigure,
  };
};
