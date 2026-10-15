import { Field } from '@/components/ui/field';
import { NativeSelect } from '@/components/ui/input';
import type { Building } from '@/domain/types';

interface BuildingPickerProps {
  buildings: Building[];
  value: string;
  onChange: (buildingId: string) => void;
  className?: string;
}

/** Building selector shared by the building settings and location screens (kept in ?b=). */
export const BuildingPicker = ({ buildings, value, onChange, className }: BuildingPickerProps) => (
  <Field label="Tòa nhà" htmlFor="bld-select" className={className}>
    <NativeSelect id="bld-select" value={value} onChange={(event) => onChange(event.target.value)}>
      {buildings.map((row) => (
        <option key={row.id} value={row.id}>
          {row.name}
        </option>
      ))}
    </NativeSelect>
  </Field>
);
