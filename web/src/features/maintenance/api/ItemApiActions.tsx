import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ReasonDialog } from '@/components/common/ReasonDialog';
import type { MaintenanceItem, User } from '@/domain/types';
import { useCommand } from '@/hooks/useCommand';
import { useOnline } from '@/hooks/useOnline';
import { ItemConditionDialog } from '../components/ItemConditionDialog';
import { ItemFormDialog } from '../components/ItemFormDialog';
import { capabilityState } from '../utils/maintenance-ui';

type ApiItemDialog = 'edit' | 'condition' | 'deactivate' | 'reactivate' | null;

interface ItemApiActionsProps {
  item: MaintenanceItem;
  viewer: User;
}

/**
 * Item actions of api mode (MT-S1 ui-brief §2.2): Sửa, Đổi tình trạng, Ngừng dùng; "Dùng lại" in place of the edits
 * once stopped (D-MT-5). An account without the capability gets no button at all (AC-MT.5); offline locks writes.
 */
export const ItemApiActions = ({ item, viewer }: ItemApiActionsProps) => {
  const [dialog, setDialog] = useState<ApiItemDialog>(null);
  const online = useOnline();
  const stateChange = useCommand({
    successMessage: dialog === 'reactivate' ? 'Đã dùng lại thiết bị.' : 'Đã ngừng dùng thiết bị. Lịch sử cũ vẫn giữ nguyên.',
  });
  const canManage = capabilityState(viewer, 'MAINTENANCE_MANAGE', item.buildingId).allowed;
  const canCondition = capabilityState(viewer, 'ITEM_CONDITION', item.buildingId).allowed;

  const changeState = async (action: 'deactivateMaintenanceItem' | 'reactivateMaintenanceItem', reason: string) => {
    const result = await stateChange.execute({
      subjectType: 'MAINTENANCE_ITEM',
      subjectId: item.id,
      expectedVersion: item.version,
      action,
      payload: { reason },
    });
    if (result) setDialog(null);
  };

  return (
    <>
      {item.active && canManage ? (
        <Button size="sm" variant="secondary" disabled={!online} onClick={() => setDialog('edit')}>
          Sửa
        </Button>
      ) : null}
      {item.active && canCondition ? (
        <Button size="sm" variant="secondary" disabled={!online} onClick={() => setDialog('condition')}>
          Đổi tình trạng
        </Button>
      ) : null}
      {canManage ? (
        <Button size="sm" variant="ghost" disabled={!online} onClick={() => setDialog(item.active ? 'deactivate' : 'reactivate')}>
          {item.active ? 'Ngừng dùng' : 'Dùng lại'}
        </Button>
      ) : null}
      {dialog === 'edit' ? <ItemFormDialog item={item} viewer={viewer} onClose={() => setDialog(null)} /> : null}
      {dialog === 'condition' ? <ItemConditionDialog item={item} onClose={() => setDialog(null)} /> : null}
      <ReasonDialog
        open={dialog === 'deactivate'}
        onOpenChange={(open) => setDialog(open ? 'deactivate' : null)}
        title={`Ngừng dùng ${item.code}`}
        description="Thiết bị đã ngừng không chọn được cho hồ sơ sửa chữa mới. Hồ sơ cũ và lịch sử vẫn giữ nguyên."
        confirmLabel="Ngừng dùng"
        confirmVariant="danger"
        isPending={stateChange.isPending}
        error={stateChange.fieldErrors.reason}
        onConfirm={(reason) => void changeState('deactivateMaintenanceItem', reason)}
      />
      <ReasonDialog
        open={dialog === 'reactivate'}
        onOpenChange={(open) => setDialog(open ? 'reactivate' : null)}
        title={`Dùng lại ${item.code}`}
        description="Thiết bị sẽ chọn được trở lại cho hồ sơ sửa chữa mới."
        confirmLabel="Dùng lại"
        isPending={stateChange.isPending}
        error={stateChange.fieldErrors.reason}
        onConfirm={(reason) => void changeState('reactivateMaintenanceItem', reason)}
      />
    </>
  );
};
