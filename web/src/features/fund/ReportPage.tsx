import { useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { Notice } from '@/components/common/Notice';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/States';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { NativeSelect } from '@/components/ui/input';
import { useOnline } from '@/hooks/useOnline';
import { useReferenceData } from '@/hooks/useReferenceData';
import { useServiceQuery } from '@/hooks/useServiceQuery';
import { downloadFundReport, getFundReport } from '@/services/report-api';
import { formatDate, formatDateTime } from '@/utils/date';
import { formatVndText } from '@/utils/money';
import { FigureRow } from '@/features/exploitation/components/FigureRow';
import { shortVnd } from '@/features/exploitation/contract-ui';
import { signedVnd } from './fund-ui';
import { ReportPeriodPicker } from './report/ReportPeriodPicker';
import { ReportSideCards } from './report/ReportSideCards';
import { WaterfallChart } from './report/WaterfallChart';
import { useReportScope } from './report/useReportScope';
import { useFundScope } from './useFundScope';

/** "Báo cáo thu chi quỹ" (SPEC F-S5 BR-F5-01..05, ui-brief §2.1, D1 p. 13): BQT and Kế toán. */
const ReportPage = () => {
  const scope = useFundScope();
  const period = useReportScope();
  const { buildingName } = useReferenceData();
  const online = useOnline();
  const [exporting, setExporting] = useState(false);
  const fund = scope.fund;
  const query = { fundId: fund?.id ?? '', kind: period.kind, value: period.value };
  const ready = Boolean(fund?.openingDate);
  const report = useServiceQuery(['fund', 'report', query], () => (fund && ready ? getFundReport(query) : Promise.resolve(null)));
  if (scope.isLoading) return <LoadingState rows={4} />;
  if (scope.error) return <ErrorState error={scope.error} onRetry={scope.refetch} />;
  if (!fund) return <EmptyState title="Không có quỹ khai thác trong phạm vi của bạn." />;
  const view = report.data;
  const printUrl = `/exploitation/report/print?${new URLSearchParams({ building: fund.buildingId, kind: period.kind, value: period.value }).toString()}`;
  const exportXlsx = async () => {
    setExporting(true);
    try {
      const blob = await downloadFundReport(query);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `bao-cao-thu-chi-${view?.period.slug ?? period.value}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success('Đã xuất báo cáo');
    } catch (error) {
      console.error(error);
      toast.error('Không xuất được báo cáo.');
    } finally {
      setExporting(false);
    }
  };
  const body = () => {
    if (!ready) return <EmptyState title="Kế toán chưa thiết lập quỹ khai thác của tòa này." />;
    if (report.isLoading) return <LoadingState rows={6} />;
    if (report.error) return <ErrorState error={report.error} onRetry={() => void report.refetch()} />;
    if (!view) return null;
    const empty = view.ledger.length === 0;
    return (
      <>
        <p className="flex flex-wrap items-center gap-2 text-sm text-ink-2">
          {buildingName(fund.buildingId)} · Quỹ khai thác ·{' '}
          {view.source === 'STATEMENT' ? <Badge tone="good">✓ Theo sao kê · Đã đối soát</Badge> : <Badge tone="warn">⚠ Số liệu theo sổ, chưa đối soát xong</Badge>}
          · Số liệu tính đến {formatDateTime(view.computedAt)}
        </p>
        {view.source === 'LEDGER' && view.unreconciled.length ? (
          <Notice tone="warning">
            <span className="block">Số liệu theo sổ, chưa đối soát xong:</span>
            <ul className="mt-1 space-y-0.5">
              {view.unreconciled.map((row) => (
                <li key={row.month}>
                  <Link className="underline" to={`/exploitation/reconciliation?building=${fund.buildingId}&month=${row.month}`}>
                    Tháng {row.month.slice(5)}/{row.month.slice(0, 4)}
                  </Link>{' '}
                  · {row.differenceVnd === null ? 'chưa có sao kê' : `chênh lệch ${signedVnd(row.differenceVnd.startsWith('-') ? 'OUT' : 'IN', row.differenceVnd.replace(/^-/, ''))}`}
                </li>
              ))}
            </ul>
          </Notice>
        ) : null}
        <FigureRow
          figures={[
            { label: 'Đầu kỳ', value: shortVnd(view.figures.openingVnd) },
            { label: 'Thu', value: shortVnd(view.figures.inVnd) },
            { label: 'Chi', value: shortVnd(view.figures.outVnd) },
            { label: 'Cuối kỳ', value: shortVnd(view.figures.closingVnd) },
          ]}
        />
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[3fr_2fr]">
          <Card>
            <CardHeader title={`${buildingName(fund.buildingId)} · ${view.period.label}`} description="Dòng tiền quỹ khai thác" />
            <CardBody className="pt-0">
              <WaterfallChart figures={view.figures} />
              {empty ? <p className="mt-2 text-sm text-ink-2">Không có khoản thu, chi nào trong kỳ.</p> : null}
            </CardBody>
          </Card>
          <ReportSideCards report={view} />
        </div>
        <Card>
          <CardHeader title="Nguồn hình thành" />
          <CardBody className="space-y-2 pt-0">
            {view.sources.map((row) => (
              <details key={`${row.direction}-${row.category}`} className="rounded-lg border border-line p-2 text-sm">
                <summary className="flex cursor-pointer justify-between gap-2">
                  <span>
                    {row.direction === 'IN' ? 'Thu' : 'Chi'} · {row.label}
                  </span>
                  <span className="tabular-nums font-semibold">{signedVnd(row.direction, row.amountVnd)}</span>
                </summary>
                <ul className="mt-2 space-y-1 text-ink-2">
                  {row.documents.map((doc) => (
                    <li key={doc.entryId}>
                      {formatDate(doc.date)} · {doc.code} · {doc.description} · <span className="tabular-nums">{formatVndText(doc.amountVnd)}</span>
                      {doc.statementCode ? ` · ${doc.statementCode}` : ''}
                    </li>
                  ))}
                </ul>
              </details>
            ))}
            {view.byContract.length ? (
              <table className="mt-2 w-full text-left text-sm">
                <caption className="text-left font-semibold text-ink">Thu theo hợp đồng</caption>
                <thead>
                  <tr className="border-b border-line-2 text-xs uppercase tracking-wide text-ink-3">
                    <th scope="col" className="py-1 pr-3">Mã</th>
                    <th scope="col" className="py-1 pr-3">Đơn vị</th>
                    <th scope="col" className="py-1 text-right">Số tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {view.byContract.map((row) => (
                    <tr key={row.contractId} className="border-b border-line">
                      <td className="py-1 pr-3">
                        <Link to={`/exploitation/contracts/${row.contractId}?tab=receipts`} className="text-accent hover:underline">
                          {row.code}
                        </Link>
                      </td>
                      <td className="py-1 pr-3">{row.partner}</td>
                      <td className="py-1 text-right tabular-nums">
                        {formatVndText(row.amountVnd)}
                        {row.offsetVnd !== '0' ? <span className="block text-xs text-ink-3">trong đó cấn trừ cọc {formatVndText(row.offsetVnd)}</span> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
            <Link to={`/exploitation/fund?building=${fund.buildingId}&month=${view.period.from.slice(0, 7)}`} className="inline-block text-sm text-accent hover:underline">
              Chi tiết sổ ›
            </Link>
          </CardBody>
        </Card>
      </>
    );
  };
  return (
    <div className="space-y-4">
      <PageHeader
        title="Báo cáo thu chi quỹ"
        description="Một tòa, một quỹ khai thác; số theo sao kê khi đã đối soát xong."
        actions={
          <>
            <Button variant="secondary" disabled={!online || !view} onClick={() => window.open(printUrl, '_blank', 'noopener')}>
              In
            </Button>
            <Button isLoading={exporting} disabled={!online || !view} onClick={() => void exportXlsx()}>
              Xuất thu chi · XLSX
            </Button>
          </>
        }
      />
      {online ? null : <Notice tone="warning">Đang mất kết nối.</Notice>}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Tòa" htmlFor="rp-building">
          <NativeSelect id="rp-building" value={fund.buildingId} onChange={(event) => scope.setBuilding(event.target.value)}>
            {scope.funds.map((row) => (
              <option key={row.id} value={row.buildingId}>
                {buildingName(row.buildingId)}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <ReportPeriodPicker kind={period.kind} value={period.value} onKind={period.setKind} onValue={period.setValue} />
      </div>
      {body()}
    </div>
  );
};

export default ReportPage;
