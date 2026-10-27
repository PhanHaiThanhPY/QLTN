import { Link } from 'react-router';
import { OccurrenceStatusBadge } from '@/components/common/StatusBadge';
import { Table, Td, Th, Tr } from '@/components/ui/table';
import type { ApiOccurrence } from '@/services/maintenance-plans-api';
import { formatDate } from '@/utils/date';
import { isOccurrenceStatus } from './plan-api-ui';
import type { PlanTimelineRow } from './plan-api-ui';
import { OccurrenceApiMenu } from './OccurrenceApiMenu';
import type { OccurrenceAction } from './OccurrenceApiMenu';
import { OccurrenceApiNote } from './OccurrenceApiNote';

interface PlanOccurrenceApiTableProps {
  rows: PlanTimelineRow[];
  /** The plan's manager may act on scheduled occurrences. */
  canAct: boolean;
  online: boolean;
  onAction: (action: OccurrenceAction, occurrence: ApiOccurrence) => void;
}

const StatusCell = ({ occurrence }: { occurrence: ApiOccurrence }) =>
  isOccurrenceStatus(occurrence.status) ? <OccurrenceStatusBadge status={occurrence.status} /> : <span>{occurrence.status}</span>;

const SkippedDate = ({ date }: { date: string }) => <span className="text-ink-3 line-through">{formatDate(date)}</span>;

/**
 * Occurrences and skipped periods by date (MT-S2 ui-brief §2.3); the code opens the occurrence page (MT-S3) and a
 * scheduled occurrence has its `⋯` menu. Table from md, cards on phones.
 */
export const PlanOccurrenceApiTable = ({ rows, canAct, online, onAction }: PlanOccurrenceApiTableProps) => {
  const menu = (occurrence: ApiOccurrence) =>
    canAct && occurrence.status === 'SCHEDULED' ? <OccurrenceApiMenu occurrence={occurrence} disabled={!online} onAction={onAction} /> : null;
  return (
    <>
      <Table>
        <thead>
          <tr>
            <Th scope="col" className="w-24">Mã</Th>
            <Th scope="col">Ngày</Th>
            <Th scope="col">Trạng thái</Th>
            <Th scope="col" className="min-w-64">Ghi chú</Th>
            <Th scope="col" className="w-12">
              <span className="sr-only">Thao tác</span>
            </Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) =>
            row.kind === 'skipped' ? (
              <Tr key={`skip-${row.date}`}>
                <Td className="text-ink-3">—</Td>
                <Td><SkippedDate date={row.date} /></Td>
                <Td className="text-ink-3">Bỏ qua do tạm dừng</Td>
                <Td />
                <Td />
              </Tr>
            ) : (
              <Tr key={row.occurrence.id}>
                <Td>
                  <Link to={`/maintenance/occurrences/${row.occurrence.id}`} className="font-medium text-accent hover:underline">
                    {row.occurrence.code}
                  </Link>
                </Td>
                <Td>{formatDate(row.occurrence.scheduledDate)}</Td>
                <Td><StatusCell occurrence={row.occurrence} /></Td>
                <Td className="min-w-64"><OccurrenceApiNote occurrence={row.occurrence} /></Td>
                <Td className="w-12">{menu(row.occurrence)}</Td>
              </Tr>
            ),
          )}
        </tbody>
      </Table>
      <ul className="space-y-2 md:hidden">
        {rows.map((row) =>
          row.kind === 'skipped' ? (
            <li key={`skip-${row.date}`} className="rounded-lg border border-line bg-surface p-3 text-sm text-ink-3">
              <SkippedDate date={row.date} /> · Bỏ qua do tạm dừng
            </li>
          ) : (
            <li key={row.occurrence.id} className="rounded-lg border border-line bg-surface p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">
                    <Link to={`/maintenance/occurrences/${row.occurrence.id}`} className="text-accent hover:underline">
                      {row.occurrence.code}
                    </Link>{' '}
                    · {formatDate(row.occurrence.scheduledDate)}
                  </p>
                  <div className="mt-1"><StatusCell occurrence={row.occurrence} /></div>
                </div>
                {menu(row.occurrence)}
              </div>
              <div className="mt-2"><OccurrenceApiNote occurrence={row.occurrence} /></div>
            </li>
          ),
        )}
      </ul>
    </>
  );
};
