import type { ReactNode } from 'react';

/** Field-sized read-only value (used instead of disabled inputs so RHF keeps the value). */
export const ReadOnlyValue = ({ children }: { children: ReactNode }) => (
  <p className="flex min-h-10 items-center rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-ink-3">{children}</p>
);
