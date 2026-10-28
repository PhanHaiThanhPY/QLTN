import { useState, type ReactNode } from 'react';
import { Plus } from 'lucide-react';
import { ReasonDialog } from '@/components/common/ReasonDialog';
import { Button } from '@/components/ui/button';
import type { useCommand } from '@/hooks/useCommand';
import type { InvitationDetail, InvitationStatus } from '@/services/deposit-api';
import { ExtendDialog } from '@/features/exploitation/components/ExtendDialog';
import { InvitationFormDialog } from './InvitationFormDialog';
import { OfferDialog } from './OfferDialog';
import { SendDialog } from './SendDialog';

type Open = 'edit' | 'send' | 'offer' | 'extend' | 'close' | 'cancel' | null;

/** The one primary action of a state (ui-brief §0); below 768px it sits in a bar stuck to the bottom (§3). */
const PRIMARY: Partial<Record<InvitationStatus, { label: ReactNode; open: Exclude<Open, null> }>> = {
  DRAFT: { label: 'Ghi nhận gửi', open: 'send' },
  OPEN: {
    label: (
      <>
        <Plus className="h-4 w-4" />
        Ghi nhận bản chào
      </>
    ),
    open: 'offer',
  },
};

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
  const primary = PRIMARY[status];
  const everyoneAnswered = detail.progress.invited > 0 && detail.progress.responded === detail.progress.invited;
  return (
    <>
      {primary ? (
        <Button size="sm" className="hidden md:inline-flex" disabled={!online} onClick={() => show(primary.open)}>
          {primary.label}
        </Button>
      ) : null}
      {status === 'CLOSED' ? (
        <Button size="sm" variant="secondary" disabled={!online} onClick={() => show('offer')}>
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
      {primary ? (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface px-4 py-3 shadow-card md:hidden">
          <Button className="w-full" disabled={!online} onClick={() => show(primary.open)}>
            {primary.label}
          </Button>
        </div>
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
