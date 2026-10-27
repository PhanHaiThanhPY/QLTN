import { useState } from 'react';
import { AttachmentList } from '@/components/common/AttachmentList';
import { Notice } from '@/components/common/Notice';
import { PageHeader } from '@/components/common/PageHeader';
import { ReasonDialog } from '@/components/common/ReasonDialog';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/States';
import { Badge, StatusPill } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { hasCapability } from '@/domain/permissions';
import { useCommand } from '@/hooks/useCommand';
import { useOnline } from '@/hooks/useOnline';
import { useReferenceData } from '@/hooks/useReferenceData';
import { useServiceQuery } from '@/hooks/useServiceQuery';
import { getTaxMonth, type TaxPayment } from '@/services/fund-api';
import { formatDate, formatDateTime } from '@/utils/date';
import { formatVndText } from '@/utils/money';
import { FigureRow } from '@/features/exploitation/components/FigureRow';
import { shortVnd } from '@/features/exploitation/contract-ui';
import { FundToolbar } from './components/FundToolbar';
import { TaxObligationDialog } from './components/TaxObligationDialog';
import { TaxPaymentDialog } from './components/TaxPaymentDialog';
import { monthText } from './fund-ui';
import { useFundScope } from './useFundScope';

type TaxDialog = 'create' | 'adjust' | 'pay' | TaxPayment | null;

/** "Thuế" (SPEC F-S3 BR-F3-10, BR-F3-11, ui-brief §2.3): the month's obligation as filed and its GNT slips. */
const TaxPage = () => {
  const scope = useFundScope();
  const { data, userName } = useReferenceData();
  const online = useOnline();
  const [dialog, setDialog] = useState<TaxDialog>(null);
  const cancel = useCommand({ successMessage: 'Đã hủy giấy nộp thuế.' });
  const fund = scope.fund;
  const query = useServiceQuery(['fund', 'tax', fund?.id, scope.month], () => (fund ? getTaxMonth(fund.id, scope.month) : Promise.resolve(null)));
  if (scope.isLoading) return <LoadingState rows={4} />;
  if (scope.error) return <ErrorState error={scope.error} onRetry={scope.refetch} />;
  if (!fund || !data?.viewer) return <EmptyState title="Không có quỹ khai thác trong phạm vi của bạn." />;
  const canOperate = hasCapability(data.viewer, 'FUND_OPERATE') && online;
  const tax = query.data;
  const obligation = tax?.obligation ?? null;
  const last = tax?.payments.filter((row) => row.status === 'RECORDED').at(-1);
  const body = () => {
    if (query.isLoading) return <LoadingState rows={3} />;
    if (query.error) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
    if (!tax || !obligation) return <EmptyState title={`Chưa có nghĩa vụ thuế ${monthText(scope.month).toLowerCase()}.`} />;
    return (
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title={`${obligation.code} · ${monthText(scope.month)}`}
            description="Hồ sơ nộp thuế"
            actions={obligation.settled ? <StatusPill tone="good">Đã nộp đủ</StatusPill> : null}
          />
          <CardBody className="space-y-2 pt-0 text-sm">
            <dl className="space-y-1">
              {(
                [
                  ['Theo hồ sơ kế toán', obligation.amountVnd],
                  ['Đã nộp', obligation.paidVnd],
                  ['Còn phải nộp', obligation.remainingVnd],
                ] as const
              ).map(([label, amount]) => (
                <div key={label} className="flex justify-between gap-2">
                  <dt>{label}</dt>
                  <dd className="tabular-nums font-semibold">{formatVndText(amount)}</dd>
                </div>
              ))}
            </dl>
            {obligation.attachmentId && tax.files[obligation.attachmentId] ? <AttachmentList attachments={[tax.files[obligation.attachmentId]]} /> : null}
            <ul className="space-y-1.5 border-t border-line pt-2">
              {tax.payments.map((row) => (
                <li key={row.id} className="flex flex-wrap items-center gap-2">
                  <span className={row.status === 'CANCELLED' ? 'text-ink-3 line-through' : undefined}>
                    {row.code} · Giấy nộp tiền · {formatDate(row.paidOn)} · {formatVndText(row.amountVnd)}
                  </span>
                  {row.status === 'CANCELLED' ? <Badge tone="neutral">Đã hủy</Badge> : null}
                  {canOperate && row.status === 'RECORDED' ? (
                    <Button size="sm" variant="ghost" onClick={() => setDialog(row)}>
                      Hủy
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
            {canOperate ? (
              <div className="flex flex-wrap gap-2 pt-1">
                {obligation.settled ? null : <Button size="sm" onClick={() => setDialog('pay')}>Ghi giấy nộp thuế</Button>}
                <Button size="sm" variant="secondary" onClick={() => setDialog('adjust')}>
                  Điều chỉnh
                </Button>
              </div>
            ) : null}
            {obligation.adjustments.length ? (
              <ol className="space-y-0.5 border-t border-line pt-2 text-xs text-ink-2">
                {obligation.adjustments.map((row) => (
                  <li key={row.at}>
                    {formatVndText(row.fromVnd)} → {formatVndText(row.toVnd)} · {row.reason} · {userName(row.by)} · {formatDateTime(row.at)}
                  </li>
                ))}
              </ol>
            ) : null}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Chứng từ nộp thuế" />
          <CardBody className="space-y-1.5 pt-0 text-sm">
            {last ? (
              <>
                <p className="font-semibold">{last.code}</p>
                <p>Hồ sơ nghĩa vụ {obligation.code}</p>
                <p className="tabular-nums">Số tiền {formatVndText(last.amountVnd)}</p>
                <p>Ngày ghi nhận {formatDate(last.paidOn)}</p>
                <p className="text-ink-2">Giao dịch sao kê: — (F-S4)</p>
                {tax.files[last.attachmentId] ? <AttachmentList attachments={[tax.files[last.attachmentId]]} /> : null}
              </>
            ) : (
              <p className="text-ink-2">Chưa có giấy nộp thuế.</p>
            )}
            <p className="text-xs text-ink-3">Số tiền lấy từ hồ sơ kế toán, không tự áp thuế suất.</p>
          </CardBody>
        </Card>
      </div>
    );
  };
  return (
    <div className="space-y-4">
      <PageHeader
        title="Thuế quỹ khai thác"
        description="Số thuế theo hồ sơ kế toán và giấy nộp thuế (GNT)."
        actions={
          canOperate && tax && !obligation ? <Button onClick={() => setDialog('create')}>Ghi nghĩa vụ thuế</Button> : null
        }
      />
      {online ? null : <Notice tone="warning">Đang mất kết nối — chưa ghi được chứng từ.</Notice>}
      <FundToolbar scope={scope} />
      <FigureRow
        figures={[
          { label: 'Theo hồ sơ', value: obligation ? shortVnd(obligation.amountVnd) : '—' },
          { label: 'Đã nộp', value: obligation ? shortVnd(obligation.paidVnd) : '—' },
          { label: 'Còn nộp', value: obligation ? shortVnd(obligation.remainingVnd) : '—', warn: Boolean(obligation && !obligation.settled) },
          { label: 'Đối chiếu', value: '—', hint: 'F-S4' },
        ]}
      />
      {body()}
      {dialog === 'create' || dialog === 'adjust' ? (
        <TaxObligationDialog
          fundId={fund.id}
          month={scope.month}
          obligation={dialog === 'adjust' && obligation ? obligation : undefined}
          contractIncomeVnd={tax?.contractIncomeVnd ?? '0'}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog === 'pay' && obligation ? <TaxPaymentDialog fundId={fund.id} obligation={obligation} onClose={() => setDialog(null)} /> : null}
      <ReasonDialog
        open={typeof dialog === 'object' && dialog !== null}
        onOpenChange={(open) => (open ? undefined : setDialog(null))}
        title="Hủy giấy nộp thuế"
        description="Sổ quỹ thêm một dòng đảo ngày hôm nay; dòng gốc vẫn còn."
        confirmLabel="Hủy giấy nộp"
        confirmVariant="danger"
        minLength={10}
        isPending={cancel.isPending}
        error={cancel.fieldErrors.reason}
        onConfirm={(reason) => {
          if (typeof dialog !== 'object' || dialog === null) return;
          void cancel
            .execute({ subjectType: 'FUND_TAX', subjectId: dialog.id, expectedVersion: dialog.version, action: 'cancelTaxPayment', payload: { reason } })
            .then((result) => (result ? setDialog(null) : undefined));
        }}
      />
    </div>
  );
};

export default TaxPage;
