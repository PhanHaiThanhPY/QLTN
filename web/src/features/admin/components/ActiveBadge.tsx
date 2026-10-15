import { Badge } from '@/components/ui/badge';

/** Active / inactive account marker. */
export const ActiveBadge = ({ active }: { active: boolean }) =>
  active ? <Badge tone="good">Đang hoạt động</Badge> : <Badge tone="crit">Ngừng hoạt động</Badge>;
