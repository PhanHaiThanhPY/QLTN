import { Badge } from '@/components/ui/badge';
import type { ReconciliationMonth } from '@/services/statement-api';
import { formatDate } from '@/utils/date';
import { formatVndText } from '@/utils/money';
import { monthBoundsLast } from '../reconciliation-dates';

const signed = (amount: string): string => (amount.startsWith('-') ? `−${formatVndText(amount.slice(1))}` : `${amount === '0' ? '' : '+'}${formatVndText(amount)}`);

/**
 * BR-F4-10 status of the month (D1 p. 12): "k/n khớp · Chênh lệch X đ · Lệch/trùng a/b", read out when it changes;
 * a difference names the day and both balances (ui-brief §2.1).
 */
export const StatementStatus = ({ view }: { view: ReconciliationMonth }) => {
  const { counts } = view;
  const noStatement = view.statement.closingVnd === null;
  const differs = view.differenceVnd !== null && view.differenceVnd !== '0';
  const badge = () => {
    if (noStatement) return <Badge tone="neutral">Chưa có sao kê</Badge>;
    return view.matchedMonth ? <Badge tone="good">✓ Đã khớp</Badge> : <Badge tone="warn">Còn lệch</Badge>;
  };
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
      <p className="flex flex-wrap items-center gap-2 text-sm" aria-live="polite">
        {badge()}
        <span className="tabular-nums">
          {counts.matched}/{counts.lines} khớp
        </span>
        <span aria-hidden>·</span>
        {view.differenceVnd === null ? (
          <span>Chênh lệch: chưa có sao kê</span>
        ) : (
          <span className={differs ? 'font-semibold text-crit' : undefined}>
            {differs ? '⚠ ' : ''}Chênh lệch {signed(view.differenceVnd)}
          </span>
        )}
        <span aria-hidden>·</span>
        <span className="tabular-nums">
          Lệch/trùng {counts.gaps}/{counts.duplicates}
        </span>
      </p>
      <p className="text-xs text-ink-3">Chỉ tính giao dịch thực nhận, thực chi.</p>
      {differs && view.ledgerClosingVnd !== null && view.statement.closingVnd !== null ? (
        <p className="text-sm text-crit sm:basis-full">
          Tại {formatDate(monthBoundsLast(view.month))}: Theo sổ {formatVndText(view.ledgerClosingVnd)} · Theo sao kê{' '}
          {formatVndText(view.statement.closingVnd)} · Chênh lệch {signed(view.differenceVnd as string)}
        </p>
      ) : null}
    </div>
  );
};
