import { Badge } from '@/components/ui/badge';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { InfoGrid } from '@/components/common/InfoGrid';
import { useReferenceData } from '@/hooks/useReferenceData';
import { formatDateTime } from '@/utils/date';
import { useRepairAction } from '../../hooks/useRepairAction';
import { useRecordContext } from '../../record-context';
import { DialogActionButton } from '../shared/DialogActionButton';
import { RecordFiles } from '../shared/RecordFiles';
import { ClosePostReviewDialog } from './ClosePostReviewDialog';

/**
 * Record not accepted at post-review (B06-S1 ui-brief §2.6): the rejection, then the BOARD holder's decision on the
 * cost. Read-only once closed; the close action is offered to the BOARD holder only.
 */
export const PostReviewRejectedCard = () => {
  const { detail } = useRecordContext();
  const { userName } = useReferenceData();
  const closeAction = useRepairAction('closePostReviewRejected');
  const emergency = detail.record.emergency;
  const rejection = emergency?.postReviewRejection;
  if (!rejection) return null;
  const decision = emergency.closeDecision;
  return (
    <Card className="border-crit/40">
      <CardHeader
        title="Không được duyệt hậu kiểm"
        description="BQT không chấp nhận việc sửa khẩn cấp. Không có thanh toán trong hệ thống. BQT ghi quyết định xử lý chi phí rồi đóng hồ sơ."
        actions={<Badge tone="crit">Không được duyệt hậu kiểm</Badge>}
      />
      <CardBody className="space-y-3">
        <InfoGrid
          items={[
            { label: 'Lý do từ chối', value: `${rejection.reason} · ${userName(rejection.decidedBy)} · ${formatDateTime(rejection.decidedAt)}`, wide: true },
            ...(decision
              ? [{ label: 'Quyết định xử lý chi phí', value: `${decision.reason} · ${userName(decision.decidedBy)} · ${formatDateTime(decision.decidedAt)}`, wide: true }]
              : []),
          ]}
        />
        {decision && decision.attachmentIds.length > 0 ? <RecordFiles ids={decision.attachmentIds} /> : null}
        {decision || !closeAction.state.allowed ? null : (
          <div className="flex justify-end">
            <DialogActionButton action="closePostReviewRejected" variant="danger" renderDialog={(close) => <ClosePostReviewDialog onClose={close} />} />
          </div>
        )}
      </CardBody>
    </Card>
  );
};
