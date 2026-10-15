import { ChevronRight, MapPin } from 'lucide-react';
import type { ReferenceData } from '@/services/reference-service';

interface MaintenanceLocationTrailProps {
  data?: ReferenceData;
  buildingId: string;
  itemId?: string;
  locationId?: string;
  compact?: boolean;
}

const findLocation = (data: ReferenceData | undefined, buildingId: string, itemId?: string, locationId?: string) => {
  const item = data?.items.find((row) => row.id === itemId);
  const location = data?.locations.find((row) => row.id === (locationId || item?.locationId));
  const building = data?.buildings.find((row) => row.id === buildingId);
  return { item, location, building };
};

/** Shows the operational location in the order staff use to find it. */
export const MaintenanceLocationTrail = ({ data, buildingId, itemId, locationId, compact = false }: MaintenanceLocationTrailProps) => {
  const { location, building } = findLocation(data, buildingId, itemId, locationId);
  const blockLabel = building ? `Block ${building.code}` : buildingId || 'Chưa gán block / tòa';
  const buildingName = building?.name || 'Chưa gán tòa nhà';
  const floor = location?.floor ? `Tầng ${location.floor}` : 'Chưa gán tầng';
  const room = location?.name || 'Chưa gán phòng / vị trí';

  if (compact) {
    return (
      <span className="inline-flex max-w-full items-center gap-1 truncate text-[0.68rem] text-ink-2" title={`${blockLabel} · ${buildingName} → ${floor} → ${room}`}>
        <MapPin className="size-3 shrink-0 text-accent" aria-hidden />
        <span className="truncate">{blockLabel} · {floor} · {room}</span>
      </span>
    );
  }

  return (
    <div className="min-w-56 leading-tight">
      <div className="flex items-center gap-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.08em]">
        <MapPin className="size-3 shrink-0" aria-hidden />
        <span className="shrink-0 rounded bg-accent-soft px-1.5 py-0.5 text-accent" title={blockLabel}>{blockLabel}</span>
        <ChevronRight className="size-3 shrink-0 text-ink-3" aria-hidden />
        <span className="shrink-0 rounded bg-surface-2 px-1.5 py-0.5 text-ink-2" title={floor}>{floor}</span>
      </div>
      <div className="mt-1 truncate text-[0.68rem] text-ink-2" title={buildingName}>{buildingName}</div>
      <div className="mt-0.5 truncate text-xs font-semibold text-ink" title={room}>
        {room}
      </div>
    </div>
  );
};

export const locationOptionLabel = (data: ReferenceData | undefined, locationId: string): string => {
  const location = data?.locations.find((row) => row.id === locationId);
  if (!location) return locationId;
  const building = data?.buildings.find((row) => row.id === location.buildingId);
  const block = building ? `Block ${building.code}` : 'Chưa gán block';
  return `${block} · Tầng ${location.floor} · ${location.name}`;
};
