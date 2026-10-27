import { useState } from 'react';
import { ReasonDialog } from '@/components/common/ReasonDialog';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { effectiveResult, RESOLUTION_MIN, REWORK_REASON_MIN } from '@/domain/maintenance-execution';
import { useCommand } from '@/hooks/useCommand';
import { useOnline } from '@/hooks/useOnline';
import type { OccurrenceDetail, Submission } from '@/services/maintenance-occurrences-api';
import { formatDateTime } from '@/utils/date';
import { ERROR_CODE } from '@/domain/errors';
import { ConfirmOccurrenceDialog } from './ConfirmOccurrenceDialog';
import { ConflictNotice } from './ConflictNotice';
import type { ConditionChoice } from './ConfirmOccurrenceDialog';
import { ItemResultView } from './ItemResultView';

interface ReviewPanelProps {
  detail: OccurrenceDetail;
  submission: Submission;
  userName: (id?: string) => string;
  onReload: () => void;
}

/**
 * The reviewer's view of the current submission (BR-MT3-06, BR-MT3-09, ui-brief §2.2): mark items "Cần làm lại" with
 * a reason, or confirm once every failed item has its repair record or a resolution.
 */
export const ReviewPanel = ({ detail, submission, userName, onReload }: ReviewPanelProps) => {
  const { occurrence } = detail;
  const online = useOnline();
  const command = useCommand();
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [resolutions, setResolutions] = useState<Record<string, string>>({});
  const [dialog, setDialog] = useState<'rework' | 'confirm' | null>(null);
  const marked = Object.keys(marks);
  const send = async (action: string, payload: Record<string, unknown>) => {
    const result = await command.execute({ subjectType: 'MAINTENANCE_OCCURRENCE', subjectId: occurrence.id, expectedVersion: occurrence.version, action, payload: { round: submission.round, ...payload } });
    // A refusal on items is shown on their cards: close the dialog so they are in view.
    const onItems = Object.keys(command.getLastFieldErrors()).some((field) => field.startsWith('entries.'));
    if (result || onItems) setDialog(null);
  };
  return (
    <div className="space-y-3 pb-24 lg:pb-0">
      {command.errorCode === ERROR_CODE.CONFLICT ? <ConflictNotice onReload={onReload} /> : null}
      <p className="text-sm text-ink-2">
        Lần gửi {submission.round} · {userName(submission.submittedBy)} · {formatDateTime(submission.submittedAt)} · Hạn xác nhận {formatDateTime(submission.reviewDueAt)}
      </p>
      {occurrence.checklist.map((item, index) => {
        const entry = submission.entries.find((row) => row.itemId === item.id);
        const failed = entry ? effectiveResult(item, entry) === 'FAIL' : false;
        const repair = detail.repairs.find((row) => row.itemId === item.id && row.inForce);
        const field = `entries.${item.id}`;
        const isMarked = marks[item.id] !== undefined;
        return (
          <ItemResultView key={item.id} index={index} item={item} entry={entry} files={detail.files} repair={repair} error={command.fieldErrors[field]} highlight={isMarked}>
            {failed && !repair ? (
              <div className="mt-2">
                <label htmlFor={`resolution-${item.id}`} className="text-sm font-medium text-ink">
                  Hướng xử lý <span className="text-crit">*</span>
                </label>
                <Textarea
                  id={`resolution-${item.id}`}
                  rows={2}
                  className="mt-1"
                  placeholder="Ghi hướng xử lý…"
                  value={resolutions[item.id] ?? ''}
                  aria-describedby={`resolution-${item.id}-hint`}
                  onChange={(event) => setResolutions({ ...resolutions, [item.id]: event.target.value })}
                />
                <p id={`resolution-${item.id}-hint`} className="mt-0.5 text-xs text-ink-3">
                  Tối thiểu {RESOLUTION_MIN} ký tự, khi mục chưa có hồ sơ sửa chữa.
                </p>
              </div>
            ) : null}
            <label className="mt-2 flex min-h-11 items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                className="h-5 w-5 accent-accent"
                checked={isMarked}
                onChange={() => {
                  const next = { ...marks };
                  if (isMarked) delete next[item.id];
                  else next[item.id] = '';
                  setMarks(next);
                }}
              />
              Cần làm lại
            </label>
            {isMarked ? (
              <Input
                aria-label={`Lý do làm lại ${item.label}`}
                className="min-h-11"
                placeholder={`Lý do (tối thiểu ${REWORK_REASON_MIN} ký tự)`}
                value={marks[item.id]}
                onChange={(event) => setMarks({ ...marks, [item.id]: event.target.value })}
              />
            ) : null}
          </ItemResultView>
        );
      })}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] lg:static lg:rounded-xl lg:border lg:p-3">
        {marked.length ? <p className="mb-2 text-xs text-ink-2">Bỏ đánh dấu «Cần làm lại» để xác nhận.</p> : null}
        <div className="mx-auto flex max-w-3xl gap-2">
          <Button variant="secondary" className="min-h-11 flex-1" disabled={!online || marked.length === 0} onClick={() => setDialog('rework')}>
            Yêu cầu làm lại
          </Button>
          <Button className="min-h-11 flex-1" disabled={!online || marked.length > 0} onClick={() => setDialog('confirm')}>
            Xác nhận hoàn thành
          </Button>
        </div>
      </div>
      <ReasonDialog
        open={dialog === 'rework'}
        onOpenChange={(open) => (open ? undefined : setDialog(null))}
        title="Yêu cầu làm lại"
        description={`${marked.length} mục được trả lại; các mục khác giữ kết quả.`}
        confirmLabel="Yêu cầu làm lại"
        isPending={command.isPending}
        error={command.fieldErrors.reason ?? command.fieldErrors.items}
        onConfirm={(reason) => void send('requestMaintenanceOccurrenceRework', { reason, items: marked.map((itemId) => ({ itemId, reason: marks[itemId].trim() })) })}
      />
      {dialog === 'confirm' ? (
        <ConfirmOccurrenceDialog
          itemName={`${detail.item.code} · ${detail.item.name}`}
          isPending={command.isPending}
          errors={command.fieldErrors}
          onClose={() => setDialog(null)}
          onConfirm={(condition: ConditionChoice, note) =>
            void send('confirmMaintenanceOccurrence', {
              resolutions: Object.entries(resolutions).map(([itemId, text]) => ({ itemId, text: text.trim() })),
              condition: condition || null,
              conditionNote: condition ? note : null,
            })
          }
        />
      ) : null}
    </div>
  );
};
