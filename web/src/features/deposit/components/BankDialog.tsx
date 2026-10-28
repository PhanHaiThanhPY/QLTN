import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useCommand } from '@/hooks/useCommand';
import { useOnline } from '@/hooks/useOnline';
import type { Bank } from '@/services/deposit-api';

type BankField = 'name' | 'shortName' | 'branch' | 'contactName' | 'phone' | 'email';

const FIELDS: ReadonlyArray<{ key: BankField; label: string; required?: boolean; hint?: string }> = [
  { key: 'name', label: 'Tên ngân hàng', required: true },
  { key: 'shortName', label: 'Tên viết tắt', hint: 'Tối đa 20 ký tự, ví dụ VCB.' },
  { key: 'branch', label: 'Chi nhánh' },
  { key: 'contactName', label: 'Người liên hệ' },
  { key: 'phone', label: 'Điện thoại' },
  { key: 'email', label: 'Email' },
] as const;

/** Add or edit a bank (SPEC T-S1 BR-T1-01): the same name and branch as a bank in use is refused on "Chi nhánh". */
export const BankDialog = ({ bank, onClose }: { bank?: Bank; onClose: () => void }) => {
  const online = useOnline();
  const command = useCommand({ successMessage: bank ? 'Đã lưu ngân hàng.' : 'Đã thêm ngân hàng.' });
  const [values, setValues] = useState<Record<BankField, string>>(() =>
    Object.fromEntries(FIELDS.map(({ key }) => [key, bank?.[key] ?? ''])) as Record<BankField, string>,
  );
  const submit = async () => {
    const payload = Object.fromEntries(FIELDS.map(({ key }) => [key, values[key].trim() || null]));
    const result = await command.execute(
      bank
        ? { subjectType: 'DEPOSIT_BANK', subjectId: bank.id, expectedVersion: bank.version, action: 'updateDepositBank', payload }
        : { subjectType: 'DEPOSIT_BANK', action: 'createDepositBank', payload },
    );
    if (result) onClose();
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => (open ? undefined : onClose())}
      title={bank ? `Sửa ${bank.code}` : 'Thêm ngân hàng'}
      description="Danh mục dùng chung cho mọi tòa."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button isLoading={command.isPending} disabled={!online || values.name.trim().length < 2} onClick={() => void submit()}>
            Lưu
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {FIELDS.map((field) => (
          <Field key={field.key} label={field.label} htmlFor={`bank-${field.key}`} required={field.required} hint={field.hint} error={command.fieldErrors[field.key]}>
            <Input id={`bank-${field.key}`} value={values[field.key]} onChange={(event) => setValues({ ...values, [field.key]: event.target.value })} />
          </Field>
        ))}
      </div>
    </Dialog>
  );
};
