import { Link } from 'react-router';
import { Badge } from '@/components/ui/badge';
import { Table, Td, Th, Tr } from '@/components/ui/table';
import type { ApiPlanRow } from '@/services/maintenance-plans-api';
import { formatDate } from '@/utils/date';
import { PlanApiStatusBadge } from './PlanApiStatusBadge';

interface PlanApiTableProps {
  rows: ApiPlanRow[];
  placeName: (row: ApiPlanRow) => string;
  userName: (id?: string) => string;
}

const ReassignFlag = ({ row }: { row: ApiPlanRow }) => (row.needsReassignment ? <Badge tone="warn">Cần giao lại</Badge> : null);

/** Plans of api mode (ui-brief §2.1): table from md, one card per plan on phones. */
export const PlanApiTable = ({ rows, placeName, userName }: PlanApiTableProps) => (
  <>
    <Table>
      <thead>
        <tr>
          <Th scope="col" className="w-20">Mã</Th>
          <Th scope="col" className="min-w-72">Kế hoạch</Th>
          <Th scope="col" className="min-w-56">Phụ trách</Th>
          <Th scope="col">Chu kỳ</Th>
          <Th scope="col">Lượt kế tiếp</Th>
          <Th scope="col">Trạng thái</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <Tr key={row.id}>
            <Td className="w-20">
              <Link to={`/maintenance/plans/${row.id}`} className="font-medium text-accent hover:underline">
                {row.code}
              </Link>
            </Td>
            <Td className="min-w-72">
              <div className="font-medium text-ink">{row.name}</div>
              <div className="text-xs text-ink-2">
                {row.item.code} – {row.item.name} · {placeName(row)}
              </div>
            </Td>
            <Td className="min-w-56 text-xs text-ink-2">
              <div>Thực hiện: {userName(row.performerUserId)}</div>
              <div>Xác nhận: {userName(row.reviewerUserId)}</div>
            </Td>
            <Td>{row.schedule?.label ?? '—'}</Td>
            <Td>{row.nextDate ? formatDate(row.nextDate) : '—'}</Td>
            <Td>
              <div className="flex flex-wrap items-center gap-1.5">
                <PlanApiStatusBadge status={row.status} />
                <ReassignFlag row={row} />
              </div>
            </Td>
          </Tr>
        ))}
      </tbody>
    </Table>
    <ul className="space-y-2 md:hidden">
      {rows.map((row) => (
        <li key={row.id}>
          <Link to={`/maintenance/plans/${row.id}`} className="block rounded-lg border border-line bg-surface p-3 hover:border-accent">
            <div className="flex items-start justify-between gap-2">
              <span className="font-medium text-accent">{row.code}</span>
              <span className="flex flex-wrap justify-end gap-1.5">
                <PlanApiStatusBadge status={row.status} />
                <ReassignFlag row={row} />
              </span>
            </div>
            <p className="mt-1 text-sm font-medium text-ink">{row.name}</p>
            <p className="text-xs text-ink-2">
              {row.item.code} – {row.item.name} · {placeName(row)}
            </p>
            <p className="mt-1 text-sm text-ink-2">
              {row.schedule?.label ?? '—'}
              {row.nextDate ? ` · Lượt kế tiếp ${formatDate(row.nextDate)}` : ''}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  </>
);
