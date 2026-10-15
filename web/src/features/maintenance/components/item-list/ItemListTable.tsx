import { ChevronRight, MapPin } from 'lucide-react';
import { Link } from 'react-router';
import { Badge, Tag } from '@/components/ui/badge';
import { Table, Td, Th, Tr } from '@/components/ui/table';
import type { IsoDate } from '@/domain/types';
import { cn } from '@/lib/cn';
import type { ItemListRow } from '@/services/maintenance-service';
import { ConditionBadge } from '../ConditionBadge';
import { WarrantyBadge } from '../item/WarrantyBadge';
import { warrantyInfo } from '../../utils/item-insights';
import { NextMaintenanceCell } from './NextMaintenanceCell';
import { RepairCountCell } from './RepairCountCell';

interface ItemListTableProps {
  rows: ItemListRow[];
  today: IsoDate;
  locationName: (id?: string) => string;
  buildingName: (id?: string) => string;
  userName: (id?: string) => string;
}

const detailPath = (id: string): string => `/maintenance/items/${id}`;

/** Equipment list: table on desktop, cards on phones; overdue rows carry a red edge. */
export const ItemListTable = ({ rows, today, locationName, buildingName, userName }: ItemListTableProps) => (
  <>
    <Table>
      <thead>
        <tr>
          <Th className="min-w-64">Thiết bị</Th>
          <Th className="min-w-64">Nơi đặt thiết bị</Th>
          <Th>Tình trạng</Th>
          <Th className="min-w-44">Bảo trì kế tiếp</Th>
          <Th>Sửa chữa</Th>
          <Th className="min-w-40">Đầu mối</Th>
          <Th className="w-10"><span className="sr-only">Mở</span></Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <Tr key={row.item.id} className={cn(!row.item.active && 'opacity-70')}>
            <Td className={cn('border-l-[3px]', row.overdueCount > 0 ? 'border-l-crit' : 'border-l-transparent')}>
              <div className="flex items-start gap-2.5">
                <Tag className="mt-0.5 shrink-0">{row.item.code}</Tag>
                <div className="min-w-0">
                  <Link to={detailPath(row.item.id)} className="font-semibold text-ink hover:text-accent hover:underline">
                    {row.item.name}
                  </Link>
                  <p className="text-xs text-ink-3">{[row.item.type, row.item.model].filter(Boolean).join(' · ')}</p>
                </div>
              </div>
            </Td>
            <Td>
              <span className="block text-xs font-semibold uppercase tracking-wide text-accent">{buildingName(row.item.buildingId)}</span>
              <span className="mt-0.5 block font-medium text-ink">{locationName(row.item.locationId)}</span>
            </Td>
            <Td>
              <div className="flex flex-col items-start gap-1">
                <ConditionBadge condition={row.item.condition} />
                <WarrantyBadge warranty={warrantyInfo(row.item, today)} compact />
                {row.item.active ? null : <Badge tone="neutral">Đã vô hiệu hóa</Badge>}
              </div>
            </Td>
            <Td><NextMaintenanceCell row={row} today={today} /></Td>
            <Td><RepairCountCell open={row.openRepairCount} total={row.repairCount} /></Td>
            <Td className="text-[0.8125rem]">{userName(row.item.ownerUserId)}</Td>
            <Td>
              <Link to={detailPath(row.item.id)} aria-label={`Mở ${row.item.code}`} className="flex size-8 items-center justify-center rounded-lg text-ink-3 hover:bg-surface-3 hover:text-accent">
                <ChevronRight className="size-4" aria-hidden />
              </Link>
            </Td>
          </Tr>
        ))}
      </tbody>
    </Table>
    <ul className="space-y-2 md:hidden">
      {rows.map((row) => (
        <li key={row.item.id}>
          <div className={cn('rounded-xl border border-line bg-surface p-3.5 shadow-card', row.overdueCount > 0 && 'border-l-4 border-l-crit')}>
            <div className="flex items-start justify-between gap-2">
              <Link to={detailPath(row.item.id)} className="min-w-0">
                <Tag>{row.item.code}</Tag>
                <span className="mt-1.5 block font-semibold text-ink">{row.item.name}</span>
                <span className="block text-xs text-ink-3">{row.item.type}</span>
              </Link>
              <ConditionBadge condition={row.item.condition} />
            </div>
            <p className="mt-2 flex items-start gap-1.5 text-xs text-ink-2">
              <MapPin className="mt-px size-3.5 shrink-0 text-ink-3" aria-hidden />
              {locationName(row.item.locationId)} · {buildingName(row.item.buildingId)}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3 border-t border-line pt-3 text-sm">
              <div>
                <p className="mb-0.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-3">Bảo trì kế tiếp</p>
                <NextMaintenanceCell row={row} today={today} />
              </div>
              <div>
                <p className="mb-0.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-3">Sửa chữa</p>
                <RepairCountCell open={row.openRepairCount} total={row.repairCount} />
              </div>
            </div>
          </div>
        </li>
      ))}
    </ul>
  </>
);
