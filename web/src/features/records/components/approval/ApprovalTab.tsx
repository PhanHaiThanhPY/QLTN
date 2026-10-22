import { Notice } from '@/components/common/Notice';
import { EmptyState } from '@/components/common/States';
import { approvalStepsFor } from '@/domain/actions';
import type { ApprovalStepKey } from '@/domain/constants';
import { isActionRelevant } from '../../record-utils';
import { useRecordContext } from '../../record-context';
import { PendingDecisionCard } from './PendingDecisionCard';
import { ProposalEditor } from './ProposalEditor';
import { SubmissionCard } from './SubmissionCard';
import { UnresolvedNoticeCard } from './UnresolvedNoticeCard';

const returnTitle = (status: string, step: ApprovalStepKey | undefined, approvalStepKeys: readonly ApprovalStepKey[], workflowApprovalSteps: Parameters<typeof approvalStepsFor>[1]): string => {
  const who = approvalStepsFor(approvalStepKeys, workflowApprovalSteps).find((row) => row.key === step)?.actor ?? 'Người duyệt';
  return status === 'REJECTED_RESUBMITTABLE' ? `${who} từ chối – được trình lại` : `${who} yêu cầu bổ sung`;
};

/** Tờ trình và phê duyệt: draft editor, approver decision, simulated signing, every attempt. */
export const ApprovalTab = () => {
  const { detail } = useRecordContext();
  const { record, submissions } = detail;
  const isEditable = isActionRelevant('saveProposalDraft', record.status);
  if (submissions.length === 0 && !isEditable) {
    return (
      <EmptyState
        title="Chưa có tờ trình"
        description="Tờ trình (phương án, tên nhà thầu và giá) được lập sau khi kỹ thuật xác nhận hồ sơ cần sửa."
      />
    );
  }
  const lastDecision = submissions[submissions.length - 1]?.decisions.at(-1);
  const showReturnNotice = (record.status === 'NEEDS_SUBMISSION_UPDATE' || record.status === 'REJECTED_RESUBMITTABLE') && lastDecision?.reason;
  return (
    <div className="space-y-4">
      {showReturnNotice ? (
        <Notice tone="warning" title={returnTitle(record.status, lastDecision?.step, record.approvalStepKeys, record.workflowApprovalSteps)}>
          <span className="whitespace-pre-line">{lastDecision?.reason}</span>
        </Notice>
      ) : null}
      {record.status === 'UNRESOLVED' ? (
        <Notice tone="danger" title="Hồ sơ chưa xử lý – bị từ chối ở lần trình thứ 3">Không thể tạo lần trình thứ 4.</Notice>
      ) : null}
      <UnresolvedNoticeCard />
      <PendingDecisionCard />
      <ProposalEditor />
      {submissions.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-ink-2">Các lần trình ({submissions.length})</h2>
          {[...submissions].reverse().map((view) => (
            <SubmissionCard
              key={view.submission.id}
              view={view}
              record={record}
              signatures={detail.signatures.filter((row) => row.submissionId === view.submission.id)}
            />
          ))}
        </section>
      ) : null}
    </div>
  );
};
