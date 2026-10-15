import { Badge } from '@/components/ui/badge';
import type { BadgeTone } from '@/components/ui/badge';
import { CHECK_RESULT_LABEL } from '@/domain/constants';
import type { CheckResult } from '@/domain/constants';

const RESULT_TONE: Record<CheckResult, BadgeTone> = { OK: 'good', ISSUE: 'crit', NOT_APPLICABLE: 'neutral', NOT_CHECKED: 'outline' };

/** Optional items left NOT_CHECKED read “Không kiểm tra” (spec 6.6). */
export const CheckResultBadge = ({ result, required }: { result: CheckResult; required: boolean }) => (
  <Badge tone={RESULT_TONE[result]}>{result === 'NOT_CHECKED' && !required ? 'Không kiểm tra' : CHECK_RESULT_LABEL[result]}</Badge>
);
