import { Link, useParams } from 'react-router';
import { AuditTimeline } from '@/components/common/AuditTimeline';
import { InfoGrid } from '@/components/common/InfoGrid';
import { Notice } from '@/components/common/Notice';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/States';
import { PlanStatusBadge } from '@/components/common/StatusBadge';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { FREQUENCY_LABEL } from '@/domain/constants';
import { currentScheduleVersion } from '@/domain/schedule';
import { useServiceQuery } from '@/hooks/useServiceQuery';
import { getPlanDetail } from '@/services/maintenance-service';
import { formatDate, formatDateTime } from '@/utils/date';
import { DetailHeaderCard } from './components/DetailHeaderCard';
import { ChecklistTemplateCard } from './components/ChecklistTemplateCard';
import { OccurrenceTable } from './components/OccurrenceTable';
import { PlanActions } from './components/PlanActions';
import { ScheduleVersionsCard } from './components/ScheduleVersionsCard';
import { useMaintenanceScreen } from './hooks/useMaintenanceScreen';

const PlanDetailPage = () => {
  const { planId = '' } = useParams();
  const { data, userName, buildingName } = useMaintenanceScreen();
  const query = useServiceQuery(['maintenance', 'plan', planId], () => getPlanDetail(planId));

  if (query.isLoading) return <LoadingState />;
  if (query.error) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  if (!query.data || !data?.viewer) return <LoadingState />;

  const { plan, item, nextDueDate, occurrences, rows, audit } = query.data;
  const version = currentScheduleVersion(plan);

  return (
    <div className="space-y-4">
      <PageHeader isCompact
        title={`Kế hoạch ${plan.code}`}
        breadcrumbs={[{ label: 'Kế hoạch bảo trì', to: '/maintenance/plans' }, { label: plan.code }]}
      />
      <DetailHeaderCard
        code={plan.code}
        title={plan.title}
        badges={<PlanStatusBadge status={plan.status} />}
        meta={item ? `${item.code} – ${item.name} · ${FREQUENCY_LABEL[version.frequency]}` : FREQUENCY_LABEL[version.frequency]}
        actions={<PlanActions plan={plan} viewer={data.viewer} />}
      />
      {plan.status === 'DRAFT' ? <Notice tone="info">Kế hoạch nháp chưa sinh lượt. Bấm “Kích hoạt” để bắt đầu sinh lịch.</Notice> : null}
      {plan.status === 'PAUSED' ? (
        <Notice tone="warning" title="Kế hoạch đang tạm dừng">
          Từ {formatDateTime(plan.pausedAt)} không sinh lượt mới. Kỳ rơi vào thời gian tạm dừng sẽ được ghi “bỏ qua” khi kích hoạt lại.
        </Notice>
      ) : null}
      {item && !item.active ? <Notice tone="warning">Hạng mục đã vô hiệu hóa; không thể kích hoạt kế hoạch.</Notice> : null}
      <Card>
        <CardHeader title="Thông tin" />
        <CardBody>
          <InfoGrid
            items={[
              {
                label: 'Hạng mục',
                value: item ? (
                  <Link to={`/maintenance/items/${item.id}`} className="text-accent hover:underline">
                    {item.code} – {item.name}
                  </Link>
                ) : (
                  '—'
                ),
              },
              { label: 'Tòa nhà', value: buildingName(plan.buildingId) },
              { label: 'Chu kỳ hiện hành', value: `${FREQUENCY_LABEL[version.frequency]} (phiên bản #${version.revision})` },
              { label: 'Ngày gốc hiện hành', value: formatDate(version.anchorDate) },
              { label: 'Kỳ tới (tính toán)', value: plan.status === 'ACTIVE' ? formatDate(nextDueDate) : 'Không sinh khi chưa hoạt động' },
              { label: 'Đã sinh lịch đến', value: formatDate(plan.generatedThrough) },
              { label: 'BQL quản lý', value: userName(plan.managerUserId) },
              { label: 'Người xác nhận kỹ thuật', value: userName(plan.confirmationUserId) },
              { label: 'Nhà thầu', value: plan.contractorName ?? '—' },
              { label: 'Cập nhật', value: `${formatDateTime(plan.updatedAt)} · phiên bản ${plan.version}` },
            ]}
          />
        </CardBody>
      </Card>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ScheduleVersionsCard plan={plan} />
        <ChecklistTemplateCard items={plan.checklistTemplate} />
      </div>
      <Card>
        <CardHeader title="Các lượt bảo trì" description={`${occurrences.length} lượt`} />
        <CardBody>
          {rows.length === 0 ? <EmptyState title="Chưa có lượt nào" /> : <OccurrenceTable rows={rows} showItem={false} />}
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Lịch sử kế hoạch" />
        <CardBody>
          <AuditTimeline events={audit} />
        </CardBody>
      </Card>
    </div>
  );
};

export default PlanDetailPage;
