import { CalendarClock, Info } from 'lucide-react';
import { AsideCard } from '@/components/ui/form-layout';
import { FREQUENCY_MONTHS } from '@/domain/constants';
import type { Frequency } from '@/domain/constants';
import { listScheduleSlots } from '@/domain/schedule';
import { addMonthsClamped, formatDate, isValidIsoDate } from '@/utils/date';

interface PlanFormAsideProps {
  frequency: Frequency;
  anchorDate: string;
  scheduleLocked: boolean;
}

const PREVIEW_COUNT = 4;

/** Right column of the plan form: first computed periods and the editing rules. */
export const PlanFormAside = ({ frequency, anchorDate, scheduleLocked }: PlanFormAsideProps) => {
  const interval = FREQUENCY_MONTHS[frequency];
  const preview =
    !scheduleLocked && isValidIsoDate(anchorDate)
      ? listScheduleSlots(
          [{ revision: 1, effectiveFrom: anchorDate, anchorDate, frequency, intervalMonths: interval }],
          undefined,
          addMonthsClamped(anchorDate, interval * (PREVIEW_COUNT - 1)),
        )
      : [];
  return (
    <div className="space-y-4">
      {preview.length > 0 ? (
        <AsideCard icon={CalendarClock} title="Các kỳ đầu dự kiến">
          <ol className="space-y-1">
            {preview.map((slot, index) => (
              <li key={slot.date} className="flex justify-between gap-2">
                <span>Kỳ {index + 1}</span>
                <span className="tnum text-ink">{formatDate(slot.date)}</span>
              </li>
            ))}
          </ol>
          <p className="mt-2 text-xs text-ink-3">Chỉ sinh lượt sau khi kích hoạt, trong khoảng 30 ngày tới.</p>
        </AsideCard>
      ) : null}
      <AsideCard icon={Info} title="Quy tắc">
        <ul className="list-disc space-y-1.5 pl-4">
          <li>Kế hoạch mới ở trạng thái Nháp; bạn là BQL quản lý.</li>
          <li>Chu kỳ tính theo ngày gốc: kỳ n = ngày gốc + n × chu kỳ.</li>
          <li>Người xác nhận phải là người xác nhận kỹ thuật cùng tòa, còn hoạt động.</li>
          <li>Sửa checklist, người xác nhận, nhà thầu chỉ áp dụng cho lượt sinh sau.</li>
          <li>Kế hoạch đã kích hoạt: đổi chu kỳ bằng “Đổi chu kỳ”.</li>
        </ul>
      </AsideCard>
    </div>
  );
};
