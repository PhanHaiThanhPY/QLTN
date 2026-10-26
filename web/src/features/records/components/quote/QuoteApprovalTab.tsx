import { InfoGrid } from '@/components/common/InfoGrid';
import { Notice } from '@/components/common/Notice';
import { EmptyState } from '@/components/common/States';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { formatVndString, type QuoteProposalHistory } from '@/domain/quote-proposal';
import { useRecordContext } from '../../record-context';
import { isActionRelevant } from '../../record-utils';
import { QuoteDecisionCard } from './QuoteDecisionCard';
import { QuoteProposalEditor } from './QuoteProposalEditor';
import { QuoteSubmissionCard } from './QuoteSubmissionCard';

/** Tab "Tờ trình" for records served by api-qltn (S2): result, current decision, editor and every attempt. */
export const QuoteApprovalTab = ({ proposal }: { proposal: QuoteProposalHistory }) => {
  const { detail } = useRecordContext();
  const { record } = detail;
  const { submissions } = proposal;
  const isEditable = isActionRelevant('saveProposalDraft', record.status);
  if (submissions.length === 0 && !isEditable) {
    return (
      <EmptyState
        title="Chưa có tờ trình"
        description="Tờ trình (bảng báo giá các nhà thầu) được lập sau khi hồ sơ được xác nhận cần sửa."
      />
    );
  }
  const current = submissions.find((row) => row.id === record.currentSubmissionId);
  const last = submissions.at(-1);
  const returned = last?.decisions.at(-1);
  const isReturned = record.status === 'NEEDS_SUBMISSION_UPDATE' || record.status === 'REJECTED_RESUBMITTABLE';

  return (
    <div className="space-y-4">
      {proposal.approvedAmountVnd ? (
        <Card>
          <CardHeader title="Kết quả phê duyệt" />
          <CardBody>
            <InfoGrid
              items={[
                { label: 'Số được duyệt', value: formatVndString(proposal.approvedAmountVnd) },
                { label: 'Nhà thầu thực hiện', value: proposal.executingContractorName ?? '—' },
              ]}
            />
          </CardBody>
        </Card>
      ) : null}
      {isReturned && returned?.reason ? (
        <Notice tone="warning" title={record.status === 'REJECTED_RESUBMITTABLE' ? 'Bị từ chối – được trình lại' : 'Yêu cầu bổ sung'}>
          <span className="whitespace-pre-line">{returned.reason}</span>
        </Notice>
      ) : null}
      {record.status === 'UNRESOLVED' ? (
        <Notice tone="danger" title="Hồ sơ chưa xử lý – bị từ chối ở lần trình thứ 3">
          Không thể tạo lần trình thứ 4.
        </Notice>
      ) : null}
      {current ? <QuoteDecisionCard submission={current} /> : null}
      <QuoteProposalEditor proposal={proposal} />
      {submissions.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-ink-2">Các lần trình ({submissions.length})</h2>
          {[...submissions].reverse().map((submission) => (
            <QuoteSubmissionCard key={submission.id} submission={submission} />
          ))}
        </section>
      ) : null}
    </div>
  );
};
