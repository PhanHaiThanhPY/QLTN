import { useState } from 'react';
import { SignaturePad } from '@/components/common/SignaturePad';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { formatVndInputString, formatVndString, vndDigits } from '@/domain/quote-proposal';
import { vndInWords, type PaymentDraftFields } from '@/domain/payment';
import { useAttachmentDraft } from '../../hooks/useAttachmentDraft';
import { useKnownFiles } from '../../hooks/useKnownFiles';
import { useRecordCommand } from '../../hooks/useRecordCommand';
import { useRecordContext } from '../../record-context';
import { AttachmentField } from '../shared/AttachmentField';
import { CommandDialog } from '../shared/CommandDialog';
import { FieldErrorList } from '../shared/FieldErrorList';

type RequestAction = 'submitAdvanceRequest' | 'resubmitAdvanceRequest' | 'submitPaymentRequest';

interface PaymentRequestDialogProps {
  action: RequestAction;
  initial: PaymentDraftFields;
  /** Settlement: advances already transferred, deducted from the settled total (BR-S4-02). */
  transferredAdvancesVnd?: string;
  onClose: () => void;
}

const TITLE: Record<RequestAction, string> = {
  submitAdvanceRequest: 'Đề nghị tạm ứng',
  resubmitAdvanceRequest: 'Gửi lại đề nghị tạm ứng',
  submitPaymentRequest: 'Đề nghị quyết toán',
};

const SHOWN = ['amountVnd', 'payeeName', 'accountNo', 'bankName', 'transferContent', 'requestAttachmentIds', 'invoiceAttachmentIds', 'signature'] as const;

/** A1 / A1b / T18 (D5-TDN, SPEC §4.4): amount (also in words), payee, transfer content, files and the BQL signature. */
export const PaymentRequestDialog = ({ action, initial, transferredAdvancesVnd = '0', onClose }: PaymentRequestDialogProps) => {
  const { detail } = useRecordContext();
  const isSettlement = action === 'submitPaymentRequest';
  const known = useKnownFiles(detail.attachments);
  const [amount, setAmount] = useState(initial.amountVnd ?? '');
  const [payeeName, setPayeeName] = useState(initial.payeeName ?? '');
  const [accountNo, setAccountNo] = useState(initial.accountNo ?? '');
  const [bankName, setBankName] = useState(initial.bankName ?? '');
  const [transferContent, setTransferContent] = useState(initial.transferContent ?? '');
  const requests = useAttachmentDraft(known.pick(initial.requestAttachmentIds ?? []));
  const invoices = useAttachmentDraft(known.pick(initial.invoiceAttachmentIds ?? []));
  const [signature, setSignature] = useState<string | null>(null);
  const command = useRecordCommand({ successMessage: `Đã gửi ${TITLE[action].toLowerCase()}.`, onSuccess: onClose });
  const errors = command.fieldErrors;
  const instalment = isSettlement && amount ? BigInt(amount) - BigInt(transferredAdvancesVnd) : null;

  return (
    <CommandDialog
      title={TITLE[action]}
      description={isSettlement ? 'Số của đợt quyết toán = số quyết toán − các đợt tạm ứng đã chuyển khoản.' : 'Tạm ứng không làm đổi trạng thái hồ sơ.'}
      confirmLabel="Gửi đề nghị"
      isPending={command.isPending}
      canConfirm={Boolean(signature)}
      onClose={onClose}
      onConfirm={() =>
        void command.run(action, {
          amountVnd: amount,
          payeeName: payeeName.trim(),
          accountNo: accountNo.trim(),
          bankName: bankName.trim(),
          transferContent: transferContent.trim(),
          requestAttachmentIds: requests.ids,
          ...(isSettlement ? { invoiceAttachmentIds: invoices.ids } : {}),
          signature: signature ?? '',
        })
      }
      size="lg"
    >
      <Field label={isSettlement ? 'Số quyết toán (VND)' : 'Số tiền tạm ứng (VND)'} htmlFor="pay-amount" required error={errors.amountVnd} hint={amount ? vndInWords(amount) : undefined}>
        <Input id="pay-amount" inputMode="numeric" value={formatVndInputString(amount)} onChange={(event) => setAmount(vndDigits(event.target.value))} />
      </Field>
      {instalment !== null ? (
        <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm text-ink-2">
          {formatVndString(amount)} − tạm ứng đã chuyển {formatVndString(transferredAdvancesVnd)} ={' '}
          <span className="font-semibold text-ink">{instalment > 0n ? formatVndString(instalment.toString()) : '—'}</span>
        </p>
      ) : null}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Tên tài khoản" htmlFor="pay-payee" required error={errors.payeeName}>
          <Input id="pay-payee" maxLength={200} value={payeeName} onChange={(event) => setPayeeName(event.target.value)} />
        </Field>
        <Field label="Số tài khoản" htmlFor="pay-account" required hint="6–20 chữ số." error={errors.accountNo}>
          <Input id="pay-account" inputMode="numeric" maxLength={20} value={accountNo} onChange={(event) => setAccountNo(event.target.value.replace(/\D/g, ''))} />
        </Field>
        <Field label="Ngân hàng" htmlFor="pay-bank" required error={errors.bankName}>
          <Input id="pay-bank" maxLength={200} value={bankName} onChange={(event) => setBankName(event.target.value)} />
        </Field>
      </div>
      <Field label="Nội dung chuyển khoản" htmlFor="pay-content" hint="Bỏ trống: “BQT «tòa» THANH TOAN CHI PHI «hồ sơ»”." error={errors.transferContent}>
        <Input id="pay-content" maxLength={210} value={transferContent} onChange={(event) => setTransferContent(event.target.value)} />
      </Field>
      <AttachmentField
        label={isSettlement ? 'Công văn đề nghị thanh toán của nhà thầu' : 'Đề nghị tạm ứng của nhà thầu'}
        recordId={detail.record.id}
        purpose="PAYMENT_REQUEST"
        items={requests.items}
        onAdd={requests.add}
        onRemove={requests.remove}
        required
        error={errors.requestAttachmentIds}
      />
      {isSettlement ? (
        <AttachmentField label="Hóa đơn GTGT" recordId={detail.record.id} purpose="INVOICE" items={invoices.items} onAdd={invoices.add} onRemove={invoices.remove} required error={errors.invoiceAttachmentIds} />
      ) : null}
      <Field label="Chữ ký BQL" required error={errors.signature}>
        <SignaturePad onChange={setSignature} invalid={Boolean(errors.signature)} label="Chữ ký BQL đề nghị thanh toán" />
      </Field>
      <FieldErrorList errors={errors} exclude={SHOWN} />
    </CommandDialog>
  );
};
