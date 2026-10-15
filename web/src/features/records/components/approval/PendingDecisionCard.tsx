import { Notice } from '@/components/common/Notice';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { approvalStepOf, nextApprovalStep } from '@/domain/actions';
import { LIMITS } from '@/domain/constants';
import { formatVnd } from '@/utils/money';
import { useRepairAction } from '../../hooks/useRepairAction';
import { useRecordContext } from '../../record-context';
import { currentSubmissionView, withPrecondition } from '../../record-utils';
import { ConfirmActionButton } from '../shared/ConfirmActionButton';
import { ReasonActionButton } from '../shared/ReasonActionButton';
import { RecordAlerts } from '../shared/RecordAlerts';
import { RecordFiles } from '../shared/RecordFiles';
import { ApprovalStepper } from './ApprovalStepper';
import { ApprovalSummary } from './ApprovalSummary';

/** Panel while the proposal is in the approval chain: progress, what is being approved, and the current approver's decision. */
export const PendingDecisionCard = () => {
  const { detail, viewer } = useRecordContext();
  const approve = useRepairAction('approveProposal');
  const requestUpdate = useRepairAction('requestProposalUpdate');
  const view = currentSubmissionView(detail);
  if (!approve.relevant || !view) return null;
  const { submission } = view;
  const isLastAttempt = submission.attemptNo >= LIMITS.MAX_SUBMISSION_ATTEMPTS;
  const step = approvalStepOf(detail.record.status, detail.record.approvalStepKeys);
  const next = step ? nextApprovalStep(step.key, detail.record.approvalStepKeys) : undefined;
  const afterApprove = next ? `Tiếp theo: ${next.label}.` : 'Tiếp theo: BQL có thể bắt đầu thi công.';

  return (
    <Card className="border-accent/40">
      <CardHeader
        title={step ? `Chờ ${step.label.toLowerCase()}` : 'Chờ phê duyệt'}
        description="Tờ trình đi theo chuỗi đã cấu hình của tòa nhà. Ai yêu cầu bổ sung, hồ sơ quay về BQL và trình lại từ đầu."
      />
      <CardBody className="space-y-4">
        <ApprovalStepper record={detail.record} decisions={view.decisions} isCurrent />
        <ApprovalSummary contractorName={submission.contractorName} amountVnd={submission.amountVnd} attemptNo={submission.attemptNo} />
        <RecordAlerts alerts={detail.alerts} />
        <div>
          <p className="mb-1 text-xs font-medium text-ink-3">Tài liệu tờ trình</p>
          <RecordFiles ids={submission.attachmentIds} />
        </div>
        {isLastAttempt ? (
          <Notice tone="warning" title="Lần trình thứ 3">
            Ở lần trình thứ 3 chỉ được Duyệt hoặc Từ chối. Từ chối ở bất kỳ bước nào sẽ đóng hồ sơ (“Đóng vì bị từ chối”).
          </Notice>
        ) : null}
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
          <ReasonActionButton
            action="requestProposalUpdate"
            field="reason"
            dialogTitle="Yêu cầu bổ sung tờ trình"
            dialogDescription="Hồ sơ quay về BQL chỉnh sửa; lần trình mới sẽ bắt đầu lại từ bước đầu theo workflow đã cấu hình."
            successMessage="Đã yêu cầu bổ sung tờ trình."
            stateOverride={withPrecondition(requestUpdate.state, !isLastAttempt, 'Lần trình thứ 3: chỉ được Duyệt hoặc Từ chối.')}
          />
          <ReasonActionButton
            action="rejectProposal"
            field="reason"
            confirmVariant="danger"
            dialogTitle={isLastAttempt ? 'Từ chối lần trình cuối' : 'Từ chối tờ trình'}
            dialogDescription={
              isLastAttempt
                ? 'Đây là lần trình thứ 3: từ chối sẽ đóng hồ sơ và không thể trình lại.'
                : 'Hồ sơ chuyển sang “Từ chối và được trình lại”; lần trình mới bắt đầu lại từ bước đầu theo workflow đã cấu hình.'
            }
            successMessage="Đã từ chối tờ trình."
          />
          <ConfirmActionButton
            action="approveProposal"
            dialogTitle={step ? step.label : 'Duyệt tờ trình'}
            confirmLabel="Duyệt"
            payload={{ submissionId: submission.id }}
            successMessage={`Đã duyệt. ${afterApprove}`}
            stateOverride={withPrecondition(approve.state, submission.submittedBy !== viewer.id, 'Người lập tờ trình không được tự duyệt.')}
          >
            <p className="mb-3">Xác nhận duyệt lần trình {submission.attemptNo}/{LIMITS.MAX_SUBMISSION_ATTEMPTS}:</p>
            <ApprovalSummary contractorName={submission.contractorName} amountVnd={submission.amountVnd} attemptNo={submission.attemptNo} />
            <p className="mt-3 text-ink-3">
              {afterApprove} Lần trình này đã khóa: số tiền {formatVnd(submission.amountVnd)} không thay đổi được.
            </p>
          </ConfirmActionButton>
        </div>
      </CardBody>
    </Card>
  );
};
