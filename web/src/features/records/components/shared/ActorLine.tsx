import { useReferenceData } from '@/hooks/useReferenceData';
import { formatDateTime } from '@/utils/date';

interface ActorLineProps {
  actorId?: string;
  at?: string;
  prefix?: string;
}

/** "prefix Name (CODE) · dd/mm/yyyy hh:mm" meta line. */
export const ActorLine = ({ actorId, at, prefix }: ActorLineProps) => {
  const { userName } = useReferenceData();
  return (
    <p className="text-xs text-ink-3">
      {prefix ? `${prefix} ` : ''}
      {userName(actorId)} · {formatDateTime(at)}
    </p>
  );
};
