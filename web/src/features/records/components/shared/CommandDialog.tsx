import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import type { ButtonProps } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';

interface CommandDialogProps {
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  confirmVariant?: ButtonProps['variant'];
  isPending: boolean;
  canConfirm?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  children: ReactNode;
}

/** Always-open dialog shell with Hủy / confirm footer; the parent unmounts it to close. */
export const CommandDialog = ({
  title,
  description,
  confirmLabel,
  confirmVariant = 'primary',
  isPending,
  canConfirm = true,
  onConfirm,
  onClose,
  size = 'md',
  children,
}: CommandDialogProps) => (
  <Dialog
    open
    size={size}
    onOpenChange={(open) => !open && onClose()}
    title={title}
    description={description}
    footer={
      <>
        <Button variant="secondary" onClick={onClose}>
          Hủy
        </Button>
        <Button variant={confirmVariant} isLoading={isPending} disabled={!canConfirm} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </>
    }
  >
    <div className="space-y-4">{children}</div>
  </Dialog>
);
