import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import type { Attachment } from '@/domain/types';
import { useCommand } from '@/hooks/useCommand';
import { useServiceQuery } from '@/hooks/useServiceQuery';
import { getAvailable, type Voucher } from '@/services/fund-api';
import { todayVn } from '@/services/runtime';
import { formatDate } from '@/utils/date';
import { formatVndText } from '@/utils/money';
import { FundFileField } from './FundFileField';

/**
 * "Ghi đã chi" (BR-F3-12, BR-F3-13, ui-brief §2.4): the payout day, the transfer proof, and the balance the server
 * computes for after the payout; a shortfall shows the rule's sentence here and keeps the button locked.
 */
export const PayVoucherDialog = ({ voucher, onClose }: { voucher: Voucher; onClose: () => void }) => {
  const command = useCommand({ successMessage: 'Đã ghi đã chi.' });
  const approvedOn = voucher.approvedAt ? voucher.approvedAt.slice(0, 10) : undefined;
  const [paidOn, setPaidOn] = useState(todayVn());
  const [file, setFile] = useState<Attachment | null>(null);
  const available = useServiceQuery(['fund', 'available', voucher.fundId, paidOn], () => getAvailable(voucher.fundId, paidOn));
  const after = available.data ? BigInt(available.data.amountVnd) - BigInt(voucher.amountVnd) : null;
  const short = after !== null && after < 0n;
  const errors = command.fieldErrors;
  const submit = async () => {
    const result = await command.execute({
      subjectType: 'FUND_VOUCHER',
      subjectId: voucher.id,
      expectedVersion: voucher.version,
      action: 'payFundVoucher',
      payload: { paidOn, proofAttachmentId: file?.id },
    });
    if (result) onClose();
  };
  const shortfall =
    short && available.data
      ? `Số dư quỹ không đủ: còn ${formatVndText(available.data.amountVnd).replace(' ₫', '')} đ tại ${formatDate(available.data.date)}.`
      : undefined;
  return (
    <Dialog
      open
      onOpenChange={(open) => (open ? undefined : onClose())}
      title={`Ghi đã chi ${voucher.code}`}
      description={`${formatVndText(voucher.amountVnd)} · ${voucher.payeeName}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button isLoading={command.isPending} disabled={!file || !paidOn || short || available.isLoading} onClick={() => void submit()}>
            Ghi đã chi
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Ngày chi" htmlFor="pay-date" required error={errors.paidOn ?? shortfall} hint="Từ ngày duyệt đến hôm nay.">
          <Input
            id="pay-date"
            type="date"
            min={approvedOn}
            max={todayVn()}
            value={paidOn}
            aria-invalid={Boolean(errors.paidOn ?? shortfall)}
            onChange={(event) => setPaidOn(event.target.value)}
          />
        </Field>
        <FundFileField fundId={voucher.fundId} purpose="VOUCHER_PROOF" label="Chứng từ chuyển khoản" required file={file} onChange={setFile} error={errors.proofAttachmentId} />
        {after !== null && !short ? (
          <p className="text-sm text-ink-2" aria-live="polite">
            Số dư theo sổ sau khi chi: <span className="tabular-nums font-semibold text-ink">{formatVndText(after.toString())}</span>
          </p>
        ) : null}
      </div>
    </Dialog>
  );
};
