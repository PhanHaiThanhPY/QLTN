import { useState } from 'react';
import { ActionButton } from '@/components/common/ActionButton';
import { ReasonDialog } from '@/components/common/ReasonDialog';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { OCCURRENCE_ACTIONS, evaluateAction } from '@/domain/actions';
import type { MaintenanceOccurrence, MaintenanceSubmission, User } from '@/domain/types';
import { useCommand } from '@/hooks/useCommand';
import { ConfirmMaintenanceDialog } from './ConfirmMaintenanceDialog';

interface ReviewPanelProps {
  occurrence: MaintenanceOccurrence;
  submission: MaintenanceSubmission;
  viewer: User;
}

/** Confirmer decisions on the current submission while PENDING_REVIEW. */
export const ReviewPanel = ({ occurrence, submission, viewer }: ReviewPanelProps) => {
  const [dialog, setDialog] = useState<'rework' | 'confirm' | null>(null);
  const rework = useCommand({ successMessage: 'Đã yêu cầu làm lại. BQL quản lý nhận việc làm lại.' });

  const handleRework = async (reason: string) => {
    const result = await rework.execute({
      subjectType: 'MAINTENANCE_OCCURRENCE',
      subjectId: occurrence.id,
      expectedVersion: occurrence.version,
      action: 'requestMaintenanceRework',
      payload: { submissionId: submission.id, reason },
    });
    if (result) setDialog(null);
  };

  return (
    <Card>
      <CardHeader title="Kiểm tra kết quả" description={`Kiểm tra lần gửi ${submission.roundNo} bên dưới rồi chọn kết quả.`} />
      <CardBody className="flex flex-wrap gap-2">
        <ActionButton state={evaluateAction(OCCURRENCE_ACTIONS.confirmMaintenance, viewer, occurrence)} onClick={() => setDialog('confirm')}>
          Xác nhận hoàn tất
        </ActionButton>
        <ActionButton
          state={evaluateAction(OCCURRENCE_ACTIONS.requestMaintenanceRework, viewer, occurrence)}
          variant="secondary"
          onClick={() => setDialog('rework')}
        >
          Yêu cầu làm lại
        </ActionButton>
        <ReasonDialog
          open={dialog === 'rework'}
          onOpenChange={(open) => setDialog(open ? 'rework' : null)}
          title={`Yêu cầu làm lại ${occurrence.code}`}
          description="Bản gửi hiện tại được giữ nguyên; BQL sửa bản làm việc rồi gửi lần tiếp theo."
          confirmLabel="Yêu cầu làm lại"
          isPending={rework.isPending}
          error={rework.fieldErrors.reason}
          onConfirm={(reason) => void handleRework(reason)}
        />
        {dialog === 'confirm' ? <ConfirmMaintenanceDialog occurrence={occurrence} submission={submission} onClose={() => setDialog(null)} /> : null}
      </CardBody>
    </Card>
  );
};
