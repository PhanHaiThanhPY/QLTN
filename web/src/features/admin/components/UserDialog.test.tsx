// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppError, ERROR_CODE } from '@/domain/errors';
import type { User } from '@/domain/types';
import { UserDialog } from './UserDialog';

const mocks = vi.hoisted(() => ({ executeCommand: vi.fn() }));

vi.mock('@/services/command-engine', () => ({ executeCommand: mocks.executeCommand }));
vi.mock('@/hooks/useReferenceData', () => ({
  useReferenceData: () => ({
    data: undefined,
    userName: () => '—',
    buildingName: () => '—',
    buildingCode: () => '—',
    locationName: () => '—',
    itemName: () => '—',
    isLoading: false,
  }),
}));

const account: User = {
  id: '6f1b0d0a-0000-4000-8000-000000000001',
  code: 'T4C-A',
  username: 't4c-a',
  fullName: 'Tài khoản thử',
  role: 'BQL',
  email: 't4c-a@example.com',
  buildingIds: [],
  active: true,
  version: 1,
};

const renderDialog = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <UserDialog user={account} departments={[]} roles={[]} onClose={() => undefined} />
    </QueryClientProvider>,
  );

describe('UserDialog duplicate account errors', () => {
  afterEach(() => vi.clearAllMocks());

  it('should show username and email errors under their own fields and keep what was typed', async () => {
    mocks.executeCommand.mockRejectedValue(
      new AppError(ERROR_CODE.VALIDATION_ERROR, 'Dữ liệu chưa hợp lệ.', {
        username: 'Tên đăng nhập đã tồn tại.',
        email: 'Email đã được dùng.',
      }),
    );
    renderDialog();

    fireEvent.change(screen.getByLabelText('Tên đăng nhập'), { target: { value: 'T4C-B' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 't4c-b@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));

    const alerts = await screen.findAllByRole('alert');
    expect(alerts.map((alert) => alert.textContent)).toEqual([
      'Tên đăng nhập đã tồn tại.',
      'Email đã được dùng.',
    ]);
    expect((screen.getByLabelText('Tên đăng nhập') as HTMLInputElement).value).toBe('t4c-b');
    expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe('t4c-b@example.com');
    expect(mocks.executeCommand).toHaveBeenCalledWith(
      expect.objectContaining({ payload: expect.objectContaining({ username: 't4c-b', email: 't4c-b@example.com' }) }),
    );
  });
});
