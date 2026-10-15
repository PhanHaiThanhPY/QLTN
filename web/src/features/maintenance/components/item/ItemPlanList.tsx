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
        <li key={plan.id} className="flex items-center justify-between gap-3 py-2.5">
          <div className="min-w-0">
            <Link to={`/maintenance/plans/${plan.id}`} className="text-[0.8125rem] font-semibold text-accent hover:underline">
              {plan.code}
            </Link>
            <p className="text-[0.8125rem] text-ink">{plan.title}</p>
            <p className="text-xs text-ink-2">Chu kỳ: {FREQUENCY_LABEL[currentScheduleVersion(plan).frequency]}</p>
          </div>
          <PlanStatusBadge status={plan.status} />
        </li>
      ))}
    </ul>
  );
};
