import { Link } from 'react-router';
import { AttachmentList } from '@/components/common/AttachmentList';
import { InfoGrid } from '@/components/common/InfoGrid';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import type { OccurrenceDetail } from '@/services/maintenance-occurrences-api';
import { formatDate, formatDateTime } from '@/utils/date';

interface OccurrenceSideCardProps {
  detail: OccurrenceDetail;
  userName: (id?: string) => string;
  /** The general result is shown here unless the performer is editing it. */
  showResult: boolean;
}

/** The occurrence's facts and its general result (ui-brief §2.4, right column). */
export const OccurrenceSideCard = ({ detail, userName, showResult }: OccurrenceSideCardProps) => {
  const { occurrence, plan, item, files } = detail;
  const photos = occurrence.work.attachmentIds.flatMap((id) => (files[id] ? [files[id]] : []));
  return (
    <Card>
      <CardHeader title="Thông tin lượt" />
      <CardBody className="space-y-3 pt-0">
        <InfoGrid
          items={[
            { label: 'Kế hoạch', value: <Link className="text-accent hover:underline" to={`/maintenance/plans/${plan.id}`}>{plan.code} · {plan.name}</Link> },
            { label: 'Thiết bị', value: <Link className="text-accent hover:underline" to={`/maintenance/items/${item.id}`}>{item.code} – {item.name}</Link> },
            { label: 'Ngày lịch', value: formatDate(occurrence.scheduledDate) },
            { label: 'Người thực hiện', value: userName(occurrence.performerUserId) },
            { label: 'Người xác nhận', value: userName(occurrence.reviewerUserId) },
            { label: 'Nhà thầu', value: occurrence.contractorName ?? '—' },
            { label: 'Bắt đầu', value: occurrence.startedAt ? formatDateTime(occurrence.startedAt) : '—' },
            { label: 'Hạn xác nhận', value: occurrence.reviewDueAt ? formatDateTime(occurrence.reviewDueAt) : '—' },
          ]}
        />
        {showResult && occurrence.work.summary ? (
          <div className="space-y-1.5 text-sm">
            <p className="text-ink-2">Kết quả chung</p>
            <p className="text-ink">{occurrence.work.summary}</p>
            {occurrence.work.actualWorker ? <p className="text-ink-2">Người làm thực tế: {occurrence.work.actualWorker}</p> : null}
            <AttachmentList attachments={photos} emptyText="Chưa có ảnh chung." />
          </div>
        ) : null}
        {occurrence.cancelReason ? <p className="text-sm text-ink-2">Lý do hủy: {occurrence.cancelReason}</p> : null}
      </CardBody>
    </Card>
  );
};
