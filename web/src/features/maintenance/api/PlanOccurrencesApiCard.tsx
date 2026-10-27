import { useState } from 'react';
import { Notice } from '@/components/common/Notice';
import { ReasonDialog } from '@/components/common/ReasonDialog';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { addDays } from '@/domain/maintenance-periods';
import { useCommand } from '@/hooks/useCommand';
import { useOnline } from '@/hooks/useOnline';
import type { ApiOccurrence, ApiPlanDetail } from '@/services/maintenance-plans-api';
import { todayVn } from '@/services/runtime';
import { DateReasonDialog } from '../components/DateReasonDialog';
import { ddmm, latestRescheduleDay, planTimeline } from './plan-api-ui';
import type { OccurrenceAction } from './OccurrenceApiMenu';
import { PlanOccurrenceApiTable } from './PlanOccurrenceApiTable';

interface Target {
  action: Exclude<OccurrenceAction, 'keep'>;
  occurrence: ApiOccurrence;
}

/** "Lượt bảo trì" of the plan page: flagged notice, the list, and the occurrence dialogs (BR-MT2-05, BR-MT2-07). */
export const PlanOccurrencesApiCard = ({ detail, canAct }: { detail: ApiPlanDetail; canAct: boolean }) => {
  const [target, setTarget] = useState<Target | null>(null);
  const online = useOnline();
  const today = todayVn();
  const command = useCommand({ successMessage: 'Đã cập nhật lượt bảo trì.' });
  const rows = planTimeline(detail);
  const flagged = detail.occurrences.filter((row) => row.status === 'SCHEDULED' && row.scheduleChanged).length;

  const run = async (action: string, occurrence: ApiOccurrence, payload: Record<string, unknown>) => {
    const result = await command.execute({
      subjectType: 'MAINTENANCE_OCCURRENCE',
      subjectId: occurrence.id,
      expectedVersion: occurrence.version,
      action,
      payload,
    });
    if (result) setTarget(null);
  };

  const onAction = (action: OccurrenceAction, occurrence: ApiOccurrence) => {
    command.reset();
    if (action === 'keep') void run('keepMaintenanceOccurrence', occurrence, {});
    else setTarget({ action, occurrence });
  };

  const latest = target?.action === 'reschedule' ? latestRescheduleDay(detail, target.occurrence) : undefined;
  const close = (open: boolean) => {
    if (!open) setTarget(null);
  };

  const body = () => {
    if (rows.length > 0) return <PlanOccurrenceApiTable rows={rows} canAct={canAct} online={online} onAction={onAction} />;
    if (detail.plan.status === 'DRAFT') return <p className="text-sm text-ink-2">Kích hoạt kế hoạch để hệ thống bắt đầu sinh lượt.</p>;
    return <p className="text-sm text-ink-2">Chưa có lượt bảo trì.</p>;
  };

  return (
    <Card>
      <CardHeader title="Lượt bảo trì" description="Hệ thống sinh lượt cho 30 ngày tới; mới nhất ở trên." />
      <CardBody className="space-y-3 pt-0">
        {flagged > 0 ? (
          <Notice tone="warning">
            {flagged} lượt có lịch đã đổi. Chọn “Giữ lượt này” hoặc “Hủy” cho từng lượt.
          </Notice>
        ) : null}
        {body()}
      </CardBody>
      <DateReasonDialog
        key={target?.occurrence.id ?? 'none'}
        open={target?.action === 'reschedule'}
        onOpenChange={close}
        title={`Đổi lịch ${target?.occurrence.code ?? ''}`}
        description="Ngày của kỳ không đổi; lượt chỉ dời sang ngày mới."
        dateLabel="Ngày mới"
        dateField="date"
        minDate={today}
        maxDate={latest}
        dateHint={latest ? `Phải trước ${ddmm(addDays(latest, 1))} (kỳ kế tiếp).` : undefined}
        initialDate={target?.occurrence.scheduledDate}
        confirmLabel="Đổi lịch"
        isPending={command.isPending}
        errors={command.fieldErrors}
        onConfirm={(date, reason) => target && void run('rescheduleMaintenanceOccurrence', target.occurrence, { date, reason })}
      />
      <ReasonDialog
        open={target?.action === 'cancel'}
        onOpenChange={close}
        title={`Hủy lượt ${target?.occurrence.code ?? ''}`}
        description={
          target?.occurrence.scheduleChanged
            ? 'Lượt theo lịch cũ bị hủy; kỳ theo lịch mới sẽ được sinh nếu cần.'
            : 'Lượt bị hủy không được sinh lại cho kỳ này.'
        }
        confirmLabel="Hủy lượt"
        confirmVariant="danger"
        isPending={command.isPending}
        error={command.fieldErrors.reason}
        onConfirm={(reason) => target && void run('cancelMaintenanceOccurrence', target.occurrence, { reason })}
      />
    </Card>
  );
};
