import { useState } from 'react';
import { UserCog } from 'lucide-react';
import { ActionButton } from '@/components/common/ActionButton';
import type { ButtonProps } from '@/components/ui/button';
import { useReferenceData } from '@/hooks/useReferenceData';
import { useRepairAction } from '../../hooks/useRepairAction';
import { useRecordContext } from '../../record-context';
import { withPrecondition } from '../../record-utils';
import { ReassignDialog } from './ReassignDialog';
import { NO_CANDIDATE_REASON, REASSIGN_SLOTS, reassignCandidates } from './reassign-utils';

interface ReassignButtonProps {
  variant?: ButtonProps['variant'];
  size?: ButtonProps['size'];
}

/** “Giao lại” button; disabled with “Không có người cùng vai trò trong tòa” when nobody qualifies. */
export const ReassignButton = ({ variant = 'secondary', size = 'md' }: ReassignButtonProps) => {
  const { detail } = useRecordContext();
  const reference = useReferenceData();
  const { relevant, state } = useRepairAction('reassignRepair');
  const [open, setOpen] = useState(false);
  if (!relevant) return null;
  const users = reference.data?.users ?? [];
  const available = REASSIGN_SLOTS.filter((slot) => reassignCandidates(users, detail.record, slot).length > 0);
  const inactive = REASSIGN_SLOTS.find((slot) => detail.inactiveSlots.includes(slot) && available.includes(slot));
  const initialSlot = inactive ?? available[0] ?? 'confirmer';
  return (
    <>
      <ActionButton state={withPrecondition(state, available.length > 0, NO_CANDIDATE_REASON)} variant={variant} size={size} onClick={() => setOpen(true)}>
        <UserCog className="h-4 w-4" />
        Giao lại
      </ActionButton>
      {open ? <ReassignDialog users={users} initialSlot={initialSlot} onClose={() => setOpen(false)} /> : null}
    </>
  );
};
