import { Badge } from '@/components/ui/badge';

/** BR-F4-11: "Đã đối soát · GD-…" once matched with the bank, else "Chưa đối soát". */
export const ReconBadge = ({ code }: { code: string | null | undefined }) =>
  code ? <Badge tone="good">Đã đối soát · {code}</Badge> : <Badge tone="neutral">Chưa đối soát</Badge>;
