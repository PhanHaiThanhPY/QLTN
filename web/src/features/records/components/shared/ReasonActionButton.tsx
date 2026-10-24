import { useState } from 'react';
import { ActionButton } from '@/components/common/ActionButton';
import { ReasonDialog } from '@/components/common/ReasonDialog';
import type { ButtonProps } from '@/components/ui/button';
import type { ActionState, RepairAction } from '@/domain/actions';
import { REPAIR_ACTIONS } from '@/domain/actions';
import { useRecordCommand } from '../../hooks/useRecordCommand';
import { useRepairAction } from '../../hooks/useRepairAction';

interface ReasonActionButtonProps {
  action: RepairAction;
  /** Payload key that carries the typed text. */
  field: 'reason' | 'note';
  dialogTitle: string;
  dialogDescription?: string;
  fieldLabel?: string;
  confirmLabel?: string;
  successMessage: string;
  variant?: ButtonProps['variant'];
  confirmVariant?: ButtonProps['variant'];
  /** Extra precondition applied on top of the permission check. */
  stateOverride?: ActionState;
  extraPayload?: Record<string, unknown>;
  /** Min length shown before submitting; 0 lets the server answer instead (api mode). */
  minLength?: number;
}

/** Business action that requires a reason/note (5–1.000 chars) before running. */
export const ReasonActionButton = ({
  action,
  field,
  dialogTitle,
  dialogDescription,
  fieldLabel,
  confirmLabel,
  successMessage,
  variant = 'secondary',
  confirmVariant = 'primary',
  stateOverride,
  extraPayload,
  minLength,
}: ReasonActionButtonProps) => {
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
        <ReasonDialog
          open
          onOpenChange={setOpen}
          title={dialogTitle}
          description={dialogDescription}
          label={fieldLabel}
          confirmLabel={confirmLabel ?? label}
          confirmVariant={confirmVariant}
          isPending={command.isPending}
          error={command.fieldErrors[field]}
          minLength={minLength}
          onConfirm={(text) => void command.run(action, { ...extraPayload, [field]: text })}
        />
      ) : null}
    </>
  );
};
