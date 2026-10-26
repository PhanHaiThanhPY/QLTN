import { Badge } from '@/components/ui/badge';
import { Table, TableScroll, Td, Th, Tr } from '@/components/ui/table';
import { formatVndString, type QuoteSubmissionContent } from '@/domain/quote-proposal';

interface QuoteTableViewProps {
  content: QuoteSubmissionContent;
  /** Contractor chosen by the last step, when it differs from the proposed one. */
  selectedIndex?: number | null;
}

const formatQuantity = (value: string): string => value.replace('.', ',');

/** Frozen quotation table of one submission: unit price and line total per contractor, server totals. */
export const QuoteTableView = ({ content, selectedIndex }: QuoteTableViewProps) => {
  const { items, contractors, contractorTotals, proposedContractorIndex } = content;
  return (
    <TableScroll>
      <Table>
        <thead>
          <Tr>
            <Th className="w-10">STT</Th>
            <Th>Hạng mục</Th>
            <Th>ĐVT</Th>
            <Th className="text-right">SL</Th>
            {contractors.map((contractor, index) => (
              <Th key={`head-${index}`} className="text-right normal-case tracking-normal">
                <span className="block text-ink">{contractor.name}</span>
                {index === proposedContractorIndex ? <Badge tone="info">Đề xuất</Badge> : null}
                {index === selectedIndex ? <Badge tone="good">Được chọn</Badge> : null}
              </Th>
            ))}
          </Tr>
        </thead>
        <tbody>
          {items.map((item, itemIndex) => (
            <Tr key={`item-${itemIndex}`}>
              <Td>{itemIndex + 1}</Td>
              <Td className="text-ink">{item.name}</Td>
              <Td>{item.unit}</Td>
              <Td className="text-right">{formatQuantity(item.quantity)}</Td>
              {contractors.map((contractor, contractorIndex) => (
                <Td key={`price-${contractorIndex}`} className="text-right">
                  <span className="block text-ink">
                    {formatVndString(contractorTotals[contractorIndex]?.lineTotalsVnd[itemIndex])}
                  </span>
                  <span className="text-xs text-ink-3">
                    đơn giá {formatVndString(contractor.unitPricesVnd[itemIndex])}
                  </span>
                </Td>
              ))}
            </Tr>
          ))}
          <Tr>
            <Td colSpan={4} className="text-right">
              Chi phí khác
            </Td>
            {contractors.map((contractor, index) => (
              <Td key={`other-${index}`} className="text-right">
                {formatVndString(contractor.otherCostVnd)}
              </Td>
            ))}
          </Tr>
          <Tr>
            <Td colSpan={4} className="text-right">
              Thuế (VAT)
            </Td>
            {contractors.map((contractor, index) => (
              <Td key={`tax-${index}`} className="text-right">
                {formatVndString(contractor.taxVnd)}
              </Td>
            ))}
          </Tr>
          <Tr>
            <Td colSpan={4} className="text-right font-semibold text-ink">
              Tổng cộng (gồm VAT)
            </Td>
            {contractorTotals.map((total, index) => (
              <Td key={`total-${index}`} className="text-right font-semibold text-ink">
                {formatVndString(total.totalVnd)}
              </Td>
            ))}
          </Tr>
        </tbody>
      </Table>
    </TableScroll>
  );
};
