import { Children, forwardRef, Fragment, isValidElement, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { Select as SelectPrimitive } from 'radix-ui';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/cn';

/** Radix items cannot use "" as a value; empty options ("Tất cả") map to this sentinel. */
const EMPTY = '__qltn_empty__';
const toItemValue = (value: string): string => (value === '' ? EMPTY : value);
const fromItemValue = (value: string): string => (value === EMPTY ? '' : value);

interface OptionData {
  value: string;
  label: ReactNode;
  disabled: boolean;
}

interface OptionProps {
  value?: string | number;
  children?: ReactNode;
  disabled?: boolean;
}

/** Reads <option> children (also inside fragments/arrays) so screens keep the native-select markup. */
const collectOptions = (children: ReactNode): OptionData[] =>
  Children.toArray(children).flatMap((child) => {
    if (!isValidElement(child)) return [];
    const element = child as ReactElement<OptionProps>;
    if (element.type === Fragment) return collectOptions(element.props.children);
    if (element.type !== 'option') return [];
    return [{ value: String(element.props.value ?? ''), label: element.props.children, disabled: Boolean(element.props.disabled) }];
  });

export interface SelectChangeEvent {
  target: { value: string; name: string };
}

export interface SelectProps {
  id?: string;
  name?: string;
  value?: string | number;
  defaultValue?: string | number;
  onChange?: (event: SelectChangeEvent) => void;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  className?: string;
  size?: 'sm' | 'md';
  children: ReactNode;
  'aria-invalid'?: boolean | 'true' | 'false';
  'aria-label'?: string;
  'aria-describedby'?: string;
}

/**
 * Dropdown in the VMI-GROUP style (Radix Select: custom list, check mark, shadow), keeping the
 * native <select>/<option> API so screens do not change. Controlled via `value`, or uncontrolled via `defaultValue`.
 */
export const Select = forwardRef<HTMLButtonElement, SelectProps>(
  ({ id, name, value, defaultValue, onChange, disabled, required, placeholder = 'Chọn…', className, size = 'md', children, ...aria }, ref) => {
    const options = collectOptions(children);
    const [innerValue, setInnerValue] = useState(String(defaultValue ?? options[0]?.value ?? ''));
    const current = value === undefined ? innerValue : String(value);

    const handleValueChange = (itemValue: string) => {
      const next = fromItemValue(itemValue);
      if (value === undefined) setInnerValue(next);
      onChange?.({ target: { value: next, name: name ?? '' } });
    };

    return (
      <SelectPrimitive.Root value={toItemValue(current)} onValueChange={handleValueChange} disabled={disabled} required={required} name={name}>
        <SelectPrimitive.Trigger
          ref={ref}
          id={id}
          {...aria}
          className={cn(
            'flex w-full items-center justify-between gap-1.5 rounded-md border border-line-2 bg-surface px-2.5 text-left text-[0.8125rem] text-ink shadow-sm transition-colors',
            'data-[placeholder]:text-ink-3 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-50',
            'aria-[invalid=true]:border-crit aria-[invalid=true]:ring-crit/25 [&>span]:min-w-0 [&>span]:truncate',
            size === 'sm' ? 'h-8' : 'h-9',
            // Empty choice ("Tất cả", "Chọn…") reads as a placeholder.
            current === '' && 'text-ink-3',
            className,
          )}
        >
          <SelectPrimitive.Value placeholder={placeholder} />
          <SelectPrimitive.Icon asChild>
            <ChevronDown className="size-4 shrink-0 text-ink-3" />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            position="popper"
            sideOffset={4}
            className="relative z-50 flex max-h-[min(24rem,var(--radix-select-content-available-height))] min-w-[8rem] flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-pop animate-fade-in"
          >
            <SelectPrimitive.ScrollUpButton className="flex h-5 cursor-default items-center justify-center bg-surface text-ink-3">
              <ChevronUp className="size-3.5" />
            </SelectPrimitive.ScrollUpButton>
            <SelectPrimitive.Viewport className="w-[var(--radix-select-trigger-width)] p-1">
              {options.map((option) => (
                <SelectPrimitive.Item
                  key={option.value || EMPTY}
                  value={toItemValue(option.value)}
                  disabled={option.disabled}
                  className={cn(
                    'relative flex w-full cursor-pointer select-none items-center rounded-md py-1.5 pl-2.5 pr-7 text-[0.8125rem] text-ink-2 outline-none',
                    'data-[highlighted]:bg-surface-2 data-[highlighted]:text-ink data-[state=checked]:font-medium data-[state=checked]:text-ink data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
                  )}
                >
                  <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                  <span className="absolute right-2 flex size-4 items-center justify-center">
                    <SelectPrimitive.ItemIndicator>
                      <Check className="size-3.5 text-accent" />
                    </SelectPrimitive.ItemIndicator>
                  </span>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.Viewport>
            <SelectPrimitive.ScrollDownButton className="flex h-5 cursor-default items-center justify-center bg-surface text-ink-3">
              <ChevronDown className="size-3.5" />
            </SelectPrimitive.ScrollDownButton>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
    );
  },
);
Select.displayName = 'Select';
