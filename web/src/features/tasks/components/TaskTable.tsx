import { Link } from 'react-router';
import { RepairStatusBadge } from '@/components/common/StatusBadge';
import { Table, Td, Th, Tr } from '@/components/ui/table';
import type { IsoDate } from '@/domain/types';
import type { MyTaskRow } from '@/services/my-tasks-service';
import { taskAriaLabel } from '../task-list';
import { SubjectTypeBadge } from './SubjectTypeBadge';
import { TaskDue } from './TaskDue';
import { TaskFlags } from './TaskFlags';

interface TaskTableProps {
  rows: readonly MyTaskRow[];
  buildingName: (id?: string) => string;
  locationName: (id?: string) => string;
  now: Date;
  today: IsoDate;
}

const Status = ({ row }: { row: MyTaskRow }) => (row.status ? <RepairStatusBadge status={row.status} /> : <SubjectTypeBadge subjectType={row.subjectType} />);

/**
 * Open tasks from 768px (ui-brief §2.1, §3): the whole row is one link to the right record tab, named for screen
 * readers; below 1024px the status moves under the record.
 */
export const TaskTable = ({ rows, buildingName, locationName, now, today }: TaskTableProps) => (
  <Table>
    <thead>
      <tr>
        <Th scope="col">Việc</Th>
        <Th scope="col">Hồ sơ</Th>
        <Th scope="col">Ưu tiên</Th>
        <Th scope="col">Hạn</Th>
        <Th scope="col" className="hidden lg:table-cell">Trạng thái</Th>
      </tr>
    </thead>
    <tbody>
      {rows.map((row) => (
        <Tr key={row.id} className="relative hover:bg-surface-2">
          <Td className="font-medium text-ink">
            <Link to={row.href} aria-label={taskAriaLabel(row, now, today)} className="after:absolute after:inset-0 hover:text-accent">
              {row.label}
            </Link>
            {row.detail ? <p className="mt-0.5 text-xs font-normal text-ink-2">{row.detail}</p> : null}
          </Td>
          <Td>
            <p className="font-medium text-ink">
              {row.code} <span className="font-normal">{row.title}</span>
            </p>
            <p className="text-xs text-ink-2">
              {buildingName(row.buildingId)}
              {row.locationId ? ` · ${locationName(row.locationId)}` : ''}
            </p>
            <div className="mt-1 lg:hidden"><Status row={row} /></div>
          </Td>
          <Td><TaskFlags row={row} /></Td>
          <Td><TaskDue row={row} now={now} today={today} /></Td>
          <Td className="hidden lg:table-cell"><Status row={row} /></Td>
        </Tr>
      ))}
    </tbody>
  </Table>
);
