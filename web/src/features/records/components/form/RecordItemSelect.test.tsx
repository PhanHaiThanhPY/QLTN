// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { itemOf } from '@/features/maintenance/api/__fixtures__/api-items';
import { NO_ITEM_VALUE } from './record-form-schema';
import { optionLabel, RecordItemSelect, SEARCHABLE_ITEMS_FROM } from './RecordItemSelect';

/** MT-S1 ui-brief §2.4: "no specific equipment" or one item; an inactive item on the record is marked. */
describe('RecordItemSelect', () => {
  it('labels an item by code and name, marking a stopped one', () => {
    expect(optionLabel(itemOf('BOM-A01'))).toBe('BOM-A01 – Thiết bị BOM-A01');
    expect(optionLabel(itemOf('CAM-A01', { active: false }))).toBe('CAM-A01 – Thiết bị CAM-A01 (đã ngừng)');
  });

  it('is a locked select until a building is chosen', () => {
    render(<RecordItemSelect id="rf-item" items={[itemOf('BOM-A01')]} value="" disabled invalid={false} onChange={vi.fn()} />);
    expect(screen.getByRole('combobox').hasAttribute('disabled')).toBe(true);
  });

  it('becomes a text box with suggestions past 50 items and maps the label back to the id', () => {
    const onChange = vi.fn();
    const items = Array.from({ length: SEARCHABLE_ITEMS_FROM + 1 }, (_, index) => itemOf(`BOM-${String(index).padStart(3, '0')}`));
    render(<RecordItemSelect id="rf-item" items={items} value="" disabled={false} invalid={false} onChange={onChange} />);
    const box = screen.getByPlaceholderText('Gõ mã hoặc tên thiết bị');
    fireEvent.change(box, { target: { value: 'BOM-007 – Thiết bị BOM-007' } });
    expect(onChange).toHaveBeenLastCalledWith('itm-BOM-007');
    fireEvent.change(box, { target: { value: 'Không thuộc thiết bị cụ thể' } });
    expect(onChange).toHaveBeenLastCalledWith(NO_ITEM_VALUE);
  });
});
