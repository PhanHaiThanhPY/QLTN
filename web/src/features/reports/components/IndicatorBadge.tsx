import { Badge } from '@/components/ui/badge';
import type { BadgeTone } from '@/components/ui/badge';
import type { OccurrenceIndicator } from '@/services/maintenance-service';
import { INDICATOR_LABEL } from '../report-csv';

const INDICATOR_TONE: Record<Exclude<OccurrenceIndicator, null>, BadgeTone> = {
  OVERDUE: 'crit',
  UPCOMING: 'accent',
  LATE_COMPLETION: 'warn',
};

/** Overdue / upcoming / late-completion marker (an indicator, not a status). */
export const IndicatorBadge = ({ indicator }: { indicator: OccurrenceIndicator }) => {
  if (!indicator) return <span className="text-ink-2">—</span>;
  return <Badge tone={INDICATOR_TONE[indicator]}>{INDICATOR_LABEL[indicator]}</Badge>;
};
