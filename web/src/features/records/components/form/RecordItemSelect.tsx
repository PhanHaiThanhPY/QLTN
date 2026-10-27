import { useState } from 'react';
import { Input, NativeSelect } from '@/components/ui/input';
import type { MaintenanceItem } from '@/domain/types';
import { NO_ITEM_VALUE } from './record-form-schema';

/** Above this many items in a building the picker becomes a searchable text box (MT-S1 ui-brief §2.4). */
export const SEARCHABLE_ITEMS_FROM = 50;
const NO_ITEM_LABEL = 'Không thuộc thiết bị cụ thể';

interface RecordItemSelectProps {
  id: string;
  items: readonly MaintenanceItem[];
  value: string;
  disabled: boolean;
  invalid: boolean;
  onChange: (itemId: string) => void;
}

/** "BOM-A01 – Bơm nước sinh hoạt", with "(đã ngừng)" for an inactive item still on the record. */
export const optionLabel = (item: MaintenanceItem): string => `${item.code} – ${item.name}${item.active ? '' : ' (đã ngừng)'}`;

const initialText = (items: readonly MaintenanceItem[], value: string): string => {
  if (value === NO_ITEM_VALUE) return NO_ITEM_LABEL;
  const current = items.find((item) => item.id === value);
  return current ? optionLabel(current) : '';
};

/**
 * Item of a repair record: "Không thuộc thiết bị cụ thể" or one item of the building. A plain select up to 50 items,
 * then a text box with suggestions (`<datalist>`) that maps the typed label back to the item.
 */
export const RecordItemSelect = ({ id, items, value, disabled, invalid, onChange }: RecordItemSelectProps) => {
  const [text, setText] = useState(() => initialText(items, value));

  if (items.length <= SEARCHABLE_ITEMS_FROM) {
    return (
      <NativeSelect id={id} value={value} disabled={disabled} aria-invalid={invalid} onChange={(event) => onChange(event.target.value)}>
        <option value="">Chọn thiết bị / hạng mục</option>
        <option value={NO_ITEM_VALUE}>{NO_ITEM_LABEL}</option>
        {items.map((item) => (
          <option key={item.id} value={item.id}>
            {optionLabel(item)}
          </option>
        ))}
      </NativeSelect>
    );
  }
  const listId = `${id}-options`;
  return (
    <>
      <Input
        id={id}
        list={listId}
        value={text}
        disabled={disabled}
        aria-invalid={invalid}
        placeholder="Gõ mã hoặc tên thiết bị"
        onChange={(event) => {
          const next = event.target.value;
          setText(next);
          if (next === NO_ITEM_LABEL) onChange(NO_ITEM_VALUE);
          else onChange(items.find((item) => optionLabel(item) === next)?.id ?? '');
        }}
      />
      <datalist id={listId}>
        <option value={NO_ITEM_LABEL} />
        {items.map((item) => (
          <option key={item.id} value={optionLabel(item)} />
        ))}
      </datalist>
    </>
  );
};
