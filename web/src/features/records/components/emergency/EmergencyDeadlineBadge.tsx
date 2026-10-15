import { Badge } from '@/components/ui/badge';
import type { EmergencyInfo } from '@/domain/types';
import { now } from '@/services/runtime';

const hoursUntil = (to: string): number => Math.round((new Date(to).getTime() - now().getTime()) / 3_600_000);

/** Document deadline of an emergency repair: met, met late, remaining hours, or overdue. */
export const EmergencyDeadlineBadge = ({ emergency }: { emergency: EmergencyInfo }) => {
  if (emergency.docsSubmittedAt) {
    return emergency.lateReason ? <Badge tone="warn">Bổ sung trễ hạn</Badge> : <Badge tone="good">Đã bổ sung đúng hạn</Badge>;
  }
  const left = hoursUntil(emergency.docsDueAt);
  return left >= 0 ? <Badge tone="warn">Còn khoảng {left} giờ để bổ sung hồ sơ</Badge> : <Badge tone="crit">Quá hạn bổ sung {Math.abs(left)} giờ</Badge>;
};
