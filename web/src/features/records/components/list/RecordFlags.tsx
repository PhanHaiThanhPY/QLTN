import { Badge } from '@/components/ui/badge';
import type { RepairRecord } from '@/domain/types';

interface RecordFlagsProps {
  isOverdue: boolean;
  needsReassignment: boolean;
  /** Work started before approval (emergency repair); shown even once the record is closed. */
  isEmergency?: boolean;
  /** Emergency documents not submitted and past their deadline (B06-S1 ui-brief §2.4). */
  isDocsOverdue?: boolean;
}

/** The server's `docsOverdue` (api mode) while the proposal has not been submitted yet. */
export const isDocsOverdue = (record: Pick<RepairRecord, 'emergency'>): boolean =>
  Boolean(record.emergency?.docsOverdue && !record.emergency.docsSubmittedAt);

/** Attention badges: emergency repair, overdue documents, overdue step and inactive assignee. */
export const RecordFlags = ({ isOverdue, needsReassignment, isEmergency = false, isDocsOverdue: docsOverdue = false }: RecordFlagsProps) => {
  if (!isOverdue && !needsReassignment && !isEmergency && !docsOverdue) return null;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {isEmergency ? <Badge tone="crit">Khẩn cấp</Badge> : null}
      {docsOverdue ? <Badge tone="crit">Quá hạn bổ sung</Badge> : null}
      {isOverdue ? <Badge tone="crit">Quá hạn</Badge> : null}
      {needsReassignment ? <Badge tone="warn">Cần phân công lại</Badge> : null}
    </span>
  );
};
