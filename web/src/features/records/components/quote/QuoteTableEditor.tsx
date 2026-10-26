import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableScroll, Td, Th, Tr } from '@/components/ui/table';
import {
  QUOTE_LIMITS,
  contractorTotal,
  formatVndInputString,
  formatVndString,
  vndDigits,
} from '@/domain/quote-proposal';
import type { QuoteForm } from '../../hooks/useQuoteForm';

interface QuoteTableEditorProps {
  form: QuoteForm;
  errors: Record<string, string>;
  disabled: boolean;
}

interface MoneyCellProps {
  label: string;
  value: string;
  error?: string;
  disabled: boolean;
  onChange: (digits: string) => void;
}

/** Integer VND box: shows "1.250.000", keeps only the digits. */
const MoneyCell = ({ label, value, error, disabled, onChange }: MoneyCellProps) => (
  <Input
    aria-label={label}
    inputMode="numeric"
    className="min-w-28 text-right"
    value={formatVndInputString(value)}
    disabled={disabled}
    aria-invalid={Boolean(error)}
    title={error}
    onChange={(event) => onChange(vndDigits(event.target.value))}
  />
);

/**
 * Quotation table of D5-TT (§4.2): shared items as rows, one price column per contractor, then other costs, tax and
 * the previewed total. The server recomputes every total on submission.
 */
export const QuoteTableEditor = ({ form, errors, disabled }: QuoteTableEditorProps) => {
  const { items, contractors } = form.values;
  const { table } = form;
  const totals = contractors.map((contractor) => contractorTotal(items, contractor));
  const canAddItem = !disabled && items.length < QUOTE_LIMITS.ITEMS_MAX;
  const canAddContractor = !disabled && contractors.length < QUOTE_LIMITS.CONTRACTORS_MAX;

  return (
    <div className="space-y-2">
      <TableScroll>
        <Table>
          <thead>
            <Tr>
              <Th className="w-10">STT</Th>
              <Th className="min-w-48">Hạng mục</Th>
              <Th className="w-24">ĐVT</Th>
              <Th className="w-24">Số lượng</Th>
              {contractors.map((contractor, index) => (
                <Th key={`head-${index}`} className="min-w-40">
                  <div className="flex items-center gap-1">
                    <Input
                      aria-label={`Tên nhà thầu ${index + 1}`}
                      placeholder={`Nhà thầu ${index + 1}`}
                      maxLength={QUOTE_LIMITS.CONTRACTOR_NAME_MAX}
                      value={contractor.name}
                      disabled={disabled}
                      aria-invalid={Boolean(errors[`contractors.${index}.name`])}
                      title={errors[`contractors.${index}.name`]}
                      onChange={(event) => table.updateContractor(index, { name: event.target.value })}
                    />
                    {disabled || contractors.length <= 1 ? null : (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Bỏ nhà thầu ${index + 1}`}
                        onClick={() => table.removeContractor(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </Th>
              ))}
              <Th className="w-10" />
            </Tr>
          </thead>
          <tbody>
            {items.map((item, itemIndex) => (
              <Tr key={`item-${itemIndex}`}>
                <Td>{itemIndex + 1}</Td>
                <Td>
                  <Input
                    aria-label={`Tên hạng mục ${itemIndex + 1}`}
                    maxLength={QUOTE_LIMITS.ITEM_NAME_MAX}
                    value={item.name}
                    disabled={disabled}
                    aria-invalid={Boolean(errors[`items.${itemIndex}.name`])}
                    title={errors[`items.${itemIndex}.name`]}
                    onChange={(event) => table.updateItem(itemIndex, { name: event.target.value })}
                  />
                </Td>
                <Td>
                  <Input
                    aria-label={`Đơn vị hạng mục ${itemIndex + 1}`}
                    maxLength={QUOTE_LIMITS.ITEM_UNIT_MAX}
                    value={item.unit}
                    disabled={disabled}
                    aria-invalid={Boolean(errors[`items.${itemIndex}.unit`])}
                    onChange={(event) => table.updateItem(itemIndex, { unit: event.target.value })}
                  />
                </Td>
                <Td>
                  <Input
                    aria-label={`Số lượng hạng mục ${itemIndex + 1}`}
                    inputMode="decimal"
                    placeholder="1.5"
                    value={item.quantity}
                    disabled={disabled}
                    aria-invalid={Boolean(errors[`items.${itemIndex}.quantity`])}
                    title={errors[`items.${itemIndex}.quantity`]}
                    onChange={(event) => table.updateItem(itemIndex, { quantity: event.target.value.replace(',', '.') })}
                  />
                </Td>
                {contractors.map((contractor, contractorIndex) => (
                  <Td key={`price-${contractorIndex}`}>
                    <MoneyCell
                      label={`Đơn giá hạng mục ${itemIndex + 1} – nhà thầu ${contractorIndex + 1}`}
                      value={contractor.unitPricesVnd[itemIndex] ?? ''}
                      error={errors[`contractors.${contractorIndex}.unitPricesVnd.${itemIndex}`]}
                      disabled={disabled}
                      onChange={(digits) => table.setUnitPrice(contractorIndex, itemIndex, digits)}
                    />
                    <p className="mt-1 text-right text-xs text-ink-3">
                      = {formatVndString(totals[contractorIndex].lineTotalsVnd[itemIndex])}
                    </p>
                  </Td>
                ))}
                <Td>
                  {disabled || items.length <= 1 ? null : (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Bỏ hạng mục ${itemIndex + 1}`}
                      onClick={() => table.removeItem(itemIndex)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </Td>
              </Tr>
            ))}
            <Tr>
              <Td colSpan={4} className="text-right text-ink-2">
                Chi phí khác
              </Td>
              {contractors.map((contractor, index) => (
                <Td key={`other-${index}`}>
                  <MoneyCell
                    label={`Chi phí khác – nhà thầu ${index + 1}`}
                    value={contractor.otherCostVnd}
                    error={errors[`contractors.${index}.otherCostVnd`]}
                    disabled={disabled}
                    onChange={(digits) => table.updateContractor(index, { otherCostVnd: digits })}
                  />
                </Td>
              ))}
              <Td />
            </Tr>
            <Tr>
              <Td colSpan={4} className="text-right text-ink-2">
                Thuế (VAT)
              </Td>
              {contractors.map((contractor, index) => (
                <Td key={`tax-${index}`}>
                  <MoneyCell
                    label={`Thuế – nhà thầu ${index + 1}`}
                    value={contractor.taxVnd}
                    error={errors[`contractors.${index}.taxVnd`]}
                    disabled={disabled}
                    onChange={(digits) => table.updateContractor(index, { taxVnd: digits })}
                  />
                </Td>
              ))}
              <Td />
            </Tr>
            <Tr>
              <Td colSpan={4} className="text-right font-semibold text-ink">
                Tổng cộng (gồm VAT)
              </Td>
              {totals.map((total, index) => (
                <Td key={`total-${index}`} className="text-right font-semibold text-ink">
                  {formatVndString(total.totalVnd)}
                </Td>
              ))}
              <Td />
            </Tr>
          </tbody>
        </Table>
      </TableScroll>
      {disabled ? null : (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" disabled={!canAddItem} onClick={table.addItem}>
            Thêm hạng mục
          </Button>
          <Button variant="secondary" size="sm" disabled={!canAddContractor} onClick={table.addContractor}>
            Thêm nhà thầu
          </Button>
        </div>
      )}
      <p className="text-xs text-ink-3">
        Thành tiền = số lượng × đơn giá, làm tròn đến đồng. Tổng = Σ thành tiền + chi phí khác + thuế. Hệ thống tự
        tính lại khi trình.
      </p>
    </div>
  );
};
