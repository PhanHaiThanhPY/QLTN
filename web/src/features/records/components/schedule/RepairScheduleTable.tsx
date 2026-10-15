import { Link } from 'react-router';
import { RepairStatusBadge } from '@/components/common/StatusBadge';
import { Table, Td, Th, Tr } from '@/components/ui/table';
import { MaintenanceLocationTrail } from '@/features/maintenance/components/MaintenanceLocationTrail';
import { useReferenceData } from '@/hooks/useReferenceData';
import type { RepairScheduleListItem } from '@/services/records-service';
import { RecordFlags } from '../list/RecordFlags';
import { scheduleLabel } from './repair-schedule-ui';

/** Repair-only schedule table. */
export const RepairScheduleTable = ({ items }: { items: RepairScheduleListItem[] }) => {
  const { data, userName } = useReferenceData();
  return (
    <>
      <Table>
        <thead><tr><Th className="w-24">Mã</Th><Th className="min-w-72">Nơi sửa chữa</Th><Th className="min-w-72">Công việc</Th><Th className="min-w-56">Phụ trách</Th><Th className="min-w-48">Thời gian</Th><Th>Trạng thái</Th></tr></thead>
        <tbody>
          {items.map(({ record, construction, isOverdue, needsReassignment }) => (
            <Tr key={record.id}>
              <Td className="w-24"><Link to={`/records/${record.id}`} className="font-medium text-accent hover:underline">{record.code}</Link></Td>
              <Td className="min-w-72"><MaintenanceLocationTrail data={data} buildingId={record.buildingId} locationId={record.locationId} /></Td>
              <Td className="min-w-72"><Link to={`/records/${record.id}`} className="font-medium text-ink hover:text-accent">{record.title || '(Chưa đặt tên)'}</Link></Td>
              <Td className="min-w-56 text-xs text-ink-2"><div>BQL: {userName(record.managerUserId)}</div><div>KT: {userName(record.confirmationUserId)}</div></Td>
              <Td className="min-w-48 text-sm"><span className={isOverdue ? 'font-semibold text-crit' : 'text-ink-2'}>{scheduleLabel({ record, construction, isOverdue, needsReassignment })}</span></Td>
              <Td><RepairStatusBadge status={record.status} /><div className="mt-1"><RecordFlags isOverdue={isOverdue} needsReassignment={needsReassignment} isEmergency={Boolean(record.emergency)} /></div></Td>
            </Tr>
          ))}
        </tbody>
      </Table>
      <ul className="space-y-2 md:hidden">
        {items.map(({ record, construction, isOverdue, needsReassignment }) => (
          <li key={record.id}><Link to={`/records/${record.id}`} className="block rounded-lg border border-line bg-surface p-3 hover:border-accent"><div className="flex items-start justify-between gap-2"><span className="font-medium text-accent">{record.code}</span><RepairStatusBadge status={record.status} /></div><div className="mt-2 rounded-lg border border-accent/20 bg-accent-soft/25 px-3 py-2"><MaintenanceLocationTrail data={data} buildingId={record.buildingId} locationId={record.locationId} compact /></div><p className="mt-2 font-medium text-ink">{record.title || '(Chưa đặt tên)'}</p><p className="mt-2 text-sm text-ink-2">{scheduleLabel({ record, construction, isOverdue, needsReassignment })}</p><div className="mt-2"><RecordFlags isOverdue={isOverdue} needsReassignment={needsReassignment} isEmergency={Boolean(record.emergency)} /></div></Link></li>
        ))}
      </ul>
    </>
  );
};
