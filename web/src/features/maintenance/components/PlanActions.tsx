import { useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { ActionButton } from '@/components/common/ActionButton';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { ReasonDialog } from '@/components/common/ReasonDialog';
import { PLAN_ACTIONS, evaluateAction } from '@/domain/actions';
import type { PlanAction } from '@/domain/actions';
import type { MaintenancePlan, User } from '@/domain/types';
import { useCommand } from '@/hooks/useCommand';
import { todayVn } from '@/services/runtime';
import { ChangeScheduleDialog } from './ChangeScheduleDialog';
import { DateReasonDialog } from './DateReasonDialog';

type PlanDialog = 'activate' | 'pause' | 'schedule' | 'manual' | null;

interface PlanActionsProps {
  plan: MaintenancePlan;
  viewer: User;
}

/** Header actions of a plan; only actions valid for the current status are shown. */
export const PlanActions = ({ plan, viewer }: PlanActionsProps) => {
  const navigate = useNavigate();
  const [dialog, setDialog] = useState<PlanDialog>(null);
  const activate = useCommand();
  const pause = useCommand({ successMessage: 'Đã tạm dừng kế hoạch. Lượt đã sinh vẫn xử lý bình thường.' });
  const manual = useCommand();
  const state = (action: PlanAction) => evaluateAction(PLAN_ACTIONS[action], viewer, plan);
  const applies = (action: PlanAction) => (PLAN_ACTIONS[action].from as readonly string[]).includes(plan.status);
  const base = { subjectType: 'MAINTENANCE_PLAN' as const, subjectId: plan.id, expectedVersion: plan.version };

  const handleActivate = async () => {
    const result = await activate.execute({ ...base, action: 'activateMaintenancePlan' });
    if (!result) return;
    const created = typeof result.data?.created === 'number' ? result.data.created : 0;
    toast.success(`Đã kích hoạt kế hoạch. Sinh ${created} lượt trong 30 ngày tới.`);
    if (result.data?.hasMore === true) toast.info('Còn lịch chưa sinh do chạm giới hạn; dùng “Cập nhật lịch” để tiếp tục.');
    setDialog(null);
  };
  const handlePause = async (reason: string) => {
    const result = await pause.execute({ ...base, action: 'pauseMaintenancePlan', payload: { reason } });
    if (result) setDialog(null);
  };
  const handleManual = async (scheduledDate: string, reason: string) => {
    const result = await manual.execute({ ...base, action: 'createManualOccurrence', payload: { scheduledDate, reason } });
    if (!result?.subjectId) return;
    toast.success(`Đã tạo lượt bù ${String(result.data?.code ?? '')}.`);
    setDialog(null);
    navigate(`/maintenance/occurrences/${result.subjectId}`);
  };

  return (
    <>
      <ActionButton state={state('updateMaintenancePlan')} variant="secondary" onClick={() => navigate(`/maintenance/plans/${plan.id}/edit`)}>
        Sửa
      </ActionButton>
      {applies('activateMaintenancePlan') ? (
        <ActionButton state={state('activateMaintenancePlan')} onClick={() => setDialog('activate')}>
          Kích hoạt
        </ActionButton>
      ) : null}
      {applies('pauseMaintenancePlan') ? (
        <ActionButton state={state('pauseMaintenancePlan')} variant="secondary" onClick={() => setDialog('pause')}>
          Tạm dừng
        </ActionButton>
      ) : null}
      {applies('changeMaintenanceSchedule') ? (
        <ActionButton state={state('changeMaintenanceSchedule')} variant="secondary" onClick={() => setDialog('schedule')}>
          Đổi chu kỳ
        </ActionButton>
      ) : null}
      {applies('createManualOccurrence') ? (
        <ActionButton state={state('createManualOccurrence')} variant="secondary" onClick={() => setDialog('manual')}>
          Tạo lượt bù
        </ActionButton>
      ) : null}

      <ConfirmDialog
        open={dialog === 'activate'}
        onOpenChange={(open) => setDialog(open ? 'activate' : null)}
        title={`Kích hoạt ${plan.code}`}
        confirmLabel="Kích hoạt"
        isPending={activate.isPending}
        onConfirm={() => void handleActivate()}
      >
        {plan.status === 'PAUSED'
          ? 'Kỳ chưa sinh trước khi tạm dừng sẽ được sinh bù; các kỳ rơi vào thời gian tạm dừng được ghi là “bỏ qua”, không tạo việc quá hạn hàng loạt.'
          : 'Hệ thống sẽ sinh các lượt bảo trì trong 30 ngày tới và giao việc cho BQL quản lý.'}
      </ConfirmDialog>
      <ReasonDialog
        open={dialog === 'pause'}
        onOpenChange={(open) => setDialog(open ? 'pause' : null)}
        title={`Tạm dừng ${plan.code}`}
        description="Tạm dừng chỉ ngừng sinh lượt mới; lượt đã sinh vẫn xử lý hoặc hủy riêng."
        confirmLabel="Tạm dừng"
        isPending={pause.isPending}
        error={pause.fieldErrors.reason}
        onConfirm={(reason) => void handlePause(reason)}
      />
      <ChangeScheduleDialog plan={plan} open={dialog === 'schedule'} onOpenChange={(open) => setDialog(open ? 'schedule' : null)} />
      <DateReasonDialog
        open={dialog === 'manual'}
        onOpenChange={(open) => setDialog(open ? 'manual' : null)}
        title={`Tạo lượt bù cho ${plan.code}`}
        description="Lượt bù (MANUAL) không chiếm chỗ của kỳ tự động; checklist lấy theo kế hoạch hiện tại."
        dateLabel="Ngày thực hiện"
        dateField="scheduledDate"
        minDate={todayVn()}
        initialDate={todayVn()}
        confirmLabel="Tạo lượt bù"
        isPending={manual.isPending}
        errors={manual.fieldErrors}
        onConfirm={(date, reason) => void handleManual(date, reason)}
      />
    </>
  );
};
