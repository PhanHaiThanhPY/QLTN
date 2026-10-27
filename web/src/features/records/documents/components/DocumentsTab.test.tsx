// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import type { User } from '@/domain/types';
import type { RecordDetail } from '@/services/records-service';
import { RecordContext } from '../../record-context';
import { advance, completedDetail, settlement } from '../__fixtures__/completed-record';
import { DocumentsTab } from './DocumentsTab';

/** SPEC B7-S1 BR-B7-01 / AC-B7.1, 7.2, 7.12: the documents tab. */
const renderTab = (detail: RecordDetail) =>
  render(
    <RecordContext.Provider value={{ detail, viewer: { id: 'usr-bql' } as User }}>
      <DocumentsTab />
    </RecordContext.Provider>,
  );

describe('DocumentsTab', () => {
  it('AC-B7.1: lists the 6 documents with status, signatures and a new-tab "Xem / In" link', () => {
    renderTab(completedDetail());
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(6);
    expect(within(items[0]).getByText('Tờ trình · lần 1')).toBeTruthy();
    expect(within(items[0]).getByText('Bị từ chối')).toBeTruthy();
    expect(within(items[0]).getByText('Chữ ký 2/2')).toBeTruthy();
    const link = within(items[4]).getByRole('link', { name: /Xem \/ In Biên bản nghiệm thu · lượt 2/ });
    expect(link.getAttribute('href')).toBe('/records/rec-1/documents/minutes/acc-2');
    expect(link.getAttribute('target')).toBe('_blank');
  });

  it('AC-B7.2: says there is nothing to print before the first submission', () => {
    renderTab(completedDetail({ quoteProposal: undefined, execution: undefined, paymentHistory: undefined }));
    expect(screen.getByText('Chưa có tài liệu nào để in')).toBeTruthy();
  });

  it('AC-B7.12: a 0-đồng settlement has no link, only the note', () => {
    const zero = { ...settlement, amountVnd: '0', settlementAmountVnd: '4000000' };
    renderTab(completedDetail({ paymentHistory: { approvedAmountVnd: '10000000', transferredTotalVnd: '4000000', draft: null, payments: [advance, zero] } }));
    const row = screen.getByText('Thư đề nghị · đợt 2 quyết toán').closest('li') as HTMLElement;
    expect(within(row).queryByRole('link')).toBeNull();
    expect(within(row).getByText('Không cần thư đề nghị: số của đợt bằng 0')).toBeTruthy();
  });
});
