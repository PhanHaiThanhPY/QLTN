// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { Department, RoleDefinition, User } from '@/domain/types';
import { DepartmentDialog } from './DepartmentDialog';
import { RoleDialog } from './RoleDialog';

/** SPEC AD-S1 AC-10: the role and department dialogs carry the history block of US-S1. */
const state = vi.hoisted(() => ({ isApi: true, viewer: undefined as unknown, listAccountHistory: vi.fn() }));

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
vi.mock('@/services/command-engine', () => ({ executeCommand: vi.fn() }));
vi.mock('@/services/http/users-api', () => ({
  ACCOUNT_HISTORY_PAGE_SIZE: 20,
  listAccountHistory: state.listAccountHistory,
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

const SYSTEM_BQL: RoleDefinition = {
  id: 'rol-bql',
  code: 'BQL',
  name: 'Ban quản lý',
  baseRole: 'BQL',
  capabilities: ['VIEW', 'RECORD_EDIT'],
  isSystem: true,
  version: 1,
  createdAt: '2026-10-26T00:00:00.000Z',
  updatedAt: '2026-10-26T00:00:00.000Z',
};
const CUSTOM: RoleDefinition = { ...SYSTEM_BQL, id: 'rol-vt01', code: 'VT-01', name: 'BQL rút gọn', isSystem: false };
const DEPARTMENT: Department = { id: 'dep-kt', code: 'KT', name: 'Kỹ thuật', buildingIds: ['bld-a'], version: 2 };

const wrap = (node: ReactNode) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{node}</QueryClientProvider>,
  );
const historyToggle = () => screen.queryByRole('button', { name: /Lịch sử/ });
const row = (id: string, action: string) => ({ id, action, actorName: 'Quản trị demo', reason: '', createdAt: '2026-10-26T08:00:00.000Z' });

describe('Role and department history (AD-S1)', () => {
  beforeEach(() => {
    state.isApi = true;
    state.viewer = ADMIN;
    state.listAccountHistory.mockReset();
  });

  it('AC-10: the role dialog loads the role history with "Xem thêm"', async () => {
    state.listAccountHistory.mockResolvedValueOnce({ rows: [row('h1', 'updateRoleDef')], page: 1, totalPages: 2 });
    wrap(<RoleDialog role={CUSTOM} systemRoles={[SYSTEM_BQL]} mode="edit" onClose={() => undefined} />);
    fireEvent.click(historyToggle() as HTMLElement);
    await waitFor(() => expect(screen.getByText('Sửa vai trò')).toBeTruthy());
    expect(state.listAccountHistory).toHaveBeenCalledWith('rol-vt01', 1, 'roles');
    expect(screen.getByRole('button', { name: 'Xem thêm' })).toBeTruthy();
  });

  it('AC-10: the department dialog shows the empty state', async () => {
    state.listAccountHistory.mockResolvedValueOnce({ rows: [], page: 1, totalPages: 0 });
    wrap(<DepartmentDialog department={DEPARTMENT} buildings={[]} onClose={() => undefined} />);
    fireEvent.click(historyToggle() as HTMLElement);
    await waitFor(() => expect(screen.getByText('Chưa có lịch sử.')).toBeTruthy());
    expect(state.listAccountHistory).toHaveBeenCalledWith('dep-kt', 1, 'departments');
  });

  it('has no history when creating, copying, or in mock mode', () => {
    wrap(<RoleDialog role={SYSTEM_BQL} systemRoles={[SYSTEM_BQL]} mode="copy" onClose={() => undefined} />);
    expect(historyToggle()).toBeNull();
    wrap(<DepartmentDialog buildings={[]} onClose={() => undefined} />);
    expect(historyToggle()).toBeNull();
    state.isApi = false;
    wrap(<DepartmentDialog department={DEPARTMENT} buildings={[]} onClose={() => undefined} />);
    expect(historyToggle()).toBeNull();
  });
});
