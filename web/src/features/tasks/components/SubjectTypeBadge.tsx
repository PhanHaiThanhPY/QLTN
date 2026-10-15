import { Badge } from '@/components/ui/badge';
import type { SubjectType } from '@/domain/constants';
import { subjectKindLabel } from '../task-labels';

/** "Sửa chữa" / "Bảo trì" label required on every mixed list (spec 11.1). */
export const SubjectTypeBadge = ({ subjectType }: { subjectType: SubjectType }) => (
  <Badge tone={subjectType === 'REPAIR_RECORD' ? 'accent' : 'neutral'}>{subjectKindLabel(subjectType)}</Badge>
);
