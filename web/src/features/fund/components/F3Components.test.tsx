// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import type { Collection, ContractDetail, Receivable } from '@/services/exploitation-api';
import type { LedgerPage, Voucher } from '@/services/fund-api';
import { NextDueCard } from '@/features/exploitation/components/NextDueCard';
import { ReceiptDialog } from '@/features/exploitation/components/ReceiptDialog';
import { LedgerTable } from './LedgerTable';
import { VoucherActions } from './VoucherActions';

const wrap = (node: ReactNode) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>{node}</MemoryRouter>
    </QueryClientProvider>,
  );

const command = { execute: vi.fn(), isPending: false, fieldErrors: {} as Record<string, string>, errorMessage: null, errorCode: null, reset: vi.fn(), getLastFieldErrors: vi.fn() };

const period = (n: number, dueDate: string): Receivable => ({
  id: `k${n}`,
  periodNo: n,
  periodStart: dueDate.slice(0, 8) + '01',
  periodEnd: dueDate.slice(0, 8) + '28',
  dueDate,
  amountVnd: '20000000',
  revision: 1,
  status: 'NOT_DUE',
  paidVnd: '0',
  remainingVnd: '20000000',
  overdueVnd: '0',
  receipts: [],
  supersededAt: null,
});

describe('F-S3 components', () => {
  it('spreads a receipt earliest due first and flags an edited period that gets too much (AC-F3.8)', () => {
    const detail = {
      contract: { id: 'c1', code: 'HĐ-002' },
      receivables: [period(1, '2026-12-10'), period(2, '2027-01-10'), period(3, '2027-02-10')],
    } as unknown as ContractDetail;
    wrap(<ReceiptDialog detail={detail} fundId="f1" onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/Số tiền/), { target: { value: '30.000.000' } });
    expect((screen.getByLabelText(/Kỳ 1 ·/) as HTMLInputElement).value).toBe('20.000.000');
    expect((screen.getByLabelText(/Kỳ 2 ·/) as HTMLInputElement).value).toBe('10.000.000');
    expect(screen.getByRole('status').textContent).toBe('Đã phân bổ 30.000.000 ₫ / 30.000.000 ₫');

    fireEvent.change(screen.getByLabelText(/Kỳ 1 ·/), { target: { value: '25.000.000' } });
    expect(screen.getByText(/Vượt số còn phải thu của kỳ/)).toBeTruthy();
    expect(screen.getByLabelText(/Kỳ 1 ·/).getAttribute('aria-invalid')).toBe('true');
    expect((screen.getByRole('button', { name: 'Ghi nhận khoản thu' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('always shows the check line phải thu = đã thu + còn thu (BR-F3-08)', () => {
    const collection: Collection = {
      dueVnd: '20000000',
      paidVnd: '15000000',
      remainingVnd: '5000000',
      overdueVnd: '0',
      current: { receivableId: 'k1', periodNo: 1, percentPaid: 75 },
      next: { receivableId: 'k1', periodNo: 1, dueDate: '2026-11-25', remainingVnd: '5000000', status: 'PARTIAL' },
      depositTermVnd: '0',
      depositReceivedVnd: '0',
    };
    wrap(<NextDueCard collection={collection} />);
    const card = screen.getByRole('region', { name: 'Khoản thu tiếp theo' });
    expect(card.textContent).toContain('5 tr');
    expect(card.textContent).toContain('phải thu 20.000.000 ₫ = đã thu 15.000.000 ₫ + còn thu 5.000.000 ₫');
    expect(card.textContent).toContain('Đã thu một phần');
  });

  it('lists the month with signs, the reversal pair and the closing in the footer (AC-F3.2, AC-F3.3)', () => {
    const row = (id: string, code: string, direction: 'IN' | 'OUT', amountVnd: string, extra: object = {}) => ({
      id,
      entryDate: '2026-11-18',
      direction,
      amountVnd,
      category: direction === 'IN' ? ('CONTRACT_RECEIPT' as const) : ('TAX' as const),
      sourceType: direction === 'IN' ? ('RECEIPT' as const) : ('TAX_PAYMENT' as const),
      sourceId: `s-${id}`,
      sourceCode: code,
      description: `${code} mô tả`,
      reversesId: null,
      reversedById: null,
      reconciliation: 'UNRECONCILED' as const,
      contractId: 'c1',
      createdBy: 'u1',
      createdAt: '2026-11-18T02:00:00Z',
      ...extra,
    });
    const page: LedgerPage = {
      fund: { id: 'f1', buildingId: 'b1' } as LedgerPage['fund'],
      month: '2026-11',
      figures: { openingVnd: '50000000', inVnd: '15000000', outVnd: '5000000', closingVnd: '55000000', incomeVnd: '10000000', depositHeldVnd: '0' },
      openingLine: { date: '2026-11-01', amountVnd: '50000000' },
      rows: [
        row('l1', 'PT-001', 'IN', '10000000'),
        row('l2', 'PT-002', 'IN', '5000000', { reversedById: 'l3' }),
        row('l3', 'PT-002', 'OUT', '5000000', { reversesId: 'l2', category: 'CONTRACT_RECEIPT', sourceType: 'RECEIPT' }),
      ],
    };
    const { container } = wrap(<LedgerTable page={page} />);
    const table = container.querySelector('table') as HTMLTableElement;
    expect(within(table).getByText('Số dư đầu')).toBeTruthy();
    expect(within(table).getAllByText('cộng mười triệu đồng').length).toBe(1);
    expect(within(table).getByText('+5.000.000 ₫')).toBeTruthy();
    expect(within(table).getByText('−5.000.000 ₫')).toBeTruthy();
    expect(within(table).getByText('Đã hủy')).toBeTruthy();
    expect(within(table).getByText('Dòng đảo của PT-002')).toBeTruthy();
    expect(table.querySelector('tfoot')?.textContent).toContain('55.000.000 ₫');
    expect(table.querySelectorAll('thead th[scope="col"]').length).toBe(6);
  });

  it('gives BQT the decision buttons on a pending voucher and Kế toán only the payout once approved (AC-F3.13)', () => {
    const voucher = { id: 'v1', code: 'PC-001', fundId: 'f1', status: 'PENDING', version: 2, cancelRequest: null } as unknown as Voucher;
    const { rerender } = wrap(<VoucherActions voucher={voucher} requestFile={null} canOperate={false} canApprove online command={command} />);
    for (const name of ['Duyệt', 'Yêu cầu sửa', 'Từ chối']) expect(screen.getByRole('button', { name })).toBeTruthy();

    const wrapped = (node: ReactNode) => (
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>{node}</MemoryRouter>
      </QueryClientProvider>
    );
    rerender(wrapped(<VoucherActions voucher={voucher} requestFile={null} canOperate canApprove={false} online command={command} />));
    expect(screen.queryByRole('button', { name: 'Duyệt' })).toBeNull();
    rerender(wrapped(<VoucherActions voucher={{ ...voucher, status: 'APPROVED' }} requestFile={null} canOperate canApprove={false} online command={command} />));
    expect(screen.getByRole('button', { name: 'Ghi đã chi' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Gửi duyệt' })).toBeNull();
  });
});
