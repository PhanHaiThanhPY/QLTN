import { Link } from 'react-router';
import { buttonVariants } from '@/components/ui/button';
import type { IsoDate } from '@/domain/types';
import { cn } from '@/lib/cn';
import type { MyTaskRow } from '@/services/my-tasks-service';
import { TaskDue } from './TaskDue';
import { TaskFlags } from './TaskFlags';

interface ContinueTaskCardProps {
  row: MyTaskRow;
  now: Date;
  today: IsoDate;
  place: string;
}

/** Phones only: the first task by BR-TK-07, with one button to open it (D1 p. 16, ui-brief §2.2). */
export const ContinueTaskCard = ({ row, now, today, place }: ContinueTaskCardProps) => (
  <section aria-labelledby="continue-task-title" className="rounded-xl border border-l-[3px] border-accent/30 border-l-accent bg-accent-soft p-4 md:hidden">
    <h2 id="continue-task-title" className="text-xs font-bold uppercase tracking-[0.08em] text-accent">Tiếp tục công việc</h2>
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      <span className="font-semibold text-ink">{row.label}</span>
      <TaskDue row={row} now={now} today={today} />
    </div>
    <p className="mt-1 text-sm text-ink">
      {row.code} {row.title}
    </p>
    <p className="text-xs text-ink-2">{place}</p>
    <div className="mt-1"><TaskFlags row={row} /></div>
    <Link to={row.href} className={cn(buttonVariants({ variant: 'primary' }), 'mt-3 w-full')}>Mở hồ sơ</Link>
  </section>
);
