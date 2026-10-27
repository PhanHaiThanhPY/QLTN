import { useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { useCommand } from '@/hooks/useCommand';
import { useReferenceData } from '@/hooks/useReferenceData';
import type { OccurrenceDetail } from '@/services/maintenance-occurrences-api';

interface RepairFromItemDialogProps {
  detail: OccurrenceDetail;
  itemId: string;
  onClose: () => void;
}

const PRIORITIES = [
  ['LOW', 'Thấp'],
  ['NORMAL', 'Bình thường'],
  ['HIGH', 'Cao'],
  ['URGENT', 'Khẩn cấp'],
] as const;
type Priority = (typeof PRIORITIES)[number][0];
const isPriority = (value: string): value is Priority => PRIORITIES.some(([key]) => key === value);

/**
 * "Tạo hồ sơ sửa chữa từ mục này" (BR-MT3-08, ui-brief §2.3): filled from the item; the record opens once made, its
 * page links back to the occurrence.
 */
export const RepairFromItemDialog = ({ detail, itemId, onClose }: RepairFromItemDialogProps) => {
  const navigate = useNavigate();
  const { data } = useReferenceData();
  const command = useCommand();
  const { occurrence, item } = detail;
  const rule = occurrence.checklist.find((row) => row.id === itemId);
  const entry = occurrence.work.entries.find((row) => row.itemId === itemId);
  const [title, setTitle] = useState(`${item.code}: ${rule?.label ?? ''}`.slice(0, 120));
  const [description, setDescription] = useState(entry?.note ?? '');
  const [locationId, setLocationId] = useState(item.locationId);
  const [priority, setPriority] = useState<Priority>('NORMAL');
  const locations = (data?.locations ?? []).filter((location) => location.buildingId === occurrence.buildingId);
  const photos = entry?.attachmentIds.filter((id) => detail.files[id]?.mimeType.startsWith('image/')).length ?? 0;
  const submit = async () => {
    const result = await command.execute({
      subjectType: 'MAINTENANCE_OCCURRENCE',
      subjectId: occurrence.id,
      expectedVersion: occurrence.version,
      action: 'createRepairFromMaintenanceItem',
      payload: { itemId, title: title.trim(), description: description.trim(), locationId, priority },
    });
    if (!result?.subjectId) return;
    toast.success(`Đã tạo hồ sơ ${String(result.data?.code ?? '')} (Nháp).`);
    onClose();
    navigate(`/records/${result.subjectId}`);
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => (open ? undefined : onClose())}
      title={`Tạo hồ sơ sửa chữa · ${rule?.label ?? ''}`}
      description={`Hồ sơ Nháp, gắn thiết bị ${item.code}; ${photos} ảnh của mục thành ảnh hiện trường.`}
      size="lg"
      footer={
        <>
          <Button variant="secondary" className="min-h-11" onClick={onClose}>
            Hủy
          </Button>
          <Button className="min-h-11" isLoading={command.isPending} disabled={!title.trim()} onClick={() => void submit()}>
            Tạo hồ sơ
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Tên hồ sơ" htmlFor="rfi-title" required error={command.fieldErrors.title ?? command.fieldErrors.itemId}>
            <Input id="rfi-title" maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Mô tả" htmlFor="rfi-description" error={command.fieldErrors.description}>
            <Textarea id="rfi-description" rows={3} maxLength={2000} value={description} onChange={(event) => setDescription(event.target.value)} />
          </Field>
        </div>
        <Field label="Vị trí" htmlFor="rfi-location" error={command.fieldErrors.locationId}>
          <NativeSelect id="rfi-location" value={locationId} onChange={(event) => setLocationId(event.target.value)}>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Mức ưu tiên" htmlFor="rfi-priority">
          <NativeSelect id="rfi-priority" value={priority} onChange={(event) => (isPriority(event.target.value) ? setPriority(event.target.value) : undefined)}>
            {PRIORITIES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
    </Dialog>
  );
};
