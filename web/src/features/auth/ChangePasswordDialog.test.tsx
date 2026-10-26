// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { AppError, ERROR_CODE } from '@/domain/errors';
import { CHANGE_PASSWORD_MESSAGES, ChangePasswordDialog } from './ChangePasswordDialog';

/** SPEC AU-S1: client rules (AC-2) and the outcome of each API answer (AC-5, AC-6, AC-7). */
const mocks = vi.hoisted(() => ({
  changeOwnPassword: vi.fn(),
  signOut: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('@/services/http/auth-api', () => ({ changeOwnPassword: mocks.changeOwnPassword }));
vi.mock('@/store/session-store', () => ({
  useSessionStore: (select: (state: { signOut: () => Promise<void> }) => unknown) => select({ signOut: mocks.signOut }),
}));
vi.mock('sonner', () => ({ toast: { success: mocks.toastSuccess, error: mocks.toastError } }));

const CURRENT = 'Mat-khau-cu-1';
const NEXT = 'Mat-khau-moi-2';

const renderDialog = () => {
  const onOpenChange = vi.fn();
  render(
    <MemoryRouter initialEntries={['/records']}>
      <Routes>
        <Route path="/records" element={<ChangePasswordDialog open onOpenChange={onOpenChange} />} />
        <Route path="/login" element={<p>Trang đăng nhập</p>} />
      </Routes>
    </MemoryRouter>,
  );
  return { onOpenChange };
};

const fill = (values: { current?: string; next?: string; confirm?: string }) => {
  fireEvent.change(screen.getByLabelText(/Mật khẩu hiện tại/), { target: { value: values.current ?? '' } });
  fireEvent.change(screen.getByLabelText(/^Mật khẩu mới/), { target: { value: values.next ?? '' } });
  fireEvent.change(screen.getByLabelText(/Nhập lại mật khẩu mới/), { target: { value: values.confirm ?? '' } });
};

const save = () => fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));

describe('ChangePasswordDialog', () => {
  beforeEach(() => {
    mocks.changeOwnPassword.mockReset();
    mocks.signOut.mockReset().mockResolvedValue(undefined);
    mocks.toastSuccess.mockReset();
    mocks.toastError.mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it.each([
    ['an empty field', { current: CURRENT, next: '', confirm: '' }, 'Vui lòng nhập mật khẩu mới.'],
    ['a new password under 8 characters', { current: CURRENT, next: 'Ngan-7c', confirm: 'Ngan-7c' }, CHANGE_PASSWORD_MESSAGES.LENGTH],
    ['a new password over 72 characters', { current: CURRENT, next: 'x'.repeat(73), confirm: 'x'.repeat(73) }, CHANGE_PASSWORD_MESSAGES.LENGTH],
    ['a confirmation that does not match', { current: CURRENT, next: NEXT, confirm: `${NEXT}x` }, CHANGE_PASSWORD_MESSAGES.MISMATCH],
    ['a new password equal to the current one', { current: CURRENT, next: CURRENT, confirm: CURRENT }, CHANGE_PASSWORD_MESSAGES.SAME_AS_CURRENT],
  ])('AC-2: refuses %s under the right field without calling the API', async (_case, values, message) => {
    renderDialog();
    fill(values);
    save();

    expect(await screen.findByText(message)).toBeTruthy();
    expect(mocks.changeOwnPassword).not.toHaveBeenCalled();
  });

  it('AC-2: refuses an empty current password', async () => {
    renderDialog();
    fill({ next: NEXT, confirm: NEXT });
    save();

    expect(await screen.findByText('Vui lòng nhập mật khẩu hiện tại.')).toBeTruthy();
    expect(mocks.changeOwnPassword).not.toHaveBeenCalled();
  });

  it('AC-5: shows a wrong current password under its field and keeps the form and the session', async () => {
    mocks.changeOwnPassword.mockRejectedValue(
      new AppError(ERROR_CODE.VALIDATION_ERROR, 'Mật khẩu hiện tại không đúng.', {
        currentPassword: 'Mật khẩu hiện tại không đúng.',
      }),
    );
    const { onOpenChange } = renderDialog();
    fill({ current: 'sai-mat-khau', next: NEXT, confirm: NEXT });
    save();

    expect(await screen.findByText('Mật khẩu hiện tại không đúng.')).toBeTruthy();
    expect(mocks.changeOwnPassword).toHaveBeenCalledWith('sai-mat-khau', NEXT);
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect((screen.getByLabelText(/^Mật khẩu mới/) as HTMLInputElement).value).toBe(NEXT);
  });

  it('AC-6: on success drops the local session, goes to /login and confirms with a toast', async () => {
    mocks.changeOwnPassword.mockResolvedValue(undefined);
    renderDialog();
    fill({ current: CURRENT, next: NEXT, confirm: NEXT });
    save();

    expect(await screen.findByText('Trang đăng nhập')).toBeTruthy();
    expect(mocks.changeOwnPassword).toHaveBeenCalledWith(CURRENT, NEXT);
    expect(mocks.signOut).toHaveBeenCalledTimes(1);
    expect(mocks.toastSuccess).toHaveBeenCalledWith(CHANGE_PASSWORD_MESSAGES.SUCCESS);
  });

  it('AC-7: on 429 shows the rate-limit toast and keeps the form open', async () => {
    mocks.changeOwnPassword.mockRejectedValue(new AppError(ERROR_CODE.RATE_LIMITED, 'Too many requests'));
    const { onOpenChange } = renderDialog();
    fill({ current: CURRENT, next: NEXT, confirm: NEXT });
    save();

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith(CHANGE_PASSWORD_MESSAGES.RATE_LIMITED));
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(screen.getByRole('button', { name: 'Lưu' })).toBeTruthy();
  });

  it('keeps the form open with a generic toast on a network failure', async () => {
    mocks.changeOwnPassword.mockRejectedValue(new AppError(ERROR_CODE.NETWORK_ERROR, 'Không kết nối được máy chủ.'));
    renderDialog();
    fill({ current: CURRENT, next: NEXT, confirm: NEXT });
    save();

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith('Không kết nối được máy chủ.'));
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it('never logs a password when the call fails (BR-05)', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mocks.changeOwnPassword.mockRejectedValue(new AppError(ERROR_CODE.NETWORK_ERROR, 'Không kết nối được máy chủ.'));
    renderDialog();
    fill({ current: CURRENT, next: NEXT, confirm: NEXT });
    save();

    await waitFor(() => expect(consoleError).toHaveBeenCalled());
    const logged = JSON.stringify(consoleError.mock.calls);
    expect(logged).not.toContain(CURRENT);
    expect(logged).not.toContain(NEXT);
  });
});
