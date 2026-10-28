import { useState } from 'react';
import { Plus } from 'lucide-react';
import { ReasonDialog } from '@/components/common/ReasonDialog';
import { Button } from '@/components/ui/button';
import type { useCommand } from '@/hooks/useCommand';
import type { InvitationDetail } from '@/services/deposit-api';
import { ExtendDialog } from '@/features/exploitation/components/ExtendDialog';
import { InvitationFormDialog } from './InvitationFormDialog';
import { OfferDialog } from './OfferDialog';
import { SendDialog } from './SendDialog';

type Open = 'edit' | 'send' | 'offer' | 'extend' | 'close' | 'cancel' | null;

interface InvitationActionsProps {
  detail: InvitationDetail;
  command: ReturnType<typeof useCommand>;
  online: boolean;
}

/** BQL actions by state (BR-T1-04, ui-brief §2.2): one primary button; the rest beside it. */
export const InvitationActions = ({ detail, command, online }: InvitationActionsProps) => {
  const [open, setOpen] = useState<Open>(null);
  const { invitation } = detail;
  const show = (next: Open) => {
    command.reset();
    setOpen(next);
  };
  const close = () => setOpen(null);
  const reason = (action: string) => (text: string) =>
    void command
      .execute({ subjectType: 'DEPOSIT_INVITATION', subjectId: invitation.id, expectedVersion: invitation.version, action, payload: { reason: text } })
      .then((result) => (result ? close() : undefined));
  const status = invitation.status;
  const everyoneAnswered = detail.progress.invited > 0 && detail.progress.responded === detail.progress.invited;
  return (
    <>
      {status === 'DRAFT' ? (
        <Button size="sm" disabled={!online} onClick={() => show('send')}>
          Ghi nhận gửi
        </Button>
      ) : null}
      {status === 'OPEN' || status === 'CLOSED' ? (
        <Button size="sm" variant={status === 'OPEN' ? 'primary' : 'secondary'} disabled={!online} onClick={() => show('offer')}>
          <Plus className="h-4 w-4" />
          Ghi nhận bản chào
        </Button>
      ) : null}
      {status === 'DRAFT' || status === 'OPEN' ? (
        <Button size="sm" variant="secondary" disabled={!online} onClick={() => show('edit')}>
          Sửa
        </Button>
      ) : null}
      {status === 'OPEN' ? (
        <>
          <Button size="sm" variant="secondary" disabled={!online} onClick={() => show('extend')}>
            Gia hạn
          </Button>
          <Button size="sm" variant="secondary" disabled={!online || !everyoneAnswered} title={everyoneAnswered ? undefined : 'Mọi ngân hàng được mời cần có bản chào.'} onClick={() => show('close')}>
            Đóng sớm
          </Button>
        </>
      ) : null}
      {status === 'DRAFT' || status === 'OPEN' || status === 'CLOSED' ? (
        <Button size="sm" variant="ghost" disabled={!online} onClick={() => show('cancel')}>
          Hủy thư
        </Button>
      ) : null}
      {open === 'edit' ? <InvitationFormDialog detail={detail} onClose={close} /> : null}
      {open === 'send' ? <SendDialog detail={detail} onEdit={() => show('edit')} onClose={close} /> : null}
      {open === 'offer' ? <OfferDialog detail={detail} canEdit onClose={close} /> : null}
      {open === 'extend' ? <ExtendDialog target={invitation} subjectType="DEPOSIT_INVITATION" action="extendDepositInvitation" command={command} onClose={close} /> : null}
      <ReasonDialog
        open={open === 'close'}
        onOpenChange={(isOpen) => (isOpen ? undefined : close())}
        title={`Đóng sớm ${invitation.code}`}
        description="Mọi ngân hàng được mời đã có bản chào; thư chuyển 'Đã hết hạn nhận'."
        confirmLabel="Đóng sớm"
        minLength={10}
        isPending={command.isPending}
        error={command.fieldErrors.reason ?? command.errorMessage ?? undefined}
        onConfirm={reason('closeDepositInvitationEarly')}
      />
      <ReasonDialog
        open={open === 'cancel'}
        onOpenChange={(isOpen) => (isOpen ? undefined : close())}
        title={`Hủy ${invitation.code}`}
        description="Thư bị hủy không nhận bản chào nữa."
        confirmLabel="Hủy thư"
        confirmVariant="danger"
        minLength={10}
        isPending={command.isPending}
        error={command.fieldErrors.reason ?? command.errorMessage ?? undefined}
        onConfirm={reason('cancelDepositInvitation')}
      />
    </>
  );
};
