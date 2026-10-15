import { useState } from 'react';
import { ActionButton } from '@/components/common/ActionButton';
import { ReasonDialog } from '@/components/common/ReasonDialog';
import type { ActionState } from '@/domain/actions';
import type { MaintenanceItem, User } from '@/domain/types';
import { useCommand } from '@/hooks/useCommand';
import { capabilityState } from '../utils/maintenance-ui';
import { ItemConditionDialog } from './ItemConditionDialog';
import { ItemFormDialog } from './ItemFormDialog';

type ItemDialog = 'edit' | 'condition' | 'deactivate' | null;

interface ItemActionsProps {
  item: MaintenanceItem;
  viewer: User;
  size?: 'xs' | 'sm' | 'md';
}

const INACTIVE: ActionState = { allowed: false, reason: 'Thiết bị đã vô hiệu hóa.' };

/** Edit, update condition and deactivate actions of one item. */
export const ItemActions = ({ item, viewer, size = 'md' }: ItemActionsProps) => {
  const [dialog, setDialog] = useState<ItemDialog>(null);
  const deactivate = useCommand({ successMessage: 'Đã vô hiệu hóa thiết bị. Lịch sử cũ vẫn giữ nguyên.' });
  const manage = capabilityState(viewer, 'MAINTENANCE_MANAGE', item.buildingId);
  const editState = item.active ? manage : INACTIVE;
  const conditionState = item.active ? capabilityState(viewer, 'ITEM_CONDITION', item.buildingId) : INACTIVE;

  const handleDeactivate = async (reason: string) => {
    const result = await deactivate.execute({
      subjectType: 'MAINTENANCE_ITEM',
      subjectId: item.id,
      expectedVersion: item.version,
      action: 'deactivateMaintenanceItem',
      payload: { reason },
    });
    if (result) setDialog(null);
  };

  return (
    <>
      <ActionButton state={editState} size={size} variant="secondary" onClick={() => setDialog('edit')}>
        Sửa
      </ActionButton>
      <ActionButton state={conditionState} size={size} variant="secondary" onClick={() => setDialog('condition')}>
        Tình trạng
      </ActionButton>
      {item.active ? (
        <ActionButton state={manage} size={size} variant="ghost" onClick={() => setDialog('deactivate')}>
          Vô hiệu hóa
        </ActionButton>
      ) : null}
      {dialog === 'edit' ? <ItemFormDialog item={item} viewer={viewer} onClose={() => setDialog(null)} /> : null}
      {dialog === 'condition' ? <ItemConditionDialog item={item} onClose={() => setDialog(null)} /> : null}
      <ReasonDialog
        open={dialog === 'deactivate'}
        onOpenChange={(open) => setDialog(open ? 'deactivate' : null)}
        title={`Vô hiệu hóa ${item.code}`}
        description="Cần tạm dừng mọi kế hoạch đang hoạt động của thiết bị trước. Lượt cũ và lịch sử không bị xóa."
        confirmLabel="Vô hiệu hóa"
        confirmVariant="danger"
        isPending={deactivate.isPending}
        error={deactivate.fieldErrors.plans ?? deactivate.fieldErrors.reason}
        onConfirm={(reason) => void handleDeactivate(reason)}
      />
    </>
  );
};
