import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { NativeSelect, Textarea } from '@/components/ui/input';
import type { FieldErrors } from '@/domain/errors';

export type ConditionChoice = '' | 'GOOD' | 'NEEDS_ATTENTION';

interface ConfirmOccurrenceDialogProps {
  itemName: string;
  isPending: boolean;
  errors: FieldErrors;
  onClose: () => void;
  onConfirm: (condition: ConditionChoice, note: string) => void;
}

const CHOICES: ReadonlyArray<readonly [ConditionChoice, string]> = [
  ['', 'Giữ nguyên'],
  ['GOOD', 'Tốt'],
  ['NEEDS_ATTENTION', 'Cần chú ý'],
] as const;
const NOTE_MIN = 5;
const isChoice = (value: string): value is ConditionChoice => CHOICES.some(([choice]) => choice === value);

/** "Xác nhận hoàn thành" (BR-MT3-06): optionally a new condition of the item, with a note. */
export const ConfirmOccurrenceDialog = ({ itemName, isPending, errors, onClose, onConfirm }: ConfirmOccurrenceDialogProps) => {
  const [condition, setCondition] = useState<ConditionChoice>('');
  const [note, setNote] = useState('');
  const ready = !condition || note.trim().length >= NOTE_MIN;
  return (
    <Dialog
      open
      onOpenChange={(open) => (open ? undefined : onClose())}
      title="Xác nhận hoàn thành"
      description="Hoàn thành không có nghĩa là hư hỏng đã được sửa; hồ sơ sửa chữa liên kết vẫn theo dõi riêng."
      footer={
        <>
          <Button variant="secondary" className="min-h-11" onClick={onClose}>
            Hủy
          </Button>
          <Button className="min-h-11" isLoading={isPending} disabled={!ready} onClick={() => onConfirm(condition, note.trim())}>
            Xác nhận hoàn thành
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label={`Tình trạng ${itemName}`} htmlFor="confirm-condition" error={errors.condition}>
          <NativeSelect id="confirm-condition" value={condition} onChange={(event) => (isChoice(event.target.value) ? setCondition(event.target.value) : undefined)}>
            {CHOICES.map(([value, label]) => (
              <option key={value || 'keep'} value={value}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        {condition ? (
          <Field label="Ghi chú tình trạng" htmlFor="confirm-note" required error={errors.conditionNote} hint={`Tối thiểu ${NOTE_MIN} ký tự.`}>
            <Textarea id="confirm-note" rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
          </Field>
        ) : null}
      </div>
    </Dialog>
  );
};
