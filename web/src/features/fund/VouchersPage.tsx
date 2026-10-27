import { useState } from 'react';
import { Link } from 'react-router';
import { Notice } from '@/components/common/Notice';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/States';
import { StatusPill } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { Table, Td, Th, Tr } from '@/components/ui/table';
import { hasCapability } from '@/domain/permissions';
import { useOnline } from '@/hooks/useOnline';
import { useReferenceData } from '@/hooks/useReferenceData';
import { useServiceQuery } from '@/hooks/useServiceQuery';
import { listVouchers } from '@/services/fund-api';
import { formatVndText } from '@/utils/money';
import { FigureRow } from '@/features/exploitation/components/FigureRow';
import { shortVnd } from '@/features/exploitation/contract-ui';
import { FundToolbar } from './components/FundToolbar';
import { VoucherFormDialog } from './components/VoucherFormDialog';
import { VOUCHER_CATEGORY_TEXT, VOUCHER_STATUS_TEXT, VOUCHER_STATUS_TONE } from './fund-ui';
import { useFundScope } from './useFundScope';

/** "Phiếu chi" (SPEC F-S3 BR-F3-12, ui-brief §2.4): the fund's vouchers; Kế toán drafts, BQT decides. */
const VouchersPage = () => {
  const scope = useFundScope();
  const { data } = useReferenceData();
  const online = useOnline();
  const [creating, setCreating] = useState(false);
  const fund = scope.fund;
  const query = useServiceQuery(['fund', 'vouchers', fund?.id, scope.month], () => (fund ? listVouchers(fund.id, scope.month) : Promise.resolve(null)));
  if (scope.isLoading) return <LoadingState rows={4} />;
  if (scope.error) return <ErrorState error={scope.error} onRetry={scope.refetch} />;
  if (!fund || !data?.viewer) return <EmptyState title="Không có quỹ khai thác trong phạm vi của bạn." />;
  const canOperate = hasCapability(data.viewer, 'FUND_OPERATE');
  const rows = query.data?.rows ?? [];
  const counts = query.data?.counts;
  const body = () => {
    if (query.isLoading) return <LoadingState />;
    if (query.error) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
    if (rows.length === 0) return <EmptyState title="Chưa có phiếu chi nào." />;
    return (
      <>
        <Table>
          <thead>
            <tr>
              <Th scope="col" className="w-24">Mã</Th>
              <Th scope="col">Nhóm chi</Th>
              <Th scope="col" className="min-w-56">Nội dung</Th>
              <Th scope="col">Người nhận</Th>
              <Th scope="col" className="text-right">Số tiền</Th>
              <Th scope="col">Trạng thái</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <Tr key={row.id}>
                <Td>
                  <Link to={`/exploitation/vouchers/${row.id}`} className="font-medium text-accent hover:underline">
                    {row.code}
                  </Link>
                </Td>
                <Td>{VOUCHER_CATEGORY_TEXT[row.category]}</Td>
                <Td className="min-w-56">{row.content}</Td>
                <Td>{row.payeeName}</Td>
                <Td className="text-right tabular-nums">{formatVndText(row.amountVnd)}</Td>
                <Td>
                  <StatusPill tone={VOUCHER_STATUS_TONE[row.status]}>{`${row.status === 'PAID' ? '✓ ' : ''}${VOUCHER_STATUS_TEXT[row.status]}`}</StatusPill>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
        <ul className="space-y-2 md:hidden">
          {rows.map((row) => (
            <li key={row.id}>
              <Link to={`/exploitation/vouchers/${row.id}`} className="block rounded-lg border border-line bg-surface p-3 hover:border-accent">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium text-accent">{row.code}</span>
                  <StatusPill tone={VOUCHER_STATUS_TONE[row.status]}>{VOUCHER_STATUS_TEXT[row.status]}</StatusPill>
                </div>
                <p className="mt-1 text-sm text-ink">{row.content}</p>
                <p className="text-sm tabular-nums font-semibold">{formatVndText(row.amountVnd)}</p>
              </Link>
            </li>
          ))}
        </ul>
      </>
    );
  };
  return (
    <div className="space-y-4">
      <PageHeader
        title="Phiếu chi quỹ khai thác"
        description="Mọi khoản chi của quỹ qua BQT duyệt; chỉ phiếu đã chi mới ghi vào sổ quỹ."
        actions={canOperate ? <Button disabled={!online || !fund.openingDate} onClick={() => setCreating(true)}>Lập phiếu chi</Button> : null}
      />
      {online ? null : <Notice tone="warning">Đang mất kết nối — chưa ghi được chứng từ.</Notice>}
      <FundToolbar scope={scope} />
      <FigureRow
        figures={[
          { label: 'Chờ duyệt', value: counts?.pending ?? '—', warn: Boolean(counts?.pending) },
          { label: 'Đã duyệt chờ chi', value: counts?.approved ?? '—' },
          { label: 'Đã chi trong tháng', value: counts ? shortVnd(counts.paidThisMonthVnd) : '—' },
          { label: 'Bị từ chối', value: counts?.rejected ?? '—' },
        ]}
      />
      <Card className="shadow-none">
        <CardBody className="p-0 md:p-0">{body()}</CardBody>
      </Card>
      {creating ? <VoucherFormDialog fundId={fund.id} onClose={() => setCreating(false)} /> : null}
    </div>
  );
};

export default VouchersPage;
