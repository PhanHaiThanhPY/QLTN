import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { InfoGrid } from '@/components/common/InfoGrid';
import { formatDateTime } from '@/utils/date';
import { formatVnd } from '@/utils/money';
import { useRecordContext } from '../../record-context';
import { ActorLine } from '../shared/ActorLine';
import { EmergencyDeadlineBadge } from './EmergencyDeadlineBadge';

/** Emergency repair summary with the document deadline (remaining, overdue, or met). */
export const EmergencyCard = () => {
  const { detail } = useRecordContext();
  const emergency = detail.record.emergency;
  if (!emergency) return null;
  return (
    <Card className="border-crit/40">
      <CardHeader title="Sửa chữa khẩn cấp" description="Đã cho làm trước khi duyệt; tờ trình vẫn đi đủ 4 bước duyệt sau đó." actions={<EmergencyDeadlineBadge emergency={emergency} />} />
      <CardBody className="space-y-3">
        <InfoGrid
          items={[
            { label: 'Lý do', value: emergency.reason, wide: true },
            { label: 'Nhà thầu', value: emergency.contractorName },
            { label: 'Chi phí dự kiến', value: `${formatVnd(emergency.estimatedAmountVnd)} (hạn mức ${formatVnd(emergency.limitVnd)})` },
            { label: 'Hạn bổ sung hồ sơ', value: formatDateTime(emergency.docsDueAt) },
            { label: 'Đã bổ sung lúc', value: formatDateTime(emergency.docsSubmittedAt) },
            ...(emergency.lateReason ? [{ label: 'Lý do bổ sung trễ', value: emergency.lateReason, wide: true }] : []),
          ]}
        />
        <ActorLine prefix="Cho xử lý bởi" actorId={emergency.startedBy} at={emergency.startedAt} />
      </CardBody>
    </Card>
  );
};
