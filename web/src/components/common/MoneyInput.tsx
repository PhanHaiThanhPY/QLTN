import { Input } from '@/components/ui/input';
import { formatVnd, parseVndInput } from '@/utils/money';

interface MoneyInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  disabled?: boolean;
  /** Set by `Field` to point at its error or hint line. */
  'aria-describedby'?: string;
  'aria-invalid'?: boolean | 'true' | 'false';
}

/** Free text VND input ("12.500.000"); shows the parsed amount below. */
export const MoneyInput = ({ id, value, onChange, invalid = false, disabled = false, 'aria-describedby': describedBy, 'aria-invalid': ariaInvalid }: MoneyInputProps) => {
  const amount = parseVndInput(value);
  return (
    <div>
      <Input
        id={id}
        inputMode="numeric"
        placeholder="Ví dụ: 12.500.000"
        value={value}
        disabled={disabled}
        aria-invalid={invalid || ariaInvalid === true || ariaInvalid === 'true'}
        aria-describedby={describedBy}
        onChange={(event) => onChange(event.target.value)}
      />
      <p className="mt-1 text-xs text-ink-3">{amount === undefined ? 'Nhập số tiền nguyên dương (VND).' : `= ${formatVnd(amount)}`}</p>
    </div>
  );
};
