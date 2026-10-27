import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ArrowLeft, Printer } from 'lucide-react';
import { ErrorState } from '@/components/common/States';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PrintSheet } from '@/features/records/documents/components/PrintSheet';
import { printDateTime } from '@/features/records/documents/print-format';
import { useReferenceData } from '@/hooks/useReferenceData';
import { useServiceQuery } from '@/hooks/useServiceQuery';
import { listFunds } from '@/services/fund-api';
import { getFundReport, type ReportKind } from '@/services/report-api';
import { formatDate, formatDateTime } from '@/utils/date';
import { formatVndText } from '@/utils/money';
import { WaterfallChart } from './report/WaterfallChart';

const KINDS: readonly ReportKind[] = ['MONTH', 'QUARTER', 'YEAR', 'RANGE'];
const isKind = (value: string | null): value is ReportKind => KINDS.some((kind) => kind === value);

/**
 * The A4 print of the fund report (BR-F5-05, ui-brief §2.2): B7-S1's paper sheet, black on white, the waterfall in
 * shades with its labels, tables, the source label, two empty signature boxes, footer with page numbers.
 */
const ReportPrintPage = () => {
  const [params] = useSearchParams();
  const { buildingName } = useReferenceData();
  const [printedAt] = useState(() => printDateTime(new Date().toISOString()));
  const kindParam = params.get('kind');
  const kind: ReportKind = isKind(kindParam) ? kindParam : 'MONTH';
  const value = params.get('value') ?? '';
  const building = params.get('building') ?? '';
  const funds = useServiceQuery(['fund', 'list'], () => listFunds());
  const fund = funds.data?.find((row) => row.buildingId === building);
  const report = useServiceQuery(['fund', 'report', fund?.id, kind, value], () =>
    fund ? getFundReport({ fundId: fund.id, kind, value }) : Promise.resolve(null),
  );
  if (funds.error || report.error) return <ErrorState error={funds.error ?? report.error} onRetry={() => void report.refetch()} />;
  const view = report.data;
  if (!view) {
    return (
      <main className="mx-auto mt-16 w-[min(210mm,calc(100%-32px))]" aria-busy="true">
        <Skeleton className="h-[297mm] w-full" />
      </main>
    );
  }
  const name = buildingName(view.fund.buildingId);
  const title = `Báo cáo thu chi quỹ khai thác · ${name} · ${view.period.label}`;
  return (
    <div className="d5-page min-h-screen bg-bg px-4 pb-10">
      <div className="d5-no-print sticky top-0 z-10 mx-auto mb-4 flex max-w-[210mm] items-center gap-3 border-b border-line bg-bg py-3">
        <Link
          to={`/exploitation/report?building=${building}&kind=${kind}&value=${encodeURIComponent(value)}`}
          className="inline-flex items-center gap-1 text-sm text-accent hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Về báo cáo
        </Link>
        <p className="min-w-0 flex-1 truncate text-center text-sm font-medium text-ink">{title}</p>
        <Button size="sm" onClick={() => window.print()}>
          <Printer aria-hidden />
          In
        </Button>
      </div>
      <main>
        <PrintSheet title="Báo cáo thu chi" recordCode={`${name} · ${view.period.label}`} printedAt={printedAt}>
          <h1 id="d5-title">Báo cáo thu chi quỹ khai thác</h1>
          <p style={{ textAlign: 'center' }}>
            {name} · {view.period.label}
          </p>
          <p>
            <strong>Nguồn số:</strong> {view.source === 'STATEMENT' ? 'Theo sao kê · Đã đối soát' : 'Số liệu theo sổ, chưa đối soát xong'}
            {view.unreconciled.length
              ? ` (${view.unreconciled.map((row) => `tháng ${row.month.slice(5)}/${row.month.slice(0, 4)}${row.differenceVnd ? ` chênh lệch ${formatVndText(row.differenceVnd)}` : ' chưa có sao kê'}`).join('; ')})`
              : ''}
            . Số liệu tính đến {formatDateTime(view.computedAt)}.
          </p>
          <table className="d5-table">
            <tbody>
              {(
                [
                  ['Đầu kỳ', view.figures.openingVnd],
                  ['Tổng thu', view.figures.inVnd],
                  ['Tổng chi', view.figures.outVnd],
                  ['Cuối kỳ', view.figures.closingVnd],
                ] as const
              ).map(([label, amount]) => (
                <tr key={label}>
                  <th scope="row" style={{ textAlign: 'left' }}>
                    {label}
                  </th>
                  <td style={{ textAlign: 'right' }}>{formatVndText(amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <WaterfallChart figures={view.figures} variant="print" />
          <p className="d5-heading">Nguồn hình thành</p>
          <table className="d5-table">
            <tbody>
              {view.sources.map((row) => (
                <tr key={`${row.direction}-${row.category}`}>
                  <td>
                    {row.direction === 'IN' ? 'Thu' : 'Chi'} · {row.label}
                  </td>
                  <td style={{ textAlign: 'right' }}>{formatVndText(row.amountVnd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="d5-heading">Theo dõi riêng, không cộng vào tiền quỹ</p>
          <table className="d5-table">
            <tbody>
              <tr>
                <td>Còn phải thu</td>
                <td style={{ textAlign: 'right' }}>{formatVndText(view.outstandingVnd)}</td>
              </tr>
              {view.outstanding.map((row) => (
                <tr key={`${row.contractId}-${row.periodNo}`}>
                  <td>
                    {row.code} · {row.partner} · kỳ {row.periodNo} · hạn {formatDate(row.dueDate)}
                    {row.overdueDays > 0 ? ` · quá hạn ${row.overdueDays} ngày` : ''}
                  </td>
                  <td style={{ textAlign: 'right' }}>{formatVndText(row.remainingVnd)}</td>
                </tr>
              ))}
              <tr>
                <td>Tiền cọc đang giữ (nằm trong cuối kỳ)</td>
                <td style={{ textAlign: 'right' }}>{formatVndText(view.depositHeldVnd)}</td>
              </tr>
              <tr>
                <td>Không thu được trong kỳ</td>
                <td style={{ textAlign: 'right' }}>{formatVndText(view.writeOffVnd)}</td>
              </tr>
            </tbody>
          </table>
          {view.byContract.length ? (
            <>
              <p className="d5-heading">Thu theo hợp đồng</p>
              <table className="d5-table">
                <tbody>
                  {view.byContract.map((row) => (
                    <tr key={row.contractId}>
                      <td>
                        {row.code} · {row.partner}
                      </td>
                      <td style={{ textAlign: 'right' }}>{formatVndText(row.amountVnd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : null}
          <table className="d5-table" style={{ marginTop: '1.5em' }}>
            <tbody>
              <tr>
                <th style={{ width: '50%' }}>Người lập</th>
                <th>Ban quản trị</th>
              </tr>
              <tr>
                <td style={{ height: '28mm' }} />
                <td />
              </tr>
            </tbody>
          </table>
        </PrintSheet>
      </main>
    </div>
  );
};

export default ReportPrintPage;
