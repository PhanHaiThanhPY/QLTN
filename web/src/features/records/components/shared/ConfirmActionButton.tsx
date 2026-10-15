import { useState } from 'react';
import type { ReactNode } from 'react';
import { ActionButton } from '@/components/common/ActionButton';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import type { ButtonProps } from '@/components/ui/button';
import type { ActionState, RepairAction } from '@/domain/actions';
import { REPAIR_ACTIONS } from '@/domain/actions';
import { useRecordCommand } from '../../hooks/useRecordCommand';
import { useRepairAction } from '../../hooks/useRepairAction';
import { FieldErrorList } from './FieldErrorList';

interface ConfirmActionButtonProps {
  action: RepairAction;
  dialogTitle: string;
  children: ReactNode;
  confirmLabel?: string;
  successMessage: string;
  payload?: Record<string, unknown>;
  variant?: ButtonProps['variant'];
  confirmVariant?: ButtonProps['variant'];
  stateOverride?: ActionState;
}

/** Business action guarded by a confirmation dialog (no free text). */
export const ConfirmActionButton = ({
  action,
  dialogTitle,
  children,
  confirmLabel,
  successMessage,
  payload,
  variant = 'primary',
  confirmVariant = 'primary',
  stateOverride,
}: ConfirmActionButtonProps) => {
  const [open, setOpen] = useState(false);
  const { relevant, state } = useRepairAction(action);
  const command = useRecordCommand({ successMessage, onSuccess: () => setOpen(false) });
  if (!relevant) return null;
  const label = REPAIR_ACTIONS[action].label;
  return (
    <>
      <ActionButton state={stateOverride ?? state} variant={variant} onClick={() => setOpen(true)}>
        {label}
      </ActionButton>
      {open ? (
        <ConfirmDialog
          open
          onOpenChange={setOpen}
          title={dialogTitle}
          confirmLabel={confirmLabel ?? label}
          confirmVariant={confirmVariant}
          isPending={command.isPending}
          onConfirm={() => void command.run(action, payload ?? {})}
        >
          {children}
          <FieldErrorList errors={command.fieldErrors} />
        </ConfirmDialog>
      ) : null}
    </>
  );
};
