import { useState } from 'react';
import { ActionButton } from '@/components/common/ActionButton';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { REPAIR_ACTIONS } from '@/domain/actions';
import { formatVnd, formatVndInput, parseVndInput } from '@/utils/money';
import { useAttachmentDraft } from '../../hooks/useAttachmentDraft';
import { useRecordCommand } from '../../hooks/useRecordCommand';
import { useRepairAction } from '../../hooks/useRepairAction';
import { useRecordContext } from '../../record-context';
import { pickAttachments } from '../../record-utils';
import { AttachmentField } from '../shared/AttachmentField';
import { FieldErrorList } from '../shared/FieldErrorList';
import { MoneyInput } from '@/components/common/MoneyInput';

/** Payment request draft / submit (new revision each submit). Amount must equal the approved amount. */
export const PaymentRequestForm = ({ approvedAmount }: { approvedAmount: number }) => {
  const { detail } = useRecordContext();
  const draft = detail.paymentDraft;
  const save = useRepairAction('savePaymentDraft');
  const submit = useRepairAction('submitPaymentRequest');
  const [amount, setAmount] = useState(formatVndInput(draft?.amountVnd || approvedAmount));
  const files = useAttachmentDraft(pickAttachments(detail.attachments, draft?.attachmentIds ?? []));
  const saveCommand = useRecordCommand({ successMessage: 'Đã lưu đề nghị nháp.' });
  const submitCommand = useRecordCommand({ successMessage: 'Đã gửi đề nghị thanh toán.' });
  if (!save.relevant) return null;
  const payload = { amountVnd: parseVndInput(amount), attachmentIds: files.ids };
  const errors = { ...saveCommand.fieldErrors, ...submitCommand.fieldErrors };
  const isReadOnly = !save.state.allowed;
  const revisionNo = detail.paymentRequests.length + 1;
  return (
    <Card>
      <CardHeader title={`Đề nghị thanh toán (lần ${revisionNo})`} description={`Số tiền phải đúng giá trị đã duyệt: ${formatVnd(approvedAmount)}.`} />
      <CardBody className="space-y-4">
        <Field label="Số tiền đề nghị (VND)" htmlFor="pay-amount" required error={errors.amountVnd}>
          <MoneyInput id="pay-amount" value={amount} onChange={setAmount} disabled={isReadOnly} invalid={Boolean(errors.amountVnd)} />
        </Field>
        <AttachmentField
          label="Tệp đề nghị thanh toán"
          recordId={detail.record.id}
          purpose="PAYMENT_REQUEST"
          items={files.items}
          onAdd={files.add}
          onRemove={files.remove}
          required
          disabled={isReadOnly}
          error={errors.attachmentIds}
        />
        <FieldErrorList errors={errors} exclude={['amountVnd', 'attachmentIds']} />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <ActionButton state={save.state} variant="secondary" isLoading={saveCommand.isPending} onClick={() => void saveCommand.run('savePaymentDraft', payload)}>
            {REPAIR_ACTIONS.savePaymentDraft.label}
          </ActionButton>
          <ActionButton state={submit.state} isLoading={submitCommand.isPending} onClick={() => void submitCommand.run('submitPaymentRequest', payload)}>
            {REPAIR_ACTIONS.submitPaymentRequest.label}
          </ActionButton>
        </div>
      </CardBody>
    </Card>
  );
};
