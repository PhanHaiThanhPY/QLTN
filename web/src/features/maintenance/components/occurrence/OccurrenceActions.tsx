import { useState } from 'react';
import { ActionButton } from '@/components/common/ActionButton';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { OCCURRENCE_ACTIONS, evaluateAction } from '@/domain/actions';
import type { OccurrenceAction } from '@/domain/actions';
import type { User } from '@/domain/types';
import { useCommand } from '@/hooks/useCommand';
import type { OccurrenceDetail } from '@/services/maintenance-service';
import { todayVn } from '@/services/runtime';
import { DateReasonDialog } from '../DateReasonDialog';
import { CancelOccurrenceButton } from './CancelOccurrenceButton';
import { CreateRepairDialog } from './CreateRepairDialog';

type ActionDialog = 'start' | 'reschedule' | 'repair' | null;

interface OccurrenceActionsProps {
  detail: OccurrenceDetail;
  viewer: User;
}

/** Manager header actions; each only shown when valid for the current status. */
export const OccurrenceActions = ({ detail, viewer }: OccurrenceActionsProps) => {
  const { occurrence } = detail;
  const [dialog, setDialog] = useState<ActionDialog>(null);
  const start = useCommand({ successMessage: 'Đã bắt đầu lượt bảo trì. Nhập checklist ở tab “Checklist & kết quả”.' });
  const reschedule = useCommand({ successMessage: 'Đã đổi lịch lượt. Ngày gốc của kỳ được giữ nguyên.' });
  const state = (action: OccurrenceAction) => evaluateAction(OCCURRENCE_ACTIONS[action], viewer, occurrence);
  const applies = (action: OccurrenceAction) => (OCCURRENCE_ACTIONS[action].from as readonly string[]).includes(occurrence.status);
  const base = { subjectType: 'MAINTENANCE_OCCURRENCE' as const, subjectId: occurrence.id, expectedVersion: occurrence.version };

  const handleStart = async () => {
    const result = await start.execute({ ...base, action: 'startMaintenance' });
    if (result) setDialog(null);
  };
  const handleReschedule = async (scheduledDate: string, reason: string) => {
    const result = await reschedule.execute({ ...base, action: 'rescheduleMaintenance', payload: { scheduledDate, reason } });
    if (result) setDialog(null);
  };

  return (
    <>
      {applies('startMaintenance') ? (
        <ActionButton state={state('startMaintenance')} onClick={() => setDialog('start')}>
          Bắt đầu
        </ActionButton>
      ) : null}
      {applies('rescheduleMaintenance') ? (
        <ActionButton state={state('rescheduleMaintenance')} variant="secondary" onClick={() => setDialog('reschedule')}>
          Đổi lịch
        </ActionButton>
      ) : null}
      {applies('createRepairFromMaintenance') ? (
        <ActionButton state={state('createRepairFromMaintenance')} variant="secondary" onClick={() => setDialog('repair')}>
          Tạo hồ sơ sửa chữa
        </ActionButton>
      ) : null}
      {applies('cancelMaintenance') ? <CancelOccurrenceButton occurrence={occurrence} viewer={viewer} /> : null}

      <ConfirmDialog
        open={dialog === 'start'}
        onOpenChange={(open) => setDialog(open ? 'start' : null)}
        title={`Bắt đầu ${occurrence.code}`}
        confirmLabel="Bắt đầu"
        isPending={start.isPending}
        onConfirm={() => void handleStart()}
      >
        Lượt chuyển sang “Đang thực hiện”. BQL nhập checklist thay cho đơn vị thực hiện ngoài hệ thống.
      </ConfirmDialog>
      <DateReasonDialog
        open={dialog === 'reschedule'}
        onOpenChange={(open) => setDialog(open ? 'reschedule' : null)}
        title={`Đổi lịch ${occurrence.code}`}
        description="Chỉ đổi ngày của lượt này; chu kỳ kế hoạch và ngày gốc của kỳ không đổi."
        dateLabel="Ngày mới"
        dateField="scheduledDate"
        minDate={todayVn()}
        confirmLabel="Đổi lịch"
        isPending={reschedule.isPending}
        errors={reschedule.fieldErrors}
        onConfirm={(date, reason) => void handleReschedule(date, reason)}
      />
      {dialog === 'repair' ? <CreateRepairDialog detail={detail} onClose={() => setDialog(null)} /> : null}
    </>
  );
};
