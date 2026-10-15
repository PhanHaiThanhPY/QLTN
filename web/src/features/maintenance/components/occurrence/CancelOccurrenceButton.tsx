import { useState } from 'react';
import { ActionButton } from '@/components/common/ActionButton';
import { ReasonDialog } from '@/components/common/ReasonDialog';
import { OCCURRENCE_ACTIONS, evaluateAction } from '@/domain/actions';
import type { MaintenanceOccurrence, User } from '@/domain/types';
import { useCommand } from '@/hooks/useCommand';

interface CancelOccurrenceButtonProps {
  occurrence: MaintenanceOccurrence;
  viewer: User;
  size?: 'sm' | 'md';
}

/** "Hủy lượt" with required reason (cancelMaintenance). */
export const CancelOccurrenceButton = ({ occurrence, viewer, size = 'md' }: CancelOccurrenceButtonProps) => {
  const [open, setOpen] = useState(false);
  const command = useCommand({ successMessage: `Đã hủy lượt ${occurrence.code}.` });
  const handleConfirm = async (reason: string) => {
    const result = await command.execute({
      subjectType: 'MAINTENANCE_OCCURRENCE',
      subjectId: occurrence.id,
      expectedVersion: occurrence.version,
      action: 'cancelMaintenance',
      payload: { reason },
    });
    if (result) setOpen(false);
  };
  return (
    <>
      <ActionButton
        state={evaluateAction(OCCURRENCE_ACTIONS.cancelMaintenance, viewer, occurrence)}
        variant="secondary"
        size={size}
        onClick={() => setOpen(true)}
      >
        Hủy lượt
      </ActionButton>
      <ReasonDialog
        open={open}
        onOpenChange={setOpen}
        title={`Hủy lượt ${occurrence.code}`}
        description="Lượt bị hủy vẫn được lưu trong lịch sử; không sinh lại kỳ này."
        confirmLabel="Hủy lượt"
        confirmVariant="danger"
        isPending={command.isPending}
        error={command.fieldErrors.reason}
        onConfirm={(reason) => void handleConfirm(reason)}
      />
    </>
  );
};
