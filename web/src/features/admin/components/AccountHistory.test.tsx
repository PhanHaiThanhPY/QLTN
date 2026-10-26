// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AccountHistory } from './AccountHistory';

/** SPEC US-S1 AC-8: labels, "Xem thêm" paging and the empty state of the account history. */
const mocks = vi.hoisted(() => ({ listAccountHistory: vi.fn() }));

vi.mock('@/services/http/users-api', () => ({ listAccountHistory: mocks.listAccountHistory }));

const row = (id: string, action: string, actorName = 'Quản trị demo', reason = 'KT-A2') => ({
  id,
  action,
  actorName,
  reason,
  createdAt: '2026-10-26T08:00:00.000Z',
});

const renderHistory = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AccountHistory subjectId="usr-kt" />
    </QueryClientProvider>,
  );

const open = () => fireEvent.click(screen.getByRole('button', { name: /Lịch sử/ }));

describe('AccountHistory', () => {
  beforeEach(() => mocks.listAccountHistory.mockReset());

  it('loads only when opened', () => {
    renderHistory();
    expect(mocks.listAccountHistory).not.toHaveBeenCalled();
  });

  it('AC-8: shows Vietnamese labels, "Hệ thống" without an actor, the raw code for an unknown action', async () => {
    mocks.listAccountHistory.mockResolvedValue({
      rows: [
        row('a1', 'resetPassword'),
        row('a2', 'updateUser'),
        row('a3', 'deactivateUser'),
        row('a4', 'createUser', ''),
        row('a5', 'mergeAccount'),
      ],
      page: 1,
      totalPages: 1,
    });
    renderHistory();
    open();

    expect(await screen.findByText('Đặt lại mật khẩu')).toBeTruthy();
    expect(screen.getByText('Cập nhật thông tin')).toBeTruthy();
    expect(screen.getByText('Ngừng hoạt động')).toBeTruthy();
    expect(screen.getByText('Tạo tài khoản')).toBeTruthy();
    expect(screen.getByText('mergeAccount')).toBeTruthy();
    expect(screen.getByText('Hệ thống')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Xem thêm' })).toBeNull();
    expect(mocks.listAccountHistory).toHaveBeenCalledWith('usr-kt', 1, 'users');
  });

  it('AC-8: offers "Xem thêm" while more pages exist and appends the next page', async () => {
    mocks.listAccountHistory
      .mockResolvedValueOnce({ rows: [row('p1', 'updateUser')], page: 1, totalPages: 2 })
      .mockResolvedValueOnce({ rows: [row('p2', 'createUser')], page: 2, totalPages: 2 });
    renderHistory();
    open();

    fireEvent.click(await screen.findByRole('button', { name: 'Xem thêm' }));

    expect(await screen.findByText('Tạo tài khoản')).toBeTruthy();
    expect(screen.getByText('Cập nhật thông tin')).toBeTruthy();
    expect(mocks.listAccountHistory).toHaveBeenLastCalledWith('usr-kt', 2, 'users');
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Xem thêm' })).toBeNull());
  });

  it('AC-8: shows "Chưa có lịch sử." when the account has no history', async () => {
    mocks.listAccountHistory.mockResolvedValue({ rows: [], page: 1, totalPages: 0 });
    renderHistory();
    open();

    expect(await screen.findByText('Chưa có lịch sử.')).toBeTruthy();
  });
});
