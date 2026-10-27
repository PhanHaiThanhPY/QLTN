import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AttachmentList } from '@/components/common/AttachmentList';
import { FileUploader } from '@/components/common/FileUploader';
import { Notice } from '@/components/common/Notice';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input, Textarea } from '@/components/ui/input';
import { ERROR_CODE } from '@/domain/errors';
import type { Attachment } from '@/domain/types';
import { useCommand } from '@/hooks/useCommand';
import { useOnline } from '@/hooks/useOnline';
import type { OccurrenceDetail } from '@/services/maintenance-occurrences-api';
import { draftProblems, progressText, toDraft, toPayload, type EntryDraft, type WorkDraft } from './occurrence-ui';
import { ConflictNotice } from './ConflictNotice';
import { UnsavedChangesGuard } from './UnsavedChangesGuard';
import { WorkItemCard } from './WorkItemCard';

interface WorkEditorProps {
  detail: OccurrenceDetail;
  /** The plan's manager may also make a repair record from a failed item. */
  onCreateRepair?: (itemId: string) => void;
  /** Fetches the occurrence again and starts the form over from it. */
  onReload: () => void;
}

const focusItem = (field: string) => {
  const target = document.getElementById(field.startsWith('entries.') ? `item-${field.slice('entries.'.length)}` : `work-${field}`);
  if (typeof target?.scrollIntoView === 'function') target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  target?.focus({ preventScroll: true });
};

/**
 * The performer's form (SPEC MT-S3 BR-MT3-03, BR-MT3-04, ui-brief §2.1): saved as often as needed; a submission
 * checked item by item first; a network failure keeps every value typed (AC-MT3.17).
 */
export const WorkEditor = ({ detail, onCreateRepair, onReload }: WorkEditorProps) => {
  const { occurrence } = detail;
  const online = useOnline();
  const command = useCommand();
  const [draft, setDraft] = useState<WorkDraft>(() => toDraft(occurrence));
  const [saved, setSaved] = useState<string>(() => JSON.stringify(toPayload(toDraft(occurrence))));
  const [uploaded, setUploaded] = useState<Record<string, Attachment>>({});
  const [problems, setProblems] = useState<Record<string, string>>({});
  const files = useMemo(() => ({ ...detail.files, ...uploaded }), [detail.files, uploaded]);
  const dirty = JSON.stringify(toPayload(draft)) !== saved;
  const offlineFailure = command.errorCode === ERROR_CODE.NETWORK_ERROR;
  const errors: Record<string, string> = { ...problems, ...command.fieldErrors };
  const failing = occurrence.checklist.filter((item) => errors[`entries.${item.id}`]);

  const keep = (added: Attachment[]) => setUploaded((current) => ({ ...current, ...Object.fromEntries(added.map((file) => [file.id, file])) }));
  const patchEntry = (itemId: string, change: Partial<EntryDraft>) =>
    setDraft((current) => ({ ...current, entries: current.entries.map((entry) => (entry.itemId === itemId ? { ...entry, ...change } : entry)) }));

  const send = async (action: 'saveMaintenanceWork' | 'submitMaintenanceWork') => {
    const payload = toPayload(draft);
    const result = await command.execute({ subjectType: 'MAINTENANCE_OCCURRENCE', subjectId: occurrence.id, expectedVersion: occurrence.version, action, payload });
    if (!result) {
      const first = Object.keys(command.getLastFieldErrors())[0];
      if (first) focusItem(first);
      return;
    }
    setSaved(JSON.stringify(payload));
    toast.success(action === 'saveMaintenanceWork' ? 'Đã lưu' : 'Đã gửi kết quả. Chờ người xác nhận.');
  };

  const submit = () => {
    const found = draftProblems(occurrence.checklist, draft, files);
    const byField: Record<string, string> = {};
    for (const problem of found) byField[problem.field] ??= problem.message;
    setProblems(byField);
    if (found.length) {
      focusItem(found[0].field);
      return;
    }
    void send('submitMaintenanceWork');
  };

  const busy = command.isPending;
  return (
    <div className="space-y-3 pb-24 lg:pb-0">
      <UnsavedChangesGuard dirty={dirty} />
      {command.errorCode === ERROR_CODE.CONFLICT ? <ConflictNotice onReload={onReload} /> : null}
      <p className="text-sm font-medium text-ink" aria-live="polite">
        {progressText(occurrence.checklist, draft)}
      </p>
      {failing.length ? (
        <Notice tone="danger">
          Còn {failing.length} mục chưa đủ:{' '}
          {failing.map((item, index) => (
            <span key={item.id}>
              {index ? ', ' : ''}
              <a href={`#item-${item.id}`} className="underline" onClick={(event) => { event.preventDefault(); focusItem(`entries.${item.id}`); }}>
                {item.label}
              </a>
            </span>
          ))}
        </Notice>
      ) : null}
      {offlineFailure ? (
        <Notice tone="danger">Chưa lưu được vì mất kết nối. Dữ liệu vẫn còn trên màn hình — bấm Lưu lại khi có mạng.</Notice>
      ) : null}
      {occurrence.checklist.map((item, index) => {
        const entry = draft.entries.find((row) => row.itemId === item.id) as EntryDraft;
        const repair = detail.repairs.find((row) => row.itemId === item.id && row.inForce);
        return (
          <WorkItemCard
            key={item.id}
            index={index}
            item={item}
            draft={entry}
            occurrenceId={occurrence.id}
            files={files}
            disabled={busy}
            error={errors[`entries.${item.id}`]}
            reworkReason={occurrence.rework[item.id]}
            repair={repair}
            onCreateRepair={onCreateRepair ? () => onCreateRepair(item.id) : undefined}
            onUploaded={keep}
            onChange={(change) => patchEntry(item.id, change)}
          />
        );
      })}
      <section aria-label="Kết quả chung" className="space-y-3 rounded-xl border border-line bg-surface p-3.5 shadow-card">
        <div id="work-summary" tabIndex={-1}>
          <Field label="Kết quả chung" htmlFor="work-summary-input" required error={errors.summary}>
            <Textarea id="work-summary-input" rows={3} maxLength={2000} value={draft.summary} disabled={busy} onChange={(event) => setDraft({ ...draft, summary: event.target.value })} />
          </Field>
        </div>
        <Field label="Nhà thầu" htmlFor="work-contractor" error={errors.contractorName}>
          <Input id="work-contractor" className="min-h-11" maxLength={200} value={draft.contractorName} disabled={busy} onChange={(event) => setDraft({ ...draft, contractorName: event.target.value })} />
        </Field>
        <Field label="Người làm thực tế" htmlFor="work-worker" error={errors.actualWorker} hint="Ví dụ: thợ của nhà thầu.">
          <Input id="work-worker" className="min-h-11" maxLength={120} value={draft.actualWorker} disabled={busy} onChange={(event) => setDraft({ ...draft, actualWorker: event.target.value })} />
        </Field>
        <div id="work-attachmentIds" tabIndex={-1} className="space-y-1.5 [&_button]:min-h-11 [&_button]:min-w-11">
          <span className="text-sm font-medium text-ink">
            Ảnh chung <span className="text-crit">*</span>
          </span>
          <AttachmentList
            attachments={draft.attachmentIds.flatMap((id) => (files[id] ? [files[id]] : []))}
            emptyText="Chưa có ảnh."
            onRemove={busy ? undefined : (id) => setDraft({ ...draft, attachmentIds: draft.attachmentIds.filter((value) => value !== id) })}
          />
          <FileUploader
            subjectType="MAINTENANCE_OCCURRENCE"
            subjectId={occurrence.id}
            purpose="MAINTENANCE_RESULT"
            accept="image/*"
            label="Chụp / chọn ảnh"
            disabled={busy}
            onUploaded={(added) => {
              keep(added);
              setDraft((current) => ({ ...current, attachmentIds: [...current.attachmentIds, ...added.map((file) => file.id)] }));
            }}
          />
          {errors.attachmentIds ? <p className="text-sm text-crit" role="alert">{errors.attachmentIds}</p> : null}
        </div>
      </section>
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] lg:static lg:rounded-xl lg:border lg:p-3">
        {online ? null : <p className="mb-2 text-xs text-warn">Đang mất kết nối.</p>}
        <div className="mx-auto flex max-w-3xl gap-2">
          <Button variant="secondary" className="min-h-11 flex-1" isLoading={busy} disabled={!online} onClick={() => void send('saveMaintenanceWork')}>
            Lưu
          </Button>
          <Button className="min-h-11 flex-1" isLoading={busy} disabled={!online} onClick={submit}>
            Gửi kết quả
          </Button>
        </div>
      </div>
    </div>
  );
};
