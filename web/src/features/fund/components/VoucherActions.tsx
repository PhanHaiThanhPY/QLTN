import { useState } from 'react';
import { ReasonDialog } from '@/components/common/ReasonDialog';
import { Button } from '@/components/ui/button';
import type { useCommand } from '@/hooks/useCommand';
import type { Attachment } from '@/domain/types';
import type { Voucher } from '@/services/fund-api';
import { PayVoucherDialog } from './PayVoucherDialog';
import { VoucherFormDialog } from './VoucherFormDialog';

type VoucherDialog = 'edit' | 'pay' | 'requestChanges' | 'reject' | 'cancel' | 'rejectCancel' | null;

interface VoucherActionsProps {
  voucher: Voucher;
  requestFile: Attachment | null;
  canOperate: boolean;
  canApprove: boolean;
  online: boolean;
  command: ReturnType<typeof useCommand>;
}

const REASON_DIALOGS = {
  requestChanges: { title: 'Yêu cầu sửa phiếu chi', confirm: 'Yêu cầu sửa', action: 'requestFundVoucherChanges', danger: false },
  reject: { title: 'Từ chối phiếu chi', confirm: 'Từ chối', action: 'rejectFundVoucher', danger: true },
  cancel: { title: 'Hủy phiếu chi', confirm: 'Hủy phiếu', action: 'cancelFundVoucher', danger: true },
  rejectCancel: { title: 'Từ chối hủy phiếu đã chi', confirm: 'Từ chối hủy', action: 'rejectFundVoucherCancel', danger: false },
} as const;
type ReasonKind = keyof typeof REASON_DIALOGS;
const isReasonKind = (value: VoucherDialog): value is ReasonKind => value !== null && Object.hasOwn(REASON_DIALOGS, value);

/** BR-F3-12 buttons by role and state: Kế toán drafts, sends and pays; BQT decides (ui-brief §2.4). */
export const VoucherActions = ({ voucher, requestFile, canOperate, canApprove, online, command }: VoucherActionsProps) => {
  const [dialog, setDialog] = useState<VoucherDialog>(null);
  const run = (action: string, payload: Record<string, unknown> = {}) =>
    command.execute({ subjectType: 'FUND_VOUCHER', subjectId: voucher.id, expectedVersion: voucher.version, action, payload });
  const open = (next: VoucherDialog) => {
    command.reset();
    setDialog(next);
  };
  const editable = voucher.status === 'DRAFT' || voucher.status === 'NEEDS_CHANGES';
  const reasonDialog = isReasonKind(dialog) ? REASON_DIALOGS[dialog] : null;
  return (
    <>
      {canOperate && editable ? (
        <>
          <Button size="sm" disabled={!online} isLoading={command.isPending} onClick={() => void run('submitFundVoucher')}>
            Gửi duyệt
          </Button>
          <Button size="sm" variant="secondary" disabled={!online} onClick={() => open('edit')}>
            Sửa
          </Button>
        </>
      ) : null}
      {canApprove && voucher.status === 'PENDING' ? (
        <>
          <Button size="sm" disabled={!online} isLoading={command.isPending} onClick={() => void run('approveFundVoucher')}>
            Duyệt
          </Button>
          <Button size="sm" variant="secondary" disabled={!online} onClick={() => open('requestChanges')}>
            Yêu cầu sửa
          </Button>
          <Button size="sm" variant="ghost" disabled={!online} onClick={() => open('reject')}>
            Từ chối
          </Button>
        </>
      ) : null}
      {canOperate && voucher.status === 'APPROVED' ? (
        <Button size="sm" disabled={!online} onClick={() => open('pay')}>
          Ghi đã chi
        </Button>
      ) : null}
      {canApprove && voucher.status === 'PAID' && voucher.cancelRequest ? (
        <>
          <Button size="sm" variant="danger" disabled={!online} isLoading={command.isPending} onClick={() => void run('approveFundVoucherCancel')}>
            Duyệt hủy
          </Button>
          <Button size="sm" variant="secondary" disabled={!online} onClick={() => open('rejectCancel')}>
            Từ chối hủy
          </Button>
        </>
      ) : null}
      {canOperate && (editable || voucher.status === 'APPROVED' || (voucher.status === 'PAID' && !voucher.cancelRequest)) ? (
        <Button size="sm" variant="ghost" disabled={!online} onClick={() => open('cancel')}>
          {voucher.status === 'PAID' ? 'Đề nghị hủy' : 'Hủy phiếu'}
        </Button>
      ) : null}
      {dialog === 'edit' ? <VoucherFormDialog fundId={voucher.fundId} voucher={voucher} requestFile={requestFile} onClose={() => setDialog(null)} /> : null}
      {dialog === 'pay' ? <PayVoucherDialog voucher={voucher} onClose={() => setDialog(null)} /> : null}
      <ReasonDialog
        open={Boolean(reasonDialog)}
        onOpenChange={(isOpen) => (isOpen ? undefined : setDialog(null))}
        title={reasonDialog?.title ?? ''}
        description={dialog === 'cancel' && voucher.status === 'PAID' ? 'Phiếu đã chi: BQT duyệt thì sổ quỹ thêm một dòng đảo.' : undefined}
        confirmLabel={reasonDialog?.confirm ?? ''}
        confirmVariant={reasonDialog?.danger ? 'danger' : 'primary'}
        minLength={10}
        isPending={command.isPending}
        error={command.fieldErrors.reason}
        onConfirm={(reason) => {
          if (!reasonDialog) return;
          void run(reasonDialog.action, { reason }).then((result) => (result ? setDialog(null) : undefined));
        }}
      />
    </>
  );
};
