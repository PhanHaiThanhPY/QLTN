import { CalendarClock, Info } from 'lucide-react';
import { AsideCard } from '@/components/ui/form-layout';
import type { ScheduleUnit } from '@/domain/maintenance-periods';
import { ddmm, previewDates } from './plan-api-ui';

interface PlanApiFormAsideProps {
  unit: ScheduleUnit;
  every: number;
  startDate: string;
  scheduleLocked: boolean;
}

/** Right column of the plan form (ui-brief §2.2): the first three dates and the rules. */
export const PlanApiFormAside = ({ unit, every, startDate, scheduleLocked }: PlanApiFormAsideProps) => {
  const preview = scheduleLocked ? [] : previewDates(unit, every, startDate);
  return (
    <div className="space-y-4">
      {preview.length > 0 ? (
        <AsideCard icon={CalendarClock} title="Các lượt đầu dự kiến">
          <p className="tnum text-ink">{preview.map(ddmm).join(' · ')}</p>
          <p className="mt-2 text-xs text-ink-3">Hệ thống sinh lượt sau khi kích hoạt, cho 30 ngày tới.</p>
        </AsideCard>
      ) : null}
      <AsideCard icon={Info} title="Quy tắc">
        <ul className="list-disc space-y-1.5 pl-4">
          <li>Kế hoạch mới ở trạng thái Nháp; bạn là người quản lý kế hoạch.</li>
          <li>Ngày lượt tính từ ngày bắt đầu: lượt n = ngày bắt đầu + n × chu kỳ.</li>
          <li>Người thực hiện là KT hoặc BQL của vị trí thiết bị; người xác nhận là KT khác.</li>
          <li>Đổi tên, danh mục kiểm, người, nhà thầu áp dụng cho các lượt chưa bắt đầu.</li>
          <li>Kế hoạch đã kích hoạt: đổi chu kỳ bằng “Đổi chu kỳ”.</li>
        </ul>
      </AsideCard>
    </div>
  );
};
