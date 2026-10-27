import type { IsoDate } from '@/domain/types';
import type { ApiItemDetail } from '@/services/maintenance-items-api';
import { formatVndText } from '@/utils/money';
import { warrantyKpi } from './item-api-ui';

interface Figure {
  label: string;
  value: string | number;
  hint: string;
}

/** The four figures of the item page as a description list (MT-S1 BR-MT-08, ui-brief §2.2 and §4). */
export const ItemApiFigures = ({ detail, today }: { detail: ApiItemDetail; today: IsoDate }) => {
  const warranty = warrantyKpi(detail.warranty, detail.item.warrantyUntil, today);
  const figures: Figure[] = [
    { label: 'Số lần sửa chữa', value: detail.repairCount, hint: 'Hồ sơ đã gửi, trừ hồ sơ rút và không cần sửa' },
    { label: 'Chi phí đã duyệt', value: formatVndText(detail.approvedTotalVnd), hint: 'Tổng số đã duyệt của các hồ sơ sửa chữa' },
    { label: 'Đang sửa chữa', value: detail.openRepairCount, hint: 'Hồ sơ chưa kết thúc' },
    { label: 'Bảo hành', value: warranty.value, hint: warranty.hint },
  ];
  return (
    <dl className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
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
