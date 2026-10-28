// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { User } from '@/domain/types';
import { AdminViewNotice } from './AdminViewNotice';

const user = (role: User['role']): User => ({
  id: `usr-${role}`,
  code: role,
  username: role.toLowerCase(),
  fullName: role,
  role,
  buildingIds: ['bld-a'],
  active: true,
  version: 1,
});

const at = (path: string, role: User['role']) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AdminViewNotice user={user(role)} />
    </MemoryRouter>,
  );

const NOTE = 'Bạn đang xem với quyền Quản trị — chỉ xem.';

describe('AdminViewNotice (RM-S2 BR-RM2-04)', () => {
  it.each(['/exploitation/fund', '/deposits/invitations/x', '/records', '/maintenance/plans'])('shows once to ADMIN on %s', (path) => {
    at(path, 'ADMIN');
    expect(screen.getAllByText(NOTE)).toHaveLength(1);
  });

  it('stays off ADMIN system pages and off other roles', () => {
    at('/settings/buildings', 'ADMIN');
    expect(screen.queryByText(NOTE)).toBeNull();
    at('/exploitation/fund', 'OWNERS_BOARD');
    expect(screen.queryByText(NOTE)).toBeNull();
  });
});
