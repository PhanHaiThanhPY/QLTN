import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import type { Location } from '@/domain/types';
import { useCommand } from '@/hooks/useCommand';

interface LocationDialogProps {
  buildingId: string;
  location?: Location;
  onClose: () => void;
}

/** Add or edit a location (floor, optional zone, name) of a building. */
export const LocationDialog = ({ buildingId, location, onClose }: LocationDialogProps) => {
  const [floor, setFloor] = useState(location?.floor ?? '');
  const [zone, setZone] = useState(location?.zone ?? '');
  const [name, setName] = useState(location?.name ?? '');
  const command = useCommand({ successMessage: location ? 'Đã lưu vị trí.' : 'Đã thêm vị trí.' });
  const errors = command.fieldErrors;
  const submit = async () => {
    const result = await command.execute({
      subjectType: 'BUILDING',
      subjectId: buildingId,
      action: location ? 'updateLocation' : 'createLocation',
      payload: { locationId: location?.id, floor, zone, name },
    });
    if (result) onClose();
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={location ? 'Sửa vị trí' : 'Thêm vị trí'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button isLoading={command.isPending} onClick={() => void submit()}>
            {location ? 'Lưu' : 'Thêm vị trí'}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Tầng" htmlFor="loc-floor" required error={errors.floor} hint="VD: B1, Trệt, 12, Mái">
          <Input id="loc-floor" maxLength={20} placeholder="VD: Tầng 5, B1, Mái" value={floor} onChange={(event) => setFloor(event.target.value)} />
        </Field>
        <Field label="Khu vực" htmlFor="loc-zone" error={errors.zone} hint="Tùy chọn, VD: Khu A, Block B">
          <Input id="loc-zone" maxLength={60} placeholder="VD: Khu A, Block B" value={zone} onChange={(event) => setZone(event.target.value)} />
        </Field>
        <Field label="Tên vị trí" htmlFor="loc-name" required error={errors.name} className="sm:col-span-2">
          <Input id="loc-name" maxLength={120} placeholder="VD: Hành lang phía Đông" value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
      </div>
    </Dialog>
  );
};
