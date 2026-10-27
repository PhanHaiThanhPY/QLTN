import { useEffect } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { AuditTimeline } from '@/components/common/AuditTimeline';
import { Notice } from '@/components/common/Notice';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/States';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { TabPanel, Tabs } from '@/components/ui/tabs';
import type { TabItem } from '@/components/ui/tabs';
import { ERROR_CODE, isAppError } from '@/domain/errors';
import { useServiceQuery } from '@/hooks/useServiceQuery';
import { cn } from '@/lib/cn';
import { getApiItemDetail } from '@/services/maintenance-items-api';
import { listApiPlans } from '@/services/maintenance-plans-api';
import type { ApiItemDetail } from '@/services/maintenance-items-api';
import { todayVn } from '@/services/runtime';
import { formatDate, toVnDate } from '@/utils/date';
import { ConditionHistory } from '../components/ConditionHistory';
import { ItemDocumentsCard } from '../components/ItemDocumentsCard';
import { ItemAttentionPanel } from '../components/item/ItemAttentionPanel';
import { ItemDetailHeader } from '../components/item/ItemDetailHeader';
import { ItemSpecCard } from '../components/item/ItemSpecCard';
import { TabCount } from '../components/item/TabCount';
import { useMaintenanceScreen } from '../hooks/useMaintenanceScreen';
import { capabilityState } from '../utils/maintenance-ui';
import { ageLabel, warrantyInfo } from '../utils/item-insights';
import { apiAttentionItems } from './item-api-ui';
import { ItemApiActions } from './ItemApiActions';
import { ItemApiFigures } from './ItemApiFigures';
import { ItemApiRepairTable } from './ItemApiRepairTable';
import { ItemMaintenanceApiTab } from './ItemMaintenanceApiTab';

const TAB_VALUES = ['overview', 'maintenance', 'repairs', 'documents', 'history'] as const;
type ItemTab = (typeof TAB_VALUES)[number];
const RECENT_REPAIRS = 3;

const isItemTab = (value: string | null): value is ItemTab => TAB_VALUES.some((tab) => tab === value);

/** MT-S2 ui-brief §2.4: the "Bảo trì" tab is back in api mode with the item's plans. */
const tabItems = (detail: ApiItemDetail, plans: number): TabItem[] => [
  { value: 'overview', label: 'Tổng quan' },
  { value: 'maintenance', label: 'Bảo trì', badge: <TabCount value={plans} /> },
  { value: 'repairs', label: 'Sửa chữa', badge: <TabCount value={detail.repairs.length} /> },
  { value: 'documents', label: 'Tài liệu', badge: <TabCount value={detail.documents.length} /> },
  { value: 'history', label: 'Lịch sử thay đổi' },
];

const NotFound = () => (
  <EmptyState
    title="Không tìm thấy thiết bị"
    description="Thiết bị không tồn tại hoặc nằm ngoài phạm vi của bạn."
    action={<Link to="/maintenance/items" className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }))}>Về danh sách thiết bị</Link>}
  />
);

/** Item page on real data (SPEC MT-S1 BR-MT-08): figures and attention on top, history in tabs, specs on the side. */
const ItemDetailApiPage = () => {
  const { itemId = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const { data, userName, buildingName, locationName } = useMaintenanceScreen();
  const query = useServiceQuery(['maintenance', 'item', 'api', itemId], () => getApiItemDetail(itemId));
  const plans = useServiceQuery(['maintenance', 'plans', 'api', 'item', itemId], () => listApiPlans({ itemId, includeEnded: true }));
  const tabParam = params.get('tab');
  const tab: ItemTab = isItemTab(tabParam) ? tabParam : 'overview';

  const setTab = (next: string) => {
    const updated = new URLSearchParams(params);
    updated.set('tab', next);
    setParams(updated, { replace: true });
  };

  useEffect(() => {
    if (query.data?.item.code) document.title = `Thiết bị ${query.data.item.code} · QLTN`;
  }, [query.data?.item.code]);

  if (query.isLoading) return <LoadingState rows={4} />;
  if (isAppError(query.error) && query.error.code === ERROR_CODE.NOT_FOUND) return <NotFound />;
  if (query.error) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  if (!query.data || !data?.viewer) return <LoadingState rows={4} />;

  const detail = query.data;
  const { item, repairs, documents, audit } = detail;
  const today = todayVn();
  const lastEditor = audit[0]?.actorId;
  const itemPlans = plans.data ?? [];
  const nextDate = itemPlans.flatMap((plan) => (plan.nextDate ? [plan.nextDate] : [])).sort()[0];
  const canPlan = item.active && capabilityState(data.viewer, 'MAINTENANCE_MANAGE', item.buildingId).allowed;

  return (
    <div className="space-y-4">
      <ItemDetailHeader
        item={item}
        viewer={data.viewer}
        warranty={warrantyInfo(item, today)}
        buildingLabel={buildingName(item.buildingId)}
        locationLabel={locationName(item.locationId)}
        ownerLabel={userName(item.ownerUserId)}
        actions={<ItemApiActions item={item} viewer={data.viewer} />}
        inactiveLabel="Đã ngừng dùng"
      />
      {item.active ? null : (
        <Notice tone="info">
          Thiết bị đã ngừng dùng{item.deactivatedAt ? ` từ ${formatDate(toVnDate(item.deactivatedAt))}` : ''}.
          {item.deactivationReason ? ` Lý do: ${item.deactivationReason}` : ''}
        </Notice>
      )}
      <ItemApiFigures detail={detail} today={today} nextDate={nextDate} />
      <ItemAttentionPanel items={apiAttentionItems(detail)} />

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0">
          <Tabs value={tab} onValueChange={setTab} items={tabItems(detail, itemPlans.length)}>
            <TabPanel value="overview">
              <Card>
                <CardHeader
                  title="Sửa chữa gần đây"
                  description={repairs.length > 0 ? `${repairs.length} hồ sơ, mới nhất trước.` : undefined}
                />
                <CardBody className="pt-0">
                  <ItemApiRepairTable repairs={repairs.slice(0, RECENT_REPAIRS)} />
                </CardBody>
              </Card>
            </TabPanel>
            <TabPanel value="maintenance">
              {plans.error ? (
                <ErrorState error={plans.error} onRetry={() => void plans.refetch()} />
              ) : (
                <ItemMaintenanceApiTab itemId={item.id} plans={itemPlans} today={today} canCreate={canPlan} userName={userName} />
              )}
            </TabPanel>
            <TabPanel value="repairs">
              <Card>
                <CardHeader title="Hồ sơ sửa chữa" description="Bấm mã để mở hồ sơ." />
                <CardBody className="pt-0"><ItemApiRepairTable repairs={repairs} /></CardBody>
              </Card>
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
          <ItemSpecCard
            item={item}
            ageLabel={item.installDate ? ageLabel(item.installDate, today) : undefined}
            ownerLabel={userName(item.ownerUserId)}
            updatedByLabel={lastEditor ? userName(lastEditor) : 'Hệ thống'}
          />
        </aside>
      </div>
    </div>
  );
};

export default ItemDetailApiPage;
