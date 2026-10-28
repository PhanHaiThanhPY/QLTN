// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ComparisonRow, InvitationDetail } from '@/services/deposit-api';
import { ComparisonCards } from './ComparisonCards';
import { ResponsesCard } from './ResponsesCard';
import { highestOf } from '../deposit-ui';

const row = (rank: number, bankName: string, rateMilli: number, interestVnd: string, patch: Partial<ComparisonRow> = {}): ComparisonRow => ({
  rank,
  offerId: `o-${bankName}`,
  bankId: `b-${bankName}`,
  bankCode: 'NH-001',
  bankName,
  shortName: null,
  rateMilli,
  dayBasis: 360,
  interestVnd,
  paymentKind: 'END',
  paymentEvery: null,
  paymentUnit: null,
  completeness: 'COMPLETE',
  missingNote: null,
  isLate: false,
  outside: false,
  ...patch,
});

const D1 = [row(1, 'Ngân hàng B', 6000, '15000000'), row(2, 'Ngân hàng C', 5900, '14750000'), row(3, 'Ngân hàng A', 5800, '14500000')];

const bank = (name: string, offerId: string | null) => ({
  id: `b-${name}`,
  code: 'NH-001',
  name,
  shortName: null,
  branch: null,
  contactName: null,
  phone: null,
  email: null,
  active: true,
  deactivationReason: null,
  version: 1,
  invitationCount: 1,
  offerId,
});

describe('T-S1 components', () => {
  it('shows "2/3" with a labelled progress bar and each bank received or waiting (AC-T1.5)', () => {
    const detail = {
      progress: { responded: 2, invited: 3 },
      invitees: [bank('Ngân hàng A', 'o1'), bank('Ngân hàng B', 'o2'), bank('Ngân hàng C', null)],
      offers: [],
      banks: {},
    } as unknown as InvitationDetail;
    const onOpen = vi.fn();
    render(<ResponsesCard detail={detail} onOpenOffer={onOpen} />);
    const bar = screen.getByRole('progressbar', { name: '2 trên 3 ngân hàng đã phản hồi' });
    expect(bar.getAttribute('aria-valuenow')).toBe('2');
    const rows = screen.getAllByRole('listitem');
    expect(within(rows[2]).getByText('Còn chờ')).toBeTruthy();
    expect(within(rows[0]).getByText('Đã nhận')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Xem bản chào của Ngân hàng B' }));
    expect(onOpen).toHaveBeenCalledWith('o2');
  });

  it('ranks the D1 offers with their interest and reads the rate aloud; a mixed basis warns (AC-T1.7, AC-T1.8)', () => {
    const { rerender } = render(<ComparisonCards rows={D1} amountVnd="1000000000" termDays={90} mixedBasis={false} selectedOfferId="o-Ngân hàng B" />);
    const cards = screen.getAllByRole('listitem');
    expect(cards.map((card, index) => within(card).getByText(`#${index + 1} ${D1[index].bankName}`).textContent)).toEqual([
      '#1 Ngân hàng B',
      '#2 Ngân hàng C',
      '#3 Ngân hàng A',
    ]);
    expect(within(cards[0]).getByText('Được chọn')).toBeTruthy();
    expect(cards[0].textContent).toContain('15.000.000');
    expect(within(cards[0]).getByText('sáu phẩy không phần trăm một năm')).toBeTruthy();
    expect(screen.queryByText(/cơ sở tính ngày khác nhau/)).toBeNull();
    rerender(<ComparisonCards rows={D1} amountVnd="1000000000" termDays={90} mixedBasis />);
    expect(screen.getByText(/Các bản chào dùng cơ sở tính ngày khác nhau/)).toBeTruthy();
  });

  it('locks an incomplete offer in the proposal with a readable reason (AC-T1.10)', () => {
    const rows = [D1[0], row(2, 'Ngân hàng C', 5900, '14750000', { completeness: 'INCOMPLETE', missingNote: 'Thiếu xác nhận' })];
    const onChange = vi.fn();
    render(<ComparisonCards rows={rows} amountVnd="1000000000" termDays={90} mixedBasis={false} pick={{ value: null, onChange }} />);
    const radios = screen.getAllByRole('radio');
    expect(radios[1].getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByText('Bản chào "Thiếu" không chọn được.')).toBeTruthy();
    fireEvent.click(radios[1]);
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(radios[0]);
    expect(onChange).toHaveBeenCalledWith('o-Ngân hàng B');
  });

  it('finds the highest complete offer on time for the "không cao nhất" warning (AC-T1.11)', () => {
    expect(highestOf(D1)?.bankName).toBe('Ngân hàng B');
    const late = [row(1, 'Ngân hàng B', 6000, '15000000', { isLate: true }), D1[1], D1[2]];
    expect(highestOf(late)?.bankName).toBe('Ngân hàng C');
    expect(highestOf([row(1, 'Ngân hàng B', 6000, '15000000', { completeness: 'INCOMPLETE', missingNote: 'x' })])).toBeNull();
  });
});
