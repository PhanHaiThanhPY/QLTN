import { Link } from 'react-router';
import { RepairStatusBadge } from '@/components/common/StatusBadge';
import { Table, Td, Th, Tr } from '@/components/ui/table';
import type { RepairRecord } from '@/domain/types';
import { formatDateTime } from '@/utils/date';
import { formatVnd } from '@/utils/money';
import { subjectPath } from '@/utils/subject-link';

interface ItemRepairTableProps {
  repairs: RepairRecord[];
  repairCosts: Record<string, number>;
  limit?: number;
}

/** Repair records of one item with their approved cost: table on desktop, cards on phones. */
export const ItemRepairTable = ({ repairs, repairCosts, limit }: ItemRepairTableProps) => {
  const rows = repairs.slice(0, limit);
  return (
    <>
      <Table className="min-w-0">
        <thead>
          <tr>
            <Th className="w-24">Mã hồ sơ</Th>
            <Th>Nội dung</Th>
            <Th className="w-32 text-right">Chi phí duyệt</Th>
            <Th className="w-32">Trạng thái</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((record) => (
            <Tr key={record.id}>
              <Td>
                <Link to={subjectPath('REPAIR_RECORD', record.id)} className="font-medium text-accent hover:underline">
                  {record.code}
                </Link>
              </Td>
              <Td>
                <span className="block text-ink">{record.title}</span>
                <span className="block text-xs text-ink-2">Tạo {formatDateTime(record.createdAt)}</span>
              </Td>
              <Td className="tnum whitespace-nowrap text-right font-medium text-ink">{formatVnd(repairCosts[record.id])}</Td>
              <Td><RepairStatusBadge status={record.status} /></Td>
            </Tr>
          ))}
        </tbody>
      </Table>
      <ul className="space-y-2 md:hidden">
        {rows.map((record) => (
          <li key={record.id}>
            <Link to={subjectPath('REPAIR_RECORD', record.id)} className="block rounded-lg border border-line bg-surface p-3 hover:border-accent">
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium text-accent">{record.code}</span>
                <RepairStatusBadge status={record.status} />
              </div>
              <p className="mt-1 text-sm text-ink">{record.title}</p>
              <div className="mt-1.5 flex items-center justify-between gap-2 text-xs text-ink-2">
                <span>{formatDateTime(record.createdAt)}</span>
                <span className="tnum font-semibold text-ink">{formatVnd(repairCosts[record.id])}</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
};
