import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input, Textarea } from '@/components/ui/input';
import type { Building, Department } from '@/domain/types';
import { useCommand } from '@/hooks/useCommand';

interface DepartmentDialogProps {
  department?: Department;
  buildings: Building[];
  onClose: () => void;
}

/** Creates or edits the organization unit used by workflow assignment rules. */
export const DepartmentDialog = ({ department, buildings, onClose }: DepartmentDialogProps) => {
  const [code, setCode] = useState(department?.code ?? '');
  const [name, setName] = useState(department?.name ?? '');
  const [description, setDescription] = useState(department?.description ?? '');
  const [buildingIds, setBuildingIds] = useState<string[]>(department?.buildingIds ?? []);
  const command = useCommand({ successMessage: department ? 'Đã lưu bộ phận.' : 'Đã tạo bộ phận.', onSuccess: onClose });
  const errors = command.fieldErrors;
  const toggleBuilding = (id: string) => setBuildingIds((prev) => (prev.includes(id) ? prev.filter((row) => row !== id) : [...prev, id]));
  const submit = () =>
    void command.execute({
      subjectType: 'ACCOUNT',
      subjectId: department?.id,
      action: department ? 'updateDepartment' : 'createDepartment',
      payload: { code, name, description, buildingIds },
    });

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={department ? `Sửa bộ phận ${department.code}` : 'Thêm bộ phận'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Hủy</Button>
          <Button isLoading={command.isPending} onClick={submit}>{department ? 'Lưu' : 'Tạo bộ phận'}</Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Mã bộ phận" htmlFor="dep-code" required error={errors.code}>
          <Input id="dep-code" maxLength={20} placeholder="VD: KT" value={code} disabled={Boolean(department)} onChange={(event) => setCode(event.target.value.toUpperCase())} />
        </Field>
        <Field label="Tên bộ phận" htmlFor="dep-name" required error={errors.name}>
          <Input id="dep-name" maxLength={80} placeholder="VD: Kỹ thuật" value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field label="Mô tả" htmlFor="dep-description" error={errors.description} className="sm:col-span-2">
          <Textarea id="dep-description" maxLength={200} placeholder="Mô tả trách nhiệm của bộ phận" value={description} onChange={(event) => setDescription(event.target.value)} />
        </Field>
        <Field label="Phạm vi tòa nhà" required error={errors.buildingIds} className="sm:col-span-2">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {buildings.map((building) => (
              <label key={building.id} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm text-ink">
                <input type="checkbox" className="size-4 accent-[var(--accent)]" checked={buildingIds.includes(building.id)} onChange={() => toggleBuilding(building.id)} />
                {building.name}
              </label>
            ))}
          </div>
        </Field>
      </div>
    </Dialog>
  );
};
