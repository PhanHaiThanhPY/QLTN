import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { LIMITS } from '@/domain/constants';
import type { ScheduleUnit } from '@/domain/maintenance-periods';
import type { FieldErrors } from '@/domain/errors';
import type { ApiPlanDetail } from '@/services/maintenance-plans-api';
import { todayVn } from '@/services/runtime';
import { ddmm, flaggedByChange, SCHEDULE_LIMIT } from './plan-api-ui';

export interface ScheduleChangeValues {
  unit: ScheduleUnit;
  every: number;
  effectiveFrom: string;
  anchorDate: string;
  reason: string;
}

interface ScheduleChangeApiDialogProps {
  detail: ApiPlanDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isPending: boolean;
  errors: FieldErrors;
  onConfirm: (values: ScheduleChangeValues) => void;
}

/** "Đổi chu kỳ" (BR-MT2-05, ui-brief §2.3): new schedule from a day, its first occurrence, and a reason. */
export const ScheduleChangeApiDialog = ({ detail, open, onOpenChange, isPending, errors, onConfirm }: ScheduleChangeApiDialogProps) => {
  const today = todayVn();
  const [unit, setUnit] = useState<ScheduleUnit>(detail.plan.schedule?.unit ?? 'MONTH');
  const [every, setEvery] = useState(String(detail.plan.schedule?.every ?? 1));
  const [effectiveFrom, setEffectiveFrom] = useState(today);
  const [anchorDate, setAnchorDate] = useState(today);
  const [reason, setReason] = useState('');
  const everyNumber = Number(every);
  const everyError =
    Number.isInteger(everyNumber) && everyNumber >= 1 && everyNumber <= SCHEDULE_LIMIT[unit]
      ? undefined
      : `Chu kỳ ${unit === 'WEEK' ? 'tuần' : 'tháng'} từ 1 đến ${SCHEDULE_LIMIT[unit]}.`;
  const fromError = effectiveFrom < today ? 'Ngày hiệu lực không được trước hôm nay.' : undefined;
  const anchorError = anchorDate < effectiveFrom ? 'Lượt đầu không được trước ngày hiệu lực.' : undefined;
  const trimmed = reason.trim();
  const reasonError = trimmed.length > 0 && trimmed.length < LIMITS.REASON_MIN ? `Lý do cần tối thiểu ${LIMITS.REASON_MIN} ký tự.` : undefined;
  const canSubmit = !everyError && !fromError && !anchorError && Boolean(effectiveFrom && anchorDate) && trimmed.length >= LIMITS.REASON_MIN;
  const flagged = effectiveFrom ? flaggedByChange(detail.occurrences, effectiveFrom) : 0;

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Đổi chu kỳ ${detail.plan.code}`}
      description={`Hiện tại: ${detail.plan.schedule?.label ?? '—'}. Lịch mới thay mọi lần đổi có hiệu lực từ ngày đó trở đi.`}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button
            isLoading={isPending}
            disabled={!canSubmit}
            onClick={() => onConfirm({ unit, every: everyNumber, effectiveFrom, anchorDate, reason: trimmed })}
          >
            Đổi chu kỳ
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Chu kỳ mới" htmlFor="sc-every" required error={everyError ?? errors.every}>
          <div className="flex items-center gap-2">
            <span className="text-sm text-ink-2">Mỗi</span>
            <Input id="sc-every" type="number" min={1} max={SCHEDULE_LIMIT[unit]} className="w-20" value={every} onChange={(event) => setEvery(event.target.value)} />
            <NativeSelect aria-label="Đơn vị chu kỳ mới" className="w-28" value={unit} onChange={(event) => setUnit(event.target.value === 'WEEK' ? 'WEEK' : 'MONTH')}>
              <option value="WEEK">tuần</option>
              <option value="MONTH">tháng</option>
            </NativeSelect>
          </div>
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Hiệu lực từ" htmlFor="sc-from" required error={fromError ?? errors.effectiveFrom}>
            <Input id="sc-from" type="date" min={today} value={effectiveFrom} onChange={(event) => setEffectiveFrom(event.target.value)} />
          </Field>
          <Field label="Lượt đầu" htmlFor="sc-anchor" required error={anchorError ?? errors.anchorDate}>
            <Input id="sc-anchor" type="date" min={effectiveFrom} value={anchorDate} onChange={(event) => setAnchorDate(event.target.value)} />
          </Field>
        </div>
        {flagged > 0 ? (
          <p className="text-sm text-warn">
            {flagged} lượt từ {ddmm(effectiveFrom)} sẽ được đánh dấu để bạn xem lại.
          </p>
        ) : null}
        <Field label="Lý do" htmlFor="sc-reason" required error={reasonError ?? errors.reason}>
          <Textarea id="sc-reason" rows={3} maxLength={LIMITS.REASON_MAX} value={reason} onChange={(event) => setReason(event.target.value)} />
        </Field>
      </div>
    </Dialog>
  );
};
