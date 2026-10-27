import { useState } from 'react';
import { ReasonDialog } from '@/components/common/ReasonDialog';
import { ActionMenu } from '@/components/ui/action-menu';
import type { ActionMenuItem } from '@/components/ui/action-menu';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { NativeSelect, Textarea } from '@/components/ui/input';
import type { User } from '@/domain/types';
import { useCommand } from '@/hooks/useCommand';
import type { OccurrenceDetail } from '@/services/maintenance-occurrences-api';
import { userOptionLabel } from '../../utils/maintenance-ui';
import { eligiblePerformers, eligibleReviewers } from '../plan-api-ui';
import { isFinal } from './occurrence-ui';

type Slot = 'PERFORMER' | 'REVIEWER';

interface OccurrenceManagerMenuProps {
  detail: OccurrenceDetail;
  users: readonly User[];
  online: boolean;
}

const REASON_MIN = 5;

/** "Thao tác" of the plan's manager (ui-brief §2.3, BR-MT3-01, BR-MT3-07): reassign either person, cancel. */
export const OccurrenceManagerMenu = ({ detail, users, online }: OccurrenceManagerMenuProps) => {
  const { occurrence, item } = detail;
  const command = useCommand({ successMessage: 'Đã cập nhật lượt bảo trì.' });
  const [dialog, setDialog] = useState<Slot | 'cancel' | null>(null);
  const [userId, setUserId] = useState('');
  const [reason, setReason] = useState('');
  const toDo = ['SCHEDULED', 'IN_PROGRESS', 'REWORK'].includes(occurrence.status);
  const items: ActionMenuItem[] = [
    ...(toDo ? [{ key: 'performer', label: 'Giao lại người thực hiện', onSelect: () => open('PERFORMER') }] : []),
    ...(!isFinal(occurrence.status) ? [{ key: 'reviewer', label: 'Giao lại người xác nhận', onSelect: () => open('REVIEWER') }] : []),
    ...(toDo ? [{ key: 'cancel', label: 'Hủy lượt', tone: 'danger' as const, onSelect: () => open('cancel') }] : []),
  ].map((row) => ({ ...row, disabled: !online }));
  function open(next: Slot | 'cancel') {
    command.reset();
    setUserId('');
    setReason('');
    setDialog(next);
  }
  const run = async (action: string, payload: Record<string, unknown>) => {
    const result = await command.execute({ subjectType: 'MAINTENANCE_OCCURRENCE', subjectId: occurrence.id, expectedVersion: occurrence.version, action, payload });
    if (result) setDialog(null);
  };
  if (items.length === 0) return null;
  const slot = dialog === 'PERFORMER' || dialog === 'REVIEWER' ? dialog : null;
  const current = slot === 'PERFORMER' ? occurrence.performerUserId : occurrence.reviewerUserId;
  const candidates = (
    slot === 'PERFORMER'
      ? eligiblePerformers(users, item, occurrence.buildingId).filter((user) => user.id !== occurrence.reviewerUserId)
      : eligibleReviewers(users, item, occurrence.buildingId, occurrence.performerUserId)
  ).filter((user) => user.id !== current);
  return (
    <>
      <ActionMenu
        items={items}
        trigger={
          <Button size="sm" variant="secondary" className="min-h-11">
            Thao tác
          </Button>
        }
      />
      {slot ? (
        <Dialog
          open
          onOpenChange={(isOpen) => (isOpen ? undefined : setDialog(null))}
          title={slot === 'PERFORMER' ? 'Giao lại người thực hiện' : 'Giao lại người xác nhận'}
          description="Kết quả đã điền giữ nguyên. Người mới nhận thông báo."
          footer={
            <>
              <Button variant="secondary" className="min-h-11" onClick={() => setDialog(null)}>
                Hủy
              </Button>
              <Button
                className="min-h-11"
                isLoading={command.isPending}
                disabled={!userId || reason.trim().length < REASON_MIN}
                onClick={() => void run('reassignMaintenanceOccurrence', { slot, userId, reason: reason.trim() })}
              >
                Giao lại
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <Field label="Người mới" htmlFor="reassign-user" required error={command.fieldErrors.userId}>
              <NativeSelect id="reassign-user" value={userId} onChange={(event) => setUserId(event.target.value)}>
                <option value="">— Chọn người —</option>
                {candidates.map((user) => (
                  <option key={user.id} value={user.id}>
                    {userOptionLabel(user)}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Lý do" htmlFor="reassign-reason" required error={command.fieldErrors.reason}>
              <Textarea id="reassign-reason" rows={2} value={reason} onChange={(event) => setReason(event.target.value)} />
            </Field>
          </div>
        </Dialog>
      ) : null}
      <ReasonDialog
        open={dialog === 'cancel'}
        onOpenChange={(isOpen) => (isOpen ? undefined : setDialog(null))}
        title={`Hủy ${occurrence.code}`}
        description="Kết quả đã điền vẫn xem được sau khi hủy."
        confirmLabel="Hủy lượt"
        confirmVariant="danger"
        isPending={command.isPending}
        error={command.fieldErrors.reason}
        onConfirm={(text) => void run('cancelMaintenanceOccurrence', { reason: text })}
      />
    </>
  );
};
