import type { ConstructionLog } from '@/domain/types';
import { ActorLine } from '../shared/ActorLine';
import { RecordFiles } from '../shared/RecordFiles';

/** Construction log timeline, newest first. */
export const ConstructionLogList = ({ logs }: { logs: ConstructionLog[] }) => {
  if (logs.length === 0) return <p className="text-sm text-ink-3">Chưa có nhật ký thi công.</p>;
  return (
    <ol className="relative space-y-4 border-l border-line pl-5">
      {[...logs].reverse().map((log) => (
        <li key={log.id} className="relative">
          <span className="absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full bg-accent ring-4 ring-surface" aria-hidden />
          <p className="text-sm font-medium text-ink">
            Tiến độ <span className="tnum">{log.progressPercent}%</span>
          </p>
          <ActorLine actorId={log.actorId} at={log.createdAt} />
          <p className="mt-1 whitespace-pre-line text-sm text-ink">{log.note}</p>
          {log.attachmentIds.length > 0 ? (
            <div className="mt-2">
              <RecordFiles ids={log.attachmentIds} />
            </div>
          ) : null}
        </li>
      ))}
    </ol>
  );
};
