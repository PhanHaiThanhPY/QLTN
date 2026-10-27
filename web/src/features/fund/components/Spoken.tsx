import type { ReactNode } from 'react';

/** Shown text for the eye, full words for a screen reader ("+10.000.000 ₫" read "cộng mười triệu đồng", ui-brief §4). */
export const Spoken = ({ children, spoken, className }: { children: ReactNode; spoken: string; className?: string }) => (
  <span className={className}>
    <span aria-hidden>{children}</span>
    <span className="sr-only">{spoken}</span>
  </span>
);
