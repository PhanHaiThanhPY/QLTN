import { CalendarCheck2, CalendarClock, Receipt, Wrench } from 'lucide-react';
import { StatCard } from '@/components/ui/stat-card';
import type { StatTone } from '@/components/ui/stat-card';
import type { IsoDate } from '@/domain/types';
import { formatDate } from '@/utils/date';
import { formatVnd } from '@/utils/money';
import { completedDateOf, occurrenceDue } from '../../utils/item-insights';
import type { ItemInsights } from '../../utils/item-insights';

interface ItemKpiRowProps {
  insights: ItemInsights;
  repairCount: number;
  today: IsoDate;
}

const nextTone = (insights: ItemInsights): StatTone => {
  if (!insights.nextOccurrence) return 'neutral';
  return insights.nextIsOverdue ? 'crit' : 'info';
};

const nextHint = (insights: ItemInsights, today: IsoDate): string => {
  const next = insights.nextOccurrence;
  if (!next) return 'Chưa có lượt nào đang mở';
  return `${next.code} · ${occurrenceDue(next, today).text.toLowerCase()}`;
};

/** Four answers a technician looks for first: next visit, last visit, open repairs, money spent. */
export const ItemKpiRow = ({ insights, repairCount, today }: ItemKpiRowProps) => {
  const next = insights.nextOccurrence;
  const last = insights.lastCompleted;
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
      <StatCard
        compact
        icon={CalendarClock}
        label="Bảo trì kế tiếp"
        value={next ? formatDate(next.scheduledDate) : '—'}
        hint={nextHint(insights, today)}
        tone={nextTone(insights)}
        to={next ? `/maintenance/occurrences/${next.id}` : undefined}
      />
      <StatCard
        compact
        icon={CalendarCheck2}
        label="Bảo trì gần nhất"
        value={last ? formatDate(completedDateOf(last)) : '—'}
        hint={last ? `${last.code} · đã hoàn thành` : 'Chưa có lượt hoàn thành'}
        tone={last ? 'good' : 'neutral'}
        to={last ? `/maintenance/occurrences/${last.id}` : undefined}
      />
      <StatCard
        compact
        icon={Wrench}
        label="Sửa chữa đang mở"
        value={insights.openRepairs.length}
        hint={`Tổng ${repairCount} hồ sơ liên quan`}
        tone={insights.openRepairs.length > 0 ? 'warn' : 'neutral'}
        to="?tab=repairs"
      />
      <StatCard
        compact
        icon={Receipt}
        label="Chi phí sửa chữa"
        value={formatVnd(insights.repairCostTotal)}
        hint={`Đã duyệt · ${insights.costedRepairCount} hồ sơ`}
        tone="accent"
        to="?tab=repairs"
      />
    </div>
  );
};
