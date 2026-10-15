import { AlertTriangle, ArrowUpRight, Bell, CalendarClock, CheckCircle2, ClipboardCheck, ListChecks } from 'lucide-react';
import { Link } from 'react-router';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import type { DashboardData } from '@/services/report-service';

interface DashboardTodayCenterProps {
  data: DashboardData;
}

type ActionTone = 'danger' | 'warning' | 'info';

interface ActionRow {
  key: string;
  label: string;
  detail: string;
  count: number;
  href: string;
  tone: ActionTone;
  icon: typeof AlertTriangle;
}

const TONE_CLASS: Record<ActionTone, string> = {
  danger: 'bg-crit/10 text-crit',
  warning: 'bg-warn/12 text-warn',
  info: 'bg-accent/10 text-accent',
};

const buildRows = (data: DashboardData): ActionRow[] => {
  const maintenanceDueCount = data.overdueMaintenance.length + data.upcomingMaintenance.length;
  const rows: ActionRow[] = [
    {
      key: 'overdue',
      label: 'Công việc quá hạn',
      detail: 'Ưu tiên kiểm tra và phân công xử lý',
      count: data.overdueRepairCount,
      href: '/records?overdue=1',
      tone: 'danger',
      icon: AlertTriangle,
    },
    {
      key: 'approval',
      label: 'Hồ sơ chờ phê duyệt',
      detail: 'Tiếp tục chuỗi duyệt đang mở',
      count: data.pendingApprovalCount,
      href: '/records',
      tone: 'warning',
      icon: ClipboardCheck,
    },
    {
      key: 'maintenance',
      label: 'Lịch bảo trì cần theo dõi',
      detail: 'Lượt đến hạn hoặc đã quá lịch',
      count: maintenanceDueCount,
      href: '/maintenance/schedule',
      tone: 'info',
      icon: CalendarClock,
    },
    {
      key: 'tasks',
      label: 'Việc được giao cho tôi',
      detail: 'Công việc đang mở trong phạm vi của bạn',
      count: data.myOpenTaskCount,
      href: '/tasks',
      tone: 'info',
      icon: ListChecks,
    },
    {
      key: 'notifications',
      label: 'Thông báo chưa đọc',
      detail: 'Rà soát các cập nhật mới từ workflow',
      count: data.unreadNotificationCount,
      href: '/notifications?filter=unread',
      tone: 'info',
      icon: Bell,
    },
  ];
  return rows.filter((row) => row.count > 0);
};

/** Compact operational queue for the few actions that matter today. */
export const DashboardTodayCenter = ({ data }: DashboardTodayCenterProps) => {
  const rows = buildRows(data);

  return (
    <Card>
      <CardHeader title="Trung tâm điều hành hôm nay" description="Các việc cần xử lý trước trong phạm vi của bạn." />
      <CardBody className="pt-0">
        {rows.length === 0 ? (
          <div className="flex items-center gap-3 rounded-lg border border-good/20 bg-good/5 px-3 py-3 text-sm text-ink-2">
            <CheckCircle2 className="size-5 shrink-0 text-good" aria-hidden />
            <span>Hôm nay chưa có việc quá hạn hoặc đang chờ xử lý.</span>
          </div>
        ) : (
          <div className="divide-y divide-line rounded-lg border border-line">
            {rows.map((row) => {
              const Icon = row.icon;
              return (
                <Link key={row.key} to={row.href} className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-surface-2">
                  <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${TONE_CLASS[row.tone]}`}>
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink">{row.label}</span>
                    <span className="block truncate text-xs text-ink-2">{row.detail}</span>
                  </span>
                  <span className="flex items-center gap-1.5 text-sm font-bold tabular-nums text-ink">
                    {row.count}
                    <ArrowUpRight className="size-4 text-ink-3" aria-hidden />
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </CardBody>
    </Card>
  );
};
