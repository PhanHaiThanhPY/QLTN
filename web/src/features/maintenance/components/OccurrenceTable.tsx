import { Link } from 'react-router';
import { OccurrenceStatusBadge } from '@/components/common/StatusBadge';
import { Table, Td, Th, Tr } from '@/components/ui/table';
import { useReferenceData } from '@/hooks/useReferenceData';
import type { OccurrenceListItem } from '@/services/maintenance-service';
import { subjectPath } from '@/utils/subject-link';
import { OccurrenceDate } from './OccurrenceDate';
import { OccurrenceFlags } from './OccurrenceFlags';
import { MaintenanceLocationTrail } from './MaintenanceLocationTrail';

interface OccurrenceTableProps {
  rows: OccurrenceListItem[];
  showItem?: boolean;
  /** Hide the location column when every row belongs to the same item (item detail page). */
  showLocation?: boolean;
}

/** Occurrence list: table on desktop, cards on phones. */
export const OccurrenceTable = ({ rows, showItem = true, showLocation = true }: OccurrenceTableProps) => {
  const { data, itemName, userName } = useReferenceData();
  return (
    <>
      <Table className={showLocation ? undefined : 'min-w-0'}>
        <thead>
          <tr>
            <Th className="w-24">Mã lượt</Th>
            {showLocation ? <Th>Nơi bảo trì</Th> : null}
            {showItem ? <Th className="min-w-64">Hạng mục</Th> : null}
            <Th className="min-w-56">Phụ trách</Th>
            <Th>Ngày dự kiến</Th>
            <Th>Trạng thái</Th>
            <Th>Chỉ báo</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ occurrence, indicator, needsReassignment, pendingSince }) => (
            <Tr key={occurrence.id}>
              <Td className="w-24">
                <Link to={subjectPath('MAINTENANCE_OCCURRENCE', occurrence.id)} className="font-medium text-accent hover:underline">
                  {occurrence.code}
                </Link>
              </Td>
              {showLocation ? (
                <Td>
                  <MaintenanceLocationTrail data={data} buildingId={occurrence.buildingId} itemId={occurrence.itemId} />
                </Td>
              ) : null}
              {showItem ? <Td className="min-w-64">{itemName(occurrence.itemId)}</Td> : null}
              <Td className="min-w-56 text-xs text-ink-2">
                <div>BQL: {userName(occurrence.managerUserId)}</div>
                <div>KT: {userName(occurrence.confirmationUserId)}</div>
              </Td>
              <Td>
                <OccurrenceDate occurrence={occurrence} />
              </Td>
              <Td>
                <OccurrenceStatusBadge status={occurrence.status} />
              </Td>
              <Td>
                <OccurrenceFlags occurrence={occurrence} indicator={indicator} needsReassignment={needsReassignment} pendingSince={pendingSince} />
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>
      <ul className="space-y-2 md:hidden">
        {rows.map(({ occurrence, indicator, needsReassignment, pendingSince }) => (
          <li key={occurrence.id}>
            <Link
              to={subjectPath('MAINTENANCE_OCCURRENCE', occurrence.id)}
              className="block rounded-lg border border-line bg-surface p-3 hover:border-accent"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium text-accent">{occurrence.code}</span>
                <OccurrenceStatusBadge status={occurrence.status} />
              </div>
              {showLocation ? (
                <div className="mt-2 rounded-md bg-accent-soft/45 px-2.5 py-2">
                  <MaintenanceLocationTrail data={data} buildingId={occurrence.buildingId} itemId={occurrence.itemId} />
                </div>
              ) : null}
              {showItem ? <p className="mt-1 text-sm text-ink">{itemName(occurrence.itemId)}</p> : null}
              <div className="mt-1 text-sm text-ink-2">
                <OccurrenceDate occurrence={occurrence} />
              </div>
              <div className="mt-2">
                <OccurrenceFlags occurrence={occurrence} indicator={indicator} needsReassignment={needsReassignment} pendingSince={pendingSince} />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
};
