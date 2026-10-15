import { useState } from 'react';
import { toast } from 'sonner';
import { Notice } from '@/components/common/Notice';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { FREQUENCY_LABEL, LIMITS } from '@/domain/constants';
import type { Frequency } from '@/domain/constants';
import { currentScheduleVersion } from '@/domain/schedule';
import type { MaintenancePlan } from '@/domain/types';
import { useCommand } from '@/hooks/useCommand';
import { todayVn } from '@/services/runtime';

interface ChangeScheduleDialogProps {
  plan: MaintenancePlan;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const FREQUENCY_OPTIONS = Object.entries(FREQUENCY_LABEL) as [Frequency, string][];

/** Creates a new schedule version (changeMaintenanceSchedule); generated occurrences are never edited. */
export const ChangeScheduleDialog = ({ plan, open, onOpenChange }: ChangeScheduleDialogProps) => {
  const today = todayVn();
  const command = useCommand();
  const [frequency, setFrequency] = useState<Frequency>(currentScheduleVersion(plan).frequency);
  const [effectiveFrom, setEffectiveFrom] = useState(today);
  const [anchorDate, setAnchorDate] = useState(today);
  const [reason, setReason] = useState('');
  const trimmed = reason.trim();
  const effectiveError = effectiveFrom && effectiveFrom < today ? 'Ngày hiệu lực không được trước hôm nay.' : undefined;
  const anchorError = anchorDate && effectiveFrom && anchorDate < effectiveFrom ? 'Ngày gốc mới không được trước ngày hiệu lực.' : undefined;
  const reasonError = trimmed.length > 0 && trimmed.length < LIMITS.REASON_MIN ? `Lý do cần tối thiểu ${LIMITS.REASON_MIN} ký tự.` : undefined;
  const canSubmit = Boolean(effectiveFrom && anchorDate) && !effectiveError && !anchorError && trimmed.length >= LIMITS.REASON_MIN;
  const errors = command.fieldErrors;

  const handleConfirm = async () => {
    const result = await command.execute({
      subjectType: 'MAINTENANCE_PLAN',
      subjectId: plan.id,
      expectedVersion: plan.version,
      action: 'changeMaintenanceSchedule',
      payload: { frequency, effectiveFrom, anchorDate, reason: trimmed },
    });
    if (!result) return;
    const flagged = typeof result.data?.flagged === 'number' ? result.data.flagged : 0;
    toast.success(
      flagged > 0
        ? `Đã lập phiên bản lịch mới. ${flagged} lượt theo lịch cũ được gắn cờ “Cần rà soát”.`
        : 'Đã lập phiên bản lịch mới. Không có lượt nào cần rà soát.',
    );
    setReason('');
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Đổi chu kỳ ${plan.code}`}
      description="Lập phiên bản lịch mới. Lượt đã sinh không bị sửa; lượt SCHEDULED theo lịch cũ từ ngày hiệu lực được gắn cờ để BQL rà soát."
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button isLoading={command.isPending} disabled={!canSubmit} onClick={() => void handleConfirm()}>
            Lập phiên bản lịch
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Chu kỳ mới" htmlFor="cs-frequency" required error={errors.frequency}>
          <NativeSelect id="cs-frequency" value={frequency} onChange={(event) => setFrequency(event.target.value as Frequency)}>
            {FREQUENCY_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Ngày hiệu lực" htmlFor="cs-effective" required error={effectiveError ?? errors.effectiveFrom}>
            <Input id="cs-effective" type="date" min={today} value={effectiveFrom} onChange={(event) => setEffectiveFrom(event.target.value)} />
          </Field>
          <Field label="Ngày gốc mới" htmlFor="cs-anchor" required error={anchorError ?? errors.anchorDate}>
            <Input id="cs-anchor" type="date" min={effectiveFrom || today} value={anchorDate} onChange={(event) => setAnchorDate(event.target.value)} />
          </Field>
        </div>
        <Field label="Lý do" htmlFor="cs-reason" required error={reasonError ?? errors.reason}>
          <Textarea id="cs-reason" rows={3} maxLength={LIMITS.REASON_MAX} placeholder="Nhập lý do thay đổi lịch..." value={reason} onChange={(event) => setReason(event.target.value)} />
        </Field>
        {plan.status === 'PAUSED' ? (
          <Notice tone="info">Kế hoạch đang tạm dừng: phiên bản mới chỉ sinh lượt sau khi kích hoạt lại.</Notice>
        ) : null}
      </div>
    </Dialog>
  );
};
