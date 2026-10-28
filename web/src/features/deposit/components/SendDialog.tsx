import { useState } from 'react';
import { Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useCommand } from '@/hooks/useCommand';
import { todayVn } from '@/services/runtime';
import type { InvitationDetail } from '@/services/deposit-api';
import { formatVnDateTime } from '@/features/exploitation/exploitation-ui';

interface SendDialogProps {
  detail: InvitationDetail;
  onEdit: () => void;
  onClose: () => void;
}

/** "Ghi nhận gửi" (BR-T1-04, ui-brief §2.2): the date sent and what must be there; a missing item links to the form. */
export const SendDialog = ({ detail, onEdit, onClose }: SendDialogProps) => {
  const command = useCommand({ successMessage: 'Đã ghi nhận gửi thư mời.' });
  const today = todayVn();
  const [sentOn, setSentOn] = useState(today);
  const { invitation } = detail;
  const activeInvitees = detail.invitees.filter((bank) => bank.active).length;
  const deadline = invitation.deadlineAt;
  const checks = [
    { key: 'letterAttachmentId', ok: Boolean(invitation.letterAttachmentId), text: 'Tệp thư mời' },
    { key: 'inviteeIds', ok: activeInvitees > 0, text: `Ngân hàng được mời (${activeInvitees})` },
    {
      key: 'deadlineAt',
      ok: Boolean(deadline && new Date(deadline).getTime() > Date.now()),
      text: deadline ? `Hạn phản hồi ${formatVnDateTime(deadline)}, sau bây giờ` : 'Hạn phản hồi',
    },
  ];
  const errors = command.fieldErrors;
  const submit = async () => {
    const result = await command.execute({
      subjectType: 'DEPOSIT_INVITATION',
      subjectId: invitation.id,
      expectedVersion: invitation.version,
      action: 'sendDepositInvitation',
      payload: { sentOn },
    });
    if (result) onClose();
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => (open ? undefined : onClose())}
      title={`Ghi nhận gửi ${invitation.code}`}
      description="Ghi lại việc BQL đã gửi thư cho ngân hàng ngoài hệ thống. Sau khi gửi, số tiền và kỳ hạn không đổi được."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button isLoading={command.isPending} disabled={checks.some((check) => !check.ok) || !sentOn} onClick={() => void submit()}>
            Ghi nhận gửi
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Ngày gửi" htmlFor="send-date" required error={errors.sentOn} hint="Không sau hôm nay.">
          <Input id="send-date" type="date" max={today} value={sentOn} onChange={(event) => setSentOn(event.target.value)} />
        </Field>
        <ul className="space-y-2" aria-label="Danh sách kiểm khi gửi">
          {checks.map((check) => (
            <li key={check.key} className="flex items-center gap-2 text-sm">
              <span className={check.ok ? 'text-good' : 'text-crit'} aria-hidden>
                {check.ok ? <Check className="size-4" /> : <X className="size-4" />}
              </span>
              <span className="flex-1 text-ink">
                {check.text}
                <span className="sr-only">{check.ok ? ': đủ' : ': còn thiếu'}</span>
              </span>
              {check.ok ? null : (
                <Button size="xs" variant="link" onClick={onEdit}>
                  Sửa thư
                </Button>
              )}
              {errors[check.key] ? <span className="text-xs text-crit">{errors[check.key]}</span> : null}
            </li>
          ))}
        </ul>
      </div>
    </Dialog>
  );
};
