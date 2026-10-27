import type { Location } from '@/domain/types';

export type LocationStatusFilter = '' | 'active' | 'inactive';

export interface LocationFilters {
  q: string;
  floor: string;
  status: LocationStatusFilter;
}

export const EMPTY_LOCATION_FILTERS: LocationFilters = { q: '', floor: '', status: '' };

/** Distinct floors in display order (B2, B1, Trệt, 1, 2 … Mái as sorted by the service). */
export const floorsOf = (locations: Location[]): string[] => [...new Set(locations.map((row) => row.floor))];

export const filterLocations = (locations: Location[], filters: LocationFilters): Location[] => {
  const q = filters.q.trim().toLowerCase();
  return locations.filter((row) => {
    const isActive = row.active !== false;
    if (filters.status === 'active' && !isActive) return false;
    if (filters.status === 'inactive' && isActive) return false;
    if (filters.floor && row.floor !== filters.floor) return false;
    if (!q) return true;
    return [row.name, row.zone ?? '', row.floor].some((text) => text.toLowerCase().includes(q));
  });
};

/** Audit actions about locations. */
export const LOCATION_ACTIONS: readonly string[] = ['createLocation', 'updateLocation', 'activateLocation', 'deactivateLocation'];

/** Audit actions about the building configuration and its workflow. */
export const CONFIG_ACTIONS: readonly string[] = ['updateBuildingConfig', 'applyConfigTemplate', 'updateWorkflowConfig', 'migrateApprovalChain'];

export type BuildingHistoryFilter = 'all' | 'locations' | 'config';

/** FX-S3 BR-FX3-04: every building event, or only locations / only configuration. */
export const filterBuildingHistory = <T extends { action: string }>(events: readonly T[], filter: BuildingHistoryFilter): T[] => {
  if (filter === 'locations') return events.filter((event) => LOCATION_ACTIONS.includes(event.action));
  if (filter === 'config') return events.filter((event) => CONFIG_ACTIONS.includes(event.action));
  return [...events];
};
