import { ActionButton } from '@/components/common/ActionButton';
import { Notice } from '@/components/common/Notice';
import { OCCURRENCE_ACTIONS, evaluateAction } from '@/domain/actions';
import type { User } from '@/domain/types';
import { useCommand } from '@/hooks/useCommand';
import type { OccurrenceDetail } from '@/services/maintenance-service';
import { todayVn } from '@/services/runtime';
import { diffDays, formatDateTime, toVnDate } from '@/utils/date';
import { CancelOccurrenceButton } from './CancelOccurrenceButton';
import { ReassignConfirmerButton } from './ReassignConfirmerButton';

interface OccurrenceNoticesProps {
  detail: OccurrenceDetail;
  viewer: User;
}

/** Review flag, reassignment, waiting-for-review and cancellation notices above the tabs. */
export const OccurrenceNotices = ({ detail, viewer }: OccurrenceNoticesProps) => {
  const { occurrence, inactiveSlots, submissions } = detail;
  const acknowledge = useCommand({ successMessage: 'Đã giữ lượt này theo ngày hiện tại.' });
  const current = submissions.find((row) => row.id === occurrence.currentSubmissionId);
  const waitingDays = current ? diffDays(toVnDate(current.submittedAt), todayVn()) : 0;
  const reviewOverdue = Boolean(occurrence.reviewDueAt && new Date(occurrence.reviewDueAt).getTime() < Date.now());

  const handleAcknowledge = () =>
    void acknowledge.execute({
      subjectType: 'MAINTENANCE_OCCURRENCE',
      subjectId: occurrence.id,
      expectedVersion: occurrence.version,
      action: 'acknowledgeScheduleChange',
    });

  return (
    <div className="space-y-3">
      {occurrence.reviewFlag === 'SCHEDULE_CHANGED' && occurrence.status === 'SCHEDULED' ? (
        <Notice tone="warning" title="Cần rà soát sau khi đổi chu kỳ">
          <p>Kế hoạch đã lập phiên bản lịch mới từ trước ngày của lượt này. Giữ lượt theo ngày hiện tại hoặc hủy lượt kèm lý do.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <ActionButton
              state={evaluateAction(OCCURRENCE_ACTIONS.acknowledgeScheduleChange, viewer, occurrence)}
              size="sm"
              isLoading={acknowledge.isPending}
              onClick={handleAcknowledge}
            >
              Giữ lượt này
            </ActionButton>
            <CancelOccurrenceButton occurrence={occurrence} viewer={viewer} size="sm" />
          </div>
        </Notice>
      ) : null}
      {inactiveSlots.length > 0 ? (
        <Notice tone="danger" title="Cần phân công lại">
          {inactiveSlots.includes('confirmer') ? (
            <div className="space-y-2">
              <p>Người xác nhận kỹ thuật đã ngừng hoạt động; các quyết định bị chặn cho đến khi BQL quản lý giao lại.</p>
              <ReassignConfirmerButton occurrence={occurrence} viewer={viewer} />
            </div>
          ) : null}
          {inactiveSlots.includes('manager') ? <p>BQL quản lý đã ngừng hoạt động; ADMIN cần thay BQL quản lý tại màn Quản trị demo.</p> : null}
        </Notice>
      ) : null}
      {occurrence.status === 'PENDING_REVIEW' ? (
        <Notice tone={reviewOverdue ? 'danger' : 'info'} title={reviewOverdue ? `Quá hạn kiểm tra ${waitingDays} ngày` : `Chờ kiểm tra ${waitingDays} ngày`}>
          Đã gửi kết quả. Hạn kiểm tra: {occurrence.reviewDueAt ? formatDateTime(occurrence.reviewDueAt) : 'chưa cấu hình'}. Người xác nhận kiểm tra ở tab “Checklist & kết quả”.
        </Notice>
      ) : null}
      {occurrence.status === 'CANCELLED' && occurrence.cancelReason ? (
        <Notice tone="warning" title="Lượt đã hủy">
          {occurrence.cancelReason}
        </Notice>
      ) : null}
    </div>
  );
};
