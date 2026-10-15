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

/** Audit actions about locations (the rest of the building history is configuration). */
export const LOCATION_ACTIONS: readonly string[] = ['createLocation', 'updateLocation', 'activateLocation', 'deactivateLocation'];
