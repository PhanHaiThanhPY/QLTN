import { StatusPill } from '@/components/ui/badge';
import type { ApiPlanStatus } from '@/services/maintenance-plans-api';
import { PLAN_STATUS_TEXT, PLAN_STATUS_TONE } from './plan-api-ui';

/** Plan state with dot and text (ui-brief §1); "Đã kết thúc" in muted text. */
export const PlanApiStatusBadge = ({ status }: { status: ApiPlanStatus }) => (
  <span className={status === 'ENDED' ? 'text-ink-3' : undefined}>
    <StatusPill tone={PLAN_STATUS_TONE[status]}>{PLAN_STATUS_TEXT[status]}</StatusPill>
  </span>
);
