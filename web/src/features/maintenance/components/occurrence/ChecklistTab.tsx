import { AttachmentList } from '@/components/common/AttachmentList';
import { InfoGrid } from '@/components/common/InfoGrid';
import { Notice } from '@/components/common/Notice';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { OCCURRENCE_ACTIONS, evaluateAction } from '@/domain/actions';
import type { User } from '@/domain/types';
import type { OccurrenceDetail } from '@/services/maintenance-service';
import { ChecklistEntriesView, pickAttachments } from './ChecklistEntriesView';
import { ChecklistWorkEditor } from './ChecklistWorkEditor';
import { ReviewPanel } from './ReviewPanel';
import { SubmissionRounds } from './SubmissionRounds';

const WORKING_STATUSES = ['SCHEDULED', 'IN_PROGRESS', 'REWORK', 'CANCELLED'];

/** "Checklist & kết quả": editable working copy for the manager, otherwise read-only, plus all submission rounds. */
export const ChecklistTab = ({ detail, viewer }: { detail: OccurrenceDetail; viewer: User }) => {
  const { occurrence, attachments, submissions, reviews } = detail;
  const attachmentsById = new Map(attachments.map((row) => [row.id, row]));
  const canEdit = evaluateAction(OCCURRENCE_ACTIONS.saveMaintenanceProgress, viewer, occurrence).allowed;
  const current = submissions.find((row) => row.id === occurrence.currentSubmissionId);
  const showWorkingCopy = !canEdit && WORKING_STATUSES.includes(occurrence.status);

  return (
    <div className="space-y-4">
      {canEdit ? <ChecklistWorkEditor key={`${occurrence.id}-${occurrence.status}`} occurrence={occurrence} attachments={attachments} viewer={viewer} /> : null}
      {occurrence.status === 'SCHEDULED' ? <Notice tone="info">Lượt chưa bắt đầu. BQL quản lý bấm “Bắt đầu” để nhập checklist.</Notice> : null}
      {showWorkingCopy ? (
        <Card>
          <CardHeader title="Bản làm việc hiện tại" description="Chỉ xem. BQL quản lý lượt mới được cập nhật." />
          <CardBody className="space-y-4">
            <ChecklistEntriesView entries={occurrence.checklist} attachmentsById={attachmentsById} />
            <InfoGrid
              items={[
                { label: 'Đơn vị thực hiện', value: occurrence.performerName ?? '—' },
                { label: 'Nhà thầu', value: occurrence.contractorName ?? '—' },
                { label: 'Kết luận', value: occurrence.resultNote ?? '—', wide: true },
              ]}
            />
            <AttachmentList attachments={pickAttachments(occurrence.attachmentIds, attachmentsById)} emptyText="Chưa có ảnh kết quả chung." />
          </CardBody>
        </Card>
      ) : null}
      {occurrence.status === 'PENDING_REVIEW' && current ? <ReviewPanel occurrence={occurrence} submission={current} viewer={viewer} /> : null}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-ink">Các lần gửi kết quả</h3>
        <SubmissionRounds submissions={submissions} reviews={reviews} currentSubmissionId={occurrence.currentSubmissionId} attachmentsById={attachmentsById} />
      </div>
    </div>
  );
};
