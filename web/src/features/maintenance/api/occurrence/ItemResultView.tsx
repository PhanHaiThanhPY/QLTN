import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { AttachmentList } from '@/components/common/AttachmentList';
import { Badge, StatusPill } from '@/components/ui/badge';
import { effectiveResult, type ChecklistItemRule } from '@/domain/maintenance-execution';
import type { Attachment } from '@/domain/types';
import { cn } from '@/lib/cn';
import type { LinkedRepair, WorkEntry } from '@/services/maintenance-occurrences-api';
import { RESULT_TEXT, RESULT_TONE, repairText } from './occurrence-ui';

interface ItemResultViewProps {
  index: number;
  item: ChecklistItemRule;
  entry?: WorkEntry;
  files: Readonly<Record<string, Attachment>>;
  repair?: LinkedRepair;
  /** Reviewer controls or extra lines under the result. */
  children?: ReactNode;
  error?: string;
  highlight?: boolean;
}

/** A checklist item's result, read-only (reviewer, history, viewers). */
export const ItemResultView = ({ index, item, entry, files, repair, children, error, highlight = false }: ItemResultViewProps) => {
  const result = entry ? effectiveResult(item, entry) : null;
  return (
    <section
      id={`item-${item.id}`}
      tabIndex={-1}
      className={cn('rounded-xl border bg-surface p-3.5 shadow-card outline-none', error ? 'border-crit' : 'border-line', highlight ? 'border-l-[3px] border-l-warn bg-warn-soft' : '')}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink">
          {index + 1}. {item.label}
          {entry?.value !== null && entry?.value !== undefined ? <span className="font-normal text-ink-2"> · {entry.value} {item.unit}</span> : null}
        </h3>
        {result ? <StatusPill tone={RESULT_TONE[result]}>{RESULT_TEXT[result]}</StatusPill> : <Badge tone="outline">Chưa kiểm</Badge>}
      </div>
      {entry?.note ? <p className="mt-1 text-sm text-ink-2">“{entry.note}”</p> : null}
      {entry?.attachmentIds.length ? (
        <div className="mt-2">
          <AttachmentList attachments={entry.attachmentIds.flatMap((id) => (files[id] ? [files[id]] : []))} />
        </div>
      ) : null}
      {repair ? (
        <p className="mt-2 text-sm text-ink-2">
          Hồ sơ sửa chữa:{' '}
          <Link to={`/records/${repair.id}`}>
            <Badge tone="info">{repairText(repair)}</Badge>
          </Link>
        </p>
      ) : null}
      {children}
      {error ? <p className="mt-1 text-sm text-crit" role="alert">{error}</p> : null}
    </section>
  );
};
