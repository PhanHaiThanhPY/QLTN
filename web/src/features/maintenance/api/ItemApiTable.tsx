import { Link } from 'react-router';
import { Badge, Tag } from '@/components/ui/badge';
import { Table, Td, Th, Tr } from '@/components/ui/table';
import type { IsoDate } from '@/domain/types';
import { cn } from '@/lib/cn';
import type { ApiItemRow } from '@/services/maintenance-items-api';
import { ConditionBadge } from '../components/ConditionBadge';
import { WarrantyBadge } from '../components/item/WarrantyBadge';
import { warrantyInfo } from '../utils/item-insights';

interface ItemApiTableProps {
  rows: readonly ApiItemRow[];
  today: IsoDate;
  locationName: (id?: string) => string;
  buildingName: (id?: string) => string;
}

const detailPath = (id: string): string => `/maintenance/items/${id}`;

/** "Đang sửa chữa" and "Đã ngừng dùng" chips, always as words (ui-brief §1). */
const RowFlags = ({ row }: { row: ApiItemRow }) => (
  <span className="inline-flex flex-wrap gap-1">
    {row.openRepairCount > 0 ? <Badge tone="info">Đang sửa chữa</Badge> : null}
    {row.item.active ? null : <Badge tone="neutral">Đã ngừng dùng</Badge>}
  </span>
);

/**
 * Equipment list of api mode (MT-S1 ui-brief §2.1, §3): table from 768px (location under the name below 1024px),
 * one card per item on phones.
 */
export const ItemApiTable = ({ rows, today, locationName, buildingName }: ItemApiTableProps) => (
  <>
    <Table>
      <thead>
        <tr>
          <Th scope="col">Mã</Th>
          <Th scope="col" className="min-w-56">Tên</Th>
          <Th scope="col" className="hidden min-w-48 lg:table-cell">Vị trí</Th>
          <Th scope="col">Tình trạng</Th>
          <Th scope="col">Bảo hành</Th>
          <Th scope="col"><span className="sr-only">Cờ</span></Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const place = `${buildingName(row.item.buildingId)} · ${locationName(row.item.locationId)}`;
          return (
            <Tr key={row.item.id} className={cn(!row.item.active && 'text-ink-3')}>
              <Td>
                <Link to={detailPath(row.item.id)} className="font-semibold text-accent hover:underline">
                  {row.item.code}
                </Link>
              </Td>
              <Td>
                <span className={cn('font-medium', row.item.active ? 'text-ink' : 'text-ink-3')}>{row.item.name}</span>
                <span className="block text-xs text-ink-3">{row.item.type}</span>
                <span className="block text-xs text-ink-2 lg:hidden">{place}</span>
              </Td>
              <Td className="hidden lg:table-cell text-[0.8125rem]">{place}</Td>
              <Td><ConditionBadge condition={row.item.condition} /></Td>
              <Td><WarrantyBadge warranty={warrantyInfo(row.item, today)} compact /></Td>
              <Td><RowFlags row={row} /></Td>
            </Tr>
          );
        })}
      </tbody>
    </Table>
    <ul className="space-y-2 md:hidden">
      {rows.map((row) => (
        <li key={row.item.id} className="rounded-xl border border-line bg-surface p-3.5 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Link to={detailPath(row.item.id)} className="font-semibold text-accent hover:underline">
              <Tag>{row.item.code}</Tag>
            </Link>
            <RowFlags row={row} />
          </div>
          <p className={cn('mt-1.5 font-semibold', row.item.active ? 'text-ink' : 'text-ink-3')}>{row.item.name}</p>
          <p className="text-xs text-ink-2">
            {buildingName(row.item.buildingId)} · {locationName(row.item.locationId)}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <ConditionBadge condition={row.item.condition} />
            <WarrantyBadge warranty={warrantyInfo(row.item, today)} compact />
          </div>
        </li>
      ))}
    </ul>
  </>
);
