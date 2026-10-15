import { approvalStepKeysOf, assignmentRulesOf, defaultConfigValues } from '@/domain/building-config';
import { forbidden } from '@/domain/errors';
import { hasCapability } from '@/domain/permissions';
import type { AuditEvent, Building, BuildingConfig, Location } from '@/domain/types';
import { getDb } from '@/storage/db';
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

export interface WorkflowIndexItem {
  building: Building;
  config: BuildingConfig;
}

export interface WorkflowIndex {
  buildings: Building[];
  workflows: WorkflowIndexItem[];
  canConfigure: boolean;
}

/** "Tòa nhà & cấu hình" for one building in the viewer's scope (first one by code when none is given). */
export const getBuildingSettings = async (buildingId?: string): Promise<BuildingSettings> => {
  const viewer = await requireViewer();
  if (!hasCapability(viewer, 'BUILDING_CONFIG')) throw forbidden('Vai trò của bạn không xem được cấu hình tòa nhà.');
  const db = getDb();
  const buildings = (await db.buildings.bulkGet(viewer.buildingIds))
    .filter((row): row is Building => Boolean(row))
    .sort((a, b) => a.code.localeCompare(b.code));
  const building = buildings.find((row) => row.id === buildingId) ?? buildings[0];
  if (!building) throw forbidden('Bạn chưa được gán tòa nhà nào.');
  const [stored, locations, audit] = await Promise.all([
    db.buildingConfigs.get(building.id),
    db.locations.where('buildingId').equals(building.id).toArray(),
    db.auditEvents.where('[subjectType+subjectId]').equals(['BUILDING', building.id]).sortBy('createdAt'),
  ]);
  const config: BuildingConfig = stored
    ? { ...stored, approvalStepKeys: approvalStepKeysOf(stored.approvalStepKeys), assignmentRules: assignmentRulesOf(stored.assignmentRules) }
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

/** Configurations of the viewer's buildings (to copy one building's settings to another). */
export const listBuildingConfigs = async (): Promise<BuildingConfig[]> => {
  const viewer = await requireViewer();
  const rows = await getDb().buildingConfigs.bulkGet(viewer.buildingIds);
  return rows
    .filter((row): row is BuildingConfig => Boolean(row))
    .map((row) => ({ ...row, approvalStepKeys: approvalStepKeysOf(row.approvalStepKeys), assignmentRules: assignmentRulesOf(row.assignmentRules) }));
};

/** Lists the building-scoped workflows before the user enters the visual designer. */
export const getWorkflowIndex = async (): Promise<WorkflowIndex> => {
  const first = await getBuildingSettings();
  const settings = await Promise.all(first.buildings.map((building) => (
    building.id === first.building.id ? Promise.resolve(first) : getBuildingSettings(building.id)
  )));
  return {
    buildings: first.buildings,
    workflows: settings.map(({ building, config }) => ({ building, config })),
    canConfigure: first.canConfigure,
  };
};
