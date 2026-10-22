import { AttachmentList } from '@/components/common/AttachmentList';
import { Badge } from '@/components/ui/badge';
import type { Attachment, MaintenanceChecklistEntry } from '@/domain/types';
import { CheckResultBadge } from './CheckResultBadge';

interface ChecklistEntriesViewProps {
  entries: MaintenanceChecklistEntry[];
  attachmentsById: Map<string, Attachment>;
}

export const pickAttachments = (ids: string[], attachmentsById: Map<string, Attachment>): Attachment[] =>
  ids.map((id) => attachmentsById.get(id)).filter((row): row is Attachment => Boolean(row));

/** Read-only checklist answers (working copy or an immutable submission snapshot). */
export const ChecklistEntriesView = ({ entries, attachmentsById }: ChecklistEntriesViewProps) => (
  <ol className="divide-y divide-line">
    {entries.map((entry, index) => (
      <li key={entry.templateItemId} className="py-2.5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 text-sm text-ink">
            <span className="mr-1 text-ink-3">{index + 1}.</span>
            {entry.label}
            {entry.required ? (
              <Badge tone="accent" className="ml-2">
                Bắt buộc
              </Badge>
            ) : null}
          </div>
          <CheckResultBadge result={entry.result} required={entry.required} />
        </div>
        {entry.note ? <p className="mt-1 text-sm text-ink-2">Ghi chú: {entry.note}</p> : null}
        {entry.inputType === 'MEASUREMENT' ? (
          <p className="mt-1 text-sm text-ink-2">
            Số đo: {entry.measurementValue ?? '—'} {entry.unit ?? ''}
            {entry.minValue !== undefined || entry.maxValue !== undefined ? ` (chuẩn ${entry.minValue ?? '—'} – ${entry.maxValue ?? '—'})` : ''}
          </p>
        ) : null}
        {entry.attachmentIds.length > 0 ? (
          <div className="mt-2">
            <AttachmentList attachments={pickAttachments(entry.attachmentIds, attachmentsById)} />
          </div>
        ) : null}
      </li>
    ))}
  </ol>
);
