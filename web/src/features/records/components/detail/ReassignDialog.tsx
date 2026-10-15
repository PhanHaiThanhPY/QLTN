import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { NativeSelect, Textarea } from '@/components/ui/input';
import { LIMITS } from '@/domain/constants';
import type { User } from '@/domain/types';
import { useReferenceData } from '@/hooks/useReferenceData';
import { useRecordCommand } from '../../hooks/useRecordCommand';
import { useRecordContext } from '../../record-context';
import { FieldErrorList } from '../shared/FieldErrorList';
import { NO_CANDIDATE_REASON, REASSIGN_SLOTS, SLOT_TITLE, reassignCandidates, slotAssignee } from './reassign-utils';
import type { ReassignSlot } from './reassign-utils';

interface ReassignDialogProps {
  users: User[];
  initialSlot: ReassignSlot;
  onClose: () => void;
}

/** Reassigns the technical confirmer or one approver of the chain with a reason; history keeps previous people. */
export const ReassignDialog = ({ users, initialSlot, onClose }: ReassignDialogProps) => {
  const { detail } = useRecordContext();
  const { userName } = useReferenceData();
  const record = detail.record;
  const [slot, setSlot] = useState<ReassignSlot>(initialSlot);
  const candidates = reassignCandidates(users, record, slot);
  const [userId, setUserId] = useState(candidates[0]?.id ?? '');
  const [reason, setReason] = useState('');
  const command = useRecordCommand({ successMessage: 'Đã giao lại người xử lý.', onSuccess: onClose });
  const trimmed = reason.trim();

  const changeSlot = (next: ReassignSlot) => {
    setSlot(next);
    setUserId(reassignCandidates(users, record, next)[0]?.id ?? '');
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title="Giao lại người xử lý"
      description="Chỉ đổi người của bước hiện hành và các bước chưa diễn ra; lịch sử giữ nguyên."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button
            isLoading={command.isPending}
            disabled={!userId || trimmed.length < LIMITS.REASON_MIN}
            onClick={() => void command.run('reassignRepair', { slot, userId, reason: trimmed })}
          >
            Giao lại
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Vai trò cần giao lại" htmlFor="reassign-slot" error={command.fieldErrors.slot}>
          <NativeSelect id="reassign-slot" value={slot} onChange={(event) => changeSlot(event.target.value as ReassignSlot)}>
            {REASSIGN_SLOTS.map((value) => (
              <option key={value} value={value}>
                {SLOT_TITLE[value]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <p className="text-sm text-ink-3">Hiện tại: {userName(slotAssignee(record, slot))}</p>
        <Field label="Người mới" htmlFor="reassign-user" required error={command.fieldErrors.userId ?? (candidates.length === 0 ? NO_CANDIDATE_REASON : undefined)}>
          <NativeSelect id="reassign-user" value={userId} disabled={candidates.length === 0} onChange={(event) => setUserId(event.target.value)}>
            {candidates.length === 0 ? <option value="">{NO_CANDIDATE_REASON}</option> : null}
            {candidates.map((user) => (
              <option key={user.id} value={user.id}>
                {user.fullName} ({user.code})
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field
          label="Lý do"
          htmlFor="reassign-reason"
          required
          error={command.fieldErrors.reason ?? (trimmed.length > 0 && trimmed.length < LIMITS.REASON_MIN ? `Lý do cần tối thiểu ${LIMITS.REASON_MIN} ký tự.` : undefined)}
        >
          <Textarea id="reassign-reason" rows={3} maxLength={LIMITS.REASON_MAX} placeholder="Nhập lý do phân công lại..." value={reason} onChange={(event) => setReason(event.target.value)} />
        </Field>
        <FieldErrorList errors={command.fieldErrors} exclude={['slot', 'userId', 'reason']} />
      </div>
    </Dialog>
  );
};
