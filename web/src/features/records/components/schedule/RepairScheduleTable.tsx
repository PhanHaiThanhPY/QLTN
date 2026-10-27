import { Link } from 'react-router';
import { RepairStatusBadge } from '@/components/common/StatusBadge';
import { Table, Td, Th, Tr } from '@/components/ui/table';
import { MaintenanceLocationTrail } from '@/features/maintenance/components/MaintenanceLocationTrail';
import { useReferenceData } from '@/hooks/useReferenceData';
import type { ScheduleEntry } from '@/services/schedule-service';
import { ScheduleFlags } from './ScheduleFlags';
import { plannedNote, recordTitle, spanText } from './repair-schedule-ui';

/** "Thời gian" of a row: the span, and for a late one the planned end in the late colour (ui-brief §2.2). */
const SpanCell = ({ entry }: { entry: ScheduleEntry }) => {
  const planned = plannedNote(entry);
  return (
    <span className={entry.isLate ? 'font-semibold text-crit' : 'text-ink-2'}>
      {spanText(entry)}
      {planned ? <span className="block text-xs font-normal">{planned}</span> : null}
    </span>
  );
};

const progressOf = (entry: ScheduleEntry): string => (entry.construction ? `${entry.construction.progressPercent}%` : '—');

/** Construction list (BR-B4-07): table on wide screens, one card per record below 768px. */
export const RepairScheduleTable = ({ items }: { items: readonly ScheduleEntry[] }) => {
  const { data, userName } = useReferenceData();
  return (
    <>
      <Table>
        <thead><tr><Th className="w-24">Mã</Th><Th className="min-w-64">Nơi sửa chữa</Th><Th className="min-w-64">Công việc</Th><Th className="min-w-44">Phụ trách</Th><Th className="min-w-40">Thời gian</Th><Th>Tiến độ</Th><Th>Trạng thái</Th></tr></thead>
        <tbody>
          {items.map((entry) => {
            const { record } = entry;
            return (
              <Tr key={record.id}>
                <Td className="w-24"><Link to={`/records/${record.id}`} className="font-medium text-accent hover:underline">{record.code}</Link></Td>
                <Td className="min-w-64"><MaintenanceLocationTrail data={data} buildingId={record.buildingId} locationId={record.locationId} /></Td>
                <Td className="min-w-64">
                  <Link to={`/records/${record.id}`} className="font-medium text-ink hover:text-accent">{recordTitle(entry)}</Link>
                  {entry.contractorName ? <p className="text-xs text-ink-2">Nhà thầu: {entry.contractorName}</p> : null}
                </Td>
                <Td className="min-w-44 text-xs text-ink-2">BQL: {userName(record.managerUserId)}</Td>
                <Td className="min-w-40 text-sm"><SpanCell entry={entry} /></Td>
                <Td className="text-sm text-ink-2">{progressOf(entry)}</Td>
                <Td><RepairStatusBadge status={record.status} /><div className="mt-1"><ScheduleFlags entry={entry} /></div></Td>
              </Tr>
            );
          })}
        </tbody>
      </Table>
      <ul className="space-y-2 md:hidden">
        {items.map((entry) => {
          const { record } = entry;
          return (
            <li key={record.id}>
              <Link to={`/records/${record.id}`} className="block rounded-lg border border-line bg-surface p-3 hover:border-accent">
                <div className="flex items-start justify-between gap-2"><span className="font-medium text-accent">{record.code}</span><RepairStatusBadge status={record.status} /></div>
                <div className="mt-2 rounded-lg border border-accent/20 bg-accent-soft/25 px-3 py-2"><MaintenanceLocationTrail data={data} buildingId={record.buildingId} locationId={record.locationId} compact /></div>
                <p className="mt-2 font-medium text-ink">{recordTitle(entry)}</p>
                {entry.contractorName ? <p className="text-xs text-ink-2">Nhà thầu: {entry.contractorName}</p> : null}
                <p className="mt-2 text-sm"><SpanCell entry={entry} /></p>
                <p className="mt-1 text-xs text-ink-2">Tiến độ {progressOf(entry)} · BQL: {userName(record.managerUserId)}</p>
                <div className="mt-2"><ScheduleFlags entry={entry} /></div>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
};
