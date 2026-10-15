import { Badge } from '@/components/ui/badge';
import type { BadgeTone } from '@/components/ui/badge';
import { ITEM_CONDITION_LABEL } from '@/domain/constants';
import type { ItemCondition } from '@/domain/constants';

const CONDITION_TONE: Record<ItemCondition, BadgeTone> = { UNKNOWN: 'neutral', GOOD: 'good', NEEDS_ATTENTION: 'warn' };

export const ConditionBadge = ({ condition }: { condition: ItemCondition }) => (
  <Badge tone={CONDITION_TONE[condition]}>{ITEM_CONDITION_LABEL[condition]}</Badge>
);
