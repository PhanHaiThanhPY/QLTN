import { Table, Td, Th, Tr } from '@/components/ui/table';

export interface StatusCount {
  status: string;
  label: string;
  count: number;
}

interface StatusBarsProps {
  title: string;
  rows: StatusCount[];
  selectedStatus?: string;
  onSelect?: (status: string) => void;
}

/**
 * Horizontal bars built from divs; the visible text carries the numbers, the bar is decorative.
 * Bars list non-zero statuses; the desktop table lists every status.
 */
export const StatusBars = ({ title, rows, selectedStatus, onSelect }: StatusBarsProps) => {
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  const max = Math.max(1, ...rows.map((row) => row.count));
  const nonZero = rows.filter((row) => row.count > 0);

  return (
    <section aria-label={title}>
      <h3 className="mb-3 text-sm font-semibold text-ink">{title}</h3>
      {nonZero.length === 0 ? (
        <p className="text-sm text-ink-2">Không có dữ liệu trong kỳ lọc.</p>
      ) : (
        <ul className="space-y-2.5">
          {nonZero.map((row) => (
            <li key={row.status}>
              <button
                type="button"
                className={`block min-h-11 w-full rounded-lg px-2 text-left transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${selectedStatus === row.status ? 'bg-accent-soft' : ''}`}
                onClick={() => onSelect?.(row.status)}
                aria-pressed={selectedStatus === row.status}
              >
                <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate text-ink">{row.label}</span>
                  <span className="tnum shrink-0 font-medium text-ink">
                    {row.count}
                    <span className="ml-1 text-xs font-normal text-ink-2">({total > 0 ? Math.round((row.count / total) * 100) : 0}%)</span>
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-surface-3" aria-hidden>
                  <div className="h-full rounded-full bg-accent" style={{ width: `${(row.count / max) * 100}%` }} />
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4">
        <Table>
          <thead>
            <tr>
              <Th>Trạng thái</Th>
              <Th className="text-right">Số lượng</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <Tr key={row.status}>
                <Td className="py-1.5">
                  <button type="button" className="min-h-10 text-left text-sm hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" onClick={() => onSelect?.(row.status)} aria-pressed={selectedStatus === row.status}>
                    {row.label}
                  </button>
                </Td>
                <Td className="tnum py-1.5 text-right font-medium">{row.count}</Td>
              </Tr>
            ))}
            <Tr>
              <Td className="py-2 font-semibold">Tổng</Td>
              <Td className="tnum py-2 text-right font-semibold">{total}</Td>
            </Tr>
          </tbody>
        </Table>
      </div>
    </section>
  );
};
