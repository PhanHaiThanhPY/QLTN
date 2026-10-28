import { useState } from 'react';
import { MoneyInput } from '@/components/common/MoneyInput';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import type { Attachment } from '@/domain/types';
import { useCommand } from '@/hooks/useCommand';
import type { TaxObligation } from '@/services/fund-api';
import { todayVn } from '@/services/runtime';
import { formatVndText } from '@/utils/money';
import { digitsOf, groupDigits } from '../fund-input';
import { FundFileField } from './FundFileField';

/** BR-F3-11: a GNT never pays more than is still owed and never takes the fund below zero (errors on the amount). */
export const TaxPaymentDialog = ({ fundId, obligation, onClose }: { fundId: string; obligation: TaxObligation; onClose: () => void }) => {
  const command = useCommand({ successMessage: 'Đã ghi giấy nộp thuế.' });
  const [paidOn, setPaidOn] = useState(todayVn());
  const [amount, setAmount] = useState(groupDigits(obligation.remainingVnd));
  const [file, setFile] = useState<Attachment | null>(null);
  const errors = command.fieldErrors;
  const submit = async () => {
    const result = await command.execute({
      subjectType: 'FUND_TAX',
      subjectId: obligation.id,
      action: 'recordTaxPayment',
      payload: { paidOn, amountVnd: digitsOf(amount), attachmentId: file?.id },
    });
    if (result) onClose();
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => (open ? undefined : onClose())}
      title={`Ghi giấy nộp thuế · ${obligation.code}`}
      description={`Còn phải nộp ${formatVndText(obligation.remainingVnd)}.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button isLoading={command.isPending} disabled={!file || !digitsOf(amount) || !paidOn} onClick={() => void submit()}>
            Ghi giấy nộp thuế
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Ngày nộp" htmlFor="gnt-date" required error={errors.paidOn}>
          <Input id="gnt-date" type="date" max={todayVn()} value={paidOn} onChange={(event) => setPaidOn(event.target.value)} />
        </Field>
        <Field label="Số tiền (VND)" htmlFor="gnt-amount" required error={errors.amountVnd}>
          <MoneyInput id="gnt-amount" value={amount} onChange={setAmount} invalid={Boolean(errors.amountVnd)} />
        </Field>
        <FundFileField fundId={fundId} purpose="TAX_PAYMENT_SLIP" label="Giấy nộp tiền" required file={file} onChange={setFile} error={errors.attachmentId} />
      </div>
    </Dialog>
  );
};
