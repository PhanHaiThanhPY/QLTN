import { Badge } from '@/components/ui/badge';
import type { EmergencyInfo } from '@/domain/types';
import { now } from '@/services/runtime';

const hoursUntil = (to: string): number => Math.round((new Date(to).getTime() - now().getTime()) / 3_600_000);

/**
 * Document deadline of an emergency repair: met, met late, remaining hours, or overdue. In api mode the hours come
 * from the server (`hoursLeft`, B06-S1 BR-E-11), so the badge never depends on this device's clock.
 */
export const EmergencyDeadlineBadge = ({ emergency }: { emergency: EmergencyInfo }) => {
  if (emergency.docsSubmittedAt) {
    if (!emergency.lateReason) return <Badge tone="good">Đã bổ sung đúng hạn</Badge>;
    return (
      <span title={`Lý do trễ: ${emergency.lateReason}`}>
        <Badge tone="warn">Bổ sung trễ hạn</Badge>
      </span>
    );
  }
  const left = emergency.hoursLeft ?? hoursUntil(emergency.docsDueAt);
  const overdue = emergency.docsOverdue ?? left < 0;
  return overdue ? <Badge tone="crit">Quá hạn bổ sung {Math.abs(left)} giờ</Badge> : <Badge tone="warn">Còn khoảng {left} giờ để bổ sung hồ sơ</Badge>;
};
