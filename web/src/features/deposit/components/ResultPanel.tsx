import { useState } from 'react';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { ReasonDialog } from '@/components/common/ReasonDialog';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { useCommand } from '@/hooks/useCommand';
import type { DepositSelection, InvitationDetail } from '@/services/deposit-api';
import { SELECTION_STATUS_TEXT } from '../deposit-ui';
import { ProposeSelectionDialog } from './ProposeSelectionDialog';
import { SelectionBlock, type Decision, type Editing, type ResultRoles } from './SelectionBlock';

const ACTION = { approve: 'approveDepositSelection', requestChanges: 'requestDepositSelectionChanges', reject: 'rejectDepositSelection' } as const;

/** Tab "Kết quả" (SPEC T-S1 BR-T1-09..11, ui-brief §2.3). */
export const ResultPanel = ({ detail, roles }: { detail: InvitationDetail; roles: ResultRoles }) => {
  const command = useCommand({ successMessage: 'Đã ghi quyết định.' });
  const [editing, setEditing] = useState<Editing>(null);
  const [deciding, setDeciding] = useState<{ selection: DepositSelection; decision: Decision } | null>(null);
  const { invitation, selections } = detail;
  const live = selections.filter((row) => row.status === 'PENDING' || row.status === 'NEEDS_CHANGES' || row.status === 'APPROVED');
  const past = selections.filter((row) => !live.includes(row));
  const decide = async (reason: string | null) => {
    if (!deciding) return;
    const result = await command.execute({
      subjectType: 'DEPOSIT_SELECTION',
      subjectId: deciding.selection.id,
      expectedVersion: deciding.selection.version,
      action: ACTION[deciding.decision],
      payload: { reason },
    });
    if (result) setDeciding(null);
  };
  const empty = () => {
    if (invitation.status === 'DRAFT' || invitation.status === 'OPEN') return <p className="text-sm text-ink-2">Lập kết quả sau khi hết hạn nhận bản chào.</p>;
    if (invitation.status === 'CLOSED' && roles.manage)
      return (
        <Button disabled={!roles.writable} onClick={() => setEditing({ mode: 'propose' })}>
          Lập đề xuất kết quả
        </Button>
      );
    return <p className="text-sm text-ink-2">Chưa có kết quả chọn.</p>;
  };
  return (
    <div className="space-y-4">
      {live.length === 0 ? (
        <Card>
          <CardBody>{empty()}</CardBody>
        </Card>
      ) : null}
      {live.map((selection) => (
        <SelectionBlock key={selection.id} detail={detail} selection={selection} roles={roles} onDecide={(row, decision) => { command.reset(); setDeciding({ selection: row, decision }); }} onEdit={setEditing} />
      ))}
      {past.length ? (
        <details className="text-sm">
          <summary className="cursor-pointer text-ink-2">Kết quả trước ({past.length})</summary>
          <ul className="mt-2 space-y-1 text-ink-2">
            {past.map((row) => (
              <li key={row.id}>
                {row.code} · {row.kind === 'BANK' ? detail.banks[row.bankId ?? '']?.name : 'Không chọn được ngân hàng'} · {SELECTION_STATUS_TEXT[row.status]}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      {editing ? <ProposeSelectionDialog detail={detail} selection={editing.selection} mode={editing.mode} onClose={() => setEditing(null)} /> : null}
      <ConfirmDialog
        open={deciding?.decision === 'approve'}
        onOpenChange={(open) => (open ? undefined : setDeciding(null))}
        title={`Duyệt ${deciding?.selection.code ?? ''}?`}
        confirmLabel="Duyệt"
        isPending={command.isPending}
        onConfirm={() => void decide(null)}
      >
        Thư mời chuyển "{deciding?.selection.kind === 'NONE' ? 'Không có kết quả' : 'Đã chọn ngân hàng'}".
      </ConfirmDialog>
      <ReasonDialog
        open={deciding !== null && deciding.decision !== 'approve'}
        onOpenChange={(open) => (open ? undefined : setDeciding(null))}
        title={deciding?.decision === 'reject' ? 'Từ chối kết quả' : 'Yêu cầu sửa kết quả'}
        confirmLabel="Xác nhận"
        minLength={10}
        isPending={command.isPending}
        error={command.fieldErrors.reason ?? command.errorMessage ?? undefined}
        onConfirm={(reason) => void decide(reason)}
      />
    </div>
  );
};
