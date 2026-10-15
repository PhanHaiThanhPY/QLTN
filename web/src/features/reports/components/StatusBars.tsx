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

  return (
    <section aria-label={title}>
      <h3 className="mb-3 text-sm font-semibold text-ink">{title}</h3>
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
