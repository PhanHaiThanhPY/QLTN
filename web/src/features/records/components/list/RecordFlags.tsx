import { Badge } from '@/components/ui/badge';

interface RecordFlagsProps {
  isOverdue: boolean;
  needsReassignment: boolean;
  /** Work started before approval (emergency repair). */
  isEmergency?: boolean;
}

/** Attention badges: emergency repair, overdue step and inactive assignee. */
export const RecordFlags = ({ isOverdue, needsReassignment, isEmergency = false }: RecordFlagsProps) => {
  if (!isOverdue && !needsReassignment && !isEmergency) return null;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {isEmergency ? <Badge tone="crit">Khẩn cấp</Badge> : null}
      {isOverdue ? <Badge tone="crit">Quá hạn</Badge> : null}
      {needsReassignment ? <Badge tone="warn">Cần phân công lại</Badge> : null}
    </span>
  );
};
