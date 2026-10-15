import { Badge } from '@/components/ui/badge';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import type { AssigneeSlot } from '@/domain/permissions';
import { useReferenceData } from '@/hooks/useReferenceData';
import { useRecordContext } from '../../record-context';
import { SLOT_TITLE, slotAssignee } from '../detail/reassign-utils';

const SLOTS: AssigneeSlot[] = ['manager', 'confirmer', 'consultant', 'board'];

/** Manager, technical confirmer and the two approvers with inactive markers. */
export const AssigneesCard = () => {
  const { detail, viewer } = useRecordContext();
  const { userName } = useReferenceData();
  const { record, inactiveSlots } = detail;
  const idOf = (slot: AssigneeSlot) => slotAssignee(record, slot);
  return (
    <Card>
      <CardHeader title="Người xử lý" />
      <CardBody>
        <ul className="space-y-3">
          {SLOTS.map((slot) => (
            <li key={slot} className="flex flex-col gap-0.5">
              <span className="text-xs font-medium text-ink-3">{SLOT_TITLE[slot]}</span>
              <span className="flex flex-wrap items-center gap-2 text-sm text-ink">
                {userName(idOf(slot))}
                {idOf(slot) === viewer.id ? <Badge tone="accent">Bạn</Badge> : null}
                {inactiveSlots.includes(slot) ? <Badge tone="crit">Ngừng hoạt động</Badge> : null}
              </span>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
};
