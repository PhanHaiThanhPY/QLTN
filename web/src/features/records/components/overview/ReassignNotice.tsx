import { Notice } from '@/components/common/Notice';
import { ASSIGNEE_SLOT_LABEL } from '@/domain/permissions';
import { useReferenceData } from '@/hooks/useReferenceData';
import { useRecordContext } from '../../record-context';
import { ReassignButton } from '../detail/ReassignButton';
import { isReassignSlot, slotAssignee } from '../detail/reassign-utils';

/** “Cần phân công lại” when an assignee of the record is inactive (spec 7). */
export const ReassignNotice = () => {
  const { detail } = useRecordContext();
  const { userName } = useReferenceData();
  const { record, inactiveSlots } = detail;
  if (inactiveSlots.length === 0) return null;
  const managerInactive = inactiveSlots.includes('manager');
  const others = inactiveSlots.filter(isReassignSlot);
  return (
    <Notice tone="danger" title="Cần phân công lại">
      <ul className="mt-1 list-disc space-y-0.5 pl-5">
        {managerInactive ? <li>BQL quản lý {userName(record.managerUserId)} đã ngừng hoạt động – ADMIN cần thay BQL quản lý ở trang Quản trị demo.</li> : null}
        {others.map((slot) => (
          <li key={slot}>
            {ASSIGNEE_SLOT_LABEL[slot]} {userName(slotAssignee(record, slot))} đã ngừng hoạt động – các quyết định của bước này bị chặn.
          </li>
        ))}
      </ul>
      {others.length > 0 ? (
        <div className="mt-2">
          <ReassignButton size="sm" />
        </div>
      ) : null}
    </Notice>
  );
};
