import { useState } from 'react';
import { useNavigate } from 'react-router';
import { MoreHorizontal } from 'lucide-react';
import { ReasonDialog } from '@/components/common/ReasonDialog';
import { ActionMenu } from '@/components/ui/action-menu';
import type { ActionMenuItem } from '@/components/ui/action-menu';
import { Button } from '@/components/ui/button';
import type { useCommand } from '@/hooks/useCommand';
import type { ApiPlanDetail } from '@/services/maintenance-plans-api';
import { todayVn } from '@/services/runtime';
import { DateReasonDialog } from '../components/DateReasonDialog';
import { scheduledCount } from './plan-api-ui';
import { ScheduleChangeApiDialog } from './ScheduleChangeApiDialog';
import type { ScheduleChangeValues } from './ScheduleChangeApiDialog';

type PlanDialog = 'pause' | 'end' | 'schedule' | 'makeup' | null;

interface PlanApiActionsProps {
  detail: ApiPlanDetail;
  command: ReturnType<typeof useCommand>;
  online: boolean;
}

/**
 * Plan actions by state (BR-MT2-04), for the plan's manager only (the page decides). On phones every action sits in
 * one "Thao tác" menu (ui-brief §3).
 */
export const PlanApiActions = ({ detail, command, online }: PlanApiActionsProps) => {
  const navigate = useNavigate();
  const [dialog, setDialog] = useState<PlanDialog>(null);
  const { plan } = detail;
  const running = plan.status === 'ACTIVE' || plan.status === 'PAUSED';
  const cancelled = scheduledCount(detail.occurrences);
  const consequence = `${cancelled} lượt đã lên lịch sẽ bị hủy. Lượt đang làm không bị ảnh hưởng.`;

  const run = async (action: string, payload: Record<string, unknown> = {}) => {
    const result = await command.execute({ subjectType: 'MAINTENANCE_PLAN', subjectId: plan.id, expectedVersion: plan.version, action, payload });
    if (result) setDialog(null);
  };
  const open = (next: PlanDialog) => {
    command.reset();
    setDialog(next);
  };
  const onOpenChange = (next: PlanDialog) => (isOpen: boolean) => setDialog(isOpen ? next : null);

  const primary: ActionMenuItem[] = [
    { key: 'edit', label: 'Sửa', onSelect: () => navigate(`/maintenance/plans/${plan.id}/edit`) },
    ...(plan.status === 'DRAFT' ? [{ key: 'activate', label: 'Kích hoạt', onSelect: () => void run('activateMaintenancePlan') }] : []),
    ...(running ? [{ key: 'schedule', label: 'Đổi chu kỳ', onSelect: () => open('schedule') }] : []),
    ...(running ? [{ key: 'makeup', label: 'Tạo lượt bù', disabled: !detail.item.active, onSelect: () => open('makeup') }] : []),
  ];
  const secondary: ActionMenuItem[] = [
    ...(plan.status === 'ACTIVE' ? [{ key: 'pause', label: 'Tạm dừng', onSelect: () => open('pause') }] : []),
    ...(plan.status === 'PAUSED' ? [{ key: 'resume', label: 'Chạy lại', onSelect: () => void run('resumeMaintenancePlan') }] : []),
    { key: 'end', label: 'Kết thúc', tone: 'danger', onSelect: () => open('end') },
  ];
  const all = [...primary, ...secondary].map((item) => ({ ...item, disabled: item.disabled || !online || command.isPending }));

  if (plan.status === 'ENDED') return null;
  return (
    <>
      <div className="hidden flex-wrap items-center gap-2 md:flex">
        {all.slice(0, primary.length).map((item) => (
          <Button key={item.key} size="sm" variant={item.key === 'activate' ? 'primary' : 'secondary'} disabled={item.disabled} onClick={item.onSelect}>
            {item.label}
          </Button>
        ))}
        <ActionMenu
          items={all.slice(primary.length)}
          trigger={
            <Button size="sm" variant="ghost" aria-label={`Thao tác khác cho ${plan.code}`}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          }
        />
      </div>
      <div className="md:hidden">
        <ActionMenu
          align="start"
          items={all}
          trigger={
            <Button size="sm" variant="secondary">
              Thao tác
            </Button>
          }
        />
      </div>
      <ReasonDialog
        open={dialog === 'pause'}
        onOpenChange={onOpenChange('pause')}
        title={`Tạm dừng ${plan.code}`}
        description={consequence}
        confirmLabel="Tạm dừng"
        isPending={command.isPending}
        error={command.fieldErrors.reason}
        onConfirm={(reason) => void run('pauseMaintenancePlan', { reason })}
      />
      <ReasonDialog
        open={dialog === 'end'}
        onOpenChange={onOpenChange('end')}
        title={`Kết thúc ${plan.code}`}
        description={`${consequence} Kế hoạch đã kết thúc không chạy lại được.`}
        confirmLabel="Kết thúc"
        confirmVariant="danger"
        isPending={command.isPending}
        error={command.fieldErrors.reason}
        onConfirm={(reason) => void run('endMaintenancePlan', { reason })}
      />
      {dialog === 'schedule' ? (
        <ScheduleChangeApiDialog
          detail={detail}
          open
          onOpenChange={onOpenChange('schedule')}
          isPending={command.isPending}
          errors={command.fieldErrors}
          onConfirm={(values: ScheduleChangeValues) => void run('changeMaintenanceSchedule', { ...values })}
        />
      ) : null}
      <DateReasonDialog
        open={dialog === 'makeup'}
        onOpenChange={onOpenChange('makeup')}
        title={`Tạo lượt bù cho ${plan.code}`}
        description="Lượt bù nằm ngoài các kỳ của chu kỳ, dùng người và danh mục kiểm hiện tại của kế hoạch."
        dateLabel="Ngày của lượt bù"
        dateField="date"
        minDate={todayVn()}
        confirmLabel="Tạo lượt bù"
        isPending={command.isPending}
        errors={command.fieldErrors}
        onConfirm={(date, reason) => void run('createMakeupOccurrence', { date, reason })}
      />
    </>
  );
};
