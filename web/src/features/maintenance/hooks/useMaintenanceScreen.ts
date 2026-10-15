import { useAutoGenerateSchedule } from '@/hooks/useAutoGenerateSchedule';
import { useReferenceData } from '@/hooks/useReferenceData';
import type { ReferenceLookup } from '@/hooks/useReferenceData';

/** Reference lookup for maintenance screens; also triggers SYSTEM schedule generation (spec 6.5). */
export const useMaintenanceScreen = (): ReferenceLookup => {
  const lookup = useReferenceData();
  useAutoGenerateSchedule(lookup.data?.viewer);
  return lookup;
};
