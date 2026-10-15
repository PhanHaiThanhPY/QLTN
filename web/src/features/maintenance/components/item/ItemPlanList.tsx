import { Link } from 'react-router';
import { PlanStatusBadge } from '@/components/common/StatusBadge';
import { FREQUENCY_LABEL } from '@/domain/constants';
import type { MaintenancePlan } from '@/domain/types';
import { currentScheduleVersion } from '@/domain/schedule';

/** Maintenance plans attached to the item with their frequency and status. */
export const ItemPlanList = ({ plans }: { plans: MaintenancePlan[] }) => {
  if (plans.length === 0) return <p className="text-sm text-ink-2">Thiết bị chưa có kế hoạch bảo trì.</p>;
  return (
      <ul className="divide-y divide-line">
      {plans.map((plan) => (
        <li key={plan.id} className="flex items-center justify-between gap-2.5 rounded-lg px-1 py-2 hover:bg-surface-2">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <Link to={`/maintenance/plans/${plan.id}`} className="shrink-0 text-xs font-semibold text-accent hover:underline">{plan.code}</Link>
              <p className="truncate text-xs font-medium text-ink">{plan.title}</p>
            </div>
            <p className="mt-0.5 text-[0.6875rem] text-ink-2">Chu kỳ {FREQUENCY_LABEL[currentScheduleVersion(plan).frequency]}</p>
          </div>
          <span className="shrink-0 text-[0.625rem]"><PlanStatusBadge status={plan.status} /></span>
        </li>
      ))}
    </ul>
  );
};
