import { MoreHorizontal } from 'lucide-react';
import { ActionMenu } from '@/components/ui/action-menu';
import type { ActionMenuItem } from '@/components/ui/action-menu';
import { Button } from '@/components/ui/button';
import type { ApiOccurrence } from '@/services/maintenance-plans-api';
import { ddmm } from './plan-api-ui';

export type OccurrenceAction = 'keep' | 'reschedule' | 'cancel';

interface OccurrenceApiMenuProps {
  occurrence: ApiOccurrence;
  disabled: boolean;
  onAction: (action: OccurrenceAction, occurrence: ApiOccurrence) => void;
}

/** `⋯` of a scheduled occurrence (ui-brief §2.3): Giữ lượt này (flagged only) · Đổi lịch · Hủy. */
export const OccurrenceApiMenu = ({ occurrence, disabled, onAction }: OccurrenceApiMenuProps) => {
  const items: ActionMenuItem[] = [
    ...(occurrence.scheduleChanged ? [{ key: 'keep', label: 'Giữ lượt này', onSelect: () => onAction('keep', occurrence) }] : []),
    { key: 'reschedule', label: 'Đổi lịch', onSelect: () => onAction('reschedule', occurrence) },
    { key: 'cancel', label: 'Hủy', tone: 'danger', onSelect: () => onAction('cancel', occurrence) },
  ];
  return (
    <ActionMenu
      items={items}
      trigger={
        <Button variant="ghost" size="icon" disabled={disabled} aria-label={`Thao tác cho lượt ${occurrence.code}, ${ddmm(occurrence.scheduledDate)}`}>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      }
    />
  );
};
