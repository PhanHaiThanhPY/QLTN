import { useState } from 'react';
import { ActionButton } from '@/components/common/ActionButton';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { NativeSelect, Textarea } from '@/components/ui/input';
import { OCCURRENCE_ACTIONS, evaluateAction } from '@/domain/actions';
import type { ActionState } from '@/domain/actions';
import { LIMITS } from '@/domain/constants';
import type { MaintenanceOccurrence, User } from '@/domain/types';
import { useCommand } from '@/hooks/useCommand';
import { useReferenceData } from '@/hooks/useReferenceData';
import { activeUsersInRole, userOptionLabel } from '../../utils/maintenance-ui';

interface ReassignConfirmerButtonProps {
  occurrence: MaintenanceOccurrence;
  viewer: User;
  size?: 'sm' | 'md';
}

/** reassignMaintenance (slot confirmer): active TECH_CONFIRMER of the same building, with reason (spec 7). */
export const ReassignConfirmerButton = ({ occurrence, viewer, size = 'sm' }: ReassignConfirmerButtonProps) => {
  const { data, userName } = useReferenceData();
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState('');
  const [reason, setReason] = useState('');
  const command = useCommand({ successMessage: 'Đã giao lại người xác nhận. Người mới nhận việc và thông báo.' });
  const candidates = activeUsersInRole(data?.users, 'TECH_CONFIRMER', occurrence.buildingId).filter(
    (user) => user.id !== occurrence.confirmationUserId,
  );
  const base = evaluateAction(OCCURRENCE_ACTIONS.reassignMaintenance, viewer, occurrence);
  const state: ActionState = base.allowed && candidates.length === 0 ? { allowed: false, reason: 'Không có người cùng vai trò trong tòa.' } : base;
  const trimmed = reason.trim();

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setUserId('');
      setReason('');
    }
    setOpen(next);
  };
  const handleConfirm = async () => {
    const result = await command.execute({
      subjectType: 'MAINTENANCE_OCCURRENCE',
      subjectId: occurrence.id,
      expectedVersion: occurrence.version,
      action: 'reassignMaintenance',
      payload: { slot: 'confirmer', userId, reason: trimmed },
    });
    if (result) handleOpenChange(false);
  };

  return (
    <>
      <ActionButton state={state} size={size} variant="secondary" onClick={() => setOpen(true)}>
        Giao lại người xác nhận
      </ActionButton>
      <Dialog
        open={open}
        onOpenChange={handleOpenChange}
        title={`Giao lại người xác nhận · ${occurrence.code}`}
        description={`Hiện tại: ${userName(occurrence.confirmationUserId)}. Lịch sử và quyết định cũ được giữ nguyên.`}
        footer={
          <>
            <Button variant="secondary" onClick={() => handleOpenChange(false)}>
              Hủy
            </Button>
            <Button isLoading={command.isPending} disabled={!userId || trimmed.length < LIMITS.REASON_MIN} onClick={() => void handleConfirm()}>
              Giao lại
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Người xác nhận mới" htmlFor="ra-user" required error={command.fieldErrors.userId}>
            <NativeSelect id="ra-user" value={userId} onChange={(event) => setUserId(event.target.value)}>
              <option value="">— Chọn người —</option>
              {candidates.map((user) => (
                <option key={user.id} value={user.id}>
                  {userOptionLabel(user)}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Lý do" htmlFor="ra-reason" required error={command.fieldErrors.reason}>
            <Textarea id="ra-reason" rows={3} maxLength={LIMITS.REASON_MAX} placeholder="Nhập lý do phân công lại..." value={reason} onChange={(event) => setReason(event.target.value)} />
          </Field>
        </div>
      </Dialog>
    </>
  );
};
