import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

/** Bordered scroll frame (VMI TableScroll). */
export const TableScroll = ({ className, children }: { className?: string; children: ReactNode }) => (
  <div className={cn('table-frame scroll-thin relative overflow-x-auto rounded-xl border border-line bg-surface', className)}>{children}</div>
);

/** Column separators between cells, as in the VMI tables. */
const COLUMN_LINES =
  '[&_th]:border-r [&_th]:border-r-line-2 [&_td]:border-r [&_td]:border-r-line [&_th:last-child]:border-r-0 [&_td:last-child]:border-r-0';

/** Desktop table (hidden below md: pages render cards on phones). */
export const Table = ({ className, ...props }: HTMLAttributes<HTMLTableElement>) => (
  <TableScroll className="hidden md:block">
    {/* Minimum width: narrow screens scroll inside the frame instead of squeezing words. */}
    <table
      className={cn(
        'w-full min-w-[48rem] text-left text-sm [&_thead_tr]:border-b [&_thead_tr]:border-line-2 [&_td:first-child]:whitespace-nowrap',
        COLUMN_LINES,
        className,
      )}
      {...props}
    />
  </TableScroll>
);

export const Th = ({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) => (
  <th
    className={cn('h-10 whitespace-nowrap bg-surface-2 px-2.5 text-left align-middle text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-ink-3', className)}
    {...props}
  />
);

export const Td = ({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) => (
  <td className={cn('px-2.5 py-2.5 align-middle text-ink-2', className)} {...props} />
);

export const Tr = ({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) => (
  <tr className={cn('border-b border-line/80 transition-colors last:border-b-0 hover:bg-accent-soft/40', className)} {...props} />
);
