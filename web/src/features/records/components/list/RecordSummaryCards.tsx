import { AlertTriangle, CheckCircle2, ListTodo } from 'lucide-react';
import { StatCard, StatCardRow } from '@/components/ui/stat-card';
import type { RecordSummary } from '@/services/records-service';
import { formatDateTime } from '@/utils/date';

/** One card kind → the list URL that holds exactly that count (`meta.total` must match the number). */
const cardLink = (kind: 'open' | 'needsUpdate' | 'completed', buildingId?: string): string => {
  const params = new URLSearchParams();
  if (kind === 'open') params.set('open', '1');
  else if (kind === 'needsUpdate') params.set('attention', 'needs_update');
  else params.set('status', 'COMPLETED');
  if (buildingId) params.set('buildingId', buildingId);
  return `/records?${params.toString()}`;
};

interface RecordSummaryCardsProps {
  summary: RecordSummary;
  /** Current building filter, so a card opens the same building scope it counted. */
  buildingId?: string;
}

/**
 * Server-side counters on top of the repair record list (api mode).
 * Every card links to its filtered list; the denominator is the scope total and the last line says what is
 * not counted yet (no due date or assignment checks on the backend).
 */
export const RecordSummaryCards = ({ summary, buildingId }: RecordSummaryCardsProps) => (
  <div className="mb-4">
    <StatCardRow className="mb-2 xl:grid-cols-3">
      <StatCard
        compact
        icon={ListTodo}
        value={summary.open}
        label="hồ sơ đang mở"
        tone="info"
        hint={`trên ${summary.total} hồ sơ`}
        to={cardLink('open', buildingId)}
      />
      <StatCard
        compact
        icon={AlertTriangle}
        value={summary.needsUpdate}
        label="hồ sơ cần bổ sung"
        tone={summary.needsUpdate > 0 ? 'warn' : 'neutral'}
        hint={`trên ${summary.total} hồ sơ`}
        to={cardLink('needsUpdate', buildingId)}
      />
      <StatCard
        compact
        icon={CheckCircle2}
        value={summary.completed}
        label="hồ sơ hoàn tất"
        tone="good"
        hint={`trên ${summary.total} hồ sơ`}
        to={cardLink('completed', buildingId)}
      />
    </StatCardRow>
    <p className="text-xs text-ink-3">
      Nguồn số liệu: đếm hồ sơ trong phạm vi tòa nhà của bạn, tính đến {formatDateTime(summary.asOf)}. Chưa tính hồ sơ
      quá hạn và thiếu phân công.
    </p>
  </div>
);
