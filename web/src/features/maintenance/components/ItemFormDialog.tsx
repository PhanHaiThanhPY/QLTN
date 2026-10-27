import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Notice } from '@/components/common/Notice';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { LIMITS } from '@/domain/constants';
import { ERROR_CODE } from '@/domain/errors';
import type { MaintenanceItem, User } from '@/domain/types';
import { useCommand } from '@/hooks/useCommand';
import { useReferenceData } from '@/hooks/useReferenceData';
import { activeUsersInRole, userOptionLabel } from '../utils/maintenance-ui';

interface ItemFormDialogProps {
  item?: MaintenanceItem;
  viewer: User;
  onClose: () => void;
}

interface ItemDraft {
  buildingId: string;
  code: string;
  name: string;
  type: string;
  locationId: string;
  ownerUserId: string;
  description: string;
  model: string;
  supplier: string;
  installDate: string;
  warrantyUntil: string;
}

const initialDraft = (item: MaintenanceItem | undefined, viewer: User): ItemDraft => ({
  buildingId: item?.buildingId ?? (viewer.buildingIds.length === 1 ? viewer.buildingIds[0] : ''),
  code: item?.code ?? '',
  name: item?.name ?? '',
  type: item?.type ?? '',
  locationId: item?.locationId ?? '',
  ownerUserId: item?.ownerUserId ?? (viewer.role === 'BQL' ? viewer.id : ''),
  description: item?.description ?? '',
  model: item?.model ?? '',
  supplier: item?.supplier ?? '',
  installDate: item?.installDate ?? '',
  warrantyUntil: item?.warrantyUntil ?? '',
});

/** Create/edit a maintenance item; mounted only while open so each opening starts fresh. */
export const ItemFormDialog = ({ item, viewer, onClose }: ItemFormDialogProps) => {
  const { data } = useReferenceData();
  const [draft, setDraft] = useState<ItemDraft>(() => initialDraft(item, viewer));
  const command = useCommand({ successMessage: item ? 'Đã lưu thiết bị.' : 'Đã tạo thiết bị.' });
  const queryClient = useQueryClient();
  const errors = command.fieldErrors;
  const set = (key: keyof ItemDraft, value: string) => setDraft((prev) => ({ ...prev, [key]: value }));
  const locations = (data?.locations ?? []).filter(
    (row) => row.buildingId === draft.buildingId && (row.active !== false || row.id === item?.locationId),
  );
  const owners = activeUsersInRole(data?.users, 'BQL', draft.buildingId);
  const buildings = (data?.buildings ?? []).filter((row) => viewer.buildingIds.includes(row.id));
  const types = useMemo(
    () => [...new Set((data?.items ?? []).filter((row) => row.buildingId === draft.buildingId).map((row) => row.type))].sort((a, b) => a.localeCompare(b, 'vi')),
    [data?.items, draft.buildingId],
  );
  const isConflict = command.errorCode === ERROR_CODE.CONFLICT;
  const reload = () => {
    void queryClient.invalidateQueries();
    onClose();
  };

  const handleSubmit = async () => {
    const fields = {
      name: draft.name,
      type: draft.type,
      locationId: draft.locationId,
      ownerUserId: draft.ownerUserId,
      description: draft.description,
      model: draft.model,
      supplier: draft.supplier,
      installDate: draft.installDate,
      warrantyUntil: draft.warrantyUntil,
    };
    const result = item
      ? await command.execute({
          subjectType: 'MAINTENANCE_ITEM',
          subjectId: item.id,
          expectedVersion: item.version,
          action: 'updateMaintenanceItem',
          payload: fields,
        })
      : await command.execute({
          subjectType: 'MAINTENANCE_ITEM',
          action: 'createMaintenanceItem',
          payload: { ...fields, buildingId: draft.buildingId, code: draft.code },
        });
    if (result) onClose();
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      size="lg"
      title={item ? `Sửa thiết bị ${item.code}` : 'Thêm thiết bị'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button isLoading={command.isPending} onClick={() => void handleSubmit()}>
            {item ? 'Lưu' : 'Thêm thiết bị'}
          </Button>
        </>
      }
    >
      {isConflict ? (
        <Notice tone="warning" className="mb-4" title="Thiết bị vừa được người khác cập nhật. Tải lại để xem bản mới.">
          <Button size="sm" variant="secondary" className="mt-2" onClick={reload}>Tải lại</Button>
        </Notice>
      ) : null}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Mã thiết bị" htmlFor="it-code" required error={errors.code} hint={item ? 'Mã không đổi sau khi tạo.' : 'Duy nhất trong tòa nhà.'}>
          <Input id="it-code" maxLength={30} placeholder="VD: TM-A01" value={draft.code} disabled={Boolean(item)} onChange={(event) => set('code', event.target.value.toUpperCase())} />
        </Field>
        <Field label="Tên thiết bị" htmlFor="it-name" required error={errors.name}>
          <Input id="it-name" maxLength={120} placeholder="VD: Thang máy số 1" value={draft.name} onChange={(event) => set('name', event.target.value)} />
        </Field>
        <Field label="Loại" htmlFor="it-type" required error={errors.type} hint="Chọn loại đã có trong tòa hoặc gõ loại mới.">
          <Input id="it-type" list="it-type-options" maxLength={60} placeholder="VD: Thang máy, PCCC" value={draft.type} onChange={(event) => set('type', event.target.value)} />
          <datalist id="it-type-options">
            {types.map((type) => (
              <option key={type} value={type} />
            ))}
          </datalist>
        </Field>
        <Field label="Tòa nhà" htmlFor="it-building" required error={errors.buildingId} hint={item ? 'Tòa không đổi sau khi tạo.' : undefined}>
          <NativeSelect
            id="it-building"
            value={draft.buildingId}
            disabled={Boolean(item)}
            onChange={(event) => setDraft((prev) => ({ ...prev, buildingId: event.target.value, locationId: '', ownerUserId: '' }))}
          >
            <option value="">— Chọn tòa nhà —</option>
            {buildings.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Vị trí" htmlFor="it-location" required error={errors.locationId}>
          <NativeSelect id="it-location" value={draft.locationId} disabled={!draft.buildingId} onChange={(event) => set('locationId', event.target.value)}>
            <option value="">— Chọn vị trí —</option>
            {locations.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name} · Tầng {row.floor}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Người phụ trách (BQL)" htmlFor="it-owner" required error={errors.ownerUserId}>
          <NativeSelect id="it-owner" value={draft.ownerUserId} disabled={!draft.buildingId} onChange={(event) => set('ownerUserId', event.target.value)}>
            <option value="">— Chọn người phụ trách —</option>
            {owners.map((user) => (
              <option key={user.id} value={user.id}>
                {userOptionLabel(user)}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Model" htmlFor="it-model" error={errors.model}>
          <Input id="it-model" maxLength={LIMITS.MODEL_MAX} placeholder="VD: Mitsubishi NexWay" value={draft.model} onChange={(event) => set('model', event.target.value)} />
        </Field>
        <Field label="Nhà cung cấp / bảo hành" htmlFor="it-supplier" error={errors.supplier}>
          <Input id="it-supplier" maxLength={LIMITS.SUPPLIER_MAX} placeholder="Tên nhà cung cấp hoặc đơn vị bảo hành" value={draft.supplier} onChange={(event) => set('supplier', event.target.value)} />
        </Field>
        <Field label="Ngày lắp / thay" htmlFor="it-install" error={errors.installDate}>
          <Input id="it-install" type="date" value={draft.installDate} onChange={(event) => set('installDate', event.target.value)} />
        </Field>
        <Field label="Hạn bảo hành" htmlFor="it-warranty" error={errors.warrantyUntil} hint="Hồ sơ sửa chữa của thiết bị còn bảo hành sẽ được cảnh báo.">
          <Input id="it-warranty" type="date" value={draft.warrantyUntil} onChange={(event) => set('warrantyUntil', event.target.value)} />
        </Field>
        <Field label="Thông tin kỹ thuật" htmlFor="it-description" className="sm:col-span-2" error={errors.description}>
          <Textarea id="it-description" rows={3} maxLength={2000} placeholder="Công suất, thông số, ghi chú kỹ thuật..." value={draft.description} onChange={(event) => set('description', event.target.value)} />
        </Field>
      </div>
    </Dialog>
  );
};
