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

/** Largest amount the system stores: 15 digits, as `VND_PATTERN` (FX-S3 BR-FX3-06). */
export const VND_MAX = 999_999_999_999_999n;

export interface QuoteLimitCheck {
  /** Lines whose total exceeds `VND_MAX`. */
  linesOverLimit: number[];
  /** Total of the contractor when every value is well formed, else null. */
  totalVnd: bigint | null;
}

/**
 * Bounds of one contractor's quotation (FX-S3 BR-FX3-06/07), computed with BigInt so an oversized product is
 * reported rather than overflowing the bigint column. Values that are not well formed are skipped: their own
 * format errors are reported elsewhere.
 */
export const checkQuoteLimits = (items: readonly QuoteItem[], contractor: QuoteContractor): QuoteLimitCheck => {
  const lines = items.map((item, index) => {
    const price = contractor.unitPricesVnd[index];
    const valid = QUANTITY_PATTERN.test(item.quantity) && price !== undefined && VND_PATTERN.test(price);
    return valid ? lineTotalVnd(item.quantity, price) : null;
  });
  const complete =
    contractor.unitPricesVnd.length === items.length &&
    lines.every((line) => line !== null) &&
    VND_PATTERN.test(contractor.otherCostVnd) &&
    VND_PATTERN.test(contractor.taxVnd);
  return {
    linesOverLimit: lines.flatMap((line, index) => (line !== null && line > VND_MAX ? [index] : [])),
    totalVnd: complete
      ? lines.reduce<bigint>((sum, line) => sum + (line ?? 0n), 0n) +
        BigInt(contractor.otherCostVnd) +
        BigInt(contractor.taxVnd)
      : null,
  };
};
