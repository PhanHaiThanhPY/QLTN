import { useMemo } from 'react';
import { getReferenceData } from '@/services/reference-service';
import type { ReferenceData } from '@/services/reference-service';
import { useServiceQuery } from './useServiceQuery';

export interface ReferenceLookup {
  data?: ReferenceData;
  userName: (id?: string) => string;
  buildingName: (id?: string) => string;
  /** Short building code such as "A". */
  buildingCode: (id?: string) => string;
  locationName: (id?: string) => string;
  itemName: (id?: string) => string;
  isLoading: boolean;
}

/** Scoped lookup lists plus name helpers used across screens. */
export const useReferenceData = (): ReferenceLookup => {
  const query = useServiceQuery(['reference'], getReferenceData);
  const data = query.data;
  return useMemo(() => {
    const byId = <T extends { id: string }>(rows: T[] | undefined) => new Map((rows ?? []).map((row) => [row.id, row]));
    const users = byId(data?.users);
    const buildings = byId(data?.buildings);
    const locations = byId(data?.locations);
    const items = byId(data?.items);
    return {
      data,
      isLoading: query.isLoading,
      userName: (id) => {
        if (!id) return '—';
        if (id === 'SYSTEM') return 'Hệ thống';
        const user = users.get(id);
        // Non-breaking hyphen keeps codes like BQL-A from splitting across lines.
        return user ? `${user.fullName} (${user.code.replace(/-/g, '\u2011')})` : id;
      },
      buildingName: (id) => (id ? (buildings.get(id)?.name ?? id) : '—'),
      buildingCode: (id) => (id ? (buildings.get(id)?.code ?? id) : '—'),
      locationName: (id) => {
        const location = id ? locations.get(id) : undefined;
        return location ? `${location.name} · Tầng ${location.floor}` : '—';
      },
      itemName: (id) => {
        const item = id ? items.get(id) : undefined;
        return item ? `${item.code} – ${item.name}` : '—';
      },
    };
  }, [data, query.isLoading]);
};
