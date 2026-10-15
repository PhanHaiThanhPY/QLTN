import { Badge } from '@/components/ui/badge';
import type { BadgeTone } from '@/components/ui/badge';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { approvalStepOf, approvalStepsFor } from '@/domain/actions';
import { LIMITS } from '@/domain/constants';
import type { ApprovalDecision, ProposalSignature, RepairRecord } from '@/domain/types';
import type { SubmissionView } from '@/services/records-service';
import { formatVnd } from '@/utils/money';
import { ActorLine } from '../shared/ActorLine';
import { RecordFiles } from '../shared/RecordFiles';
import { ApprovalStepper } from './ApprovalStepper';
import { SignatureView } from './SignatureView';
import { APPROVAL_OUTCOME } from './approval-labels';

/** Header badge: the latest decision, or "running" while the chain is still on this attempt. */
const submissionBadge = (latest: ApprovalDecision | undefined, isRunning: boolean, record: RepairRecord): { label: string; tone: BadgeTone } => {
  if (isRunning) return { label: 'Đang trong chuỗi duyệt', tone: 'warn' };
  if (latest?.outcome === 'APPROVED') return { label: `Đã duyệt đủ ${approvalStepsFor(record.approvalStepKeys).length} bước`, tone: 'good' };
  if (latest) return APPROVAL_OUTCOME[latest.outcome];
  return { label: 'Đang chờ duyệt', tone: 'warn' };
};

interface SubmissionCardProps {
  view: SubmissionView;
  record: RepairRecord;
  signatures: ProposalSignature[];
}

/** One immutable submission attempt with its contractor, price, documents and configured approval steps. */
export const SubmissionCard = ({ view, record, signatures }: SubmissionCardProps) => {
  const { submission, decisions } = view;
  const latest = decisions[decisions.length - 1];
  const isCurrent = record.currentSubmissionId === submission.id;
  const badge = submissionBadge(latest, isCurrent && Boolean(approvalStepOf(record.status, record.approvalStepKeys)), record);
  return (
    <Card>
      <CardHeader
        title={`Lần trình ${submission.attemptNo}/${LIMITS.MAX_SUBMISSION_ATTEMPTS}`}
        description={<ActorLine prefix="Trình bởi" actorId={submission.submittedBy} at={submission.submittedAt} />}
        actions={<Badge tone={badge.tone}>{badge.label}</Badge>}
      />
      <CardBody className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium text-ink-3">Nhà thầu thực hiện</p>
            <p className="text-sm text-ink">{submission.contractorName}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-ink-3">Giá trị trình</p>
            <p className="text-sm font-semibold text-ink">{formatVnd(submission.amountVnd)}</p>
          </div>
        </div>
        <div>
          <p className="text-xs font-medium text-ink-3">Phương án</p>
          <p className="mt-0.5 whitespace-pre-line text-sm text-ink">{submission.proposal}</p>
        </div>
        <div>
          <p className="mb-1 text-xs font-medium text-ink-3">Tài liệu tờ trình</p>
          <RecordFiles ids={submission.attachmentIds} />
        </div>
        {signatures.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {signatures.map((row) => (
              <SignatureView key={row.id} signature={row} />
            ))}
          </div>
        ) : null}
        <div>
          <p className="mb-1 text-xs font-medium text-ink-3">Các bước duyệt</p>
          <ApprovalStepper record={record} decisions={decisions} isCurrent={isCurrent} />
        </div>
      </CardBody>
    </Card>
  );
};
