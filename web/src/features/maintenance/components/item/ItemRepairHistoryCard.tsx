import { Link } from 'react-router';
import { ErrorState, LoadingState } from '@/components/common/States';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { useServiceQuery } from '@/hooks/useServiceQuery';
import { getEquipmentHistory } from '@/services/equipment-report-service';
import { formatVnd } from '@/utils/money';
import { EquipmentHistoryTimeline } from './EquipmentHistoryTimeline';

/** "Sửa chữa" tab of the item page: the same timeline as the equipment report panel. */
export const ItemRepairHistoryCard = ({ itemId }: { itemId: string }) => {
  const query = useServiceQuery(['reports', 'equipment-history', itemId], () => getEquipmentHistory(itemId));
  const history = query.data;
  const renderBody = () => {
    if (query.isLoading) return <LoadingState rows={4} />;
    if (query.error || !history) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
    return <EquipmentHistoryTimeline history={history} />;
  };
  return (
    <Card>
      <CardHeader
        title="Lịch sử sửa chữa"
        description={history ? `${history.repairCount} lần sửa · ${formatVnd(history.costTotal)} đã duyệt. Mới nhất trước.` : undefined}
        actions={<Link to={`/records?maintenanceItemId=${itemId}`} className="text-sm font-semibold text-accent hover:underline">Mở trong danh sách hồ sơ</Link>}
      />
      <CardBody className="pt-0">{renderBody()}</CardBody>
    </Card>
  );
};
