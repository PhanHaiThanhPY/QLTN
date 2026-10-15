import { AlarmClock, CalendarDays, ChevronDown, ClipboardCheck, FileWarning, Plus, Wrench } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/common/PageHeader';
import { ErrorState, LoadingState } from '@/components/common/States';
import { AssistantInsight } from '@/components/assistant/AssistantInsight';
import { useAutoGenerateSchedule } from '@/hooks/useAutoGenerateSchedule';
import { useReferenceData } from '@/hooks/useReferenceData';
import { useServiceQuery } from '@/hooks/useServiceQuery';
import { hasCapability } from '@/domain/permissions';
import { buildOperationalRiskGuidance } from '@/domain/operational-guidance';
import { getDashboard } from '@/services/report-service';
import { DashboardTodayCenter } from './components/DashboardTodayCenter';
import { DashboardInsights } from './components/DashboardInsights';
import { DashboardFocusCard } from './components/DashboardFocusCard';
import { DashboardMetricCard } from './components/DashboardMetricCard';
import { DashboardScheduleCard } from './components/DashboardScheduleCard';
import { DashboardWorkCard } from './components/DashboardWorkCard';
import { QuickIncidentDialog } from './components/QuickIncidentDialog';

const TITLE = 'Tổng quan vận hành';

const monthLabel = (): string => {
  const value = new Intl.DateTimeFormat('en-US', { month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
  const [month, year] = value.split('/');
  return `Tháng ${month}, ${year}`;
};

/** "Tổng quan": action-first overview for the viewer's buildings. */
const DashboardPage = () => {
  const [quickIncidentOpen, setQuickIncidentOpen] = useState(false);
  const { data: reference, buildingName, itemName } = useReferenceData();
  const viewer = reference?.viewer;
  useAutoGenerateSchedule(viewer);
  const query = useServiceQuery(['dashboard'], getDashboard);

  const buildingCount = viewer?.buildingIds.length ?? 0;
  const description = viewer ? `Theo dõi công việc tại ${buildingCount} tòa nhà` : undefined;

  if (query.isLoading) {
    return (
      <div className="space-y-4">
        <PageHeader title={TITLE} description={description} />
        <LoadingState rows={6} />
      </div>
    );
  }

  if (query.error || !query.data) {
    return (
      <div className="space-y-4">
        <PageHeader title={TITLE} description={description} />
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      </div>
    );
  }

  const data = query.data;
  const maintenanceDueCount = data.overdueMaintenance.length + data.upcomingMaintenance.length;
  const risk = buildOperationalRiskGuidance({
    overdueRepairCount: data.overdueRepairCount,
    overdueMaintenanceCount: data.overdueMaintenance.length,
    pendingApprovalCount: data.pendingApprovalCount,
    pendingReviewCount: data.pendingReviewCount,
    unresolvedCount: data.unresolvedCount,
  });
  const canCreateRecord = Boolean(viewer && hasCapability(viewer, 'RECORD_EDIT'));
  return (
    <div className="space-y-4">
      <PageHeader
        title={TITLE}
        description={description}
        actions={
          <>
            {canCreateRecord ? <Button size="sm" onClick={() => setQuickIncidentOpen(true)}><Plus className="size-4" aria-hidden />Ghi nhận sự cố</Button> : null}
            <div className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-semibold text-ink-2"><CalendarDays className="size-4 text-accent" aria-hidden /><span>{monthLabel()}</span><ChevronDown className="size-4 text-ink-3" aria-hidden /></div>
          </>
        }
      />
      <div className="mb-4">
        <DashboardFocusCard data={data} viewerName={viewer?.fullName} />
      </div>
      <div className="mb-4">
        <DashboardTodayCenter data={data} />
      </div>
      <AssistantInsight
        context="Tổng quan"
        summary={risk.tone === 'good' ? 'Chưa phát hiện rủi ro vận hành nổi bật.' : risk.title}
        details={`${risk.reason} ${data.openRepairCount} sự cố đang mở · ${maintenanceDueCount} lượt bảo trì đến hạn. Tôi chỉ đang đọc dữ liệu trong phạm vi tòa nhà hiện tại.`}
        sourceHref={risk.href}
        sourceLabel="Mở dữ liệu nguồn"
        suggestions={['Tóm tắt hiện tại', 'Việc nào nên ưu tiên?']}
      />
      <details className="group rounded-xl border border-line bg-surface shadow-card">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-ink [&::-webkit-details-marker]:hidden sm:px-5">
          <span>Xem dữ liệu chi tiết</span>
          <ChevronDown className="size-4 text-ink-3 transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <div className="space-y-4 border-t border-line p-4 sm:p-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <DashboardMetricCard icon={FileWarning} value={data.openRepairCount} label="Sự cố đang mở" tone="crit" hint="Trong phạm vi tòa nhà" to="/records" />
            <DashboardMetricCard icon={AlarmClock} value={data.overdueRepairCount} label="Công việc quá hạn" tone={data.overdueRepairCount > 0 ? 'crit' : 'neutral'} hint="Cần xử lý ngay" to="/records?overdue=1" />
            <DashboardMetricCard icon={Wrench} value={maintenanceDueCount} label="Bảo trì đến hạn" tone="good" hint={`${data.pendingReviewCount} lượt chờ kiểm tra`} to="/maintenance/schedule" />
            <DashboardMetricCard icon={ClipboardCheck} value={data.pendingApprovalCount} label="Chờ phê duyệt" tone="warn" hint="Đang ở chuỗi phê duyệt" to="/records" />
          </div>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.65fr)]">
            <DashboardWorkCard records={data.recentRecords} buildingName={buildingName} />
            <DashboardScheduleCard upcoming={data.upcomingMaintenance} overdue={data.overdueMaintenance} itemName={itemName} />
          </div>
          <DashboardInsights records={data.recentRecords} overdueRepairCount={data.overdueRepairCount} pendingApprovalCount={data.pendingApprovalCount} approvedTotal={data.approvedTotal} paidTotal={data.paidTotal} />
        </div>
      </details>
      {quickIncidentOpen ? <QuickIncidentDialog onClose={() => setQuickIncidentOpen(false)} /> : null}
    </div>
  );
};

export default DashboardPage;
