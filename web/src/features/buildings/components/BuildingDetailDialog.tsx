import { Link } from 'react-router';
import { Building2, MapPin } from 'lucide-react';
import { AuditTimeline } from '@/components/common/AuditTimeline';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import type { AuditEvent, Building, BuildingConfig, Location } from '@/domain/types';
import { ConfigCard } from './ConfigCard';
import { LOCATION_ACTIONS } from '../location-filters';

interface BuildingDetailDialogProps {
  building: Building;
  buildings: Building[];
  config: BuildingConfig;
  locations: Location[];
  audit: AuditEvent[];
  canConfigure: boolean;
  onClose: () => void;
}

/** Building detail stays in a modal so the building list remains compact and scannable. */
export const BuildingDetailDialog = ({ building, buildings, config, locations, audit, canConfigure, onClose }: BuildingDetailDialogProps) => {
  const activeLocations = locations.filter((row) => row.active !== false);
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()} title={`Chi tiết ${building.name}`} description={`Tòa ${building.code} · ${building.address}`} size="xl" footer={<Button variant="secondary" onClick={onClose}>Đóng</Button>}>
      <div className="space-y-4">
        <Card className="shadow-none">
          <CardHeader title="Thông tin tòa nhà" description="Thông tin dùng để định danh và vận hành tòa nhà." />
          <CardBody className="grid gap-3 pt-0 sm:grid-cols-3">
            <div className="rounded-lg bg-surface-2 p-3"><p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-3">Mã tòa</p><p className="mt-1 inline-flex items-center gap-1.5 font-semibold text-accent"><Building2 className="size-4" />Tòa {building.code}</p></div>
            <div className="rounded-lg bg-surface-2 p-3"><p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-3">Vị trí đang dùng</p><p className="mt-1 font-semibold text-ink">{activeLocations.length} vị trí</p></div>
            <div className="rounded-lg bg-surface-2 p-3"><p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-3">Quản lý vị trí</p><Link to={`/settings/locations?b=${building.id}`} onClick={onClose} className="mt-1 inline-flex items-center gap-1.5 font-semibold text-accent hover:underline"><MapPin className="size-4" />Mở danh sách vị trí</Link></div>
          </CardBody>
        </Card>
        <ConfigCard key={`${building.id}-${config.version}`} building={building} buildings={buildings} config={config} canEdit={canConfigure} />
        <Card className="shadow-none">
          <CardHeader title="Lịch sử thay đổi" description="Theo dõi các cập nhật thông tin và cấu hình của tòa." />
          <CardBody><AuditTimeline events={audit.filter((event) => !LOCATION_ACTIONS.includes(event.action))} /></CardBody>
        </Card>
      </div>
    </Dialog>
  );
};
