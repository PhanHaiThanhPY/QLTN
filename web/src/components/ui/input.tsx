import { forwardRef } from 'react';
import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

/** Quiet field style: soft surface, clear focus ring and restrained borders. */
const FIELD_CLASS = cn(
  'w-full rounded-lg border border-line-2 bg-surface px-2.5 text-[0.8125rem] text-ink shadow-none transition-colors',
  'placeholder:text-ink-3 focus-visible:border-accent focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/10',
  'disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-crit aria-[invalid=true]:ring-crit/25',
);

/** Field height shared by inputs and selects. */
export const FIELD_H = 'h-9';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn(FIELD_CLASS, FIELD_H, 'py-1', className)} {...props} />
));
Input.displayName = 'Input';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, rows = 3, ...props }, ref) => (
    <textarea ref={ref} rows={rows} className={cn(FIELD_CLASS, 'min-h-[68px] py-1.5', className)} {...props} />
  ),
);
Textarea.displayName = 'Textarea';

/** Kept for existing imports: the VMI-style dropdown with the native <option> API. */
export { Select as NativeSelect } from './select';
