import { useParams } from 'react-router';
import { Notice } from '@/components/common/Notice';
import { PageHeader } from '@/components/common/PageHeader';
import { ErrorState, LoadingState } from '@/components/common/States';
import { PLAN_ACTIONS, evaluateAction } from '@/domain/actions';
import { hasCapability } from '@/domain/permissions';
import { useServiceQuery } from '@/hooks/useServiceQuery';
import { getPlanDetail } from '@/services/maintenance-service';
import { PlanForm } from './components/PlanForm';
import { useMaintenanceScreen } from './hooks/useMaintenanceScreen';

const PlanFormPage = () => {
  const { planId } = useParams();
  const { data, isLoading } = useMaintenanceScreen();
  const query = useServiceQuery(['maintenance', 'plan', planId], () => getPlanDetail(planId ?? ''), Boolean(planId));
  const viewer = data?.viewer;

  if (isLoading || (planId && query.isLoading)) return <LoadingState />;
  if (query.error) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  if (!viewer) return <LoadingState />;

  const plan = query.data?.plan;
  if (planId && !plan) return <LoadingState />;
  const title = plan ? `Sửa kế hoạch ${plan.code}` : 'Tạo kế hoạch bảo trì';
  const backTo = plan ? `/maintenance/plans/${plan.id}` : '/maintenance/plans';
  const state = plan
    ? evaluateAction(PLAN_ACTIONS.updateMaintenancePlan, viewer, plan)
    : { allowed: hasCapability(viewer, 'MAINTENANCE_MANAGE'), reason: 'Chỉ BQL được lập kế hoạch bảo trì.' };

  return (
    <div>
      <PageHeader
        title={title}
        breadcrumbs={[{ label: 'Kế hoạch bảo trì', to: '/maintenance/plans' }, ...(plan ? [{ label: plan.code, to: backTo }] : []), { label: plan ? 'Sửa' : 'Tạo mới' }]}
      />
      {state.allowed ? (
        <PlanForm key={plan?.id ?? 'new'} plan={plan} />
      ) : (
        <Notice tone="warning" title="Không thể sửa">
          {state.reason}
        </Notice>
      )}
    </div>
  );
};

export default PlanFormPage;
