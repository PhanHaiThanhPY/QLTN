import { ChevronRight } from 'lucide-react';
import { Badge, Tag } from '@/components/ui/badge';
import { Table, Td, Th, Tr } from '@/components/ui/table';
import type { EquipmentReportItem } from '@/services/equipment-report-service';
import { formatDate, toVnDate } from '@/utils/date';
import { formatVnd } from '@/utils/money';
import { ConditionBadge } from '@/features/maintenance/components/ConditionBadge';

interface EquipmentItemTableProps {
  rows: EquipmentReportItem[];
  hasPeriod: boolean;
  locationName: (id?: string) => string;
  buildingName: (id?: string) => string;
  onOpen: (itemId: string) => void;
}

const repairText = (row: EquipmentReportItem, hasPeriod: boolean): string =>
  hasPeriod && row.repairCount !== row.repairCountTotal ? `${row.repairCount} / tổng ${row.repairCountTotal}` : String(row.repairCount);

/** Items ranked by repairs in the period; a click opens the repair history panel. */
export const EquipmentItemTable = ({ rows, hasPeriod, locationName, buildingName, onOpen }: EquipmentItemTableProps) => (
  <>
    <Table>
      <thead>
        <tr>
          <Th className="min-w-64">Thiết bị</Th>
          <Th className="min-w-48">Vị trí</Th>
          <Th>Tình trạng</Th>
          <Th className="text-right">Số lần sửa</Th>
          <Th>Lần sửa gần nhất</Th>
          <Th className="text-right">Chi phí sửa</Th>
          <Th className="w-10"><span className="sr-only">Xem lịch sử</span></Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <Tr key={row.item.id}>
            <Td>
              <div className="flex items-start gap-2.5">
                <Tag className="mt-0.5 shrink-0">{row.item.code}</Tag>
                <div className="min-w-0">
                  <button type="button" className="text-left font-semibold text-ink hover:text-accent hover:underline" onClick={() => onOpen(row.item.id)}>
                    {row.item.name}
                  </button>
                  <p className="text-xs text-ink-3">{row.item.type}</p>
                </div>
              </div>
            </Td>
            <Td>
              <span className="block text-ink">{locationName(row.item.locationId)}</span>
              <span className="block text-xs text-ink-3">{buildingName(row.item.buildingId)}</span>
            </Td>
            <Td>
              <div className="flex flex-col items-start gap-1">
                <ConditionBadge condition={row.item.condition} />
                {row.isRepeated ? <Badge tone="crit">Hỏng lặp lại</Badge> : null}
                {row.openRepairCount > 0 ? <Badge tone="warn">{row.openRepairCount} đang mở</Badge> : null}
              </div>
            </Td>
            <Td className="tnum text-right font-semibold text-ink">{repairText(row, hasPeriod)}</Td>
            <Td className="tnum text-ink-2">{row.lastRepairAt ? formatDate(toVnDate(row.lastRepairAt)) : '—'}</Td>
            <Td className="tnum whitespace-nowrap text-right font-medium text-ink">{row.cost > 0 ? formatVnd(row.cost) : '—'}</Td>
            <Td>
              <button type="button" onClick={() => onOpen(row.item.id)} aria-label={`Xem lịch sử ${row.item.code}`} className="flex size-8 items-center justify-center rounded-lg text-ink-3 hover:bg-surface-3 hover:text-accent">
                <ChevronRight className="size-4" aria-hidden />
              </button>
            </Td>
          </Tr>
        ))}
      </tbody>
    </Table>
    <ul className="space-y-2 md:hidden">
      {rows.map((row) => (
        <li key={row.item.id}>
          <button type="button" onClick={() => onOpen(row.item.id)} className="w-full rounded-xl border border-line bg-surface p-3.5 text-left shadow-card">
            <span className="flex items-start justify-between gap-2">
              <span className="min-w-0">
                <Tag>{row.item.code}</Tag>
                <span className="mt-1.5 block font-semibold text-ink">{row.item.name}</span>
                <span className="block text-xs text-ink-3">{locationName(row.item.locationId)} · {buildingName(row.item.buildingId)}</span>
              </span>
              <ConditionBadge condition={row.item.condition} />
            </span>
            <span className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3 text-xs text-ink-2">
              <span><span className="block text-[0.6875rem] uppercase tracking-wide text-ink-3">Số lần sửa</span><span className="tnum text-sm font-semibold text-ink">{repairText(row, hasPeriod)}</span></span>
              <span><span className="block text-[0.6875rem] uppercase tracking-wide text-ink-3">Gần nhất</span><span className="tnum text-sm text-ink">{row.lastRepairAt ? formatDate(toVnDate(row.lastRepairAt)) : '—'}</span></span>
              <span><span className="block text-[0.6875rem] uppercase tracking-wide text-ink-3">Chi phí</span><span className="tnum text-sm font-semibold text-ink">{row.cost > 0 ? formatVnd(row.cost) : '—'}</span></span>
            </span>
            {row.isRepeated ? <span className="mt-2 inline-block"><Badge tone="crit">Hỏng lặp lại</Badge></span> : null}
          </button>
        </li>
      ))}
    </ul>
  </>
);
