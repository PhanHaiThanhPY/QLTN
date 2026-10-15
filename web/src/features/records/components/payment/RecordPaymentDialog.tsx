import { useState } from 'react';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { todayVn } from '@/services/runtime';
import { parseVndInput } from '@/utils/money';
import { useAttachmentDraft } from '../../hooks/useAttachmentDraft';
import { useRecordCommand } from '../../hooks/useRecordCommand';
import { useRecordContext } from '../../record-context';
import { AttachmentField } from '../shared/AttachmentField';
import { CommandDialog } from '../shared/CommandDialog';
import { FieldErrorList } from '../shared/FieldErrorList';
import { MoneyInput } from '@/components/common/MoneyInput';

/** recordPayment: amount, paid date, reference and PAYMENT_PROOF files (demo: one full payment). */
export const RecordPaymentDialog = ({ approvedAmount, onClose }: { approvedAmount: number; onClose: () => void }) => {
  const { detail } = useRecordContext();
  const today = todayVn();
  const [amount, setAmount] = useState(new Intl.NumberFormat('vi-VN').format(approvedAmount));
  const [paidDate, setPaidDate] = useState(today);
  const [reference, setReference] = useState('');
  const proofs = useAttachmentDraft();
  const command = useRecordCommand({ successMessage: 'Đã ghi nhận thanh toán. Rà soát rồi bấm “Đóng hoàn tất”.', onSuccess: onClose });
  return (
    <CommandDialog
      title="Ghi nhận thanh toán"
      description="Demo chỉ thanh toán một lần, đúng đủ số được duyệt."
      confirmLabel="Ghi nhận thanh toán"
      isPending={command.isPending}
      canConfirm={reference.trim().length > 0}
      onClose={onClose}
      onConfirm={() =>
        void command.run('recordPayment', { amountVnd: parseVndInput(amount), paidDate, reference: reference.trim(), attachmentIds: proofs.ids })
      }
    >
      <Field label="Số tiền (VND)" htmlFor="paid-amount" required error={command.fieldErrors.amountVnd}>
        <MoneyInput id="paid-amount" value={amount} onChange={setAmount} invalid={Boolean(command.fieldErrors.amountVnd)} />
      </Field>
      <Field label="Ngày thanh toán" htmlFor="paid-date" required hint="Không được ở tương lai." error={command.fieldErrors.paidDate}>
        <Input id="paid-date" type="date" max={today} value={paidDate} onChange={(event) => setPaidDate(event.target.value)} />
      </Field>
      <Field label="Mã tham chiếu" htmlFor="paid-ref" required error={command.fieldErrors.reference}>
        <Input id="paid-ref" maxLength={100} placeholder="Ví dụ: UNC-2026-0001" value={reference} onChange={(event) => setReference(event.target.value)} />
      </Field>
      <AttachmentField
        label="Chứng từ thanh toán"
        recordId={detail.record.id}
        purpose="PAYMENT_PROOF"
        items={proofs.items}
        onAdd={proofs.add}
        onRemove={proofs.remove}
        required
        error={command.fieldErrors.attachmentIds}
      />
      <FieldErrorList errors={command.fieldErrors} exclude={['amountVnd', 'paidDate', 'reference', 'attachmentIds']} />
    </CommandDialog>
  );
};
