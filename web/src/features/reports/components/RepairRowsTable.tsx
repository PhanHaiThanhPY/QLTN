import { Link } from 'react-router';
import { RepairStatusBadge } from '@/components/common/StatusBadge';
import { Table, Td, Th, Tr } from '@/components/ui/table';
import type { RepairReportRow } from '@/services/report-service';
import { formatDate, formatDateTime } from '@/utils/date';
import { formatVnd } from '@/utils/money';
import { subjectPath } from '@/utils/subject-link';

interface RepairRowsTableProps {
  rows: RepairReportRow[];
  buildingName: (id?: string) => string;
}

/** Records created in the period (same rows as the CSV export). */
export const RepairRowsTable = ({ rows, buildingName }: RepairRowsTableProps) => (
  <>
    <Table>
      <thead>
        <tr>
          <Th>Mã hồ sơ</Th>
          <Th>Tên hồ sơ</Th>
          <Th>Tòa nhà</Th>
          <Th>Trạng thái</Th>
          <Th>Ngày tạo</Th>
          <Th className="text-right">Giá trị duyệt</Th>
          <Th className="text-right">Đã thanh toán</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <Tr key={row.record.id}>
            <Td className="font-medium">
              <Link to={subjectPath('REPAIR_RECORD', row.record.id)} className="text-accent hover:underline">
                {row.record.code}
              </Link>
            </Td>
            <Td>{row.record.title}</Td>
            <Td className="text-ink-2">{buildingName(row.record.buildingId)}</Td>
            <Td>
              <RepairStatusBadge status={row.record.status} />
            </Td>
            <Td className="whitespace-nowrap">{formatDateTime(row.record.createdAt)}</Td>
            <Td className="tnum text-right whitespace-nowrap">{formatVnd(row.approvedAmount)}</Td>
            <Td className="tnum text-right whitespace-nowrap">{row.paidAmount > 0 ? formatVnd(row.paidAmount) : '—'}</Td>
          </Tr>
        ))}
      </tbody>
    </Table>
    <ul className="space-y-2 md:hidden">
      {rows.map((row) => (
        <li key={row.record.id}>
          <Link to={subjectPath('REPAIR_RECORD', row.record.id)} className="block rounded-lg border border-line px-3.5 py-3 hover:bg-surface-2">
            <span className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium text-accent">{row.record.code}</span>
              <RepairStatusBadge status={row.record.status} />
            </span>
            <span className="mt-1 block text-sm text-ink">{row.record.title}</span>
            <span className="mt-1 block text-xs text-ink-2">
              Duyệt: {formatVnd(row.approvedAmount)} · Đã TT: {row.paidAmount > 0 ? formatVnd(row.paidAmount) : '—'}
              {row.paidDate ? ` (${formatDate(row.paidDate)})` : ''}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  </>
);
