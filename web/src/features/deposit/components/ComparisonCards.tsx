import { Notice } from '@/components/common/Notice';
import { StatusPill } from '@/components/ui/badge';
import { spokenRate } from '@/domain/deposit';
import { cn } from '@/lib/cn';
import type { ComparisonRow } from '@/services/deposit-api';
import { formatVndText } from '@/utils/money';
import { paymentText, rateText } from '../deposit-ui';

interface ComparisonCardsProps {
  rows: readonly ComparisonRow[];
  amountVnd: string;
  termDays: number;
  mixedBasis: boolean;
  /** The approved (or proposed) bank's offer, framed "Được chọn" (D1 p. 34). */
  selectedOfferId?: string | null;
  /** Radio mode in the proposal dialog: only complete offers can be picked. */
  pick?: { value: string | null; onChange: (offerId: string) => void };
  compact?: boolean;
}

/** One card per offer, ranked by the interest of the term (BR-T1-08, ui-brief §2.3); flags always carry words. */
export const ComparisonCards = ({ rows, amountVnd, termDays, mixedBasis, selectedOfferId = null, pick, compact = false }: ComparisonCardsProps) => {
  if (rows.length === 0) return <p className="text-sm text-ink-2">Chưa có ngân hàng nào gửi bản chào.</p>;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-ink-2">
          Cùng điều kiện: <span className="tabular-nums font-semibold text-ink">{formatVndText(amountVnd)}</span> · {termDays} ngày
        </p>
      </div>
      {mixedBasis ? <Notice tone="warning">Các bản chào dùng cơ sở tính ngày khác nhau; lãi cả kỳ tính theo cơ sở của từng bản.</Notice> : null}
      <ol className={cn('grid grid-cols-1 gap-3 md:grid-cols-2', compact ? 'xl:grid-cols-3' : 'lg:grid-cols-3')} role={pick ? 'radiogroup' : undefined} aria-label={pick ? 'Chọn bản chào' : 'Bảng so sánh bản chào'}>
        {rows.map((row) => {
          const selected = row.offerId === selectedOfferId;
          const locked = row.completeness !== 'COMPLETE';
          const checked = pick?.value === row.offerId;
          const muted = locked || row.isLate;
          const content = (
            <>
              <div className="flex items-start justify-between gap-2">
                <span className="font-semibold text-ink">
                  #{row.rank} {row.bankName}
                </span>
                {selected ? <StatusPill tone="good">Được chọn</StatusPill> : null}
              </div>
              <p className={cn('text-sm tabular-nums', muted ? 'text-ink-2' : 'text-ink')}>
                <span aria-hidden>{rateText(row.rateMilli)}</span>
                <span className="sr-only">{spokenRate(row.rateMilli)}</span> · cơ sở {row.dayBasis}
              </p>
              <p className="text-sm">
                Lãi cả kỳ <span className="font-semibold tabular-nums text-ink">{formatVndText(row.interestVnd)}</span>
              </p>
              <p className="text-xs text-ink-2">{paymentText(row)}</p>
              <p className="flex flex-wrap gap-1.5">
                <StatusPill tone={locked ? 'warn' : 'good'}>{locked ? 'Thiếu' : 'Đủ hồ sơ'}</StatusPill>
                {row.isLate ? <StatusPill tone="crit">Trễ hạn</StatusPill> : null}
                {row.outside ? <StatusPill tone="info">Ngoài danh sách mời</StatusPill> : null}
              </p>
              {row.missingNote ? <p className="text-xs text-ink-2">Thiếu: {row.missingNote}</p> : null}
            </>
          );
          const frame = cn('h-full space-y-1.5 rounded-xl border bg-surface p-3.5 text-left', selected || checked ? 'border-2 border-good' : 'border-line');
          return (
            <li key={row.offerId}>
              {pick ? (
                <button
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  aria-disabled={locked}
                  aria-describedby={locked ? `locked-${row.offerId}` : undefined}
                  className={cn(frame, 'w-full', locked ? 'cursor-not-allowed opacity-70' : 'hover:border-accent')}
                  onClick={() => (locked ? undefined : pick.onChange(row.offerId))}
                >
                  {content}
                  {locked ? (
                    <span id={`locked-${row.offerId}`} className="block text-xs text-ink-2">
                      Bản chào "Thiếu" không chọn được.
                    </span>
                  ) : null}
                </button>
              ) : (
                <div className={frame}>{content}</div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
};
