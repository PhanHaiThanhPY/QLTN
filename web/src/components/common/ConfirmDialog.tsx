import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import type { ButtonProps } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  confirmVariant?: ButtonProps['variant'];
  isPending?: boolean;
  onConfirm: () => void;
}

export const ConfirmDialog = ({ open, onOpenChange, title, children, confirmLabel, confirmVariant = 'primary', isPending = false, onConfirm }: ConfirmDialogProps) => (
  <Dialog
    open={open}
    onOpenChange={onOpenChange}
    title={title}
    size="sm"
    footer={
      <>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Hủy
        </Button>
        <Button variant={confirmVariant} isLoading={isPending} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </>
    }
  >
    <div className="text-sm text-ink">{children}</div>
  </Dialog>
);
