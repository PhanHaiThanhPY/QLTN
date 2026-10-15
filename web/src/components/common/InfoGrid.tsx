import type { ReactNode } from 'react';

export interface InfoItem {
  label: string;
  value: ReactNode;
  wide?: boolean;
}

/** Label/value pairs; one column on phones, two on larger screens. */
export const InfoGrid = ({ items }: { items: InfoItem[] }) => (
  <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
    {items.map((item) => (
      <div key={item.label} className={item.wide ? 'sm:col-span-2' : undefined}>
        <dt className="text-xs text-ink-3">{item.label}</dt>
        <dd className="mt-0.5 break-words text-sm text-ink">{item.value}</dd>
      </div>
    ))}
  </dl>
);
