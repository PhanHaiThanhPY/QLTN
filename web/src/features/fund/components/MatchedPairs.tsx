import { MoreHorizontal } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import type { ReconciliationMonth } from '@/services/statement-api';
import { formatDate } from '@/utils/date';
import { signedVnd } from '../fund-ui';
import { pairName } from '../statement-ui';

type Pair = ReconciliationMonth['pairs'][number];

interface MatchedPairsProps {
  pairs: readonly Pair[];
  accountLabel: string;
  canOperate: boolean;
  onUnmatch: (pair: Pair) => void;
}

const amountClass = (direction: 'IN' | 'OUT') => cn('tabular-nums', direction === 'IN' ? 'text-good' : 'text-ink');

/**
 * Two lists side by side (ui-brief §2.1): the statement on the left, the matched documents on the right, one pair per
 * row so the eye reads across; on phones each pair is one card with the statement above its document.
 */
export const MatchedPairs = ({ pairs, accountLabel, canOperate, onUnmatch }: MatchedPairsProps) => (
  <>
    <div className="hidden grid-cols-2 gap-4 md:grid">
      <section aria-labelledby="pairs-statement" className="rounded-xl border border-line bg-surface p-4">
        <h2 id="pairs-statement" className="mb-2 flex justify-between text-xs font-semibold uppercase tracking-wide text-ink-2">
          <span>Sao kê · {accountLabel}</span>
          <span>({pairs.length} giao dịch)</span>
        </h2>
        <ol>
          {pairs.map((pair) => (
            <li key={pair.matchId} className="flex h-11 items-center justify-between gap-2 border-b border-line text-sm" title={pair.line.description}>
              <span className="sr-only">{pairName(pair.line, pair.entry.sourceCode)}</span>
              <span aria-hidden className="font-medium">
                {pair.line.code}
              </span>
              <span aria-hidden className="min-w-0 flex-1 truncate text-ink-2">
                {formatDate(pair.line.txnDate)} · {pair.line.description}
              </span>
              <span aria-hidden className={amountClass(pair.line.direction)}>
                {signedVnd(pair.line.direction, pair.line.amountVnd)}
              </span>
            </li>
          ))}
        </ol>
      </section>
      <section aria-labelledby="pairs-documents" className="rounded-xl border border-line bg-surface p-4">
        <h2 id="pairs-documents" className="mb-2 flex justify-between text-xs font-semibold uppercase tracking-wide text-ink-2">
          <span>Chứng từ đã ghép</span>
          <span>({pairs.length}/{pairs.length} khớp)</span>
        </h2>
        <ol>
          {pairs.map((pair) => (
            <li key={pair.matchId} className="flex h-11 items-center justify-between gap-2 border-b border-line text-sm">
              <span>
                <span className="font-medium">{pair.entry.sourceCode}</span> · Liên kết {pair.line.code}
                {pair.kind === 'RECORDED' ? <Badge tone="info">Ghi nhận từ sao kê</Badge> : null}
              </span>
              <span className="flex items-center gap-1">
                <span aria-label="Đã khớp" className="text-good">
                  ✓
                </span>
                {canOperate && pair.kind === 'MATCH' ? (
                  <Button size="sm" variant="ghost" aria-label={`Bỏ ghép ${pair.line.code}`} onClick={() => onUnmatch(pair)}>
                    <MoreHorizontal className="h-4 w-4" aria-hidden />
                  </Button>
                ) : null}
              </span>
            </li>
          ))}
        </ol>
      </section>
    </div>
    <ul className="space-y-2 md:hidden" aria-label="Các cặp đã ghép">
      {pairs.map((pair) => (
        <li key={pair.matchId} className="rounded-lg border border-line bg-surface p-3 text-sm">
          <span className="sr-only">{pairName(pair.line, pair.entry.sourceCode)}</span>
          <div aria-hidden className="flex justify-between gap-2">
            <span>
              {pair.line.code} · {formatDate(pair.line.txnDate)}
            </span>
            <span className={amountClass(pair.line.direction)}>{signedVnd(pair.line.direction, pair.line.amountVnd)}</span>
          </div>
          <p aria-hidden className="text-ink-2">
            ↓ {pair.entry.sourceCode} ✓
          </p>
          {canOperate && pair.kind === 'MATCH' ? (
            <Button size="sm" variant="ghost" onClick={() => onUnmatch(pair)}>
              Bỏ ghép
            </Button>
          ) : null}
        </li>
      ))}
    </ul>
  </>
);
