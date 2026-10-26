import { InfoGrid } from '@/components/common/InfoGrid';
import { Badge } from '@/components/ui/badge';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { LIMITS } from '@/domain/constants';
import {
  BUDGET_SOURCE_LABEL,
  PROPOSAL_TYPE_LABEL,
  formatVndString,
  type QuoteSignature,
  type QuoteSubmission,
} from '@/domain/quote-proposal';
import type { ApprovalDecision } from '@/domain/types';
import { useReferenceData } from '@/hooks/useReferenceData';
import { formatDate } from '@/utils/date';
import { useRecordContext } from '../../record-context';
import { ApprovalStepper } from '../approval/ApprovalStepper';
import { APPROVAL_OUTCOME } from '../approval/approval-labels';
import { ActorLine } from '../shared/ActorLine';
import { RecordFiles } from '../shared/RecordFiles';
import { QuoteTableView } from './QuoteTableView';

const SIGNATURE_LABEL: Record<QuoteSignature['documentType'], string> = {
  PROPOSAL: 'Người trình ký',
  BOARD_DECISION: 'BQT ký quyết định',
};

/** Decisions in the shape of the shared approval stepper. */
export const toStepperDecisions = (submission: QuoteSubmission, recordId: string): ApprovalDecision[] =>
  submission.decisions.map((row) => ({
    id: row.id,
    submissionId: submission.id,
    recordId,
    step: row.stepKey,
    actorId: row.actorId,
    outcome: row.outcome,
    reason: row.reason ?? undefined,
    createdAt: row.createdAt,
  }));

/** One immutable submission: D5-TT fields, frozen quotation table, files, signatures and step decisions. */
export const QuoteSubmissionCard = ({ submission }: { submission: QuoteSubmission }) => {
  const { detail } = useRecordContext();
  const { userName } = useReferenceData();
  const { record } = detail;
  const { content } = submission;
  const isCurrent = record.currentSubmissionId === submission.id;
  const latest = submission.decisions.at(-1);
  const finalChoice = submission.decisions.find((row) => row.selectedContractorIndex !== null);
  const boardMinutes = submission.decisions.flatMap((row) => row.attachmentIds);
  const badge = latest ? APPROVAL_OUTCOME[latest.outcome] : { label: 'Đang chờ duyệt', tone: 'warn' as const };

  return (
    <Card>
      <CardHeader
        title={`Lần trình ${submission.attemptNo}/${LIMITS.MAX_SUBMISSION_ATTEMPTS}`}
        description={<ActorLine prefix="Trình bởi" actorId={submission.submittedBy} at={submission.submittedAt} />}
        actions={<Badge tone={badge.tone}>{isCurrent && !latest ? 'Đang trong chuỗi duyệt' : badge.label}</Badge>}
      />
      <CardBody className="space-y-4">
        <InfoGrid
          items={[
            { label: 'Kính gửi', value: content.recipient },
            { label: 'Người lập', value: content.preparedByName },
            { label: 'Thẩm định nội dung', value: userName(content.reviewerUserId ?? undefined) },
            { label: 'Loại tờ trình', value: PROPOSAL_TYPE_LABEL[content.proposalType] },
            { label: 'Ngân sách', value: BUDGET_SOURCE_LABEL[content.budgetSource] },
            { label: 'Hạn mong muốn', value: content.desiredApprovalDate ? formatDate(content.desiredApprovalDate) : '—' },
            { label: 'Số trình (nhà thầu đề xuất)', value: formatVndString(submission.proposedAmountVnd) },
            { label: 'Nội dung xin phê duyệt', value: content.requestContent, wide: true },
            { label: 'Đề xuất và đánh giá', value: content.assessment, wide: true },
            ...(content.shortfallReason
              ? [{ label: 'Lý do không đủ 3 báo giá', value: content.shortfallReason, wide: true }]
              : []),
          ]}
        />
        <QuoteTableView content={content} selectedIndex={finalChoice?.selectedContractorIndex} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-xs font-medium text-ink-3">Biên bản ghi nhận sự việc và báo giá</p>
            <RecordFiles ids={submission.attachmentIds} />
          </div>
          {boardMinutes.length > 0 ? (
            <div>
              <p className="mb-1 text-xs font-medium text-ink-3">Biên bản họp BQT</p>
              <RecordFiles ids={boardMinutes} />
            </div>
          ) : null}
        </div>
        {submission.signatures.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {submission.signatures.map((row) => (
              <figure key={row.id} className="rounded-lg border border-line bg-surface-2 p-3">
                <figcaption className="text-xs font-semibold text-ink-2">{SIGNATURE_LABEL[row.documentType]}</figcaption>
                <img
                  src={row.imageDataUrl}
                  alt={`Chữ ký – ${SIGNATURE_LABEL[row.documentType]}`}
                  className="my-2 h-20 w-full max-w-xs rounded-md bg-white object-contain"
                />
                <ActorLine actorId={row.signerId} at={row.createdAt} />
              </figure>
            ))}
          </div>
        ) : null}
        <div>
          <p className="mb-1 text-xs font-medium text-ink-3">Các bước duyệt</p>
          <ApprovalStepper record={record} decisions={toStepperDecisions(submission, record.id)} isCurrent={isCurrent} />
        </div>
      </CardBody>
    </Card>
  );
};
