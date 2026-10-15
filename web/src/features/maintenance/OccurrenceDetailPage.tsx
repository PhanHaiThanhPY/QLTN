import { useParams, useSearchParams } from 'react-router';
import { AuditTimeline } from '@/components/common/AuditTimeline';
import { PageHeader } from '@/components/common/PageHeader';
import { ErrorState, LoadingState } from '@/components/common/States';
import { OccurrenceStatusBadge } from '@/components/common/StatusBadge';
import { Card, CardBody } from '@/components/ui/card';
import { TabPanel, Tabs } from '@/components/ui/tabs';
import { useServiceQuery } from '@/hooks/useServiceQuery';
import { getOccurrenceDetail } from '@/services/maintenance-service';
import { formatDate } from '@/utils/date';
import { DetailHeaderCard } from './components/DetailHeaderCard';
import { OccurrenceFlags } from './components/OccurrenceFlags';
import { ChecklistTab } from './components/occurrence/ChecklistTab';
import { OccurrenceActions } from './components/occurrence/OccurrenceActions';
import { OccurrenceNotices } from './components/occurrence/OccurrenceNotices';
import { OverviewTab } from './components/occurrence/OverviewTab';
import { useMaintenanceScreen } from './hooks/useMaintenanceScreen';

const TABS = [
  { value: 'overview', label: 'Tổng quan' },
  { value: 'checklist', label: 'Checklist & kết quả' },
  { value: 'history', label: 'Lịch sử' },
];

const OccurrenceDetailPage = () => {
  const { occurrenceId = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const { data } = useMaintenanceScreen();
  const query = useServiceQuery(['maintenance', 'occurrence', occurrenceId], () => getOccurrenceDetail(occurrenceId));
  const requested = params.get('tab') ?? 'overview';
  const tab = TABS.some((row) => row.value === requested) ? requested : 'overview';
  const code = query.data?.occurrence.code ?? 'Chi tiết lượt';

  const setTab = (next: string) => {
    const updated = new URLSearchParams(params);
    updated.set('tab', next);
    setParams(updated, { replace: true });
  };

  const header = (
    <PageHeader isCompact title={`Lượt bảo trì ${code}`} breadcrumbs={[{ label: 'Lịch bảo trì', to: '/maintenance/schedule' }, { label: code }]} />
  );
  if (query.isLoading) return <>{header}<LoadingState /></>;
  if (query.error) return <>{header}<ErrorState error={query.error} onRetry={() => void query.refetch()} /></>;
  if (!query.data || !data?.viewer) return <>{header}<LoadingState /></>;

  const detail = query.data;
  const { occurrence, item, plan, indicator, inactiveSlots } = detail;
  const isMoved = Boolean(occurrence.originalScheduledDate) && occurrence.originalScheduledDate !== occurrence.scheduledDate;

  return (
    <div className="space-y-4">
      {header}
      <DetailHeaderCard
        code={occurrence.code}
        title={item ? `${item.code} – ${item.name}` : occurrence.code}
        badges={
          <>
            <OccurrenceStatusBadge status={occurrence.status} />
            <OccurrenceFlags occurrence={occurrence} indicator={indicator} needsReassignment={inactiveSlots.length > 0} />
          </>
        }
        meta={
          <>
            {plan ? `${plan.code} · ` : ''}Ngày dự kiến {formatDate(occurrence.scheduledDate)}
            {isMoved ? ` (ngày gốc ${formatDate(occurrence.originalScheduledDate)})` : ''}
          </>
        }
        actions={<OccurrenceActions detail={detail} viewer={data.viewer} />}
      />
      <OccurrenceNotices detail={detail} viewer={data.viewer} />
      <Tabs value={tab} onValueChange={setTab} items={TABS}>
        <TabPanel value="overview">
          <OverviewTab detail={detail} viewer={data.viewer} />
        </TabPanel>
        <TabPanel value="checklist">
          <ChecklistTab detail={detail} viewer={data.viewer} />
        </TabPanel>
        <TabPanel value="history">
          <Card>
            <CardBody>
              <AuditTimeline events={detail.audit} />
            </CardBody>
          </Card>
        </TabPanel>
      </Tabs>
    </div>
  );
};

export default OccurrenceDetailPage;
