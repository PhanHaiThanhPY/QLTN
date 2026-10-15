import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { NativeSelect, Textarea } from '@/components/ui/input';
import { ITEM_CONDITION_LABEL, LIMITS } from '@/domain/constants';
import type { ItemCondition } from '@/domain/constants';
import type { MaintenanceItem } from '@/domain/types';
import { useCommand } from '@/hooks/useCommand';

const CONDITION_OPTIONS = Object.entries(ITEM_CONDITION_LABEL) as [ItemCondition, string][];

/** updateItemCondition: condition + mandatory note (spec 6.4). Mounted only while open. */
export const ItemConditionDialog = ({ item, onClose }: { item: MaintenanceItem; onClose: () => void }) => {
  const [condition, setCondition] = useState<ItemCondition>(item.condition);
  const [note, setNote] = useState('');
  const command = useCommand({ successMessage: 'Đã cập nhật tình trạng thiết bị.' });
  const trimmed = note.trim();
  const noteError = trimmed.length > 0 && trimmed.length < LIMITS.REASON_MIN ? `Ghi chú cần tối thiểu ${LIMITS.REASON_MIN} ký tự.` : undefined;

  const handleSubmit = async () => {
    const result = await command.execute({
      subjectType: 'MAINTENANCE_ITEM',
      subjectId: item.id,
      expectedVersion: item.version,
      action: 'updateItemCondition',
      payload: { condition, note: trimmed },
    });
    if (result) onClose();
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={`Tình trạng ${item.code}`}
      description="Tình trạng không tự chuyển “Tốt” khi hồ sơ sửa chữa hoàn tất; cần cập nhật kèm ghi chú."
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button isLoading={command.isPending} disabled={trimmed.length < LIMITS.REASON_MIN} onClick={() => void handleSubmit()}>
            Cập nhật
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Tình trạng" htmlFor="ic-condition" required error={command.fieldErrors.condition}>
          <NativeSelect id="ic-condition" value={condition} onChange={(event) => setCondition(event.target.value as ItemCondition)}>
            {CONDITION_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Ghi chú" htmlFor="ic-note" required error={noteError ?? command.fieldErrors.note}>
          <Textarea id="ic-note" rows={3} maxLength={LIMITS.REASON_MAX} placeholder="Mô tả tình trạng hiện tại của thiết bị..." value={note} onChange={(event) => setNote(event.target.value)} />
        </Field>
      </div>
    </Dialog>
  );
};
