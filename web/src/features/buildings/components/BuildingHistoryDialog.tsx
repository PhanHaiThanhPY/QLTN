import { AuditTimeline } from '@/components/common/AuditTimeline';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import type { AuditEvent, Building } from '@/domain/types';
import { LOCATION_ACTIONS } from '../location-filters';

interface BuildingHistoryDialogProps {
  building: Building;
  audit: AuditEvent[];
  onClose: () => void;
}

/** Change history lives in its own modal, opened from the dedicated "Lịch sử" action. */
export const BuildingHistoryDialog = ({ building, audit, onClose }: BuildingHistoryDialogProps) => {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()} title={`Lịch sử ${building.name}`} description={`Tòa ${building.code} · ${building.address}`} size="xl" footer={<Button variant="secondary" onClick={onClose}>Đóng</Button>}>
      <Card className="shadow-none">
        <CardHeader title="Lịch sử thay đổi" description="Theo dõi các cập nhật thông tin và cấu hình của tòa." />
        <CardBody><AuditTimeline events={audit.filter((event) => !LOCATION_ACTIONS.includes(event.action))} /></CardBody>
      </Card>
    </Dialog>
  );
};
