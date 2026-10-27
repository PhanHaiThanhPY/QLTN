import { Badge } from '@/components/ui/badge';
import type { MyTaskRow } from '@/services/my-tasks-service';

/**
 * Priority of the record ("Ưu tiên khẩn cấp", "Ưu tiên cao"; normal and low show nothing), the B06 emergency flow and
 * "Cần phân công lại", always as words (ui-brief §1).
 */
export const TaskFlags = ({ row }: { row: MyTaskRow }) => (
  <span className="inline-flex flex-wrap gap-1">
    {row.priority === 'URGENT' ? <Badge tone="crit">Ưu tiên khẩn cấp</Badge> : null}
    {row.priority === 'HIGH' ? <Badge tone="warn">Ưu tiên cao</Badge> : null}
    {row.isEmergency ? <Badge tone="crit">Khẩn cấp</Badge> : null}
  </span>
);
