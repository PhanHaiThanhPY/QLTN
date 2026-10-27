import { useState } from 'react';
import { ActionButton } from '@/components/common/ActionButton';
import { Notice } from '@/components/common/Notice';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { approvalStepOf, nextApprovalStep } from '@/domain/actions';
import { LIMITS } from '@/domain/constants';
import { formatVndString, type QuoteSubmission } from '@/domain/quote-proposal';
import { useRepairAction } from '../../hooks/useRepairAction';
import { useRecordContext } from '../../record-context';
import { withPrecondition } from '../../record-utils';
import { ApprovalStepper } from '../approval/ApprovalStepper';
import { RecordFiles } from '../shared/RecordFiles';
import { QuoteDecisionDialog, type QuoteDecisionMode } from './QuoteDecisionDialog';
import { QuoteTableView } from './QuoteTableView';
import { toStepperDecisions } from './QuoteSubmissionCard';

const SELF_DECISION = 'Người lập tờ trình không được tự quyết định lần trình của mình.';

/** Panel while the proposal waits on a step: progress, the frozen quotation and the holder's three decisions. */
export const QuoteDecisionCard = ({ submission }: { submission: QuoteSubmission }) => {
  const { detail, viewer } = useRecordContext();
  const { record } = detail;
  const approve = useRepairAction('approveProposal');
  const requestUpdate = useRepairAction('requestProposalUpdate');
  const reject = useRepairAction('rejectProposal');
  const [mode, setMode] = useState<QuoteDecisionMode | null>(null);
  const step = approvalStepOf(record.status, record.approvalStepKeys, record.workflowApprovalSteps, record.currentApprovalStepKey);
  if (!approve.relevant || !step) return null;

  const next = nextApprovalStep(step.key, record.approvalStepKeys, record.workflowApprovalSteps);
  const isLastAttempt = submission.attemptNo >= LIMITS.MAX_SUBMISSION_ATTEMPTS;
  const isOwn = submission.submittedBy !== viewer.id;
  const isBoard = step.role === 'OWNERS_BOARD';

  return (
    <Card className="border-accent/40">
      <CardHeader
        title={`Chờ ${step.label.toLowerCase()}`}
        description={next ? `Sau bước này: ${next.label}.` : 'Đây là bước cuối: duyệt xong, hồ sơ chờ thi công.'}
      />
      <CardBody className="space-y-4">
        <ApprovalStepper record={record} decisions={toStepperDecisions(submission, record.id)} isCurrent />
        <p className="text-sm text-ink-2">
          Lần trình {submission.attemptNo}/{LIMITS.MAX_SUBMISSION_ATTEMPTS} · Số trình{' '}
          <span className="font-semibold text-ink">{formatVndString(submission.proposedAmountVnd)}</span> (
          {submission.content.contractors[submission.content.proposedContractorIndex]?.name})
        </p>
        <QuoteTableView content={submission.content} />
        <div>
          <p className="mb-1 text-xs font-medium text-ink-3">Biên bản ghi nhận sự việc và báo giá</p>
          <RecordFiles ids={submission.attachmentIds} />
        </div>
        {isBoard ? (
          <Notice tone="info" title="Bước BQT">
            Duyệt hoặc từ chối cần biên bản họp BQT của lần trình này và chữ ký của BQT.
          </Notice>
        ) : null}
        {isLastAttempt ? (
          <Notice tone="warning" title="Lần trình thứ 3">
            Chỉ được Duyệt hoặc Từ chối. Từ chối sẽ chuyển hồ sơ sang {record.emergency ? '“Không được duyệt hậu kiểm”' : '“Chưa xử lý”'}.
          </Notice>
        ) : null}
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
          <ActionButton
            variant="secondary"
            state={withPrecondition(
              withPrecondition(requestUpdate.state, isOwn, SELF_DECISION),
              !isLastAttempt,
              'Lần trình thứ 3: chỉ được Duyệt hoặc Từ chối.',
            )}
            onClick={() => setMode('requestProposalUpdate')}
          >
            Yêu cầu bổ sung
          </ActionButton>
          <ActionButton
            variant="danger"
            state={withPrecondition(reject.state, isOwn, SELF_DECISION)}
            onClick={() => setMode('rejectProposal')}
          >
            Từ chối
          </ActionButton>
          <ActionButton state={withPrecondition(approve.state, isOwn, SELF_DECISION)} onClick={() => setMode('approveProposal')}>
            Duyệt
          </ActionButton>
        </div>
      </CardBody>
      {mode ? (
        <QuoteDecisionDialog mode={mode} step={step} submission={submission} isLastStep={!next} onClose={() => setMode(null)} />
      ) : null}
    </Card>
  );
};
