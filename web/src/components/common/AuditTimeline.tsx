import type { AuditEvent } from '@/domain/types';
import { useReferenceData } from '@/hooks/useReferenceData';
import { formatDateTime } from '@/utils/date';
import { ACTION_LABEL, statusText } from './audit-labels';

interface AuditTimelineProps {
  events: AuditEvent[];
}

/** Read-only history (newest first). */
export const AuditTimeline = ({ events }: AuditTimelineProps) => {
  const { userName } = useReferenceData();
  if (events.length === 0) return <p className="text-sm text-ink-3">Chưa có lịch sử.</p>;
  return (
    <ol className="relative space-y-4 border-l border-line-2 pl-5">
      {events.map((event) => (
        <li key={event.id} className="relative">
          <span className="absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full bg-accent ring-4 ring-surface" aria-hidden />
          <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
            <span className="font-medium text-ink">{ACTION_LABEL[event.action] ?? event.action}</span>
            {event.fromStatus !== event.toStatus && event.toStatus ? (
              <span className="text-ink-2">
                {event.fromStatus ? `${statusText(event.fromStatus)} → ` : ''}
                {statusText(event.toStatus)}
              </span>
            ) : null}
          </div>
          <div className="text-xs text-ink-3">
            {formatDateTime(event.createdAt)} · {userName(event.actorId)}
            {event.triggeredBy ? ` (khi ${userName(event.triggeredBy)} mở màn hình)` : ''} · phiên bản {event.entityVersion}
          </div>
          {event.reason ? <p className="mt-1 rounded-md border border-line bg-surface-2 px-2.5 py-1.5 text-sm text-ink">{event.reason}</p> : null}
        </li>
      ))}
    </ol>
  );
};
