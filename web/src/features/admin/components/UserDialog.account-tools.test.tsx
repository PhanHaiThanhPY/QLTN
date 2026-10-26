// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { User } from '@/domain/types';
import { UserDialog } from './UserDialog';

/** SPEC US-S1 AC-5: where the "Đặt lại mật khẩu" button and the history block appear. */
const state = vi.hoisted(() => ({ isApi: true, viewer: undefined as unknown }));

vi.mock('@/config/data-source', () => ({
  get DATA_SOURCE() {
    return state.isApi ? 'api' : 'mock';
  },
  get IS_API_MODE() {
    return state.isApi;
  },
  API_BASE_URL: '/api',
}));
vi.mock('@/hooks/useCurrentUser', () => ({ useCurrentUser: () => state.viewer }));
vi.mock('@/hooks/useReferenceData', () => ({ useReferenceData: () => ({ data: undefined, isLoading: false }) }));
vi.mock('@/services/command-engine', () => ({ executeCommand: vi.fn() }));
vi.mock('@/services/http/users-api', () => ({
  ACCOUNT_HISTORY_PAGE_SIZE: 20,
  listAccountHistory: vi.fn(),
  resetUserPassword: vi.fn(),
}));

const ADMIN: User = {
  id: 'usr-admin',
  code: 'ADMIN-DEMO',
  username: 'admin-demo',
  fullName: 'Quản trị demo',
  role: 'ADMIN',
  buildingIds: ['bld-a'],
  active: true,
  version: 1,
};

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

const renderDialog = (user?: User) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <UserDialog user={user} departments={[]} roles={[]} onClose={() => undefined} />
    </QueryClientProvider>,
  );

const resetButton = () => screen.queryByRole('button', { name: /Đặt lại mật khẩu/ });
const historyToggle = () => screen.queryByRole('button', { name: /Lịch sử/ });

describe('UserDialog account tools (US-S1)', () => {
  beforeEach(() => {
    state.isApi = true;
    state.viewer = ADMIN;
  });

  it('AC-5: shows the reset button and the history when an administrator edits another account in api mode', () => {
    renderDialog(EMPLOYEE);
    expect(resetButton()).toBeTruthy();
    expect(historyToggle()).toBeTruthy();
  });

  it('AC-5: hides the reset button when creating an account', () => {
    renderDialog();
    expect(resetButton()).toBeNull();
    expect(historyToggle()).toBeNull();
  });

  it('AC-5: hides the reset button on the signed-in account itself but keeps its history', () => {
    renderDialog(ADMIN);
    expect(resetButton()).toBeNull();
    expect(historyToggle()).toBeTruthy();
  });

  it('AC-5: hides both in mock mode', () => {
    state.isApi = false;
    renderDialog(EMPLOYEE);
    expect(resetButton()).toBeNull();
    expect(historyToggle()).toBeNull();
  });

  it('hides the reset button for a viewer without ACCOUNT_MANAGE', () => {
    state.viewer = { ...ADMIN, capabilities: ['VIEW', 'ADMIN_VIEW'] };
    renderDialog(EMPLOYEE);
    expect(resetButton()).toBeNull();
    expect(historyToggle()).toBeTruthy();
  });
});
