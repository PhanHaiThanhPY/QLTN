import { useState } from 'react';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { ReasonDialog } from '@/components/common/ReasonDialog';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/States';
import { StatusPill } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, Td, Th, Tr } from '@/components/ui/table';
import { hasCapability } from '@/domain/permissions';
import { useCommand } from '@/hooks/useCommand';
import { useOnline } from '@/hooks/useOnline';
import { useReferenceData } from '@/hooks/useReferenceData';
import { useServiceQuery } from '@/hooks/useServiceQuery';
import { listBanks, type Bank } from '@/services/deposit-api';
import { BankDialog } from './components/BankDialog';

type Editing = { kind: 'form'; bank?: Bank } | { kind: 'stop'; bank: Bank } | null;

const StatePill = ({ bank }: { bank: Bank }) =>
  bank.active ? <StatusPill tone="good">Đang dùng</StatusPill> : <StatusPill tone="neutral">Ngừng dùng</StatusPill>;

/** "Ngân hàng" (SPEC T-S1 BR-T1-01, ui-brief §2.4): one catalogue for every building. */
const BanksPage = () => {
  const { data } = useReferenceData();
  const online = useOnline();
  const query = useServiceQuery(['deposit', 'banks', 'all'], () => listBanks(true));
  const stop = useCommand({ successMessage: 'Đã ngừng dùng ngân hàng.' });
  const [editing, setEditing] = useState<Editing>(null);
  const canManage = Boolean(data?.viewer && hasCapability(data.viewer, 'DEPOSIT_MANAGE'));
  const rows = query.data ?? [];

  const actions = (bank: Bank) =>
    canManage && bank.active ? (
      <div className="flex gap-1.5">
        <Button size="sm" variant="secondary" disabled={!online} onClick={() => setEditing({ kind: 'form', bank })}>
          Sửa
        </Button>
        <Button size="sm" variant="ghost" disabled={!online} onClick={() => setEditing({ kind: 'stop', bank })}>
          Ngừng dùng
        </Button>
      </div>
    ) : null;

  const body = () => {
    if (query.isLoading) return <LoadingState />;
    if (query.error) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
    if (rows.length === 0) return <EmptyState title="Chưa có ngân hàng nào." />;
    return (
      <>
        <Table>
          <thead>
            <tr>
              <Th scope="col" className="w-24">Mã</Th>
              <Th scope="col" className="min-w-48">Tên</Th>
              <Th scope="col">Viết tắt</Th>
              <Th scope="col">Chi nhánh</Th>
              <Th scope="col">Người liên hệ</Th>
              <Th scope="col">Số thư đã mời</Th>
              <Th scope="col">Trạng thái</Th>
              <Th scope="col"><span className="sr-only">Thao tác</span></Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((bank) => (
              <Tr key={bank.id}>
                <Td className="font-medium text-ink">{bank.code}</Td>
                <Td className="min-w-48">{bank.name}</Td>
                <Td>{bank.shortName ?? '—'}</Td>
                <Td>{bank.branch ?? '—'}</Td>
                <Td className="text-xs text-ink-2">
                  {bank.contactName ?? '—'}
                  {bank.phone ? <div>{bank.phone}</div> : null}
                </Td>
                <Td className="tabular-nums">{bank.invitationCount}</Td>
                <Td>
                  <StatePill bank={bank} />
                </Td>
                <Td>{actions(bank)}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
        <ul className="space-y-2 md:hidden">
          {rows.map((bank) => (
            <li key={bank.id} className="rounded-lg border border-line bg-surface p-3">
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium text-ink">
                  {bank.code} · {bank.name}
                </span>
                <StatePill bank={bank} />
              </div>
              <p className="mt-1 text-sm text-ink-2">
                {bank.branch ?? 'Chưa ghi chi nhánh'} · {bank.invitationCount} thư đã mời
              </p>
              <div className="mt-2">{actions(bank)}</div>
            </li>
          ))}
        </ul>
      </>
    );
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Ngân hàng"
        description="Danh mục dùng chung cho mọi tòa. Ngân hàng ngừng dùng không mời được ở thư mới."
        actions={
          canManage ? (
            <Button disabled={!online} onClick={() => setEditing({ kind: 'form' })}>
              <Plus className="h-4 w-4" />
              Thêm ngân hàng
            </Button>
          ) : null
        }
      />
      {body()}
      {editing?.kind === 'form' ? <BankDialog bank={editing.bank} onClose={() => setEditing(null)} /> : null}
      <ReasonDialog
        open={editing?.kind === 'stop'}
        onOpenChange={(open) => (open ? undefined : setEditing(null))}
        title={`Ngừng dùng ${editing?.bank?.code ?? ''}`}
        description="Ngân hàng vẫn hiện ở các thư cũ."
        confirmLabel="Ngừng dùng"
        confirmVariant="danger"
        isPending={stop.isPending}
        error={stop.fieldErrors.reason}
        onConfirm={(reason) => {
          if (editing?.kind !== 'stop') return;
          void stop
            .execute({ subjectType: 'DEPOSIT_BANK', subjectId: editing.bank.id, expectedVersion: editing.bank.version, action: 'deactivateDepositBank', payload: { reason } })
            .then((result) => (result ? setEditing(null) : undefined));
        }}
      />
    </div>
  );
};

export default BanksPage;
