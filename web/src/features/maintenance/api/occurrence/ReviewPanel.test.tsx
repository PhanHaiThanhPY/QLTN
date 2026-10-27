// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { detailOf, submissionOf } from './__fixtures__/occurrence';
import { ReviewPanel } from './ReviewPanel';

const renderPanel = (detail = detailOf({ status: 'PENDING_REVIEW', round: 1 }, { submissions: [submissionOf()] })) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <ReviewPanel detail={detail} submission={detail.submissions[0]} userName={() => 'KT01'} onReload={vi.fn()} />
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe('ReviewPanel (SPEC MT-S3 BR-MT3-06, BR-MT3-09, ui-brief §2.2)', () => {
  it('asks a resolution for each failed item without a record; an item with its record needs none', () => {
    renderPanel(
      detailOf(
        { status: 'PENDING_REVIEW', round: 1 },
        { submissions: [submissionOf()], repairs: [{ id: 'rec-1', code: 'SC-031', status: 'DRAFT', itemId: 'leak', inForce: true }] },
      ),
    );
    expect(screen.queryByLabelText(/Hướng xử lý/, { selector: '#resolution-leak' })).toBeNull();
    expect(screen.getByLabelText(/Hướng xử lý/, { selector: '#resolution-pressure' })).toBeTruthy();
    expect(screen.getByText(/SC-031 · Nháp/)).toBeTruthy();
  });

  it('blocks confirmation while an item is marked "Cần làm lại", with the hint', () => {
    renderPanel();
    expect((screen.getByRole('button', { name: 'Yêu cầu làm lại' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getAllByRole('checkbox', { name: 'Cần làm lại' })[2]);
    expect((screen.getByRole('button', { name: 'Xác nhận hoàn thành' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('Bỏ đánh dấu «Cần làm lại» để xác nhận.')).toBeTruthy();
    expect(screen.getByLabelText('Lý do làm lại Áp suất')).toBeTruthy();
  });
});
