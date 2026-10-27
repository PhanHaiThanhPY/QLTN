import { Badge, type StatusTone } from '@/components/ui/badge';
import type { RowResult, StatementPreview } from '@/services/statement-api';
import { formatDate } from '@/utils/date';
import { formatVndText } from '@/utils/money';
import { signedVnd } from '../fund-ui';
import { RESULT_TEXT } from '../statement-ui';

const RESULT_TONE: Readonly<Record<RowResult, StatusTone>> = { NEW: 'good', DUPLICATE: 'neutral', POSSIBLE_DUPLICATE: 'crit' } as const;

/**
 * Step 2 of an import (ui-brief §2.2): the lines read with their result, errors by line and column, and the check line
 * "Đầu kỳ + giao dịch = … · Cuối kỳ theo ngân hàng …".
 */
export const StatementPreviewTable = ({ preview, openingVnd, closingVnd }: { preview: StatementPreview; openingVnd: string; closingVnd: string }) => {
  const errorRows = new Map<number, string[]>();
  for (const error of preview.errors) errorRows.set(error.row, [...(errorRows.get(error.row) ?? []), error.message]);
  const computed = (BigInt(openingVnd) + BigInt(preview.sumVnd)).toString();
  const closes = preview.closureGapVnd === '0';
  return (
    <div className="space-y-3">
      {preview.errors.length ? (
        <ul className="space-y-1 rounded-lg border border-crit/40 bg-crit-soft p-3 text-sm text-crit" role="alert" aria-label="Lỗi trong tệp">
          {preview.errors.map((error) => (
            <li key={`${error.row}-${error.column ?? ''}-${error.message}`}>{error.message}</li>
          ))}
        </ul>
      ) : null}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line-2 text-xs uppercase tracking-wide text-ink-3">
              <th scope="col" className="py-2 pr-3">Dòng</th>
              <th scope="col" className="py-2 pr-3">Ngày</th>
              <th scope="col" className="py-2 pr-3">Nội dung</th>
              <th scope="col" className="py-2 pr-3 text-right">Số tiền</th>
              <th scope="col" className="py-2">Kết quả</th>
            </tr>
          </thead>
          <tbody>
            {preview.rows.map((row) => (
              <tr key={row.row} className="border-b border-line" aria-invalid={errorRows.has(row.row) || undefined}>
                <td className="py-2 pr-3">{row.row}</td>
                <td className="py-2 pr-3">{formatDate(row.txnDate)}</td>
                <td className="py-2 pr-3">{row.description}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{signedVnd(row.direction, row.amountVnd)}</td>
                <td className="py-2">
                  <Badge tone={RESULT_TONE[row.result]}>{RESULT_TEXT[row.result]}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="space-y-2 md:hidden">
        {preview.rows.map((row) => (
          <li key={row.row} className="rounded-lg border border-line p-2 text-sm">
            <div className="flex justify-between gap-2">
              <span>
                Dòng {row.row} · {formatDate(row.txnDate)}
              </span>
              <Badge tone={RESULT_TONE[row.result]}>{RESULT_TEXT[row.result]}</Badge>
            </div>
            <p className="text-ink-2">{row.description}</p>
            <p className="tabular-nums">{signedVnd(row.direction, row.amountVnd)}</p>
          </li>
        ))}
      </ul>
      <p className={closes ? 'text-sm text-ink' : 'text-sm font-semibold text-crit'} role="status">
        Đầu kỳ {formatVndText(openingVnd)} + giao dịch {formatVndText(preview.sumVnd)} = {formatVndText(computed)} · Cuối kỳ theo ngân hàng{' '}
        {formatVndText(closingVnd)} {closes ? '✓' : `· Sao kê không khép: lệch ${formatVndText(preview.closureGapVnd.replace(/^-/, ''))}`}
      </p>
      <p className="text-xs text-ink-2">
        Mới {preview.newCount} · Trùng (bỏ qua) {preview.duplicateCount} · Có thể trùng {preview.possibleDuplicateCount}
      </p>
    </div>
  );
};
