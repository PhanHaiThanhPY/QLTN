// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { User } from '@/domain/types';
import { SidebarUser } from './SidebarUser';

/** SPEC AU-S1 AC-1: "Đổi mật khẩu" exists in api mode only, with the sidebar expanded or collapsed. */
const dataSource = vi.hoisted(() => ({ isApi: true }));

vi.mock('@/config/data-source', () => ({
  get DATA_SOURCE() {
    return dataSource.isApi ? 'api' : 'mock';
  },
  get IS_API_MODE() {
    return dataSource.isApi;
  },
  API_BASE_URL: '/api',
}));

const USER = { id: 'usr-1', code: 'KT-A2', fullName: 'Lê Văn Kỹ', role: 'TECH_CONFIRMER' } as User;

const renderUser = (isCollapsed: boolean) =>
  render(
    <MemoryRouter>
      <TooltipProvider>
        <SidebarUser user={USER} isCollapsed={isCollapsed} />
      </TooltipProvider>
    </MemoryRouter>,
  );

describe('SidebarUser', () => {
  it.each([false, true])('AC-1: shows "Đổi mật khẩu" in api mode (collapsed = %s)', (isCollapsed) => {
    dataSource.isApi = true;
    renderUser(isCollapsed);

    expect(screen.getByRole('button', { name: 'Đổi mật khẩu' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Đăng xuất' })).toBeTruthy();
  });

  it.each([false, true])('AC-1: hides "Đổi mật khẩu" in mock mode (collapsed = %s)', (isCollapsed) => {
    dataSource.isApi = false;
    renderUser(isCollapsed);

    expect(screen.queryByRole('button', { name: 'Đổi mật khẩu' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Đổi tài khoản demo' })).toBeTruthy();
  });
});
