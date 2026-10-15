import { AlertTriangle, ArrowUpRight, CircleDollarSign, Info } from 'lucide-react';
import { Link } from 'react-router';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import type { RepairRecord } from '@/domain/types';
import { formatVnd } from '@/utils/money';

interface DashboardInsightsProps {
  records: RepairRecord[];
  overdueRepairCount: number;
  pendingApprovalCount: number;
  approvedTotal: number;
  paidTotal: number;
}

const percentage = (value: number, total: number): number => (total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0);

/** Bottom insight cards that keep operational warnings and spend visible at a glance. */
export const DashboardInsights = ({ records, overdueRepairCount, pendingApprovalCount, approvedTotal, paidTotal }: DashboardInsightsProps) => {
  const alerts = records.slice(0, 3);
  const paymentProgress = percentage(paidTotal, approvedTotal);
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]">
      <Card>
        <CardHeader title="Cảnh báo cần chú ý" description="Tín hiệu mới nhất từ hồ sơ và công việc vận hành" actions={<Link to="/records" className="text-sm font-semibold text-accent hover:underline">Xem tất cả <ArrowUpRight className="inline size-4" aria-hidden /></Link>} />
        <CardBody className="pt-0">
          <div className="divide-y divide-line">
            <Link to="/records?overdue=1" className="flex items-center gap-3 py-2.5 first:pt-0 hover:bg-surface-2">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-crit-soft text-crit"><AlertTriangle className="size-4" aria-hidden /></span>
              <span className="min-w-0 flex-1"><span className="block font-semibold text-ink">Hồ sơ quá hạn cần xử lý</span><span className="block text-xs text-ink-2">Các hồ sơ chưa có cập nhật đúng hạn</span></span>
              <span className="font-bold tabular-nums text-crit">{overdueRepairCount}</span>
            </Link>
            <Link to="/records" className="flex items-center gap-3 py-2.5 hover:bg-surface-2">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-warn-soft text-warn"><Info className="size-4" aria-hidden /></span>
              <span className="min-w-0 flex-1"><span className="block font-semibold text-ink">Hồ sơ đang chờ phê duyệt</span><span className="block text-xs text-ink-2">Theo dõi để không chậm tiến độ thanh toán</span></span>
              <span className="font-bold tabular-nums text-warn">{pendingApprovalCount}</span>
            </Link>
            {alerts[0] ? <Link to={`/records/${alerts[0].id}`} className="flex items-center gap-3 py-2.5 last:pb-0 hover:bg-surface-2"><span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent"><Info className="size-4" aria-hidden /></span><span className="min-w-0 flex-1 truncate"><span className="block truncate font-semibold text-ink">{alerts[0].title}</span><span className="block truncate text-xs text-ink-2">{alerts[0].code}</span></span><ArrowUpRight className="size-4 text-ink-3" aria-hidden /></Link> : null}
          </div>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Chi phí sửa chữa" description="Tổng hợp theo dữ liệu trong phạm vi tòa nhà" actions={<span className="rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-xs font-semibold text-ink-2">Tổng quan</span>} />
        <CardBody className="pt-0">
          <div className="flex items-end justify-between gap-3">
            <div><p className="text-2xl font-bold tracking-[-0.04em] text-ink">{formatVnd(paidTotal)}</p><p className="mt-1 text-xs text-ink-2">Đã thanh toán</p></div>
            <CircleDollarSign className="size-7 text-good" aria-hidden />
          </div>
          <div className="mt-5 space-y-3">
            <div><div className="mb-1.5 flex justify-between text-xs"><span className="text-ink-2">Tiến độ thanh toán</span><span className="font-bold text-ink">{paymentProgress}%</span></div><div className="h-2 overflow-hidden rounded-full bg-surface-3"><div className="h-full rounded-full bg-good" style={{ width: `${paymentProgress}%` }} /></div></div>
            <div className="flex items-center justify-between border-t border-line pt-3 text-xs"><span className="text-ink-2">Tổng giá trị đã duyệt</span><span className="font-semibold text-ink">{formatVnd(approvedTotal)}</span></div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
};
