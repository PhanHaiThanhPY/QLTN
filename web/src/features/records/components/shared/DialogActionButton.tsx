import { useState } from 'react';
import type { ReactNode } from 'react';
import { ActionButton } from '@/components/common/ActionButton';
import type { ButtonProps } from '@/components/ui/button';
import type { ActionState, RepairAction } from '@/domain/actions';
import { REPAIR_ACTIONS } from '@/domain/actions';
import { useRepairAction } from '../../hooks/useRepairAction';

interface DialogActionButtonProps {
  action: RepairAction;
  /** Renders the dialog; it is mounted only while open so its state resets each time. */
  renderDialog: (close: () => void) => ReactNode;
  label?: ReactNode;
  variant?: ButtonProps['variant'];
  size?: ButtonProps['size'];
  stateOverride?: ActionState;
}

/** ActionButton (hidden when not relevant to the status) that opens a business dialog. */
export const DialogActionButton = ({ action, renderDialog, label, variant = 'primary', size = 'md', stateOverride }: DialogActionButtonProps) => {
  const [open, setOpen] = useState(false);
  const { relevant, state } = useRepairAction(action);
  if (!relevant) return null;
  return (
    <>
      <ActionButton state={stateOverride ?? state} variant={variant} size={size} onClick={() => setOpen(true)}>
        {label ?? REPAIR_ACTIONS[action].label}
      </ActionButton>
      {open ? renderDialog(() => setOpen(false)) : null}
    </>
  );
};
