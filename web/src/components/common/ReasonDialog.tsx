import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { ButtonProps } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Textarea } from '@/components/ui/input';
import { LIMITS } from '@/domain/constants';

interface ReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  label?: string;
  confirmLabel: string;
  confirmVariant?: ButtonProps['variant'];
  isPending: boolean;
  error?: string;
  /** Min length; defaults to the reason rule (5 characters). */
  minLength?: number;
  onConfirm: (text: string) => void;
}

/** Collects a required reason/note before a decision (spec 5.4 reason rule). */
export const ReasonDialog = ({
  open,
  onOpenChange,
  title,
  description,
  label = 'Lý do',
  confirmLabel,
  confirmVariant = 'primary',
  isPending,
  error,
  minLength = LIMITS.REASON_MIN,
  onConfirm,
}: ReasonDialogProps) => {
  const [text, setText] = useState('');
  const trimmed = text.trim();
  const localError = trimmed.length > 0 && trimmed.length < minLength ? `${label} cần tối thiểu ${minLength} ký tự.` : undefined;
  const handleOpenChange = (next: boolean) => {
    if (!next) setText('');
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
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Hủy
          </Button>
          <Button variant={confirmVariant} isLoading={isPending} disabled={trimmed.length < minLength} onClick={() => onConfirm(trimmed)}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <Field label={label} htmlFor="reason-text" required error={localError ?? error}>
        <Textarea id="reason-text" rows={4} maxLength={LIMITS.REASON_MAX} placeholder="Nhập lý do cụ thể..." value={text} onChange={(event) => setText(event.target.value)} autoFocus />
      </Field>
    </Dialog>
  );
};
