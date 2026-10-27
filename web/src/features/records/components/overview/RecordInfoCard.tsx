import { Link } from 'react-router';
import { InfoGrid } from '@/components/common/InfoGrid';
import type { InfoItem } from '@/components/common/InfoGrid';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { PRIORITY_LABEL } from '@/domain/constants';
import { recordItemLink } from '@/domain/record-item-link';
import type { RecordItemLink } from '@/domain/record-item-link';
import { useReferenceData } from '@/hooks/useReferenceData';
import { formatDate, formatDateTime } from '@/utils/date';
import { subjectPath } from '@/utils/subject-link';
import { useRecordContext } from '../../record-context';

/** Shown when no item is attached (LINKED only applies to an item that no longer exists). */
const NO_ITEM_TEXT: Record<RecordItemLink, string> = {
  LINKED: 'Thiết bị không còn tồn tại',
  NONE: 'Không thuộc thiết bị cụ thể',
  UNLINKED: 'Chưa chọn (bắt buộc khi gửi xác nhận)',
};

/** Mock mode has the whole occurrence; api mode (MT-S3) its code and the checklist item the record came from. */
const sourceLink = (detail: ReturnType<typeof useRecordContext>['detail']) => {
  const { sourceOccurrence, sourceSummary } = detail;
  if (sourceSummary) {
    return (
      <Link className="text-accent hover:underline" to={subjectPath('MAINTENANCE_OCCURRENCE', sourceSummary.id)}>
        Từ lượt bảo trì {sourceSummary.code}
        {sourceSummary.itemLabel ? ` · mục ${sourceSummary.itemLabel}` : ''}
      </Link>
    );
  }
  if (sourceOccurrence) {
    return (
      <Link className="text-accent hover:underline" to={subjectPath('MAINTENANCE_OCCURRENCE', sourceOccurrence.id)}>
        {sourceOccurrence.code} · {formatDate(sourceOccurrence.scheduledDate)}
      </Link>
    );
  }
  return 'Không có';
};

/** General information, links to the maintenance item / source occurrence and the description. */
export const RecordInfoCard = () => {
  const { detail } = useRecordContext();
  const { buildingName, locationName, userName } = useReferenceData();
  const { record } = detail;
  // Mock mode loads the whole item; api mode (MT-S1) sends the short line the detail needs.
  const item = detail.item ?? detail.itemSummary;
  const items: InfoItem[] = [
    { label: 'Mã hồ sơ', value: record.code },
    { label: 'Mức ưu tiên', value: PRIORITY_LABEL[record.priority] },
    { label: 'Tòa nhà', value: buildingName(record.buildingId) },
    { label: 'Vị trí', value: locationName(record.locationId) },
    {
      label: 'Thiết bị / hạng mục',
      value: item ? (
        <Link className="text-accent hover:underline" to={subjectPath('MAINTENANCE_ITEM', item.id)}>
          {item.code} – {item.name}
        </Link>
      ) : (
        NO_ITEM_TEXT[recordItemLink(record)]
      ),
    },
    {
      label: 'Lượt bảo trì nguồn',
      value: sourceLink(detail),
    },
    { label: 'Người tạo', value: `${userName(record.createdBy)} · ${formatDateTime(record.createdAt)}` },
    { label: 'Cập nhật', value: `${formatDateTime(record.updatedAt)} · phiên bản ${record.version}` },
    { label: 'Hạn bước hiện tại', value: record.dueAt ? formatDateTime(record.dueAt) : 'Không có' },
    { label: 'Đóng lúc', value: record.closedAt ? formatDateTime(record.closedAt) : '—' },
    { label: 'Mô tả hư hỏng', value: <span className="whitespace-pre-line">{record.description || 'Chưa có mô tả.'}</span>, wide: true },
  ];
  return (
    <Card>
      <CardHeader title="Thông tin hồ sơ" />
      <CardBody>
        <InfoGrid items={items} />
      </CardBody>
    </Card>
  );
};
