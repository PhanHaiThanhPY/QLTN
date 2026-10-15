import { ArrowRight } from 'lucide-react';
import { ACTION_LABEL } from '@/components/common/audit-labels';
import { ITEM_CONDITION_LABEL } from '@/domain/constants';
import type { ItemCondition } from '@/domain/constants';
import type { AuditEvent } from '@/domain/types';
import { useReferenceData } from '@/hooks/useReferenceData';
import { formatDateTime } from '@/utils/date';
import { ConditionBadge } from './ConditionBadge';

const isCondition = (value?: string): value is ItemCondition => Boolean(value && value in ITEM_CONDITION_LABEL);

/** Condition changes (old → new) of an item, rebuilt from its audit trail. */
export const ConditionHistory = ({ audit }: { audit: AuditEvent[] }) => {
  const { userName } = useReferenceData();
  const events = audit.filter(
    (event) => event.action === 'createMaintenanceItem' || (isCondition(event.toStatus) && event.fromStatus !== event.toStatus),
  );
  if (events.length === 0) return <p className="text-sm text-ink-2">Chưa có thay đổi tình trạng.</p>;
  return (
    <ul className="space-y-3">
      {events.map((event) => (
        <li key={event.id} className="text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-ink">{ACTION_LABEL[event.action] ?? event.action}</span>
            {isCondition(event.fromStatus) && event.action !== 'createMaintenanceItem' ? <ConditionBadge condition={event.fromStatus} /> : null}
            {isCondition(event.fromStatus) && event.action !== 'createMaintenanceItem' ? <ArrowRight className="size-3.5 text-ink-3" aria-label="thành" /> : null}
            {isCondition(event.toStatus) ? <ConditionBadge condition={event.toStatus} /> : null}
          </div>
          <div className="mt-0.5 text-xs text-ink-2">
            {formatDateTime(event.createdAt)} · {userName(event.actorId)}
          </div>
          {event.reason ? <p className="mt-1 rounded-md bg-surface-2 px-2.5 py-1.5 text-ink">{event.reason}</p> : null}
        </li>
      ))}
    </ul>
  );
};
