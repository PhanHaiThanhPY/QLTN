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

const renderDialog = (user?: User) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <UserDialog user={user} departments={[]} roles={[]} onClose={() => undefined} />
    </QueryClientProvider>,
  );

describe('UserDialog duplicate account errors', () => {
  afterEach(() => vi.clearAllMocks());

  it('should not offer the login name when editing and still show the email error under its field', async () => {
    mocks.executeCommand.mockRejectedValue(
      new AppError(ERROR_CODE.VALIDATION_ERROR, 'Dữ liệu chưa hợp lệ.', { email: 'Email đã được dùng.' }),
    );
    renderDialog(account);
    expect(screen.queryByLabelText('Tên đăng nhập')).toBeNull();

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 't4c-b@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));

    const alerts = await screen.findAllByRole('alert');
    expect(alerts.map((alert) => alert.textContent)).toEqual(['Email đã được dùng.']);
    expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe('t4c-b@example.com');
    const payload = (mocks.executeCommand.mock.calls[0][0] as { payload: Record<string, unknown> }).payload;
    expect(payload).not.toHaveProperty('username');
  });

  it('should keep the login name when creating and show its error under that field', async () => {
    mocks.executeCommand.mockRejectedValue(
      new AppError(ERROR_CODE.VALIDATION_ERROR, 'Dữ liệu chưa hợp lệ.', {
        username: 'Tên đăng nhập đã tồn tại.',
      }),
    );
    renderDialog();

    fireEvent.change(screen.getByLabelText('Tên đăng nhập'), { target: { value: 'T4C-B' } });
    fireEvent.click(screen.getByRole('button', { name: 'Tạo tài khoản' }));

    expect((await screen.findByRole('alert')).textContent).toBe('Tên đăng nhập đã tồn tại.');
    expect((screen.getByLabelText('Tên đăng nhập') as HTMLInputElement).value).toBe('t4c-b');
  });
});
