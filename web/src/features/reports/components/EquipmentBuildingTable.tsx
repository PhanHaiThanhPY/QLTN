import { Table, Td, Th, Tr } from '@/components/ui/table';
import type { EquipmentBuildingSummary } from '@/services/equipment-report-service';
import { cn } from '@/lib/cn';
import { formatVnd } from '@/utils/money';

interface EquipmentBuildingTableProps {
  rows: EquipmentBuildingSummary[];
  selectedId: string;
  buildingName: (id?: string) => string;
  onSelect: (buildingId: string) => void;
}

/** Equipment count per building with condition split; a click filters the item table below. */
export const EquipmentBuildingTable = ({ rows, selectedId, buildingName, onSelect }: EquipmentBuildingTableProps) => (
  <>
    <Table className="min-w-0">
      <thead>
        <tr>
          <Th>Tòa nhà</Th>
          <Th className="text-right">Thiết bị</Th>
          <Th>Tốt / Cần chú ý / Chưa rõ</Th>
          <Th className="text-right">Lượt sửa</Th>
          <Th className="text-right">Chi phí sửa</Th>
          <Th className="text-right">Hỏng lặp lại</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <Tr key={row.buildingId} className={cn(row.buildingId === selectedId && 'bg-accent-soft/50')}>
            <Td>
              <button type="button" onClick={() => onSelect(row.buildingId)} className="font-semibold text-accent hover:underline" aria-pressed={row.buildingId === selectedId}>
                {buildingName(row.buildingId)}
              </button>
            </Td>
            <Td className="tnum text-right font-semibold text-ink">{row.itemCount}</Td>
            <Td className="tnum">
              <span className="text-good">{row.byCondition.GOOD}</span>
              {' / '}
              <span className={row.byCondition.NEEDS_ATTENTION > 0 ? 'font-semibold text-warn' : undefined}>{row.byCondition.NEEDS_ATTENTION}</span>
              {' / '}
              <span>{row.byCondition.UNKNOWN}</span>
            </Td>
            <Td className="tnum text-right">{row.repairCount}</Td>
            <Td className="tnum whitespace-nowrap text-right font-medium text-ink">{row.cost > 0 ? formatVnd(row.cost) : '—'}</Td>
            <Td className={cn('tnum text-right', row.repeatedCount > 0 && 'font-semibold text-crit')}>{row.repeatedCount}</Td>
          </Tr>
        ))}
      </tbody>
    </Table>
    <ul className="space-y-2 md:hidden">
      {rows.map((row) => (
        <li key={row.buildingId}>
          <button
            type="button"
            onClick={() => onSelect(row.buildingId)}
            aria-pressed={row.buildingId === selectedId}
            className={cn('w-full rounded-lg border border-line bg-surface p-3 text-left', row.buildingId === selectedId && 'border-accent bg-accent-soft/40')}
          >
            <span className="flex items-center justify-between gap-2">
              <span className="font-semibold text-ink">{buildingName(row.buildingId)}</span>
              <span className="tnum text-sm font-semibold text-ink">{row.itemCount} thiết bị</span>
            </span>
            <span className="mt-1 block text-xs text-ink-2">
              Tốt {row.byCondition.GOOD} · Cần chú ý {row.byCondition.NEEDS_ATTENTION} · Chưa rõ {row.byCondition.UNKNOWN}
            </span>
            <span className="mt-1 block text-xs text-ink-2">
              {row.repairCount} lượt sửa · {row.cost > 0 ? formatVnd(row.cost) : 'chưa có chi phí'}
              {row.repeatedCount > 0 ? ` · ${row.repeatedCount} hỏng lặp lại` : ''}
            </span>
          </button>
        </li>
      ))}
    </ul>
  </>
);
