import { Link } from 'react-router';
import { ErrorState, LoadingState } from '@/components/common/States';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { LOOKAHEAD_DAYS, addDays } from '@/domain/maintenance-periods';
import type { IsoDate } from '@/domain/types';
import { useServiceQuery } from '@/hooks/useServiceQuery';
import { cn } from '@/lib/cn';
import { getApiPlanDetail } from '@/services/maintenance-plans-api';
import type { ApiOccurrence, ApiPlanRow } from '@/services/maintenance-plans-api';
import { formatDate } from '@/utils/date';
import { PlanApiStatusBadge } from './PlanApiStatusBadge';

interface ItemMaintenanceApiTabProps {
  itemId: string;
  plans: ApiPlanRow[];
  today: IsoDate;
  canCreate: boolean;
  userName: (id?: string) => string;
}

interface Upcoming {
  occurrence: ApiOccurrence;
  plan: ApiPlanRow;
}

/** Scheduled occurrences of the item's running plans within the generator's 30 days, by date. */
const loadUpcoming = async (plans: readonly ApiPlanRow[], today: IsoDate): Promise<Upcoming[]> => {
  const until = addDays(today, LOOKAHEAD_DAYS);
  const running = plans.filter((plan) => plan.status === 'ACTIVE' || plan.status === 'PAUSED');
  const details = await Promise.all(running.map((plan) => getApiPlanDetail(plan.id)));
  return details
    .flatMap((detail, index) =>
      detail.occurrences
        .filter((row) => row.status === 'SCHEDULED' && row.scheduledDate >= today && row.scheduledDate <= until)
        .map((occurrence) => ({ occurrence, plan: running[index] })),
    )
    .sort((a, b) => a.occurrence.scheduledDate.localeCompare(b.occurrence.scheduledDate));
};

/** "Bảo trì" tab of the item page (MT-S2 ui-brief §2.4): the item's plans and its next 30 days. */
export const ItemMaintenanceApiTab = ({ itemId, plans, today, canCreate, userName }: ItemMaintenanceApiTabProps) => {
  const upcoming = useServiceQuery(['maintenance', 'item', 'api', itemId, 'upcoming', plans.map((plan) => `${plan.id}:${plan.version}`)], () =>
    loadUpcoming(plans, today),
  );
  const renderUpcoming = () => {
    if (upcoming.isLoading) return <LoadingState rows={2} />;
    if (upcoming.error) return <ErrorState error={upcoming.error} onRetry={() => void upcoming.refetch()} />;
    if (!upcoming.data || upcoming.data.length === 0) return <p className="text-sm text-ink-2">Không có lượt nào trong 30 ngày tới.</p>;
    return (
      <ul className="divide-y divide-line">
        {upcoming.data.map(({ occurrence, plan }) => (
          <li key={occurrence.id} className="flex items-center justify-between gap-2 py-2 text-sm">
            <span className="min-w-0">
              <span className="font-medium text-ink">{formatDate(occurrence.scheduledDate)}</span>
              <span className="text-ink-2"> · {occurrence.code} · {plan.code}</span>
            </span>
            <span className="shrink-0 text-xs text-ink-2">{userName(occurrence.performerUserId)}</span>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader
          title="Kế hoạch bảo trì"
          actions={
            canCreate ? (
              <Link to={`/maintenance/plans/new?itemId=${encodeURIComponent(itemId)}`} className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }))}>
                Tạo kế hoạch cho thiết bị này
              </Link>
            ) : undefined
          }
        />
        <CardBody className="pt-0">
          {plans.length === 0 ? (
            <p className="text-sm text-ink-2">Thiết bị chưa có kế hoạch bảo trì.</p>
          ) : (
            <ul className="divide-y divide-line">
              {plans.map((plan) => (
                <li key={plan.id} className="flex items-center justify-between gap-2.5 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm">
                      <Link to={`/maintenance/plans/${plan.id}`} className="font-semibold text-accent hover:underline">
                        {plan.code}
                      </Link>{' '}
                      <span className="text-ink">{plan.name}</span>
                    </p>
                    <p className="text-xs text-ink-2">
                      {plan.schedule?.label ?? '—'}
                      {plan.nextDate ? ` · Lượt kế tiếp ${formatDate(plan.nextDate)}` : ''}
                    </p>
                  </div>
                  <PlanApiStatusBadge status={plan.status} />
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Lượt sắp tới" description="Các lượt đã lên lịch trong 30 ngày tới." />
        <CardBody className="pt-0">{renderUpcoming()}</CardBody>
      </Card>
    </div>
  );
};
