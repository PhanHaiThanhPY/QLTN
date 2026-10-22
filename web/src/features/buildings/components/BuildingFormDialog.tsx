import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input, NativeSelect } from '@/components/ui/input';
import { CONFIG_TEMPLATES } from '@/domain/building-config';
import type { Building } from '@/domain/types';
import { useCommand } from '@/hooks/useCommand';

interface BuildingFormDialogProps {
  building?: Building;
  onClose: (createdId?: string) => void;
}

/** Administrator adds a building (starting from a configuration template) or renames one. */
export const BuildingFormDialog = ({ building, onClose }: BuildingFormDialogProps) => {
  const [code, setCode] = useState(building?.code ?? '');
  const [name, setName] = useState(building?.name ?? '');
  const [address, setAddress] = useState(building?.address ?? '');
  const [templateKey, setTemplateKey] = useState(CONFIG_TEMPLATES[0].key);
  const command = useCommand({ successMessage: building ? 'Đã lưu thông tin tòa nhà.' : 'Đã thêm tòa nhà.' });
  const errors = command.fieldErrors;
  const submit = async () => {
    const result = building
      ? await command.execute({ subjectType: 'BUILDING', subjectId: building.id, expectedVersion: building.version, action: 'updateBuilding', payload: { name, address } })
      : await command.execute({ subjectType: 'BUILDING', action: 'createBuilding', payload: { code, name, address, templateKey } });
    if (result) onClose(building ? undefined : result.subjectId);
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={building ? `Sửa ${building.name}` : 'Thêm tòa nhà'}
      footer={
        <>
          <Button variant="secondary" onClick={() => onClose()}>
            Hủy
          </Button>
          <Button isLoading={command.isPending} onClick={() => void submit()}>
            {building ? 'Lưu' : 'Thêm tòa nhà'}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Mã tòa" htmlFor="bld-code" required error={errors.code} hint={building ? 'Không đổi sau khi tạo.' : 'VD: E'}>
          <Input id="bld-code" maxLength={10} placeholder="VD: Tòa A" value={code} disabled={Boolean(building)} onChange={(event) => setCode(event.target.value.toUpperCase())} />
        </Field>
        <Field label="Tên tòa nhà" htmlFor="bld-name" required error={errors.name} className="sm:col-span-2">
          <Input id="bld-name" maxLength={120} placeholder="VD: An Khang Residence" value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field label="Địa chỉ" htmlFor="bld-address" required error={errors.address} className="sm:col-span-3">
          <Input id="bld-address" maxLength={200} placeholder="VD: 123 Nguyễn Trãi, Quận 1" value={address} onChange={(event) => setAddress(event.target.value)} />
        </Field>
        {building ? null : (
          <Field label="Cấu hình ban đầu" htmlFor="bld-template" className="sm:col-span-3" hint="Sửa lại được sau khi tạo. Nhớ gán người phụ trách ở Quản trị › Tài khoản.">
            <NativeSelect id="bld-template" value={templateKey} onChange={(event) => setTemplateKey(event.target.value)}>
              {CONFIG_TEMPLATES.map((row) => (
                <option key={row.key} value={row.key}>
                  {row.name} – {row.description}
                </option>
              ))}
            </NativeSelect>
          </Field>
        )}
      </div>
    </Dialog>
  );
};
