import { Card, CardBody, CardHeader } from '@/components/ui/card';
import type { MaintenanceItem } from '@/domain/types';
import { cn } from '@/lib/cn';
import { formatDate } from '@/utils/date';
import { ConditionBadge } from '../ConditionBadge';
import type { WarrantyInfo, WarrantyState } from '../../utils/item-insights';
import { warrantyLabel } from './WarrantyBadge';

interface ItemHealthCardProps {
  item: MaintenanceItem;
  warranty: WarrantyInfo;
}

const BAR = { NONE: 'bg-line-2', ACTIVE: 'bg-good', EXPIRING: 'bg-warn', EXPIRED: 'bg-line-2' } as const satisfies Record<WarrantyState, string>;

const remainingText = (warranty: WarrantyInfo): string => {
  if (warranty.state === 'NONE' || warranty.daysLeft === undefined) return 'Bấm “Sửa” để nhập hạn bảo hành.';
  if (warranty.daysLeft < 0) return `Đã hết ${-warranty.daysLeft} ngày. Chi phí sửa chữa do tòa nhà chi trả.`;
  return `Còn ${warranty.daysLeft} ngày. Lỗi trong thời hạn nên yêu cầu nhà cung cấp bảo hành.`;
};

/** Current condition and warranty coverage, side by side in one card. */
export const ItemHealthCard = ({ item, warranty }: ItemHealthCardProps) => (
  <Card>
    <CardHeader title="Tình trạng & bảo hành" />
    <CardBody className="space-y-4 pt-0">
      <div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[0.8125rem] text-ink-3">Tình trạng hiện tại</span>
          <ConditionBadge condition={item.condition} />
        </div>
        <p className="mt-1.5 text-[0.8125rem] text-ink">{item.conditionNote ?? 'Chưa có ghi chú tình trạng.'}</p>
      </div>
      <div className="border-t border-line pt-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[0.8125rem] text-ink-3">Bảo hành</span>
          <span className="text-[0.8125rem] font-semibold text-ink">{warranty.until ? formatDate(warranty.until) : '—'}</span>
        </div>
        {warranty.usedPercent !== undefined ? (
          <div
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3"
            role="progressbar"
            aria-label="Thời gian bảo hành đã dùng"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={warranty.usedPercent}
          >
            <div className={cn('h-full rounded-full', BAR[warranty.state])} style={{ width: `${warranty.usedPercent}%` }} />
          </div>
        ) : null}
        <p className="mt-1.5 text-xs text-ink-2">
          <span className="font-medium text-ink">{warrantyLabel(warranty)}.</span> {remainingText(warranty)}
        </p>
      </div>
    </CardBody>
  </Card>
);
