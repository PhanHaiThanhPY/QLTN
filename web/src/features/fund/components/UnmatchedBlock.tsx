import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import type { LedgerSide, ReconciliationMonth, StatementLine } from '@/services/statement-api';
import { formatDate } from '@/utils/date';
import { signedVnd } from '../fund-ui';
import { RECORD_KIND_TEXT, daysText, pairName } from '../statement-ui';

interface UnmatchedBlockProps {
  view: ReconciliationMonth;
  hidden: ReadonlySet<string>;
  canWrite: boolean;
  busy: boolean;
  onConfirm: (suggestion: ReconciliationMonth['suggestions'][number]) => void;
  onSkip: (lineId: string) => void;
  onMatchLine: (line: StatementLine) => void;
  onMatchEntry: (entry: LedgerSide) => void;
  onRecord: (line: StatementLine) => void;
}

/** BR-F4-05..08, ui-brief §2.1: what is still open — suggestions, bank lines, ledger lines — and what cancels out. */
export const UnmatchedBlock = ({ view, hidden, canWrite, busy, onConfirm, onSkip, onMatchLine, onMatchEntry, onRecord }: UnmatchedBlockProps) => {
  const suggestions = view.suggestions.filter((row) => !hidden.has(row.line.id));
  const suggested = new Set(suggestions.map((row) => row.line.id));
  const lines = view.unmatchedLines.filter((row) => !suggested.has(row.id));
  const open = view.counts.gaps + suggestions.length;
  return (
    <Card>
      <CardHeader title={`Chưa ghép (${view.unmatchedLines.length + view.unmatchedEntries.length})`} />
      <CardBody className="space-y-4 pt-0">
        {open === 0 && view.selfCancelled.length === 0 ? <p className="text-sm text-ink-2">Không còn dòng nào chưa ghép.</p> : null}
        {suggestions.length ? (
          <ul className="space-y-1.5" aria-label="Đề xuất ghép">
            {suggestions.map((row) => (
              <li key={row.line.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-info-soft p-2 text-sm">
                <span>
                  <span className="sr-only">{pairName(row.line)} — đề xuất ghép với {row.entry.sourceCode}</span>
                  <span aria-hidden>
                    {row.line.code} · {formatDate(row.line.txnDate)} · {signedVnd(row.line.direction, row.line.amountVnd)} → {row.entry.sourceCode} ({daysText(row.days)})
                  </span>
                </span>
                {canWrite ? (
                  <span className="flex gap-1">
                    <Button size="sm" isLoading={busy} onClick={() => onConfirm(row)}>
                      Xác nhận
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => onSkip(row.line.id)}>
                      Bỏ qua
                    </Button>
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <section aria-labelledby="open-lines">
            <h3 id="open-lines" className="mb-1 text-sm font-semibold text-ink">
              Sao kê chưa ghép ({lines.length})
            </h3>
            <ul className="space-y-1.5">
              {lines.map((line) => (
                <li key={line.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line p-2 text-sm" title={line.description}>
                  <span className="min-w-0">
                    <span className="font-medium">{line.code}</span> · {formatDate(line.txnDate)} ·{' '}
                    <span className="tabular-nums">{signedVnd(line.direction, line.amountVnd)}</span>
                    <span className="block truncate text-xs text-ink-2">{line.description}</span>
                    {line.possibleDuplicate ? <Badge tone="crit">Có thể trùng</Badge> : null}
                  </span>
                  {canWrite ? (
                    <span className="flex gap-1">
                      <Button size="sm" variant="secondary" onClick={() => onMatchLine(line)}>
                        Ghép…
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => onRecord(line)}>
                        Ghi nhận · {RECORD_KIND_TEXT[line.recordAs]}
                      </Button>
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
          <section aria-labelledby="open-entries">
            <h3 id="open-entries" className="mb-1 text-sm font-semibold text-ink">
              Sổ chưa đối soát ({view.unmatchedEntries.length})
            </h3>
            <ul className="space-y-1.5">
              {view.unmatchedEntries.map((entry) => (
                <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line p-2 text-sm">
                  <span>
                    <span className="font-medium">{entry.sourceCode}</span> · {formatDate(entry.entryDate)} ·{' '}
                    <span className="tabular-nums">{signedVnd(entry.direction, entry.amountVnd)}</span>
                  </span>
                  {canWrite ? (
                    <Button size="sm" variant="secondary" onClick={() => onMatchEntry(entry)}>
                      Ghép…
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        </div>
        {view.selfCancelled.length ? (
          <ul className="space-y-1 text-sm text-ink-3" aria-label="Dòng tự khử">
            {view.selfCancelled.map((entry) => (
              <li key={entry.id}>
                {entry.sourceCode} · {formatDate(entry.entryDate)} · {signedVnd(entry.direction, entry.amountVnd)} <Badge tone="neutral">Tự khử</Badge>
              </li>
            ))}
          </ul>
        ) : null}
      </CardBody>
    </Card>
  );
};
