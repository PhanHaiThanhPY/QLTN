import { Link } from 'react-router';
import { RepairStatusBadge } from '@/components/common/StatusBadge';
import { Table, Td, Th, Tr } from '@/components/ui/table';
import { useReferenceData } from '@/hooks/useReferenceData';
import type { RecordListItem } from '@/services/records-service';
import { formatDateTime } from '@/utils/date';
import { RecordFlags } from './RecordFlags';

/** Desktop table of records (hidden below md). */
export const RecordTable = ({ items }: { items: RecordListItem[] }) => {
  const { userName, locationName, buildingName } = useReferenceData();
  return (
    <Table>
      <thead>
        <tr>
          <Th>Mã</Th>
          <Th className="min-w-72">Hồ sơ / nơi sửa chữa</Th>
          <Th>Trạng thái</Th>
          <Th>BQL quản lý</Th>
          <Th>Cập nhật</Th>
        </tr>
      </thead>
      <tbody>
        {items.map(({ record, isOverdue, needsReassignment }) => (
          <Tr key={record.id}>
            <Td className="whitespace-nowrap font-medium">
              <Link to={`/records/${record.id}`} className="text-accent hover:underline">
                {record.code}
              </Link>
            </Td>
            <Td>
              <Link to={`/records/${record.id}`} className="font-medium text-ink hover:text-accent">
                {record.title || '(Chưa đặt tên)'}
              </Link>
              <p className="mt-1 text-xs font-semibold text-accent">{buildingName(record.buildingId)}</p>
              <p className="text-xs text-ink-2">{locationName(record.locationId)}</p>
            </Td>
            <Td>
              <div className="flex flex-col items-start gap-1">
                <RepairStatusBadge status={record.status} />
                <RecordFlags isOverdue={isOverdue} needsReassignment={needsReassignment} isEmergency={Boolean(record.emergency)} />
              </div>
            </Td>
            <Td className="text-sm">{userName(record.managerUserId)}</Td>
            <Td className="whitespace-nowrap text-sm text-ink-3">{formatDateTime(record.updatedAt)}</Td>
          </Tr>
        ))}
      </tbody>
    </Table>
  );
};
