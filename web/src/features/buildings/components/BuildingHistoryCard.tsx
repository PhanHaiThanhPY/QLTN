import { useMemo, useState } from 'react';
import { History, MapPin, Settings2 } from 'lucide-react';
import { AuditTimeline } from '@/components/common/AuditTimeline';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { ViewSwitch, type ViewOption } from '@/components/ui/view-switch';
import type { AuditEvent } from '@/domain/types';
import { filterBuildingHistory, type BuildingHistoryFilter } from '../location-filters';

const FILTERS: readonly ViewOption<BuildingHistoryFilter>[] = [
  { value: 'all', label: 'Tất cả', icon: History },
  { value: 'locations', label: 'Vị trí', icon: MapPin },
  { value: 'config', label: 'Cấu hình', icon: Settings2 },
] as const;

/**
 * FX-S3 BR-FX3-04 (PD-13): read-only history of the building, so BQL also sees who applied a template or changed the
 * workflow; a quick filter narrows it to locations or configuration.
 */
export const BuildingHistoryCard = ({ events }: { events: readonly AuditEvent[] }) => {
  const [filter, setFilter] = useState<BuildingHistoryFilter>('all');
  const shown = useMemo(() => filterBuildingHistory(events, filter), [events, filter]);
  return (
    <Card className="shadow-none">
      <CardHeader title="Lịch sử thay đổi tòa" actions={<ViewSwitch label="Lọc lịch sử tòa" value={filter} options={FILTERS} onChange={setFilter} />} />
      <CardBody>
        <AuditTimeline events={shown} />
      </CardBody>
    </Card>
  );
};
