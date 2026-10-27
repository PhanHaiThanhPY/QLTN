import { useState } from 'react';
import { MoneyInput } from '@/components/common/MoneyInput';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Textarea } from '@/components/ui/input';
import type { Attachment } from '@/domain/types';
import { useCommand } from '@/hooks/useCommand';
import type { TaxObligation } from '@/services/fund-api';
import { formatVndText } from '@/utils/money';
import { digitsOf, groupDigits } from '../fund-input';
import { monthText } from '../fund-ui';
import { FundFileField } from './FundFileField';

interface TaxObligationDialogProps {
  fundId: string;
  month: string;
  /** Adjusting this obligation; absent when recording the month's. */
  obligation?: TaxObligation;
  contractIncomeVnd: string;
  onClose: () => void;
}

/** BR-F3-10: the month's tax as the accounting file says; an adjustment needs a reason and keeps the history. */
export const TaxObligationDialog = ({ fundId, month, obligation, contractIncomeVnd, onClose }: TaxObligationDialogProps) => {
  const command = useCommand({ successMessage: obligation ? 'Đã điều chỉnh số thuế.' : 'Đã ghi nghĩa vụ thuế.' });
  const [amount, setAmount] = useState(groupDigits(obligation?.amountVnd));
  const [file, setFile] = useState<Attachment | null>(null);
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const errors = command.fieldErrors;
  const submit = async () => {
    const result = await command.execute(
      obligation
        ? {
            subjectType: 'FUND_TAX',
            subjectId: obligation.id,
            expectedVersion: obligation.version,
            action: 'adjustTaxObligation',
            payload: { amountVnd: digitsOf(amount), reason: reason.trim() },
          }
        : {
            subjectType: 'FUND_TAX',
            subjectId: fundId,
            action: 'createTaxObligation',
            payload: { month, amountVnd: digitsOf(amount), attachmentId: file?.id ?? null, note: note.trim() || null },
          },
    );
    if (result) onClose();
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => (open ? undefined : onClose())}
      title={obligation ? `Điều chỉnh ${obligation.code}` : `Ghi nghĩa vụ thuế ${monthText(month).toLowerCase()}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button isLoading={command.isPending} disabled={!digitsOf(amount) || (Boolean(obligation) && reason.trim().length < 10)} onClick={() => void submit()}>
            {obligation ? 'Lưu điều chỉnh' : 'Ghi nghĩa vụ thuế'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Số thuế theo hồ sơ kế toán (VND)" htmlFor="tax-amount" required error={errors.amountVnd ?? errors.month}>
          <MoneyInput id="tax-amount" value={amount} onChange={setAmount} invalid={Boolean(errors.amountVnd)} />
        </Field>
        <p className="text-xs text-ink-3">
          Thu theo hợp đồng trong tháng: {formatVndText(contractIncomeVnd)} — chỉ để tham khảo; hệ thống không tự áp thuế suất.
        </p>
        {obligation ? (
          <Field label="Lý do điều chỉnh" htmlFor="tax-reason" required error={errors.reason} hint="Tối thiểu 10 ký tự. Không được thấp hơn số đã nộp.">
            <Textarea id="tax-reason" rows={2} value={reason} onChange={(event) => setReason(event.target.value)} />
          </Field>
        ) : (
          <>
            <FundFileField fundId={fundId} purpose="TAX_FILING" label="Hồ sơ kế toán" file={file} onChange={setFile} error={errors.attachmentId} />
            <Field label="Ghi chú" htmlFor="tax-note" error={errors.note}>
              <Textarea id="tax-note" rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
            </Field>
          </>
        )}
      </div>
    </Dialog>
  );
};
