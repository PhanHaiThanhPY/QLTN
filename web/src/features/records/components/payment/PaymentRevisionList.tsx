import { Badge } from '@/components/ui/badge';
import { approvalStepsFor } from '@/domain/actions';
import type { PaymentRequest } from '@/domain/types';
import { formatVnd } from '@/utils/money';
import { ActorLine } from '../shared/ActorLine';
import { RecordFiles } from '../shared/RecordFiles';
import { useRecordContext } from '../../record-context';

/** Every payment request revision with its decision, newest first. */
export const PaymentRevisionList = ({ requests }: { requests: PaymentRequest[] }) => {
  const { detail } = useRecordContext();
  if (requests.length === 0) return <p className="text-sm text-ink-3">Chưa gửi đề nghị thanh toán.</p>;
  return (
    <ul className="space-y-3">
      {[...requests].reverse().map((request) => (
        <li key={request.id} className="rounded-lg border border-line p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium text-ink">Lần {request.revisionNo}</span>
            {request.decision === 'APPROVED' ? <Badge tone="good">Đã duyệt</Badge> : null}
            {request.decision === 'NEEDS_UPDATE' ? <Badge tone="warn">Bị trả lại</Badge> : null}
            {request.decision ? null : <Badge tone="accent">Chờ duyệt</Badge>}
          </div>
          <p className="tnum mt-1 text-sm font-semibold text-ink">{formatVnd(request.amountVnd)}</p>
          <ActorLine prefix="Gửi bởi" actorId={request.submittedBy} at={request.submittedAt} />
          <div className="mt-2">
            <RecordFiles ids={request.attachmentIds} />
          </div>
          {request.decision ? (
            <div className="mt-2 rounded-md bg-surface-2 px-3 py-2">
              {request.reason ? <p className="whitespace-pre-line text-sm text-ink">{request.reason}</p> : null}
              <ActorLine prefix="Quyết định bởi" actorId={request.decidedBy} at={request.decidedAt} />
            </div>
          ) : null}
          {request.approvalDecisions && request.approvalDecisions.length > 0 ? (
            <div className="mt-2 space-y-2 border-t border-line pt-2">
              {request.approvalDecisions.map((decision) => {
                const label = approvalStepsFor(request.approvalStepKeys, detail.record.workflowApprovalSteps).find((step) => step.key === decision.step)?.label ?? decision.step;
                return (
                  <div key={`${decision.step}-${decision.createdAt}`} className="rounded-md bg-surface-2 px-3 py-2">
                    <p className="text-xs font-semibold text-ink-2">{label} · {decision.outcome === 'APPROVED' ? 'Đã duyệt' : 'Yêu cầu bổ sung'}</p>
                    {decision.reason ? <p className="mt-1 whitespace-pre-line text-sm text-ink">{decision.reason}</p> : null}
                    <ActorLine actorId={decision.actorId} at={decision.createdAt} />
                  </div>
                );
              })}
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
};
