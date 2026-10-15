import { Badge } from '@/components/ui/badge';
import type { BadgeTone } from '@/components/ui/badge';
import { formatDate } from '@/utils/date';
import type { WarrantyInfo, WarrantyState } from '../../utils/item-insights';

const WARRANTY_TONE = { NONE: 'neutral', ACTIVE: 'good', EXPIRING: 'warn', EXPIRED: 'neutral' } as const satisfies Record<WarrantyState, BadgeTone>;

export const warrantyLabel = (warranty: WarrantyInfo): string => {
  if (warranty.state === 'NONE') return 'Chưa có thông tin bảo hành';
  if (warranty.state === 'EXPIRED') return `Hết bảo hành từ ${formatDate(warranty.until)}`;
  return `Bảo hành đến ${formatDate(warranty.until)}`;
};

/** Short form for list rows: the date only matters while the warranty is about to end. */
const compactLabel = (warranty: WarrantyInfo): string => {
  if (warranty.state === 'EXPIRING') return `Sắp hết BH · ${formatDate(warranty.until)}`;
  if (warranty.state === 'EXPIRED') return 'Hết bảo hành';
  return 'Còn bảo hành';
};

/** Warranty state chip (header, list rows). */
export const WarrantyBadge = ({ warranty, compact = false }: { warranty: WarrantyInfo; compact?: boolean }) => {
  if (warranty.state === 'NONE') return null;
  return <Badge tone={WARRANTY_TONE[warranty.state]}>{compact ? compactLabel(warranty) : warrantyLabel(warranty)}</Badge>;
};
