import { useParams, useSearchParams } from 'react-router';
import { AuditTimeline } from '@/components/common/AuditTimeline';
import { Notice } from '@/components/common/Notice';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/States';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { TabPanel, Tabs } from '@/components/ui/tabs';
import type { TabItem } from '@/components/ui/tabs';
import { useServiceQuery } from '@/hooks/useServiceQuery';
import { getItemDetail } from '@/services/maintenance-service';
import type { ItemDetail } from '@/services/maintenance-service';
import { todayVn } from '@/services/runtime';
import { ConditionHistory } from './components/ConditionHistory';
import { ItemDocumentsCard } from './components/ItemDocumentsCard';
import { OccurrenceTable } from './components/OccurrenceTable';
import { ItemAttentionPanel } from './components/item/ItemAttentionPanel';
import { ItemDetailHeader } from './components/item/ItemDetailHeader';
import { ItemHealthCard } from './components/item/ItemHealthCard';
import { ItemKpiRow } from './components/item/ItemKpiRow';
import { ItemOverviewTab } from './components/item/ItemOverviewTab';
import { ItemPlanList } from './components/item/ItemPlanList';
import { ItemRepairHistoryCard } from './components/item/ItemRepairHistoryCard';
import { ItemSpecCard } from './components/item/ItemSpecCard';
import { TabCount } from './components/item/TabCount';
import { useMaintenanceScreen } from './hooks/useMaintenanceScreen';
import { buildItemInsights } from './utils/item-insights';

const TAB_VALUES = ['overview', 'maintenance', 'repairs', 'documents', 'history'] as const;
type ItemTab = (typeof TAB_VALUES)[number];

const isItemTab = (value: string | null): value is ItemTab => TAB_VALUES.some((tab) => tab === value);
const getTab = (value: string | null): ItemTab => (isItemTab(value) ? value : 'overview');

const tabItems = (detail: ItemDetail): TabItem[] => [
  { value: 'overview', label: 'Tổng quan' },
  { value: 'maintenance', label: 'Bảo trì', badge: <TabCount value={detail.occurrences.length} /> },
  { value: 'repairs', label: 'Sửa chữa', badge: <TabCount value={detail.repairs.length} /> },
  { value: 'documents', label: 'Tài liệu', badge: <TabCount value={detail.documents.length} /> },
  { value: 'history', label: 'Lịch sử thay đổi' },
];

/** Equipment detail: identity + what needs action on top, work history in tabs, technical sheet on the side. */
const ItemDetailPage = () => {
  const { itemId = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const { data, userName, buildingName, locationName } = useMaintenanceScreen();
  const query = useServiceQuery(['maintenance', 'item', itemId], () => getItemDetail(itemId));
  const tab = getTab(params.get('tab'));

  const setTab = (next: string) => {
    const updated = new URLSearchParams(params);
    updated.set('tab', next);
    setParams(updated, { replace: true });
  };

  const breadcrumbs = [{ label: 'Thiết bị', to: '/maintenance/items' }, { label: query.data?.item.code ?? itemId }];
  const header = <PageHeader isCompact title={`Thiết bị ${query.data?.item.code ?? itemId}`} breadcrumbs={breadcrumbs} />;
  if (query.isLoading) return <>{header}<LoadingState /></>;
  if (query.error) return <>{header}<ErrorState error={query.error} onRetry={() => void query.refetch()} /></>;
  if (!query.data || !data?.viewer) return <>{header}<LoadingState /></>;

  const detail = query.data;
  const { item, plans, rows, repairs, repairCosts, documents, audit } = detail;
  const today = todayVn();
  const insights = buildItemInsights(detail, today);
  const lastEditor = audit[0]?.actorId;

  return (
    <div className="space-y-4">
      {header}
      <ItemDetailHeader
        item={item}
        viewer={data.viewer}
        warranty={insights.warranty}
        buildingLabel={buildingName(item.buildingId)}
        locationLabel={locationName(item.locationId)}
        ownerLabel={userName(item.ownerUserId)}
      />
      {item.active ? null : <Notice tone="warning">Thiết bị đã vô hiệu hóa: không sinh lịch mới, chỉ xem lịch sử.</Notice>}
      <ItemAttentionPanel items={insights.attention} />
      <ItemKpiRow insights={insights} repairCount={repairs.length} today={today} />

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0">
          <Tabs value={tab} onValueChange={setTab} items={tabItems(detail)}>
            <TabPanel value="overview">
              <ItemOverviewTab
                insights={insights}
                plans={plans}
                repairs={repairs}
                repairCosts={repairCosts}
                today={today}
                userName={userName}
                onOpenTab={setTab}
              />
            </TabPanel>

            <TabPanel value="maintenance">
              <div className="space-y-4">
                <Card>
                  <CardHeader title="Kế hoạch bảo trì" />
                  <CardBody className="pt-0"><ItemPlanList plans={plans} /></CardBody>
                </Card>
                <Card>
                  <CardHeader title="Các lượt bảo trì" description={`${rows.length} lượt, mới nhất trước.`} />
                  <CardBody className="pt-0">
                    {rows.length === 0 ? <EmptyState title="Chưa có lượt bảo trì nào" /> : <OccurrenceTable rows={rows} showItem={false} showLocation={false} />}
                  </CardBody>
                </Card>
              </div>
            </TabPanel>

            <TabPanel value="repairs">
              <ItemRepairHistoryCard itemId={item.id} />
            </TabPanel>

            <TabPanel value="documents">
              <ItemDocumentsCard item={item} documents={documents} viewer={data.viewer} />
            </TabPanel>

            <TabPanel value="history">
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <Card><CardHeader title="Thay đổi tình trạng" /><CardBody><ConditionHistory audit={audit} /></CardBody></Card>
                <Card><CardHeader title="Lịch sử thao tác" /><CardBody><AuditTimeline events={audit} /></CardBody></Card>
              </div>
            </TabPanel>
          </Tabs>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20" aria-label="Thông tin thiết bị">
          <ItemHealthCard item={item} warranty={insights.warranty} />
          <ItemSpecCard
            item={item}
            ageLabel={insights.ageLabel}
            ownerLabel={userName(item.ownerUserId)}
            updatedByLabel={lastEditor ? userName(lastEditor) : 'Hệ thống'}
          />
        </aside>
      </div>
    </div>
  );
};

export default ItemDetailPage;
