import { Link } from 'react-router';
import { OccurrenceStatusBadge } from '@/components/common/StatusBadge';
import { Table, Td, Th, Tr } from '@/components/ui/table';
import type { IsoDate, MaintenanceOccurrence } from '@/domain/types';
import { occurrenceIndicator } from '@/services/maintenance-service';
import { formatDate } from '@/utils/date';
import { subjectPath } from '@/utils/subject-link';
import { IndicatorBadge } from './IndicatorBadge';

interface MaintenanceRowsTableProps {
  rows: MaintenanceOccurrence[];
  today: IsoDate;
  buildingName: (id?: string) => string;
  itemName: (id?: string) => string;
}

/** Occurrences scheduled in the period (same rows as the CSV export). */
export const MaintenanceRowsTable = ({ rows, today, buildingName, itemName }: MaintenanceRowsTableProps) => (
  <>
    <Table>
      <thead>
        <tr>
          <Th>Mã lượt</Th>
          <Th>Hạng mục</Th>
          <Th>Tòa nhà</Th>
          <Th>Ngày dự kiến</Th>
          <Th>Trạng thái</Th>
          <Th>Chỉ báo</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <Tr key={row.id}>
            <Td className="font-medium">
              <Link to={subjectPath('MAINTENANCE_OCCURRENCE', row.id)} className="text-accent hover:underline">
                {row.code}
              </Link>
            </Td>
            <Td>{itemName(row.itemId)}</Td>
            <Td className="text-ink-2">{buildingName(row.buildingId)}</Td>
            <Td className="whitespace-nowrap">{formatDate(row.scheduledDate)}</Td>
            <Td>
              <OccurrenceStatusBadge status={row.status} />
            </Td>
            <Td>
              <IndicatorBadge indicator={occurrenceIndicator(row, today)} />
            </Td>
          </Tr>
        ))}
      </tbody>
    </Table>
    <ul className="space-y-2 md:hidden">
      {rows.map((row) => {
        const indicator = occurrenceIndicator(row, today);
        return (
          <li key={row.id}>
            <Link to={subjectPath('MAINTENANCE_OCCURRENCE', row.id)} className="block rounded-lg border border-line px-3.5 py-3 hover:bg-surface-2">
              <span className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-accent">{row.code}</span>
                <OccurrenceStatusBadge status={row.status} />
              </span>
              <span className="mt-1 block text-sm text-ink">{itemName(row.itemId)}</span>
              <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-2">
                Ngày dự kiến: {formatDate(row.scheduledDate)}
                {indicator ? <IndicatorBadge indicator={indicator} /> : null}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  </>
);
