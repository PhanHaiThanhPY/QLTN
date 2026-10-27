import { Link } from 'react-router';
import { RepairStatusBadge } from '@/components/common/StatusBadge';
import { Table, Td, Th, Tr } from '@/components/ui/table';
import type { ItemRepairRow } from '@/services/maintenance-items-api';
import { formatDateTime } from '@/utils/date';
import { formatVndText } from '@/utils/money';

const costOf = (row: ItemRepairRow): string => (row.approvedAmountVnd ? formatVndText(row.approvedAmountVnd) : 'Chưa duyệt');

/** Repair records of an item (MT-S1 BR-MT-08): code, title, created, status, approved cost; each opens its record. */
export const ItemApiRepairTable = ({ repairs }: { repairs: readonly ItemRepairRow[] }) => {
  if (repairs.length === 0) return <p className="text-sm text-ink-2">Chưa có hồ sơ sửa chữa nào cho thiết bị này.</p>;
  return (
    <>
      <Table>
        <thead>
          <tr>
            <Th scope="col">Mã</Th>
            <Th scope="col" className="min-w-56">Tên hồ sơ</Th>
            <Th scope="col">Ngày tạo</Th>
            <Th scope="col">Trạng thái</Th>
            <Th scope="col" className="text-right">Chi phí đã duyệt</Th>
          </tr>
        </thead>
        <tbody>
          {repairs.map((row) => (
            <Tr key={row.id}>
              <Td>
                <Link to={`/records/${row.id}`} className="font-medium text-accent hover:underline">{row.code}</Link>
              </Td>
              <Td>{row.title || '(Chưa đặt tên)'}</Td>
              <Td className="text-xs text-ink-2">{formatDateTime(row.createdAt)}</Td>
              <Td><RepairStatusBadge status={row.status} /></Td>
              <Td className="text-right tabular-nums">{costOf(row)}</Td>
            </Tr>
          ))}
        </tbody>
      </Table>
      <ul className="space-y-2 md:hidden">
        {repairs.map((row) => (
          <li key={row.id}>
            <Link to={`/records/${row.id}`} className="block rounded-lg border border-line bg-surface p-3 hover:border-accent">
              <span className="flex items-start justify-between gap-2">
                <span className="font-medium text-accent">{row.code}</span>
                <RepairStatusBadge status={row.status} />
              </span>
              <span className="mt-1 block text-sm text-ink">{row.title || '(Chưa đặt tên)'}</span>
              <span className="mt-1 block text-xs text-ink-2">{formatDateTime(row.createdAt)} · {costOf(row)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
};
