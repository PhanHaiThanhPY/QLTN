import { Download, ExternalLink } from 'lucide-react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { ErrorState, LoadingState } from '@/components/common/States';
import { Button, buttonVariants } from '@/components/ui/button';
import { Sheet } from '@/components/ui/sheet';
import { EquipmentHistoryTimeline } from '@/features/maintenance/components/item/EquipmentHistoryTimeline';
import { useServiceQuery } from '@/hooks/useServiceQuery';
import { cn } from '@/lib/cn';
import { getEquipmentHistory } from '@/services/equipment-report-service';
import { todayVn } from '@/services/runtime';
import { downloadCsv } from '@/utils/csv';
import { formatVnd } from '@/utils/money';
import { buildEquipmentHistoryCsv } from '../equipment-csv';
import { reportFileName } from '../report-csv';

interface EquipmentHistorySheetProps {
  itemId: string;
  onClose: () => void;
  locationName: (id?: string) => string;
  buildingName: (id?: string) => string;
}

/** Side panel: repair history of one item, without leaving the report and its filters. */
export const EquipmentHistorySheet = ({ itemId, onClose, locationName, buildingName }: EquipmentHistorySheetProps) => {
  const query = useServiceQuery(['reports', 'equipment-history', itemId], () => getEquipmentHistory(itemId));
  const history = query.data;

  const handleExport = () => {
    if (!history) return;
    try {
      downloadCsv(reportFileName(`lich-su-${history.item.code}`, todayVn()), buildEquipmentHistoryCsv(history));
      toast.success(`Đã xuất ${history.repairs.length} lần sửa ra CSV.`);
    } catch (error) {
      console.error('Export equipment history CSV failed:', error);
      toast.error('Không xuất được tệp CSV. Vui lòng thử lại.');
    }
  };

  const title = history ? `${history.item.code} · ${history.item.name}` : 'Lịch sử thiết bị';
  const description = history
    ? `${history.item.type} · ${locationName(history.item.locationId)} · ${buildingName(history.item.buildingId)} — ${history.repairCount} lần sửa · ${formatVnd(history.costTotal)}`
    : undefined;

  const renderBody = () => {
    if (query.isLoading) return <LoadingState rows={4} />;
    if (query.error || !history) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
    return <EquipmentHistoryTimeline history={history} />;
  };

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={title}
      description={description}
      actions={
        history ? (
          <>
            <Link to={`/maintenance/items/${history.item.id}`} className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }))}>
              <ExternalLink aria-hidden /> Mở trang thiết bị
            </Link>
            <Button variant="secondary" size="sm" onClick={handleExport} disabled={history.repairs.length === 0}>
              <Download aria-hidden /> Xuất CSV lịch sử
            </Button>
          </>
        ) : null
      }
    >
      {renderBody()}
    </Sheet>
  );
};
