import { useState } from 'react';
import { Field } from '@/components/ui/field';
import { Textarea } from '@/components/ui/input';
import { LIMITS } from '@/domain/constants';
import { formatVndString } from '@/domain/quote-proposal';
import { PAYMENT_KIND_LABEL, type PaymentInstalment } from '@/domain/payment';
import { useRecordCommand } from '../../hooks/useRecordCommand';
import { CommandDialog } from '../shared/CommandDialog';
import { FieldErrorList } from '../shared/FieldErrorList';

interface InstalmentDecisionDialogProps {
  payment: PaymentInstalment;
  outcome: 'approve' | 'update';
  stepLabel: string;
  onClose: () => void;
}

/** A2 / T19–T20: the holder of the current PAYMENT step approves, or sends it back with a reason. */
export const InstalmentDecisionDialog = ({ payment, outcome, stepLabel, onClose }: InstalmentDecisionDialogProps) => {
  const [reason, setReason] = useState('');
  const isAdvance = payment.kind === 'TAM_UNG';
  const approve = outcome === 'approve';
  const action = approve ? (isAdvance ? 'approveAdvance' : 'approvePayment') : isAdvance ? 'requestAdvanceUpdate' : 'requestPaymentUpdate';
  const command = useRecordCommand({ successMessage: approve ? 'Đã duyệt.' : 'Đã trả đề nghị.', onSuccess: onClose });
  return (
    <CommandDialog
      title={`${approve ? 'Duyệt' : 'Trả đề nghị'} · ${PAYMENT_KIND_LABEL[payment.kind]} đợt ${payment.seqNo}`}
      description={`${stepLabel}. Số tiền ${formatVndString(payment.amountVnd)}.`}
      confirmLabel={approve ? 'Duyệt' : 'Trả đề nghị'}
      confirmVariant={approve ? 'primary' : 'danger'}
      isPending={command.isPending}
      onClose={onClose}
      onConfirm={() => void command.run(action, { paymentId: payment.id, ...(approve ? {} : { reason: reason.trim() }) })}
    >
      {approve ? (
        <p className="text-sm text-ink-2">Xác nhận duyệt đề nghị này theo bước của bạn trong chuỗi duyệt thanh toán.</p>
      ) : (
        <Field label="Lý do" htmlFor="inst-reason" required hint="5–1000 ký tự." error={command.fieldErrors.reason}>
          <Textarea id="inst-reason" rows={3} maxLength={LIMITS.REASON_MAX} value={reason} onChange={(event) => setReason(event.target.value)} />
        </Field>
      )}
      <FieldErrorList errors={command.fieldErrors} exclude={['reason']} />
    </CommandDialog>
  );
};
