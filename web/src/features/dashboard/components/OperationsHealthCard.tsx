import { ArrowUpRight, BadgeCheck, CircleDollarSign, ClipboardCheck } from 'lucide-react';
import { Link } from 'react-router';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { formatVnd } from '@/utils/money';

interface OperationsHealthCardProps {
  completedRepairCount: number;
  openRepairCount: number;
  approvedTotal: number;
  paidTotal: number;
  pendingReviewCount: number;
}

const percentage = (value: number, total: number) => (total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0);

/** Small, data-backed progress summary for the overview screen. */
export const OperationsHealthCard = ({ completedRepairCount, openRepairCount, approvedTotal, paidTotal, pendingReviewCount }: OperationsHealthCardProps) => {
  const repairCompletion = percentage(completedRepairCount, completedRepairCount + openRepairCount);
  const paymentProgress = percentage(paidTotal, approvedTotal);
  const rows = [
    { label: 'Hồ sơ đã hoàn tất', value: `${repairCompletion}%`, width: repairCompletion, tone: 'bg-accent', Icon: BadgeCheck },
    { label: 'Bảo trì chờ kiểm tra', value: String(pendingReviewCount), width: 0, tone: 'bg-warn', Icon: ClipboardCheck },
    { label: 'Đã thanh toán', value: `${formatVnd(paidTotal)} / ${formatVnd(approvedTotal)}`, width: paymentProgress, tone: 'bg-good', Icon: CircleDollarSign },
  ] as const;

  return (
    <Card>
      <CardHeader title="Sức khỏe vận hành" description="Nhìn nhanh theo các chỉ số chính" actions={<Link to="/reports" className="text-sm font-semibold text-accent hover:underline">Báo cáo</Link>} />
      <CardBody className="space-y-4">
        {rows.map(({ label, value, width, tone, Icon }) => (
          <div key={label} className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2 text-sm text-ink-2"><Icon className="size-4 shrink-0 text-accent" aria-hidden />{label}</span>
              <span className="shrink-0 text-sm font-bold tabular-nums text-ink">{value}</span>
            </div>
            {width > 0 ? <div className="h-1.5 overflow-hidden rounded-full bg-surface-3"><div className={`h-full rounded-full ${tone}`} style={{ width: `${width}%` }} /></div> : <div className="h-1.5 rounded-full bg-warn-soft" />}
          </div>
        ))}
        <Link to="/reports" className="flex items-center justify-between border-t border-line px-0 pt-3 text-xs font-medium text-ink-2 hover:text-accent">
          <span>Xem báo cáo chi tiết</span><ArrowUpRight className="size-4 text-accent" aria-hidden />
        </Link>
      </CardBody>
    </Card>
  );
};
