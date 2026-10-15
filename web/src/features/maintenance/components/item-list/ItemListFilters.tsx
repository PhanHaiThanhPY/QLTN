import { Search } from 'lucide-react';
import { Card, CardBody } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input, NativeSelect } from '@/components/ui/input';
import type { Building } from '@/domain/types';
import { ITEM_SORTS, isItemSort } from '../../utils/item-list';
import type { ItemSort } from '../../utils/item-list';

export interface ItemListFilterValues {
  q: string;
  buildingId: string;
  type: string;
  sort: ItemSort;
  includeInactive: boolean;
}

interface ItemListFiltersProps {
  values: ItemListFilterValues;
  buildings: Building[];
  types: string[];
  onChange: (patch: Partial<ItemListFilterValues>) => void;
}

/** Search + building/type/sort selects; one row on desktop, stacked on phones. */
export const ItemListFilters = ({ values, buildings, types, onChange }: ItemListFiltersProps) => (
  <Card className="shadow-none">
    <CardBody className="grid grid-cols-1 gap-2.5 p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))] lg:items-end">
      <Field label="Tìm thiết bị" htmlFor="i-q">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
          <Input
            id="i-q"
            value={values.q}
            className="pl-9"
            placeholder="Mã, tên, loại, model, nhà cung cấp, vị trí…"
            onChange={(event) => onChange({ q: event.target.value })}
          />
        </div>
      </Field>
      <Field label="Tòa nhà" htmlFor="i-building">
        <NativeSelect id="i-building" value={values.buildingId} onChange={(event) => onChange({ buildingId: event.target.value })}>
          <option value="">Tất cả tòa nhà</option>
          {buildings.map((building) => (
            <option key={building.id} value={building.id}>{building.name}</option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Loại thiết bị" htmlFor="i-type">
        <NativeSelect id="i-type" value={values.type} onChange={(event) => onChange({ type: event.target.value })}>
          <option value="">Tất cả loại</option>
          {types.map((type) => (
            <option key={type} value={type}>{type}</option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Sắp xếp" htmlFor="i-sort">
        <NativeSelect
          id="i-sort"
          value={values.sort}
          onChange={(event) => {
            const next = event.target.value;
            if (isItemSort(next)) onChange({ sort: next });
          }}
        >
          {ITEM_SORTS.map((entry) => (
            <option key={entry.value} value={entry.value}>{entry.label}</option>
          ))}
        </NativeSelect>
      </Field>
      <label className="flex items-center gap-2 text-[0.8125rem] text-ink-2 sm:col-span-2 lg:col-span-4">
        <input
          type="checkbox"
          className="size-4 accent-accent"
          checked={values.includeInactive}
          onChange={(event) => onChange({ includeInactive: event.target.checked })}
        />
        Hiện cả thiết bị đã vô hiệu hóa
      </label>
    </CardBody>
  </Card>
);
