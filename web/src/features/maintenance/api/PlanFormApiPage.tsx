import { useParams, useSearchParams } from 'react-router';
import { Notice } from '@/components/common/Notice';
import { PageHeader } from '@/components/common/PageHeader';
import { ErrorState, LoadingState } from '@/components/common/States';
import { hasCapability } from '@/domain/permissions';
import { useReferenceData } from '@/hooks/useReferenceData';
import { useServiceQuery } from '@/hooks/useServiceQuery';
import { listApiItems } from '@/services/maintenance-items-api';
import { getApiPlanDetail } from '@/services/maintenance-plans-api';
import { PlanApiForm } from './PlanApiForm';

/** Create (`?itemId=` preselects the item, ui-brief §2.4) or edit a plan on real data. */
const PlanFormApiPage = () => {
  const { planId } = useParams();
  const [params] = useSearchParams();
  const { data, isLoading } = useReferenceData();
  const plan = useServiceQuery(['maintenance', 'plan', 'api', planId], () => getApiPlanDetail(planId ?? ''), Boolean(planId));
  const items = useServiceQuery(['maintenance', 'items', 'api', 'plannable'], () => listApiItems());
  const viewer = data?.viewer;

  if (isLoading || items.isLoading || (planId && plan.isLoading)) return <LoadingState />;
  const error = plan.error ?? items.error;
  if (error) return <ErrorState error={error} onRetry={() => void Promise.all([plan.refetch(), items.refetch()])} />;
  if (!viewer || (planId && !plan.data)) return <LoadingState />;

  const detail = plan.data;
  const title = detail ? `Sửa kế hoạch ${detail.plan.code}` : 'Tạo kế hoạch bảo trì';
  const plannable = (items.data ?? []).map((row) => row.item).filter((item) => item.active);
  const allowed = hasCapability(viewer, 'MAINTENANCE_MANAGE') && (!detail || detail.plan.managerUserId === viewer.id);
  const blocked = detail?.plan.status === 'ENDED' ? 'Kế hoạch đã kết thúc, không sửa được.' : undefined;

  return (
    <div>
      <PageHeader
        title={title}
        breadcrumbs={[
          { label: 'Kế hoạch bảo trì', to: '/maintenance/plans' },
          ...(detail ? [{ label: detail.plan.code, to: `/maintenance/plans/${detail.plan.id}` }] : []),
          { label: detail ? 'Sửa' : 'Tạo mới' },
        ]}
      />
      {allowed && !blocked ? (
        <PlanApiForm key={detail?.plan.id ?? 'new'} detail={detail} items={plannable} users={data?.users ?? []} presetItemId={params.get('itemId') ?? ''} />
      ) : (
        <Notice tone="warning" title="Không thể sửa">
          {blocked ?? 'Chỉ BQL quản lý kế hoạch được lập và sửa kế hoạch.'}
        </Notice>
      )}
    </div>
  );
};

export default PlanFormApiPage;
