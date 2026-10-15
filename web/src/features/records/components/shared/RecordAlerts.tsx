import { Fragment } from 'react';
import { Link } from 'react-router';
import { Notice } from '@/components/common/Notice';
import type { RepairAlert, RepairAlertKind } from '@/domain/repair-alerts';

/** Warranty is a hint (info); the other rules ask the people involved to check before going on. */
const TONE: Record<RepairAlertKind, 'info' | 'warning'> = {
  WARRANTY: 'info',
  RECENT_REPAIR: 'warning',
  REPEATED: 'warning',
  PRICE: 'warning',
  EMERGENCY_OVER_LIMIT: 'warning',
};

interface RecordAlertsProps {
  alerts: RepairAlert[];
  /** Limit to some kinds, e.g. only the price alert next to the decision buttons. */
  kinds?: readonly RepairAlertKind[];
}

/** Rule-based warnings (warranty, recent repair, repeated failure, unusual price); they never block a step. */
export const RecordAlerts = ({ alerts, kinds }: RecordAlertsProps) => {
  const shown = kinds ? alerts.filter((alert) => kinds.includes(alert.kind)) : alerts;
  if (shown.length === 0) return null;
  return (
    <div className="space-y-2">
      {shown.map((alert) => (
        <Notice key={alert.kind} tone={TONE[alert.kind]} title={alert.title}>
          <span>{alert.message}</span>
          {alert.related.length > 0 ? (
            <span className="mt-1 block text-xs">
              Hồ sơ liên quan:{' '}
              {alert.related.map((row, index) => (
                <Fragment key={row.id}>
                  {index > 0 ? ', ' : null}
                  <Link to={`/records/${row.id}`} className="font-medium underline underline-offset-2">
                    {row.code}
                  </Link>
                </Fragment>
              ))}
            </span>
          ) : null}
        </Notice>
      ))}
    </div>
  );
};
