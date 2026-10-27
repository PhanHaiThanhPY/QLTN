import type { QuoteTable, QuoteTableContractor } from '../proposal-model';

const SUMMARY_ROWS: ReadonlyArray<{ label: string; value: (contractor: QuoteTableContractor) => string }> = [
  { label: 'Chi phí', value: (contractor) => contractor.subtotal },
  { label: 'Thuế', value: (contractor) => contractor.tax },
  { label: 'Tổng tiền', value: (contractor) => contractor.total },
];

/**
 * One quotation table of the form (up to 3 contractors, each with "Đơn giá" and "Thành tiền"). `thead` repeats on
 * every printed page and rows are never cut across pages (print-sheet.css).
 */
export const QuoteTablePrint = ({ table, caption }: { table: QuoteTable; caption: string }) => (
  <div className="d5-table-wrap">
    <table className="d5-table">
      <caption className="d5-heading" style={{ textAlign: 'left' }}>
        {caption}
      </caption>
      <thead>
        <tr>
          <th scope="col" rowSpan={2}>STT</th>
          <th scope="col" rowSpan={2}>Hạng mục</th>
          <th scope="col" rowSpan={2}>Đơn vị</th>
          <th scope="col" rowSpan={2}>Số lượng</th>
          {table.contractors.map((contractor, index) => (
            <th key={`name-${index}`} scope="colgroup" colSpan={2}>
              {contractor.name}
            </th>
          ))}
        </tr>
        <tr>
          {table.contractors.flatMap((_, index) => [
            <th key={`price-${index}`} scope="col">Đơn giá</th>,
            <th key={`total-${index}`} scope="col">Thành tiền</th>,
          ])}
        </tr>
      </thead>
      <tbody>
        {table.items.map((item, line) => (
          <tr key={`item-${line}`}>
            <td className="d5-num">{line + 1}</td>
            <td>{item.name}</td>
            <td>{item.unit}</td>
            <td className="d5-num">{item.quantity}</td>
            {table.contractors.flatMap((contractor, index) => [
              <td key={`price-${index}`} className="d5-num">{contractor.unitPrices[line]}</td>,
              <td key={`total-${index}`} className="d5-num">{contractor.lineTotals[line]}</td>,
            ])}
          </tr>
        ))}
        {SUMMARY_ROWS.map((row) => (
          <tr key={row.label}>
            <th scope="row" colSpan={4} style={{ textAlign: 'left' }}>
              {row.label}
            </th>
            {table.contractors.flatMap((contractor, index) => [
              <td key={`empty-${index}`} />,
              <td key={`value-${index}`} className="d5-num">{row.value(contractor)}</td>,
            ])}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
