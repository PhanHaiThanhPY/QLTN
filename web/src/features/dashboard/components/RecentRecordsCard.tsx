import { Link } from 'react-router';
import { EmptyState } from '@/components/common/States';
import { RepairStatusBadge } from '@/components/common/StatusBadge';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import type { RepairRecord } from '@/domain/types';
import { formatDateTime } from '@/utils/date';
import { subjectPath } from '@/utils/subject-link';

interface RecentRecordsCardProps {
  records: RepairRecord[];
  buildingName: (id?: string) => string;
}

/** Most recently updated repair records in the viewer's buildings. */
export const RecentRecordsCard = ({ records, buildingName }: RecentRecordsCardProps) => (
  <Card>
    <CardHeader
      title="Hồ sơ gần đây"
      actions={
        <Link to="/records" className="text-sm font-medium text-accent hover:underline">
          Xem tất cả
        </Link>
      }
    />
    <CardBody>
      {records.length === 0 ? (
        <EmptyState title="Chưa có hồ sơ sửa chữa" />
      ) : (
        <ul className="divide-y divide-line">
          {records.map((record) => (
            <li key={record.id}>
              <Link to={subjectPath('REPAIR_RECORD', record.id)} className="-mx-2 flex flex-col gap-1 rounded-lg px-2 py-2.5 hover:bg-surface-2">
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-ink">{record.code}</span>
                  <RepairStatusBadge status={record.status} />
                </span>
                <span className="truncate text-sm text-ink">{record.title}</span>
                <span className="text-xs text-ink-2">
                  {buildingName(record.buildingId)} · Cập nhật {formatDateTime(record.updatedAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </CardBody>
  </Card>
);
