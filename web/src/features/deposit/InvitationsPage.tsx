import { useState } from 'react';
import { Link } from 'react-router';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Notice } from '@/components/common/Notice';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/States';
import { StatusPill } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, Td, Th, Tr } from '@/components/ui/table';
import { hasCapability } from '@/domain/permissions';
import { useOnline } from '@/hooks/useOnline';
import { useReferenceData } from '@/hooks/useReferenceData';
import { useServiceQuery } from '@/hooks/useServiceQuery';
import { listInvitations, type InvitationRow } from '@/services/deposit-api';
import { formatVndText } from '@/utils/money';
import { FigureRow } from '@/features/exploitation/components/FigureRow';
import { shortVnd } from '@/features/exploitation/contract-ui';
import { formatVnDateTime } from '@/features/exploitation/exploitation-ui';
import { InvitationFormDialog } from './components/InvitationFormDialog';
import { INVITATION_STATUS_TEXT, INVITATION_STATUS_TONE, remainingText } from './deposit-ui';

const SOON_MS = 2 * 24 * 3_600_000;

const StatusCell = ({ row }: { row: InvitationRow }) => (
  <span className={row.status === 'CANCELLED' ? 'text-ink-3' : undefined}>
    <StatusPill tone={INVITATION_STATUS_TONE[row.status]}>{INVITATION_STATUS_TEXT[row.status]}</StatusPill>
  </span>
);

/** "Thư mời chào lãi" (SPEC T-S1, ui-brief §2.1): BQL lập; BQT and Kế toán read. */
const InvitationsPage = () => {
  const { data, buildingName } = useReferenceData();
  const online = useOnline();
  const query = useServiceQuery(['deposit', 'invitations'], () => listInvitations());
  const [creating, setCreating] = useState(false);
  const canManage = Boolean(data?.viewer && hasCapability(data.viewer, 'DEPOSIT_MANAGE'));
  const rows = query.data ?? [];
  const now = new Date();
  const year = String(now.getFullYear());
  const open = rows.filter((row) => row.status === 'OPEN');
  const deadlineCell = (row: InvitationRow) =>
    row.deadlineAt ? (
      <>
        {formatVnDateTime(row.deadlineAt)}
        {row.status === 'OPEN' ? <span className="block text-xs text-ink-3">{remainingText(row.deadlineAt, now)}</span> : null}
      </>
    ) : (
      '—'
    );
  const createButton = canManage ? (
    <Button disabled={!online} onClick={() => setCreating(true)}>
      <Plus className="h-4 w-4" />
      Lập thư mời
    </Button>
  ) : null;

  const body = () => {
    if (query.isLoading) return <LoadingState rows={5} />;
    if (query.error) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
    if (rows.length === 0) return <EmptyState title="Chưa có thư mời chào lãi nào." action={createButton} />;
    return (
      <>
        <Table>
          <thead>
            <tr>
              <Th scope="col" className="w-24">Mã</Th>
              <Th scope="col">Tòa</Th>
              <Th scope="col" className="text-right">Số tiền</Th>
              <Th scope="col">Kỳ hạn</Th>
              <Th scope="col">Hạn phản hồi</Th>
              <Th scope="col">Đã phản hồi</Th>
              <Th scope="col">Trạng thái</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <Tr key={row.id}>
                <Td>
                  <Link to={`/deposits/invitations/${row.id}`} className="font-medium text-accent hover:underline">
                    {row.code}
                  </Link>
                </Td>
                <Td>{buildingName(row.buildingId)}</Td>
                <Td className="text-right tabular-nums">{formatVndText(row.amountVnd)}</Td>
                <Td className="tabular-nums">{row.termDays} ngày</Td>
                <Td className="tabular-nums">{deadlineCell(row)}</Td>
                <Td className="tabular-nums">
                  {row.responded}/{row.invited}
                </Td>
                <Td>
                  <StatusCell row={row} />
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
        <ul className="space-y-2 md:hidden">
          {rows.map((row) => (
            <li key={row.id} className="rounded-lg border border-line bg-surface p-3">
              <div className="flex items-start justify-between gap-2">
                <Link to={`/deposits/invitations/${row.id}`} className="font-medium text-accent hover:underline">
                  {row.code} · {buildingName(row.buildingId)}
                </Link>
                <StatusCell row={row} />
              </div>
              <p className="mt-1 text-sm tabular-nums text-ink-2">
                {formatVndText(row.amountVnd)} · {row.termDays} ngày · {row.responded}/{row.invited} đã phản hồi
              </p>
              <p className="text-xs text-ink-3">Hạn phản hồi {deadlineCell(row)}</p>
            </li>
          ))}
        </ul>
      </>
    );
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Thư mời chào lãi" description="Mời ngân hàng chào lãi suất cho tiền gửi quỹ bảo trì; so sánh cùng điều kiện; BQT duyệt ngân hàng được chọn." actions={createButton} />
      {online ? null : <Notice tone="warning">Đang mất kết nối — chưa lưu được thay đổi.</Notice>}
      <FigureRow
        figures={[
          { label: 'Đang nhận bản chào', value: open.length },
          {
            label: 'Sắp hết hạn',
            value: open.filter((row) => row.deadlineAt && new Date(row.deadlineAt).getTime() - now.getTime() <= SOON_MS).length,
            hint: '≤ 2 ngày',
          },
          { label: 'Chờ duyệt kết quả', value: rows.filter((row) => row.selectionStatus === 'PENDING').length },
          {
            label: 'Đã chọn trong năm',
            value: rows.filter((row) => row.status === 'SELECTED' && row.decidedAt?.startsWith(year)).length,
            hint: shortVnd(
              rows
                .filter((row) => row.status === 'SELECTED' && row.decidedAt?.startsWith(year))
                .reduce((total, row) => total + BigInt(row.amountVnd), 0n)
                .toString(),
            ),
          },
        ]}
      />
      {body()}
      {creating ? <InvitationFormDialog onClose={() => setCreating(false)} /> : null}
    </div>
  );
};

export default InvitationsPage;
