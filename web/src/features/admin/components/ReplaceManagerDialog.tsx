import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { NativeSelect, Textarea } from '@/components/ui/input';
import { Notice } from '@/components/common/Notice';
import { LIMITS } from '@/domain/constants';
import type { User } from '@/domain/types';
import { useCommand } from '@/hooks/useCommand';
import type { ManagerGap } from '@/services/admin-service';

interface ReplaceManagerDialogProps {
  gap: ManagerGap;
  subjectLabel: string;
  candidates: User[];
  onClose: () => void;
}

/** ADMIN picks an active BQL of the same building to replace an inactive manager (spec 7). */
export const ReplaceManagerDialog = ({ gap, subjectLabel, candidates, onClose }: ReplaceManagerDialogProps) => {
  const [userId, setUserId] = useState(candidates[0]?.id ?? '');
  const [reason, setReason] = useState('');
  const [localError, setLocalError] = useState<string | undefined>();
  const command = useCommand({ successMessage: 'Đã thay BQL quản lý.', onSuccess: onClose });

  const handleSubmit = async () => {
    if (reason.trim().length < LIMITS.REASON_MIN) {
      setLocalError(`Lý do cần ít nhất ${LIMITS.REASON_MIN} ký tự.`);
      return;
    }
    setLocalError(undefined);
    await command.execute({
      subjectType: gap.subjectType,
      subjectId: gap.subject.id,
      expectedVersion: gap.subject.version,
      action: 'replaceManager',
      payload: { userId, reason: reason.trim() },
    });
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !command.isPending) onClose();
      }}
      title="Thay BQL quản lý"
      description={subjectLabel}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={command.isPending}>
            Hủy
          </Button>
          <Button isLoading={command.isPending} disabled={candidates.length === 0} onClick={() => void handleSubmit()}>
            Thay BQL quản lý
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Notice tone="info">Chỉ khôi phục người quản lý; ADMIN không duyệt hoặc xác nhận thay người nghiệp vụ.</Notice>
        {candidates.length === 0 ? (
          <Notice tone="warning">Không có BQL nào còn hoạt động trong cùng tòa nhà.</Notice>
        ) : (
          <Field label="BQL mới" htmlFor="replace-manager-user" required error={command.fieldErrors.userId}>
            <NativeSelect id="replace-manager-user" value={userId} onChange={(event) => setUserId(event.target.value)}>
              {candidates.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.fullName} ({user.code})
                </option>
              ))}
            </NativeSelect>
          </Field>
        )}
        <Field
          label="Lý do"
          htmlFor="replace-manager-reason"
          required
          error={localError ?? command.fieldErrors.reason}
          hint={`Tối thiểu ${LIMITS.REASON_MIN} ký tự; ghi vào lịch sử và thông báo cho người mới.`}
        >
          <Textarea
            id="replace-manager-reason"
            value={reason}
            maxLength={LIMITS.REASON_MAX}
            placeholder="Nhập lý do thay đổi người phụ trách..."
            aria-invalid={Boolean(localError ?? command.fieldErrors.reason)}
            onChange={(event) => setReason(event.target.value)}
          />
        </Field>
      </div>
    </Dialog>
  );
};
