import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { InfoGrid } from '@/components/common/InfoGrid';
import { Notice } from '@/components/common/Notice';
import { formatVndString } from '@/domain/quote-proposal';
import { formatDate, formatDateTime } from '@/utils/date';
import { formatVnd } from '@/utils/money';
import { useRecordContext } from '../../record-context';
import { ActorLine } from '../shared/ActorLine';
import { EmergencyDeadlineBadge } from './EmergencyDeadlineBadge';
import { PostReviewBadge } from './PostReviewBadge';

/** Emergency repair summary with the document deadline, the post-review outcome and the over-limit warning. */
export const EmergencyCard = () => {
  const { detail } = useRecordContext();
  const emergency = detail.record.emergency;
  if (!emergency) return null;
  const chosenAmount = detail.paymentHistory?.approvedAmountVnd ?? detail.quoteProposal?.submissions.at(-1)?.proposedAmountVnd;
  return (
    <Card className="border-crit/40">
      <CardHeader title="Sửa chữa khẩn cấp" description="Đã cho làm trước khi duyệt; tờ trình vẫn đi đủ chuỗi duyệt sau đó." actions={<EmergencyDeadlineBadge emergency={emergency} />} />
      <CardBody className="space-y-3">
        <InfoGrid
          items={[
            { label: 'Lý do', value: emergency.reason, wide: true },
            { label: 'Nhà thầu', value: emergency.contractorName },
            { label: 'Chi phí dự kiến', value: formatVnd(emergency.estimatedAmountVnd) },
            { label: 'Hạn mức đã áp', value: formatVnd(emergency.limitVnd) },
            { label: 'Hạn bổ sung', value: formatDateTime(emergency.docsDueAt) },
            ...(emergency.plannedEndDate ? [{ label: 'Ngày dự kiến xong', value: formatDate(emergency.plannedEndDate) }] : []),
            { label: 'Đã bổ sung lúc', value: formatDateTime(emergency.docsSubmittedAt) },
            ...(emergency.lateReason ? [{ label: 'Lý do bổ sung trễ', value: emergency.lateReason, wide: true }] : []),
            ...(emergency.postReviewOutcome !== undefined ? [{ label: 'Hậu kiểm', value: <PostReviewBadge outcome={emergency.postReviewOutcome} /> }] : []),
          ]}
        />
        <ActorLine prefix="Cho xử lý bởi" actorId={emergency.startedBy} at={emergency.startedAt} />
        {emergency.overEmergencyLimit ? (
          <Notice tone="warning" title={`Báo giá được chọn ${formatVndString(chosenAmount)} vượt hạn mức khẩn cấp ${formatVnd(emergency.limitVnd)}`}>
            Người duyệt cần cân nhắc: phần vượt hạn mức chưa được phép làm trước khi duyệt.
          </Notice>
        ) : null}
      </CardBody>
    </Card>
  );
};
