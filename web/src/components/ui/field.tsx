import type { ReactNode } from 'react';
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

/** Label + control + error under the control (icon so errors are not colour-only). */
export const Field = ({ label, htmlFor, error, hint, required = false, className, children }: FieldProps) => (
  <div className={cn('min-w-0', className)}>
    <label htmlFor={htmlFor} className="mb-1 block text-xs font-medium text-ink-2">
      {label}
      {required ? <span className="ml-0.5 text-crit">*</span> : null}
    </label>
    {children}
    {error ? (
      <p className="mt-1 flex items-center gap-1 text-[0.6875rem] text-crit" role="alert">
        <TriangleAlert className="size-3 shrink-0" aria-hidden />
        {error}
      </p>
    ) : null}
    {!error && hint ? <p className="mt-1 text-[0.6875rem] text-ink-3">{hint}</p> : null}
  </div>
);
