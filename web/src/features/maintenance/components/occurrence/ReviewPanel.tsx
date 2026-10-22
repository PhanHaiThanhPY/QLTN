import { useState } from 'react';
import { AttachmentList } from '@/components/common/AttachmentList';
import { ActionButton } from '@/components/common/ActionButton';
import { Badge } from '@/components/ui/badge';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { NativeSelect, Textarea } from '@/components/ui/input';
import { OCCURRENCE_ACTIONS, evaluateAction } from '@/domain/actions';
import { LIMITS } from '@/domain/constants';
import type { CheckResult } from '@/domain/constants';
import type { Attachment, MaintenanceItemReview, MaintenanceOccurrence, MaintenanceSubmission, User } from '@/domain/types';
import { useCommand } from '@/hooks/useCommand';
import { ConfirmMaintenanceDialog } from './ConfirmMaintenanceDialog';
import { CheckResultBadge } from './CheckResultBadge';
import { pickAttachments } from './ChecklistEntriesView';

interface ReviewPanelProps {
  occurrence: MaintenanceOccurrence;
  submission: MaintenanceSubmission;
  viewer: User;
  attachmentsById: Map<string, Attachment>;
}

interface ReviewDraft extends MaintenanceItemReview {
  label: string;
  submittedResult: CheckResult;
  submittedNote?: string;
  attachmentIds: string[];
  required: boolean;
  inputType?: MaintenanceOccurrence['checklist'][number]['inputType'];
  unit?: string;
  measurementValue?: number;
}

const REVIEW_OPTIONS: MaintenanceItemReview['outcome'][] = ['APPROVED', 'REWORK'];

const reviewOptionLabel = (outcome: MaintenanceItemReview['outcome']): string => (outcome === 'REWORK' ? 'Cần làm lại' : 'Đạt');

/** Item-level review decisions for the current immutable submission. */
export const ReviewPanel = ({ occurrence, submission, viewer, attachmentsById }: ReviewPanelProps) => {
  const [dialog, setDialog] = useState<'confirm' | null>(null);
  const [generalReason, setGeneralReason] = useState('');
  const [error, setError] = useState<string>();
  const [reviewItems, setReviewItems] = useState<ReviewDraft[]>(() =>
    submission.checklistSnapshot.map((entry) => ({
      templateItemId: entry.templateItemId,
      outcome: 'APPROVED',
      label: entry.label,
      submittedResult: entry.result,
      submittedNote: entry.note,
      attachmentIds: entry.attachmentIds,
      required: entry.required,
      inputType: entry.inputType,
      unit: entry.unit,
      measurementValue: entry.measurementValue,
    })),
  );
  const rework = useCommand({ successMessage: 'Đã yêu cầu làm lại theo từng mục checklist.' });
  const reviewPayload = reviewItems.map(({ templateItemId, outcome, reason }) => ({ templateItemId, outcome, reason }));
  const reworkItems = reviewItems.filter((item) => item.outcome === 'REWORK');

  const updateItem = (index: number, patch: Partial<Pick<ReviewDraft, 'outcome' | 'reason'>>) => {
    setReviewItems((current) => current.map((item, row) => (row === index ? { ...item, ...patch } : item)));
    setError(undefined);
  };

  const openConfirm = () => {
    if (reworkItems.length > 0) {
      setError('Còn mục cần làm lại. Hãy chuyển các mục đó về “Đạt” hoặc chọn “Yêu cầu làm lại”.');
      return;
    }
    setError(undefined);
    setDialog('confirm');
  };

  const handleRework = async () => {
    const missingReason = reworkItems.some((item) => (item.reason ?? '').trim().length < LIMITS.REASON_MIN);
    const fallbackReason = reworkItems.map((item) => `${item.label}: ${item.reason ?? ''}`).join('; ');
    const reason = generalReason.trim() || fallbackReason;
    if (reworkItems.length === 0) {
      setError('Cần chọn ít nhất một mục cần làm lại.');
      return;
    }
    if (missingReason) {
      setError(`Mỗi mục cần làm lại phải có lý do tối thiểu ${LIMITS.REASON_MIN} ký tự.`);
      return;
    }
    if (reason.length < LIMITS.REASON_MIN) {
      setError(`Cần nhập lý do tổng quát tối thiểu ${LIMITS.REASON_MIN} ký tự.`);
      return;
    }
    const result = await rework.execute({
      subjectType: 'MAINTENANCE_OCCURRENCE',
      subjectId: occurrence.id,
      expectedVersion: occurrence.version,
      action: 'requestMaintenanceRework',
      payload: { submissionId: submission.id, reason, reviewItems: reviewPayload },
    });
    if (result) setGeneralReason('');
  };

  return (
    <Card>
      <CardHeader title="Kiểm tra kết quả" description={`Review lần gửi ${submission.roundNo} theo từng mục checklist trước khi chốt kết quả.`} />
      <CardBody className="space-y-4">
        <div className="space-y-3">
          {reviewItems.map((item, index) => (
            <div key={item.templateItemId} className="rounded-lg border border-line p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1 text-sm text-ink">
                  <span className="mr-1 text-ink-3">{index + 1}.</span>
                  {item.label}
                  {item.required ? <Badge tone="accent" className="ml-2">Bắt buộc</Badge> : null}
                </div>
                <div className="flex items-center gap-2">
                  <CheckResultBadge result={item.submittedResult} required={item.required} />
                  {item.inputType === 'MEASUREMENT' ? <span className="text-xs text-ink-2">Số đo: {item.measurementValue ?? '—'} {item.unit ?? ''}</span> : null}
                  <NativeSelect aria-label={`Kết quả review mục ${index + 1}`} value={item.outcome} onChange={(event) => updateItem(index, { outcome: event.target.value as MaintenanceItemReview['outcome'] })}>
                    {REVIEW_OPTIONS.map((outcome) => <option key={outcome} value={outcome}>{reviewOptionLabel(outcome)}</option>)}
                  </NativeSelect>
                </div>
              </div>
              {item.submittedNote ? <p className="mt-2 text-sm text-ink-2">Người thực hiện ghi: {item.submittedNote}</p> : null}
              {item.attachmentIds.length > 0 ? <div className="mt-2"><AttachmentList attachments={pickAttachments(item.attachmentIds, attachmentsById)} /></div> : null}
              {item.outcome === 'REWORK' ? (
                <Field label="Lý do cần làm lại" htmlFor={`review-reason-${item.templateItemId}`} required className="mt-3">
                  <Textarea id={`review-reason-${item.templateItemId}`} rows={2} maxLength={LIMITS.REASON_MAX} value={item.reason ?? ''} placeholder="Nêu rõ phần chưa đạt và yêu cầu khắc phục..." onChange={(event) => updateItem(index, { reason: event.target.value })} />
                </Field>
              ) : null}
            </div>
          ))}
        </div>
        <Field label="Tóm tắt yêu cầu xử lý" htmlFor="maintenance-review-reason" hint="Có thể để trống nếu lý do từng mục đã đủ rõ.">
          <Textarea id="maintenance-review-reason" rows={2} maxLength={LIMITS.REASON_MAX} value={generalReason} placeholder="Tóm tắt kết luận review..." onChange={(event) => { setGeneralReason(event.target.value); setError(undefined); }} />
        </Field>
        {error ? <p className="text-xs text-crit" role="alert">{error}</p> : null}
        <div className="flex flex-wrap gap-2">
          <ActionButton state={evaluateAction(OCCURRENCE_ACTIONS.confirmMaintenance, viewer, occurrence)} onClick={openConfirm}>
            Xác nhận hoàn tất
          </ActionButton>
          <ActionButton state={evaluateAction(OCCURRENCE_ACTIONS.requestMaintenanceRework, viewer, occurrence)} variant="secondary" isLoading={rework.isPending} onClick={() => void handleRework()}>
            Yêu cầu làm lại ({reworkItems.length})
          </ActionButton>
        </div>
        {dialog === 'confirm' ? <ConfirmMaintenanceDialog occurrence={occurrence} submission={submission} reviewItems={reviewPayload} onClose={() => setDialog(null)} /> : null}
      </CardBody>
    </Card>
  );
};
