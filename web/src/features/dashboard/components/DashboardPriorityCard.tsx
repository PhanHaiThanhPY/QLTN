import { CalendarClock, FileCheck2, TriangleAlert } from 'lucide-react';
import { Link } from 'react-router';
import { Card, CardBody, CardHeader } from '@/components/ui/card';

interface DashboardPriorityCardProps {
  overdueRepairCount: number;
  overdueMaintenanceCount: number;
  pendingApprovalCount: number;
  pendingReviewCount: number;
}

const ACTIONS = [
  { key: 'repairs', label: 'Hồ sơ sửa chữa quá hạn', description: 'Ưu tiên kiểm tra các hồ sơ chưa có cập nhật mới', to: '/records?overdue=1', tone: 'crit', Icon: TriangleAlert },
  { key: 'maintenance', label: 'Lượt bảo trì quá hạn', description: 'Ngày dự kiến đã qua nhưng chưa hoàn thành', to: '/maintenance/schedule?indicator=OVERDUE', tone: 'warn', Icon: CalendarClock },
  { key: 'approvals', label: 'Hồ sơ đang chờ phê duyệt', description: 'Theo dõi để không làm chậm tiến độ thanh toán', to: '/records', tone: 'accent', Icon: FileCheck2 },
] as const;

const countFor = (key: (typeof ACTIONS)[number]['key'], props: DashboardPriorityCardProps) => {
  if (key === 'repairs') return props.overdueRepairCount;
  if (key === 'maintenance') return props.overdueMaintenanceCount;
  return props.pendingApprovalCount;
};

const toneClasses = {
  crit: 'bg-crit-soft text-crit',
  warn: 'bg-warn-soft text-warn',
  accent: 'bg-accent-soft text-accent',
} as const;

/** Compact action center for the overview screen. */
export const DashboardPriorityCard = (props: DashboardPriorityCardProps) => (
  <Card>
    <CardHeader
      title="Cần xử lý hôm nay"
      description="Những việc đang ảnh hưởng tới tiến độ vận hành"
      actions={<Link to="/tasks" className="text-sm font-semibold text-accent hover:underline">Mở danh sách</Link>}
    />
    <CardBody className="pt-0">
      <div className="divide-y divide-line">
        {ACTIONS.map(({ key, label, description, to, tone, Icon }) => (
          <Link key={key} to={to} className="group flex items-center gap-3 px-0 py-3 transition-colors first:pt-0 last:border-b-0 hover:bg-surface-2">
            <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${toneClasses[tone]}`}><Icon className="size-4" aria-hidden /></span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-ink group-hover:text-accent">{label}</span>
              <span className="mt-0.5 block truncate text-xs text-ink-2">{description}</span>
            </span>
            <span className="text-lg font-bold tabular-nums text-ink">{countFor(key, props)}</span>
          </Link>
        ))}
      </div>
      <Link to="/maintenance/schedule?status=PENDING_REVIEW" className="mt-2 flex items-center justify-between border-t border-line px-0 pt-3 text-xs text-ink-2 transition-colors hover:text-accent">
        <span>Bảo trì chờ kiểm tra</span>
        <span className="font-bold tabular-nums text-warn">{props.pendingReviewCount}</span>
      </Link>
    </CardBody>
  </Card>
);
