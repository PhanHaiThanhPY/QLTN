// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import type { User } from '@/domain/types';
import { AccountsCard } from './AccountsCard';

/** FX-S1 BR-FX1-04 / AC-FX1.4–1.5: a building-A administrator sees wider accounts, opened as "Xem" only. */
const state = vi.hoisted(() => ({ viewer: undefined as unknown }));
vi.mock('@/hooks/useCurrentUser', () => ({ useCurrentUser: () => state.viewer }));
vi.mock('../hooks/useOpenFromQuery', () => ({ useOpenFromQuery: () => undefined }));
vi.mock('./UserDialog', () => ({ UserDialog: () => null }));

const account = (code: string, role: User['role'], buildingIds: string[]): User => ({
  id: `usr-${code}`,
  code,
  username: code.toLowerCase(),
  fullName: `Họ tên ${code}`,
  role,
  buildingIds,
  active: true,
  version: 1,
});

const ADMIN_A = account('ADMIN-A', 'ADMIN', ['bld-a']);
const USERS = [account('ADMIN-DEMO', 'ADMIN', ['bld-a', 'bld-b']), account('KT-A', 'TECH_CONFIRMER', ['bld-a']), account('TVKT', 'TECH_CONSULTANT', ['bld-a', 'bld-b']), ADMIN_A];

const actionOf = (code: string): string | null => {
  const row = screen.getAllByRole('row').find((tr) => tr.firstElementChild?.textContent === code) as HTMLElement;
  return within(row).queryByRole('button')?.textContent ?? null;
};

describe('AccountsCard row action by scope (FX-S1)', () => {
  it('offers Xem on accounts wider than the viewer, Sửa inside the scope, nothing on an in-scope administrator', () => {
    state.viewer = ADMIN_A;
    render(<AccountsCard users={USERS} departments={[]} roles={[]} buildings={[]} buildingCode={(id) => id ?? ''} />);
    expect(actionOf('ADMIN-DEMO')).toBe('Xem');
    expect(actionOf('TVKT')).toBe('Xem');
    expect(actionOf('KT-A')).toBe('Sửa');
    expect(actionOf('ADMIN-A')).toBeNull();
  });
});
