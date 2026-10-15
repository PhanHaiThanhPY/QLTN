import { Link } from 'react-router';
import { RepairStatusBadge } from '@/components/common/StatusBadge';
import type { RepairRecord } from '@/domain/types';
import { formatDateTime } from '@/utils/date';
import { subjectPath } from '@/utils/subject-link';

interface RepairLinksListProps {
  repairs: RepairRecord[];
  emptyText: string;
  limit?: number;
}

/** Linked repair records with their own repair status (separate lifecycle). */
export const RepairLinksList = ({ repairs, emptyText, limit }: RepairLinksListProps) => {
  if (repairs.length === 0) return <p className="text-sm text-ink-2">{emptyText}</p>;
  return (
    <ul className="divide-y divide-line">
      {repairs.slice(0, limit).map((record) => (
        <li key={record.id} className="flex flex-col gap-1 py-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <Link to={subjectPath('REPAIR_RECORD', record.id)} className="font-medium text-accent hover:underline">
              {record.code}
            </Link>{' '}
            <span className="text-sm text-ink">{record.title}</span>
            <div className="text-xs text-ink-2">Tạo {formatDateTime(record.createdAt)}</div>
          </div>
          <RepairStatusBadge status={record.status} />
        </li>
      ))}
    </ul>
  );
};
