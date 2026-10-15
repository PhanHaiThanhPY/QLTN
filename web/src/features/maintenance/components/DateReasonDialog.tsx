import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input, Textarea } from '@/components/ui/input';
import { LIMITS } from '@/domain/constants';
import type { FieldErrors } from '@/domain/errors';

interface DateReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  dateLabel: string;
  /** Server field key of the date (e.g. scheduledDate). */
  dateField: string;
  minDate: string;
  initialDate?: string;
  confirmLabel: string;
  isPending: boolean;
  errors: FieldErrors;
  onConfirm: (date: string, reason: string) => void;
}

/** Date (not before minDate) + required reason; used for rescheduling and manual occurrences. */
export const DateReasonDialog = ({
  open,
  onOpenChange,
  title,
  description,
  dateLabel,
  dateField,
  minDate,
  initialDate = '',
  confirmLabel,
  isPending,
  errors,
  onConfirm,
}: DateReasonDialogProps) => {
  const [date, setDate] = useState(initialDate);
  const [reason, setReason] = useState('');
  const trimmed = reason.trim();
  const dateError = date && date < minDate ? `${dateLabel} không được trước hôm nay.` : undefined;
  const reasonError = trimmed.length > 0 && trimmed.length < LIMITS.REASON_MIN ? `Lý do cần tối thiểu ${LIMITS.REASON_MIN} ký tự.` : undefined;
  const canSubmit = Boolean(date) && !dateError && trimmed.length >= LIMITS.REASON_MIN;
  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setDate(initialDate);
      setReason('');
    }
    onOpenChange(next);
  };
  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="secondary" onClick={() => handleOpenChange(false)}>
            Hủy
          </Button>
          <Button isLoading={isPending} disabled={!canSubmit} onClick={() => onConfirm(date, trimmed)}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label={dateLabel} htmlFor="dr-date" required error={dateError ?? errors[dateField]}>
          <Input id="dr-date" type="date" min={minDate} value={date} onChange={(event) => setDate(event.target.value)} />
        </Field>
        <Field label="Lý do" htmlFor="dr-reason" required error={reasonError ?? errors.reason}>
          <Textarea id="dr-reason" rows={3} maxLength={LIMITS.REASON_MAX} placeholder="Nhập lý do thay đổi..." value={reason} onChange={(event) => setReason(event.target.value)} />
        </Field>
      </div>
    </Dialog>
  );
};
