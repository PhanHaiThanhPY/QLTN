import { useState } from 'react';
import { Link } from 'react-router';
import { AlertTriangle } from 'lucide-react';
import { AttachmentList } from '@/components/common/AttachmentList';
import { FileUploader } from '@/components/common/FileUploader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { isOutOfRange, thresholdText, type ChecklistItemRule } from '@/domain/maintenance-execution';
import type { Attachment } from '@/domain/types';
import { cn } from '@/lib/cn';
import type { LinkedRepair } from '@/services/maintenance-occurrences-api';
import { draftResult, parseMeasure, repairText, type EntryDraft } from './occurrence-ui';
import { ResultRadioGroup } from './ResultRadioGroup';

interface WorkItemCardProps {
  index: number;
  item: ChecklistItemRule;
  draft: EntryDraft;
  occurrenceId: string;
  files: Readonly<Record<string, Attachment>>;
  onChange: (change: Partial<EntryDraft>) => void;
  onUploaded: (files: Attachment[]) => void;
  disabled: boolean;
  error?: string;
  /** The reviewer's reason when the item was sent back. */
  reworkReason?: string;
  repair?: LinkedRepair;
  /** The plan's manager may make a repair record from a failed item without one. */
  onCreateRepair?: () => void;
}

/** One checklist item for the performer (ui-brief §2.1): result, measurement, note and photos when needed. */
export const WorkItemCard = ({ index, item, draft, occurrenceId, files, onChange, onUploaded, disabled, error, reworkReason, repair, onCreateRepair }: WorkItemCardProps) => {
  const [expanded, setExpanded] = useState(false);
  const result = draftResult(item, draft);
  const measured = item.kind === 'MEASUREMENT';
  const value = parseMeasure(draft.value);
  const outOfRange = measured && isOutOfRange(item, value);
  const threshold = thresholdText(item);
  const showDetails = expanded || result === 'FAIL' || result === 'NA' || item.photoRequired || Boolean(draft.note) || draft.attachmentIds.length > 0;
  const errorId = `item-${item.id}-error`;
  const noteRequired = result === 'FAIL' || result === 'NA';
  return (
    <section
      id={`item-${item.id}`}
      tabIndex={-1}
      aria-labelledby={`item-${item.id}-title`}
      className={cn(
        'rounded-xl border bg-surface p-3.5 shadow-card outline-none',
        error ? 'border-crit' : 'border-line',
        result === 'FAIL' && !error ? 'bg-crit-soft/40' : '',
        reworkReason ? 'border-l-[3px] border-l-warn bg-warn-soft' : '',
      )}
    >
      <h3 id={`item-${item.id}-title`} className="text-sm font-semibold text-ink">
        {index + 1}. {item.label}
        {item.required ? <span className="text-crit"> *</span> : null}
        {item.photoRequired ? <span className="font-normal text-ink-2"> · Cần ảnh</span> : null}
        {measured && item.unit ? <span className="font-normal text-ink-2"> · {item.unit}{threshold ? ` · ngưỡng ${threshold}` : ''}</span> : null}
      </h3>
      {reworkReason ? <p className="mt-1 text-sm text-ink">Cần làm lại: {reworkReason}</p> : null}
      <div className="mt-2.5 space-y-2.5">
        {measured ? (
          <div>
            <label htmlFor={`value-${item.id}`} className="sr-only">
              {item.label} ({item.unit ?? 'số đo'}{threshold ? `, ngưỡng ${threshold}` : ''})
            </label>
            <div className="flex items-center gap-2">
              <Input
                id={`value-${item.id}`}
                inputMode="decimal"
                className="min-h-11 w-32"
                value={draft.value}
                disabled={disabled}
                aria-invalid={Boolean(error) || outOfRange}
                aria-describedby={error ? errorId : undefined}
                onChange={(event) => onChange({ value: event.target.value })}
              />
              <span className="text-sm text-ink-2">{item.unit}</span>
            </div>
            {outOfRange ? (
              <p className="mt-1 flex items-center gap-1 text-sm text-crit">
                <AlertTriangle className="h-4 w-4" aria-hidden /> Ngoài ngưỡng {threshold} → Lỗi
              </p>
            ) : null}
          </div>
        ) : null}
        <ResultRadioGroup
          label={item.label}
          value={result}
          lockedTo={outOfRange ? 'FAIL' : undefined}
          disabled={disabled}
          describedBy={error ? errorId : undefined}
          onChange={(next) => onChange({ result: next })}
        />
        {showDetails ? (
          <>
            <div>
              <label htmlFor={`note-${item.id}`} className="text-sm font-medium text-ink">
                Ghi chú{noteRequired ? <span className="text-crit"> *</span> : ' (không bắt buộc)'}
              </label>
              <Textarea id={`note-${item.id}`} rows={2} className="mt-1" value={draft.note} disabled={disabled} onChange={(event) => onChange({ note: event.target.value })} />
            </div>
            {/* Shared file controls get 44px targets here (ui-brief §4: gloves, one hand). */}
            <div className="space-y-1.5 [&_button]:min-h-11 [&_button]:min-w-11">
              <span className="text-sm font-medium text-ink">
                Ảnh{result === 'FAIL' || item.photoRequired ? <span className="text-crit"> *</span> : null}
              </span>
              <AttachmentList
                attachments={draft.attachmentIds.flatMap((id) => (files[id] ? [files[id]] : []))}
                emptyText="Chưa có ảnh."
                onRemove={disabled ? undefined : (id) => onChange({ attachmentIds: draft.attachmentIds.filter((value) => value !== id) })}
              />
              {disabled ? null : (
                <FileUploader
                  subjectType="MAINTENANCE_OCCURRENCE"
                  subjectId={occurrenceId}
                  purpose="MAINTENANCE_RESULT"
                  accept="image/*"
                  label="Chụp / chọn ảnh"
                  onUploaded={(added) => {
                    onUploaded(added);
                    onChange({ attachmentIds: [...draft.attachmentIds, ...added.map((file) => file.id)] });
                  }}
                />
              )}
            </div>
          </>
        ) : (
          <Button variant="ghost" size="sm" className="min-h-11" disabled={disabled} onClick={() => setExpanded(true)}>
            Thêm ghi chú/ảnh
          </Button>
        )}
        {repair ? (
          <p className="text-sm text-ink-2">
            Hồ sơ sửa chữa:{' '}
            <Link to={`/records/${repair.id}`} className="hover:underline">
              <Badge tone="info">{repairText(repair)}</Badge>
            </Link>
          </p>
        ) : null}
        {!repair && onCreateRepair && result === 'FAIL' ? (
          <Button variant="secondary" size="sm" className="min-h-11" onClick={onCreateRepair}>
            Tạo hồ sơ sửa chữa từ mục này
          </Button>
        ) : null}
        {error ? (
          <p id={errorId} className="text-sm text-crit" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </section>
  );
};
