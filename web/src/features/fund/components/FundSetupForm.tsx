import { useState } from 'react';
import { MoneyInput } from '@/components/common/MoneyInput';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input, Textarea } from '@/components/ui/input';
import { useCommand } from '@/hooks/useCommand';
import type { Fund } from '@/services/fund-api';
import { todayVn } from '@/services/runtime';
import { digitsOf, groupDigits } from '../fund-input';

interface FundSetupFormProps {
  fund: Fund;
  online: boolean;
  onDone?: () => void;
  onCancel?: () => void;
}

/**
 * BR-F3-02: the fund's one account and its opening — the statement balance at the start of the day the ledger starts.
 * Changing an opening needs a reason; once the ledger has lines it waits for BQT (D-F3-5).
 */
export const FundSetupForm = ({ fund, online, onDone, onCancel }: FundSetupFormProps) => {
  const command = useCommand({ successMessage: fund.hasLines && fund.openingDate ? 'Đã gửi BQT duyệt thay đổi.' : 'Đã lưu thiết lập quỹ.' });
  const [bankName, setBankName] = useState(fund.bankName ?? '');
  const [accountNo, setAccountNo] = useState(fund.accountNo ?? '');
  const [accountHolder, setAccountHolder] = useState(fund.accountHolder ?? '');
  const [openingDate, setOpeningDate] = useState(fund.openingDate ?? '');
  const [balance, setBalance] = useState(groupDigits(fund.openingBalanceVnd));
  const [reason, setReason] = useState('');
  const errors = command.fieldErrors;
  const changesOpening = Boolean(fund.openingDate) && (openingDate !== fund.openingDate || digitsOf(balance) !== fund.openingBalanceVnd);
  const submit = async () => {
    const result = await command.execute({
      subjectType: 'FUND',
      subjectId: fund.id,
      expectedVersion: fund.version,
      action: 'setupFund',
      payload: {
        bankName: bankName.trim(),
        accountNo: accountNo.trim(),
        accountHolder: accountHolder.trim(),
        openingDate,
        openingBalanceVnd: digitsOf(balance),
        reason: changesOpening ? reason.trim() : null,
      },
    });
    if (result) onDone?.();
  };
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Ngân hàng" htmlFor="fs-bank" required error={errors.bankName}>
          <Input id="fs-bank" value={bankName} onChange={(event) => setBankName(event.target.value)} />
        </Field>
        <Field label="Số tài khoản" htmlFor="fs-account" required error={errors.accountNo}>
          <Input id="fs-account" inputMode="numeric" value={accountNo} onChange={(event) => setAccountNo(event.target.value)} />
        </Field>
        <Field label="Chủ tài khoản" htmlFor="fs-holder" required error={errors.accountHolder}>
          <Input id="fs-holder" value={accountHolder} onChange={(event) => setAccountHolder(event.target.value)} />
        </Field>
        <Field label="Ngày bắt đầu sổ" htmlFor="fs-date" required error={errors.openingDate}>
          <Input id="fs-date" type="date" max={todayVn()} value={openingDate} onChange={(event) => setOpeningDate(event.target.value)} />
        </Field>
        <Field
          label="Số dư đầu theo sao kê (VND)"
          htmlFor="fs-balance"
          required
          error={errors.openingBalanceVnd}
          hint="Số dư tài khoản đầu ngày bắt đầu sổ."
        >
          <MoneyInput id="fs-balance" value={balance} onChange={setBalance} invalid={Boolean(errors.openingBalanceVnd)} />
        </Field>
        {changesOpening ? (
          <div className="sm:col-span-2">
            <Field
              label="Lý do đổi số dư đầu"
              htmlFor="fs-reason"
              required
              error={errors.reason}
              hint={fund.hasLines ? 'Sổ đã có dòng: thay đổi chờ BQT duyệt.' : 'Tối thiểu 10 ký tự.'}
            >
              <Textarea id="fs-reason" rows={2} value={reason} onChange={(event) => setReason(event.target.value)} />
            </Field>
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          isLoading={command.isPending}
          disabled={!online || !bankName.trim() || !accountNo.trim() || !accountHolder.trim() || !openingDate || !digitsOf(balance)}
          onClick={() => void submit()}
        >
          {fund.openingDate ? 'Lưu thiết lập' : 'Bắt đầu sổ quỹ'}
        </Button>
        {onCancel ? (
          <Button variant="secondary" onClick={onCancel}>
            Hủy
          </Button>
        ) : null}
      </div>
    </div>
  );
};
