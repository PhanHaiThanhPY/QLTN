import { Link } from 'react-router';
import { InfoGrid } from '@/components/common/InfoGrid';
import { Badge } from '@/components/ui/badge';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { OCCURRENCE_FINAL_STATUSES } from '@/domain/constants';
import type { User } from '@/domain/types';
import { useReferenceData } from '@/hooks/useReferenceData';
import type { OccurrenceDetail } from '@/services/maintenance-service';
import { formatDate, formatDateTime } from '@/utils/date';
import { RepairLinksList } from '../RepairLinksList';
import { ReassignConfirmerButton } from './ReassignConfirmerButton';

export const OverviewTab = ({ detail, viewer }: { detail: OccurrenceDetail; viewer: User }) => {
  const { userName, buildingName, locationName } = useReferenceData();
  const { occurrence, plan, item, repairs, inactiveSlots } = detail;
  const isOpen = !OCCURRENCE_FINAL_STATUSES.includes(occurrence.status);
  const inactiveBadge = <Badge tone="crit">Ngừng hoạt động</Badge>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Thông tin lượt" />
        <CardBody>
          <InfoGrid
            items={[
              {
                label: 'Hạng mục',
                value: item ? (
                  <Link to={`/maintenance/items/${item.id}`} className="text-accent hover:underline">
                    {item.code} – {item.name}
                  </Link>
                ) : (
                  '—'
                ),
              },
              {
                label: 'Kế hoạch',
                value: plan ? (
                  <Link to={`/maintenance/plans/${plan.id}`} className="text-accent hover:underline">
                    {plan.code} – {plan.title}
                  </Link>
                ) : (
                  '—'
                ),
              },
              { label: 'Tòa nhà', value: buildingName(occurrence.buildingId) },
              { label: 'Vị trí', value: locationName(item?.locationId) },
              { label: 'Loại lượt', value: occurrence.occurrenceKind === 'MANUAL' ? 'Lượt bù thủ công' : 'Theo lịch' },
              { label: 'Phiên bản lịch', value: occurrence.scheduleRevision ? `#${occurrence.scheduleRevision}` : '—' },
              { label: 'Ngày dự kiến', value: formatDate(occurrence.scheduledDate) },
              { label: 'Ngày gốc của kỳ', value: formatDate(occurrence.originalScheduledDate) },
              { label: 'Bắt đầu lúc', value: formatDateTime(occurrence.startedAt) },
              { label: 'Hoàn tất lúc', value: formatDateTime(occurrence.completedAt) },
              { label: 'Đơn vị thực hiện', value: occurrence.performerName ?? '—' },
              { label: 'Nhà thầu', value: occurrence.contractorName ?? '—' },
            ]}
          />
        </CardBody>
      </Card>
      <Card>
        <CardHeader
          title="Người được giao"
          actions={isOpen ? <ReassignConfirmerButton occurrence={occurrence} viewer={viewer} /> : null}
        />
        <CardBody>
          <InfoGrid
            items={[
              {
                label: 'BQL quản lý',
                value: (
                  <span className="inline-flex flex-wrap items-center gap-2">
                    {userName(occurrence.managerUserId)} {inactiveSlots.includes('manager') ? inactiveBadge : null}
                  </span>
                ),
              },
              {
                label: 'Người xác nhận kỹ thuật',
                value: (
                  <span className="inline-flex flex-wrap items-center gap-2">
                    {userName(occurrence.confirmationUserId)} {inactiveSlots.includes('confirmer') ? inactiveBadge : null}
                  </span>
                ),
              },
            ]}
          />
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Hồ sơ sửa chữa liên kết" description="Mỗi hồ sơ có vòng đời riêng theo quy trình sửa chữa." />
        <CardBody>
          <RepairLinksList repairs={repairs} emptyText="Chưa có hồ sơ sửa chữa tạo từ lượt này." />
        </CardBody>
      </Card>
    </div>
  );
};
