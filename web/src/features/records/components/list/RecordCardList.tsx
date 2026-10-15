import { Link } from 'react-router';
import { RepairStatusBadge } from '@/components/common/StatusBadge';
import { useReferenceData } from '@/hooks/useReferenceData';
import type { RecordListItem } from '@/services/records-service';
import { formatDateTime } from '@/utils/date';
import { RecordFlags } from './RecordFlags';

/** Mobile card list of records (shown below md). */
export const RecordCardList = ({ items }: { items: RecordListItem[] }) => {
  const { userName, locationName } = useReferenceData();
  return (
    <ul className="space-y-3 md:hidden">
      {items.map(({ record, isOverdue, needsReassignment }) => (
        <li key={record.id}>
          <Link to={`/records/${record.id}`} className="block rounded-lg border border-line bg-surface p-3.5 active:bg-surface-2">
            <div className="flex items-start justify-between gap-2">
              <span className="text-sm font-semibold text-accent">{record.code}</span>
              <RepairStatusBadge status={record.status} />
            </div>
            <p className="mt-1 font-medium text-ink">{record.title || '(Chưa đặt tên)'}</p>
            <p className="mt-0.5 text-sm text-ink-3">{locationName(record.locationId)}</p>
            <div className="mt-2">
              <RecordFlags isOverdue={isOverdue} needsReassignment={needsReassignment} isEmergency={Boolean(record.emergency)} />
            </div>
            <p className="mt-2 text-xs text-ink-3">
              {userName(record.managerUserId)} · {formatDateTime(record.updatedAt)}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
};
