import { AttachmentList } from '@/components/common/AttachmentList';
import { InfoGrid } from '@/components/common/InfoGrid';
import { Badge } from '@/components/ui/badge';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { ITEM_CONDITION_LABEL } from '@/domain/constants';
import type { Attachment, MaintenanceReview, MaintenanceSubmission } from '@/domain/types';
import { useReferenceData } from '@/hooks/useReferenceData';
import { formatDateTime } from '@/utils/date';
import { ChecklistEntriesView, pickAttachments } from './ChecklistEntriesView';

interface SubmissionRoundsProps {
  submissions: MaintenanceSubmission[];
  reviews: MaintenanceReview[];
  currentSubmissionId?: string;
  attachmentsById: Map<string, Attachment>;
}

/** Every submission round is an immutable snapshot with its review (spec 6.3). Newest first. */
export const SubmissionRounds = ({ submissions, reviews, currentSubmissionId, attachmentsById }: SubmissionRoundsProps) => {
  const { userName } = useReferenceData();
  if (submissions.length === 0) return <p className="text-sm text-ink-2">Chưa có lần gửi kết quả nào.</p>;
  const ordered = [...submissions].sort((a, b) => b.roundNo - a.roundNo);
  return (
    <div className="space-y-4">
      {ordered.map((submission) => {
        const roundReviews = reviews.filter((review) => review.submissionId === submission.id);
        const previous = submissions.find((row) => row.roundNo === submission.roundNo - 1);
        const changes = previous
          ? submission.checklistSnapshot.flatMap((entry) => {
              const oldEntry = previous.checklistSnapshot.find((row) => row.templateItemId === entry.templateItemId);
              if (!oldEntry || oldEntry.result === entry.result && oldEntry.note === entry.note && oldEntry.attachmentIds.length === entry.attachmentIds.length) return [];
              return [{ label: entry.label, before: oldEntry.result, after: entry.result, note: entry.note }];
            })
          : [];
        return (
          <Card key={submission.id}>
            <CardHeader
              title={
                <span className="flex flex-wrap items-center gap-2">
                  Lần gửi {submission.roundNo}
                  {submission.id === currentSubmissionId ? <Badge tone="accent">Bản hiện hành</Badge> : null}
                </span>
              }
              description={`${formatDateTime(submission.submittedAt)} · ${userName(submission.submittedBy)}`}
            />
            <CardBody className="space-y-4">
              {changes.length > 0 ? (
                <div className="rounded-lg border border-info/30 bg-info-soft px-3 py-2 text-sm">
                  <p className="font-medium text-ink">So với lần gửi {previous?.roundNo}: {changes.length} mục đã thay đổi</p>
                  <ul className="mt-1 list-disc pl-5 text-ink-2">
                    {changes.map((change) => <li key={change.label}>{change.label}: {change.before} → {change.after}{change.note ? ` · ${change.note}` : ''}</li>)}
                  </ul>
                </div>
              ) : null}
              <ChecklistEntriesView entries={submission.checklistSnapshot} attachmentsById={attachmentsById} />
              <InfoGrid
                items={[
                  { label: 'Đơn vị thực hiện', value: submission.performerName || '—' },
                  { label: 'Nhà thầu', value: submission.contractorName ?? '—' },
                  { label: 'Kết luận', value: submission.resultNote || '—', wide: true },
                ]}
              />
              <div>
                <p className="mb-1 text-xs font-medium text-ink-2">Ảnh/tệp kết quả</p>
                <AttachmentList attachments={pickAttachments(submission.attachmentIds, attachmentsById)} emptyText="Không có tệp chung." />
              </div>
              {roundReviews.map((review) => (
                <div
                  key={review.id}
                  className={review.outcome === 'CONFIRMED' ? 'rounded-lg bg-good-soft px-3 py-2 text-sm' : 'rounded-lg bg-warn-soft px-3 py-2 text-sm'}
                >
                  <p className="font-medium text-ink">
                    {review.outcome === 'CONFIRMED' ? 'Đã xác nhận hoàn tất' : 'Yêu cầu làm lại'} · {userName(review.actorId)}
                  </p>
                  <p className="text-xs text-ink-2">{formatDateTime(review.createdAt)}</p>
                  {review.reason ? (
                    <p className="mt-1 text-ink">
                      {review.outcome === 'CONFIRMED' ? 'Hướng xử lý: ' : 'Lý do: '}
                      {review.reason}
                    </p>
                  ) : null}
                  {review.itemReviews?.length ? (
                    <div className="mt-2 space-y-1 border-t border-current/10 pt-2 text-xs text-ink-2">
                      {review.itemReviews.map((item) => {
                        const entry = submission.checklistSnapshot.find((row) => row.templateItemId === item.templateItemId);
                        return <p key={item.templateItemId}>{entry?.label ?? item.templateItemId}: {item.outcome === 'REWORK' ? 'Cần làm lại' : 'Đạt'}{item.reason ? ` · ${item.reason}` : ''}</p>;
                      })}
                    </div>
                  ) : null}
                  {review.itemConditionAfter ? (
                    <p className="mt-1 text-ink">Tình trạng hạng mục sau kiểm tra: {ITEM_CONDITION_LABEL[review.itemConditionAfter]}</p>
                  ) : null}
                </div>
              ))}
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
};
