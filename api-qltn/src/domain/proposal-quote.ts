/**
 * Quotation maths of a proposal (SPEC B03–B09 v2 §4.2). Money never goes through floating point: amounts are
 * integer VND carried as strings and computed with BigInt, quantities are decimal strings with up to 3 decimals.
 */

/** Quantity: positive decimal with at most 3 decimals, e.g. "1", "1.5", "0.125". */
export const QUANTITY_PATTERN = /^(?:0|[1-9]\d{0,8})(?:\.\d{1,3})?$/;
/** Integer VND, no sign, no leading zero (except "0"). */
export const VND_PATTERN = /^(?:0|[1-9]\d{0,14})$/;

const QUANTITY_SCALE = 1000n;

export interface QuoteItem {
  name: string;
  unit: string;
  quantity: string;
}

export interface QuoteContractor {
  name: string;
  unitPricesVnd: string[];
  otherCostVnd: string;
  taxVnd: string;
}

export interface ContractorTotal {
  lineTotalsVnd: string[];
  subtotalVnd: string;
  totalVnd: string;
}

/** Quantity "1.5" → 1500n (thousandths). The caller has validated the format. */
const quantityThousandths = (quantity: string): bigint => {
  const [whole, fraction = ''] = quantity.split('.');
  return BigInt(whole) * QUANTITY_SCALE + BigInt(fraction.padEnd(3, '0'));
};

/** Line total = quantity × unit price, rounded half up to the đồng (1.5 × 333 333 = 499 999.5 → 500 000). */
export const lineTotalVnd = (quantity: string, unitPriceVnd: string): bigint => {
  const scaled = quantityThousandths(quantity) * BigInt(unitPriceVnd);
  return (scaled + QUANTITY_SCALE / 2n) / QUANTITY_SCALE;
};

/** Totals of one contractor: Σ line totals + other costs + tax (VAT included). */
export const contractorTotal = (items: readonly QuoteItem[], contractor: QuoteContractor): ContractorTotal => {
  const lines = items.map((item, index) => lineTotalVnd(item.quantity, contractor.unitPricesVnd[index] ?? '0'));
  const subtotal = lines.reduce((sum, line) => sum + line, 0n);
  const total = subtotal + BigInt(contractor.otherCostVnd) + BigInt(contractor.taxVnd);
  return {
    lineTotalsVnd: lines.map(String),
    subtotalVnd: subtotal.toString(),
    totalVnd: total.toString(),
  };
};
