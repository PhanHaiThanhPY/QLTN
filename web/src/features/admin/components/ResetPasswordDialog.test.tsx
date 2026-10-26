// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AppError, ERROR_CODE } from '@/domain/errors';
import type { User } from '@/domain/types';
import { PASSWORD_LENGTH_MESSAGE } from '@/services/http/mappers';
import { RESET_PASSWORD_MESSAGES, ResetPasswordDialog, resetPasswordSuccessMessage } from './ResetPasswordDialog';

/** SPEC US-S1: client rules (AC-6) and outcomes of the reset call (AC-7, §3.1 errors). */
const mocks = vi.hoisted(() => ({ resetUserPassword: vi.fn(), toastSuccess: vi.fn(), toastError: vi.fn() }));

vi.mock('@/services/http/users-api', () => ({ resetUserPassword: mocks.resetUserPassword }));
vi.mock('sonner', () => ({ toast: { success: mocks.toastSuccess, error: mocks.toastError } }));

const EMPLOYEE: User = {
  id: 'usr-kt',
  code: 'KT-A2',
  username: 'kt-a2',
  fullName: 'Lê Văn Kỹ',
  role: 'TECH_CONFIRMER',
  buildingIds: ['bld-a'],
  active: true,
  version: 3,
};
const NEXT = 'Dat-lai-moi-1';

const renderDialog = () => {
  const onOpenChange = vi.fn();
  const onReset = vi.fn();
  render(<ResetPasswordDialog user={EMPLOYEE} open onOpenChange={onOpenChange} onReset={onReset} />);
  return { onOpenChange, onReset };
};

const fill = (password: string, confirm: string) => {
  fireEvent.change(screen.getByLabelText(/^Mật khẩu mới/), { target: { value: password } });
  fireEvent.change(screen.getByLabelText(/Nhập lại mật khẩu mới/), { target: { value: confirm } });
};

const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Đặt lại' }));

describe('ResetPasswordDialog', () => {
  beforeEach(() => {
    mocks.resetUserPassword.mockReset();
    mocks.toastSuccess.mockReset();
    mocks.toastError.mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('warns that the employee is signed out everywhere', () => {
    renderDialog();
    expect(
      screen.getByText('Nhân viên «Lê Văn Kỹ (KT-A2)» sẽ bị đăng xuất khỏi mọi thiết bị và phải đăng nhập bằng mật khẩu mới.'),
    ).toBeTruthy();
  });

  it.each([
    ['an empty password', '', '', 'Vui lòng nhập mật khẩu mới.'],
    ['a password under 8 characters', 'Ngan-7c', 'Ngan-7c', PASSWORD_LENGTH_MESSAGE],
    ['two fields that differ', NEXT, `${NEXT}x`, RESET_PASSWORD_MESSAGES.MISMATCH],
  ])('AC-6: refuses %s under the right field without calling the API', async (_case, password, confirm, message) => {
    renderDialog();
    fill(password, confirm);
    submit();

    expect(await screen.findByText(message)).toBeTruthy();
    expect(mocks.resetUserPassword).not.toHaveBeenCalled();
  });

  it('AC-7: on success shows the toast, closes and asks the history to reload', async () => {
    mocks.resetUserPassword.mockResolvedValue(undefined);
    const { onOpenChange, onReset } = renderDialog();
    fill(NEXT, NEXT);
    submit();

    await waitFor(() => expect(onReset).toHaveBeenCalledTimes(1));
    expect(mocks.resetUserPassword).toHaveBeenCalledWith('usr-kt', NEXT);
    expect(mocks.toastSuccess).toHaveBeenCalledWith(resetPasswordSuccessMessage('KT-A2'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('shows a backend password error under its field and stays open', async () => {
    mocks.resetUserPassword.mockRejectedValue(
      new AppError(ERROR_CODE.VALIDATION_ERROR, 'Mật khẩu phải có từ 8 đến 72 ký tự.', { password: 'Mật khẩu không hợp lệ.' }),
    );
    const { onOpenChange } = renderDialog();
    fill(NEXT, NEXT);
    submit();

    expect(await screen.findByText('Mật khẩu không hợp lệ.')).toBeTruthy();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('shows "Không tìm thấy tài khoản." on 404 and stays open', async () => {
    mocks.resetUserPassword.mockRejectedValue(new AppError(ERROR_CODE.NOT_FOUND, 'Không tìm thấy tài khoản.'));
    const { onOpenChange } = renderDialog();
    fill(NEXT, NEXT);
    submit();

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith(RESET_PASSWORD_MESSAGES.NOT_FOUND));
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('keeps the dialog open with a generic toast on a network failure and never logs the password (BR-06)', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mocks.resetUserPassword.mockRejectedValue(new AppError(ERROR_CODE.NETWORK_ERROR, 'Không kết nối được máy chủ.'));
    const { onOpenChange } = renderDialog();
    fill(NEXT, NEXT);
    submit();

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith('Không kết nối được máy chủ.'));
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain(NEXT);
  });
});
