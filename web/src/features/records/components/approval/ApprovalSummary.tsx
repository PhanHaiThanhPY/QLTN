import { LIMITS } from '@/domain/constants';
import { formatVnd } from '@/utils/money';

interface ApprovalSummaryProps {
  contractorName: string;
  amountVnd: number;
  attemptNo: number;
}

/** Contractor / amount / attempt shown before approving (spec 11.1). */
export const ApprovalSummary = ({ contractorName, amountVnd, attemptNo }: ApprovalSummaryProps) => (
  <dl className="grid grid-cols-1 gap-3 rounded-lg bg-surface-2 p-3 sm:grid-cols-3">
    <div>
      <dt className="text-xs font-medium text-ink-3">Nhà thầu</dt>
      <dd className="text-sm font-medium text-ink">{contractorName}</dd>
    </div>
    <div>
      <dt className="text-xs font-medium text-ink-3">Số tiền</dt>
      <dd className="text-sm font-semibold text-ink">{formatVnd(amountVnd)}</dd>
    </div>
    <div>
      <dt className="text-xs font-medium text-ink-3">Lần trình</dt>
      <dd className="text-sm font-medium text-ink">
        {attemptNo}/{LIMITS.MAX_SUBMISSION_ATTEMPTS}
      </dd>
    </div>
  </dl>
);
