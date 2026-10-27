import { Link } from 'react-router';
import { RepairStatusBadge } from '@/components/common/StatusBadge';
import { Dialog } from '@/components/ui/dialog';
import type { IsoDate } from '@/domain/types';
import { cn } from '@/lib/cn';
import type { ScheduleEntry } from '@/services/schedule-service';
import { ScheduleFlags } from './ScheduleFlags';
import { entryLabel, entryTone, recordTitle, shortDate, spanText } from './repair-schedule-ui';

interface ScheduleDayDialogProps {
  day: IsoDate | null;
  entries: readonly ScheduleEntry[];
  onClose: () => void;
}

/** Every record of one month day behind "+n": centered on a wide screen, a bottom sheet on a phone; Esc closes it. */
export const ScheduleDayDialog = ({ day, entries, onClose }: ScheduleDayDialogProps) => (
  <Dialog
    open={day !== null}
    onOpenChange={(open) => {
      if (!open) onClose();
    }}
    title={day ? `Ngày ${shortDate(day)}/${day.slice(0, 4)}` : ''}
    description={`${entries.length} hồ sơ thi công`}
    size="sm"
  >
    <ul className="space-y-2">
      {entries.map((entry) => (
        <li key={entry.record.id}>
          <Link to={`/records/${entry.record.id}`} aria-label={entryLabel(entry)} className={cn('block rounded-md border-l-[3px] px-3 py-2', entryTone(entry))}>
            <p className="text-sm font-bold">{entry.record.code} · {recordTitle(entry)}</p>
            <p className="mt-0.5 text-xs text-ink-2">{spanText(entry)}</p>
            <div className="mt-1 flex flex-wrap gap-1">
              <RepairStatusBadge status={entry.record.status} />
              <ScheduleFlags entry={entry} />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  </Dialog>
);
