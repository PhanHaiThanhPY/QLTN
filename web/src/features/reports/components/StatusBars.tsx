import { Table, Td, Th, Tr } from '@/components/ui/table';

export interface StatusCount {
  status: string;
  label: string;
  count: number;
}

interface StatusBarsProps {
  title: string;
  rows: StatusCount[];
}

/**
 * Horizontal bars built from divs; the visible text carries the numbers, the bar is decorative.
 * Bars list non-zero statuses; the desktop table lists every status.
 */
export const StatusBars = ({ title, rows }: StatusBarsProps) => {
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
              <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate text-ink">{row.label}</span>
                <span className="tnum shrink-0 font-medium text-ink">
                  {row.count}
                  <span className="ml-1 text-xs font-normal text-ink-2">({Math.round((row.count / total) * 100)}%)</span>
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-surface-3" aria-hidden>
                <div className="h-full rounded-full bg-accent" style={{ width: `${(row.count / max) * 100}%` }} />
              </div>
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
                <Td className="py-2">{row.label}</Td>
                <Td className="tnum py-2 text-right font-medium">{row.count}</Td>
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
