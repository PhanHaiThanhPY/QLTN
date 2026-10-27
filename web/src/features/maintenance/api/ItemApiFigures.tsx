import type { IsoDate } from '@/domain/types';
import type { ApiItemDetail } from '@/services/maintenance-items-api';
import { cn } from '@/lib/cn';
import { formatDate } from '@/utils/date';
import { formatVndText } from '@/utils/money';
import { warrantyKpi } from './item-api-ui';

interface Figure {
  label: string;
  value: string | number;
  hint: string;
}

/** Figures of the item page as a description list (MT-S1 BR-MT-08); "Lần kế tiếp" with a running plan (MT-S2 §2.4). */
interface ItemApiFiguresProps {
  detail: ApiItemDetail;
  today: IsoDate;
  /** MT-S2: nearest scheduled occurrence of the item's running plans. */
  nextDate?: IsoDate;
}

export const ItemApiFigures = ({ detail, today, nextDate }: ItemApiFiguresProps) => {
  const warranty = warrantyKpi(detail.warranty, detail.item.warrantyUntil, today);
  const figures: Figure[] = [
    { label: 'Số lần sửa chữa', value: detail.repairCount, hint: 'Hồ sơ đã gửi, trừ hồ sơ rút và không cần sửa' },
    { label: 'Chi phí đã duyệt', value: formatVndText(detail.approvedTotalVnd), hint: 'Tổng số đã duyệt của các hồ sơ sửa chữa' },
    { label: 'Đang sửa chữa', value: detail.openRepairCount, hint: 'Hồ sơ chưa kết thúc' },
    { label: 'Bảo hành', value: warranty.value, hint: warranty.hint },
    ...(nextDate ? [{ label: 'Lần kế tiếp', value: formatDate(nextDate), hint: 'Lượt bảo trì đã lên lịch gần nhất' }] : []),
  ];
  return (
    <dl className={cn('grid grid-cols-2 gap-2.5 sm:gap-3', figures.length > 4 ? 'xl:grid-cols-5' : 'xl:grid-cols-4')}>
      {figures.map((figure) => (
        <div key={figure.label} className="rounded-xl border border-line bg-surface p-3.5 shadow-card">
          <dt className="text-xs font-semibold text-ink-2">{figure.label}</dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums text-ink">{figure.value}</dd>
          <dd className="text-xs text-ink-3">{figure.hint}</dd>
        </div>
      ))}
    </dl>
  );
};
