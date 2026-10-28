import { Link } from 'react-router';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/cn';
import type { LedgerPage, LedgerRow } from '@/services/fund-api';
import { formatDate } from '@/utils/date';
import { formatVndText } from '@/utils/money';
import { ReconBadge } from './ReconBadge';
import { Spoken } from './Spoken';
import { CATEGORY_SHORT, CATEGORY_TEXT, DIRECTION_TEXT, signedVnd, spokenVnd } from '../fund-ui';

const sourceLink = (row: LedgerRow, month: string, buildingId: string): string | null => {
  if (row.sourceType === 'VOUCHER') return `/exploitation/vouchers/${row.sourceId}`;
  if (row.sourceType === 'TAX_PAYMENT') return `/exploitation/tax?building=${buildingId}&month=${month}`;
  return row.contractId ? `/exploitation/contracts/${row.contractId}?tab=receipts` : null;
};

const Code = ({ row, month, buildingId }: { row: LedgerRow; month: string; buildingId: string }) => {
  const to = sourceLink(row, month, buildingId);
  return to ? (
    <Link to={to} className="font-medium text-accent hover:underline">
      {row.sourceCode}
    </Link>
  ) : (
    <span className="font-medium">{row.sourceCode}</span>
  );
};

/** BR-F3-04: a cancelled line is struck through; its reversal says what it reverses. */
const Marks = ({ row, codes }: { row: LedgerRow; codes: Map<string, string> }) => (
  <>
    {/* F-S5 BR-F5-10: a deposit offset moves no money, so it has no bank line to match. */}
    {row.internal ? <Badge tone="info">Nội bộ</Badge> : null}
    {row.reversedById ? <Badge tone="neutral">Đã hủy</Badge> : null}
    {row.reversesId ? (
      <Badge tone="neutral">
        <Spoken spoken={`Dòng đảo của ${codes.get(row.reversesId) ?? row.sourceCode}`}>Đảo của {codes.get(row.reversesId) ?? row.sourceCode}</Spoken>
      </Badge>
    ) : null}
  </>
);

const Amount = ({ row }: { row: LedgerRow }) => (
  <Spoken spoken={spokenVnd(row.amountVnd, row.direction)} className={cn('tabular-nums', row.direction === 'IN' ? 'text-good' : 'text-ink')}>
    {signedVnd(row.direction, row.amountVnd)}
  </Spoken>
);

/**
 * The month's ledger (ui-brief §2.1): opening (or "Số dư đầu") first, the total "Cuối kỳ" in the footer; on phones one
 * card per line with the closing kept at the bottom. Every balance is "theo sổ".
 */
export const LedgerTable = ({ page }: { page: LedgerPage }) => {
  const figures = page.figures;
  if (!figures) return null;
  const codes = new Map(page.rows.map((row) => [row.id, row.sourceCode]));
  const first = page.openingLine
    ? { date: page.openingLine.date, label: 'Số dư đầu', amount: page.openingLine.amountVnd }
    : { date: `${page.month}-01`, label: 'Đầu kỳ', amount: figures.openingVnd };
  const buildingId = page.fund.buildingId;
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Sổ quỹ {page.month}, số liệu theo sổ</caption>
          <thead>
            <tr className="border-b border-line-2 text-xs uppercase tracking-wide text-ink-3">
              <th scope="col" className="py-2 pr-3">Ngày</th>
              <th scope="col" className="py-2 pr-3">Chứng từ</th>
              <th scope="col" className="py-2 pr-3">Nội dung</th>
              <th scope="col" className="py-2 pr-3">Nhóm</th>
              <th scope="col" className="py-2 pr-3 text-right">Số tiền</th>
              <th scope="col" className="hidden py-2 lg:table-cell">Đối soát</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-line">
              <td className="py-2 pr-3">{formatDate(first.date)}</td>
              <td className="py-2 pr-3">—</td>
              <td className="py-2 pr-3 font-medium">{first.label}</td>
              <td className="py-2 pr-3" />
              <td className="py-2 pr-3 text-right tabular-nums">{formatVndText(first.amount)}</td>
              <td className="hidden lg:table-cell" />
            </tr>
            {page.rows.map((row) => (
              <tr key={row.id} className={cn('border-b border-line', row.reversedById ? 'text-ink-3' : undefined)}>
                <td className="py-2 pr-3">{formatDate(row.entryDate)}</td>
                <td className="py-2 pr-3">
                  <Code row={row} month={page.month} buildingId={buildingId} />
                </td>
                <td className="py-2 pr-3">
                  <span className={row.reversedById ? 'line-through' : undefined}>{row.description}</span>
                  <span className="ml-2 inline-flex gap-1 align-middle">
                    <Marks row={row} codes={codes} />
                  </span>
                  <span className="mt-1 block lg:hidden">
                    {row.internal ? null : <ReconBadge code={row.statementCode} />}
                  </span>
                </td>
                <td className="py-2 pr-3">
                  <span title={CATEGORY_TEXT[row.category]}>{CATEGORY_SHORT[row.category]}</span>
                  <span className="sr-only"> · {DIRECTION_TEXT[row.direction]}</span>
                </td>
                <td className="py-2 pr-3 text-right">
                  <Amount row={row} />
                </td>
                <td className="hidden py-2 lg:table-cell">
                  {row.internal ? null : <ReconBadge code={row.statementCode} />}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-semibold">
              <th scope="row" colSpan={4} className="py-2 pr-3">
                Cuối kỳ (theo sổ)
              </th>
              <td className="py-2 pr-3 text-right tabular-nums">
                <Spoken spoken={spokenVnd(figures.closingVnd)}>{formatVndText(figures.closingVnd)}</Spoken>
              </td>
              <td className="hidden lg:table-cell" />
            </tr>
          </tfoot>
        </table>
      </div>
      <ul className="space-y-2 md:hidden" aria-label={`Sổ quỹ ${page.month}`}>
        <li className="rounded-lg border border-line p-3 text-sm">
          <div className="flex justify-between gap-2">
            <span>{formatDate(first.date)} · {first.label}</span>
            <span className="tabular-nums font-semibold">{formatVndText(first.amount)}</span>
          </div>
        </li>
        {page.rows.map((row) => (
          <li key={row.id} className={cn('rounded-lg border border-line p-3 text-sm', row.reversedById ? 'text-ink-3' : undefined)}>
            <div className="flex items-start justify-between gap-2">
              <span>
                {formatDate(row.entryDate)} · <Code row={row} month={page.month} buildingId={buildingId} />
              </span>
              <span className="text-base font-semibold">
                <Amount row={row} />
              </span>
            </div>
            <p className={row.reversedById ? 'line-through' : undefined}>{row.description}</p>
            <p className="mt-1 flex flex-wrap gap-1 text-xs text-ink-2">
              {DIRECTION_TEXT[row.direction]} · {CATEGORY_TEXT[row.category]} <Marks row={row} codes={codes} />
              {row.internal ? null : <ReconBadge code={row.statementCode} />}
            </p>
          </li>
        ))}
        <li className="sticky bottom-0 rounded-lg bg-surface-2 p-3 text-sm font-semibold">
          Cuối kỳ (theo sổ) {formatVndText(figures.closingVnd)}
        </li>
      </ul>
      {page.rows.length === 0 ? <p className="mt-2 text-sm text-ink-2">Không có khoản thu, chi nào trong tháng.</p> : null}
    </>
  );
};
