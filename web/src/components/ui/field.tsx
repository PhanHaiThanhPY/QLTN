import { cloneElement, isValidElement, type ReactNode } from 'react';
import { TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/cn';

interface FieldProps {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}

interface DescribedControlProps {
  id?: string;
  'aria-invalid'?: boolean | 'true' | 'false';
  'aria-describedby'?: string;
}

/** Stable ids of the error and hint lines of the field whose control is `htmlFor`. */
export const fieldErrorId = (htmlFor: string): string => `${htmlFor}-error`;
export const fieldHintId = (htmlFor: string): string => `${htmlFor}-hint`;

/**
 * Label + control + error under the control (icon so errors are not colour-only). When the direct child is the
 * control named by `htmlFor`, it is marked `aria-invalid` and described by the error (or hint) line, so screen
 * readers announce the message with the control (B06-S1 F-B06-S1-01). A wrapped control wires these itself with
 * `fieldErrorId` / `fieldHintId`.
 */
export const Field = ({ label, htmlFor, error, hint, required = false, className, children }: FieldProps) => {
  const describedBy = htmlFor && (error ? fieldErrorId(htmlFor) : hint && fieldHintId(htmlFor));
  const control =
    htmlFor && isValidElement<DescribedControlProps>(children) && children.props.id === htmlFor
      ? cloneElement(children, {
          ...(error ? { 'aria-invalid': true } : {}),
          ...(describedBy ? { 'aria-describedby': [children.props['aria-describedby'], describedBy].filter(Boolean).join(' ') } : {}),
        })
      : children;
  return (
    <div className={cn('min-w-0', className)}>
      <label htmlFor={htmlFor} className="mb-1 block text-xs font-medium text-ink-2">
        {label}
        {required ? <span className="ml-0.5 text-crit">*</span> : null}
      </label>
      {control}
      {error ? (
        <p id={htmlFor ? fieldErrorId(htmlFor) : undefined} className="mt-1 flex items-center gap-1 text-[0.6875rem] text-crit" role="alert">
          <TriangleAlert className="size-3 shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}
      {!error && hint ? (
        <p id={htmlFor ? fieldHintId(htmlFor) : undefined} className="mt-1 text-[0.6875rem] text-ink-3">
          {hint}
        </p>
      ) : null}
    </div>
  );
};
