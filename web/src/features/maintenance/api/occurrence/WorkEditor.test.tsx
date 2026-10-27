// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { detailOf } from './__fixtures__/occurrence';
import { WorkEditor } from './WorkEditor';

const renderEditor = (detail = detailOf()) => {
  const router = createMemoryRouter([{ path: '/', element: <WorkEditor detail={detail} onReload={vi.fn()} /> }]);
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
};

describe('WorkEditor (SPEC MT-S3 BR-MT3-03, BR-MT3-04, ui-brief §2.1)', () => {
  it('locks an out-of-range measurement on Lỗi and says why (AC-MT3.2)', () => {
    renderEditor();
    fireEvent.change(screen.getByLabelText(/Áp suất \(bar, ngưỡng 2–6 bar\)/), { target: { value: '7' } });
    expect(screen.getByText(/Ngoài ngưỡng 2–6 bar/)).toBeTruthy();
    const group = screen.getByRole('radiogroup', { name: 'Áp suất' });
    expect(within(group).getByRole('radio', { name: 'Lỗi' }).getAttribute('aria-checked')).toBe('true');
    expect((within(group).getByRole('radio', { name: 'Đạt' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('Đã kiểm 1/3 mục · 1 lỗi')).toBeTruthy();
  });

  it('moves the result with the arrow keys', () => {
    renderEditor();
    const group = screen.getByRole('radiogroup', { name: 'Vận hành' });
    fireEvent.keyDown(within(group).getByRole('radio', { name: 'Đạt' }), { key: 'ArrowRight' });
    expect(within(group).getByRole('radio', { name: 'Lỗi' }).getAttribute('aria-checked')).toBe('true');
  });

  it('names the missing items on the page and on each item before calling the server (AC-MT3.3)', () => {
    renderEditor();
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Vận hành' })).getByRole('radio', { name: 'Đạt' }));
    fireEvent.click(screen.getByRole('button', { name: 'Gửi kết quả' }));
    expect(screen.getByText(/Còn \d mục chưa đủ/)).toBeTruthy();
    expect(screen.getByText('Áp suất: cần nhập số đo.')).toBeTruthy();
    expect(screen.getByText('Cần ít nhất 1 ảnh chung của lượt.')).toBeTruthy();
  });

  it('shows the reviewer reason on an item sent back', () => {
    renderEditor(detailOf({ status: 'REWORK', rework: { pressure: 'Đo lại sau khi xả khí.' } }));
    expect(screen.getByText('Cần làm lại: Đo lại sau khi xả khí.')).toBeTruthy();
  });
});
