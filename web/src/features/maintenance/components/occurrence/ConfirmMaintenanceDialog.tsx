import { useState } from 'react';
import { Notice } from '@/components/common/Notice';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { NativeSelect, Textarea } from '@/components/ui/input';
import { ITEM_CONDITION_LABEL, LIMITS } from '@/domain/constants';
import { countIssueEntries, needsIssueResolution } from '@/domain/maintenance-rules';
import type { ItemCondition } from '@/domain/constants';
import type { MaintenanceOccurrence, MaintenanceSubmission } from '@/domain/types';
import { useCommand } from '@/hooks/useCommand';

const CONDITION_OPTIONS = Object.entries(ITEM_CONDITION_LABEL) as [ItemCondition, string][];

interface ConfirmMaintenanceDialogProps {
  occurrence: MaintenanceOccurrence;
  submission: MaintenanceSubmission;
  onClose: () => void;
}

const tooShort = (text: string): boolean => text.length > 0 && text.length < LIMITS.REASON_MIN;

/** confirmMaintenance on the current submission; every unresolved ISSUE needs a resolution note (spec 6.3). */
export const ConfirmMaintenanceDialog = ({ occurrence, submission, onClose }: ConfirmMaintenanceDialogProps) => {
  const [condition, setCondition] = useState<ItemCondition | ''>('');
  const [conditionNote, setConditionNote] = useState('');
  const [resolution, setResolution] = useState('');
  const command = useCommand({ successMessage: `Đã xác nhận hoàn tất ${occurrence.code}.` });
  const issueCount = countIssueEntries(submission.checklistSnapshot);
  const hasIssue = issueCount > 0;
  const needsResolution = needsIssueResolution(submission.checklistSnapshot, occurrence.repairRecordIds.length);
  const noteText = conditionNote.trim();
  const resolutionText = resolution.trim();
  const canSubmit = (!condition || noteText.length >= LIMITS.REASON_MIN) && (!needsResolution || resolutionText.length >= LIMITS.REASON_MIN);
  const errors = command.fieldErrors;

  const handleSubmit = async () => {
    const result = await command.execute({
      subjectType: 'MAINTENANCE_OCCURRENCE',
      subjectId: occurrence.id,
      expectedVersion: occurrence.version,
      action: 'confirmMaintenance',
      payload: { submissionId: submission.id, itemCondition: condition, conditionNote: noteText, issueResolutionNote: resolutionText },
    });
    if (result) onClose();
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={`Xác nhận hoàn tất ${occurrence.code}`}
      description={`Áp dụng cho lần gửi ${submission.roundNo}. Lượt hoàn tất không mở lại được trong demo.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button isLoading={command.isPending} disabled={!canSubmit} onClick={() => void handleSubmit()}>
            Xác nhận hoàn tất
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {hasIssue ? (
          <Notice tone={needsResolution ? 'warning' : 'info'}>
            {needsResolution
              ? `Bản gửi có ${issueCount} mục “Có vấn đề” nhưng chỉ có ${occurrence.repairRecordIds.length} hồ sơ sửa chữa liên kết: cần ghi hướng xử lý phần còn lại.`
              : 'Bản gửi có mục “Có vấn đề”; các hồ sơ sửa chữa liên kết sẽ theo dõi theo vòng đời riêng.'}
          </Notice>
        ) : null}
        {hasIssue ? (
          <Field
            label="Hướng xử lý mục có vấn đề"
            htmlFor="cm-resolution"
            required={needsResolution}
            error={(tooShort(resolutionText) ? `Cần tối thiểu ${LIMITS.REASON_MIN} ký tự.` : undefined) ?? errors.issueResolutionNote}
          >
            <Textarea id="cm-resolution" rows={3} maxLength={LIMITS.REASON_MAX} placeholder="Mô tả cách xử lý và kết quả khắc phục..." value={resolution} onChange={(event) => setResolution(event.target.value)} />
          </Field>
        ) : null}
        <Field label="Cập nhật tình trạng hạng mục (tùy chọn)" htmlFor="cm-condition" error={errors.itemCondition}>
          <NativeSelect id="cm-condition" value={condition} onChange={(event) => setCondition(event.target.value as ItemCondition | '')}>
            <option value="">— Giữ nguyên —</option>
            {CONDITION_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        {condition ? (
          <Field
            label="Ghi chú tình trạng"
            htmlFor="cm-note"
            required
            error={(tooShort(noteText) ? `Cần tối thiểu ${LIMITS.REASON_MIN} ký tự.` : undefined) ?? errors.conditionNote}
          >
            <Textarea id="cm-note" rows={2} maxLength={LIMITS.REASON_MAX} placeholder="Ghi chú thêm về tình trạng hạng mục..." value={conditionNote} onChange={(event) => setConditionNote(event.target.value)} />
          </Field>
        ) : null}
      </div>
    </Dialog>
  );
};
