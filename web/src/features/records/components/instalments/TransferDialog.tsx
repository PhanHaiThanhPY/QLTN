import { useState } from 'react';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { formatVndString } from '@/domain/quote-proposal';
import { PAYMENT_KIND_LABEL, vndInWords, type PaymentInstalment } from '@/domain/payment';
import { todayVn } from '@/services/runtime';
import { useAttachmentDraft } from '../../hooks/useAttachmentDraft';
import { useRecordCommand } from '../../hooks/useRecordCommand';
import { useRecordContext } from '../../record-context';
import { AttachmentField } from '../shared/AttachmentField';
import { CommandDialog } from '../shared/CommandDialog';
import { FieldErrorList } from '../shared/FieldErrorList';

/** A3 / T21: the transfer of exactly the instalment's amount, dated, referenced and proven; confirmed once. */
export const TransferDialog = ({ payment, onClose }: { payment: PaymentInstalment; onClose: () => void }) => {
  const { detail } = useRecordContext();
  const [transferDate, setTransferDate] = useState(todayVn());
  const [reference, setReference] = useState('');
  const proofs = useAttachmentDraft();
  const action = payment.kind === 'TAM_UNG' ? 'confirmAdvanceTransfer' : 'confirmPaymentTransfer';
  const command = useRecordCommand({ successMessage: 'Đã xác nhận chuyển khoản.', onSuccess: onClose });
  const errors = command.fieldErrors;
  return (
    <CommandDialog
      title={`Xác nhận đã chuyển khoản · ${PAYMENT_KIND_LABEL[payment.kind]} đợt ${payment.seqNo}`}
      description={`Số tiền: ${formatVndString(payment.amountVnd)} (${vndInWords(payment.amountVnd)}). Mỗi đợt chỉ xác nhận một lần.`}
      confirmLabel="Xác nhận đã chuyển khoản"
      isPending={command.isPending}
      onClose={onClose}
      onConfirm={() =>
        void command.run(action, {
          paymentId: payment.id,
          amountVnd: payment.amountVnd,
          transferDate,
          reference: reference.trim(),
          proofAttachmentIds: proofs.ids,
        })
      }
    >
      <Field label="Ngày chuyển khoản" htmlFor="tr-date" required error={errors.transferDate}>
        <Input id="tr-date" type="date" max={todayVn()} value={transferDate} onChange={(event) => setTransferDate(event.target.value)} />
      </Field>
      <Field label="Mã tham chiếu giao dịch" htmlFor="tr-ref" required error={errors.reference}>
        <Input id="tr-ref" maxLength={100} value={reference} onChange={(event) => setReference(event.target.value)} />
      </Field>
      <AttachmentField label="Chứng từ chuyển khoản" recordId={detail.record.id} purpose="PAYMENT_PROOF" items={proofs.items} onAdd={proofs.add} onRemove={proofs.remove} required error={errors.proofAttachmentIds} />
      <FieldErrorList errors={errors} exclude={['transferDate', 'reference', 'proofAttachmentIds']} />
    </CommandDialog>
  );
};
