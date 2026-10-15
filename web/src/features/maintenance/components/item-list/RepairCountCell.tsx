import { Badge } from '@/components/ui/badge';

/** Open repairs as a warning chip, otherwise the plain total. */
export const RepairCountCell = ({ open, total }: { open: number; total: number }) => {
  if (open > 0) return <Badge tone="warn">{open} đang mở</Badge>;
  return <span className="text-xs text-ink-3">{total > 0 ? `${total} hồ sơ` : 'Chưa có'}</span>;
};
