import type { User } from '@/domain/types';
import { visibleNavItems } from './navigation';

/** SPEC RM-S1 AC-1.7: building configuration is ADMIN only; BQL keeps the locations (DF-11). */
const userOf = (role: User['role']): User => ({
  id: `usr-${role}`,
  code: role,
  username: role.toLowerCase(),
  fullName: role,
  role,
  buildingIds: ['bld-a'],
  active: true,
  version: 1,
});

const CONFIG = 'Tòa nhà và cấu hình';
const WORKFLOW = 'Workflow Engine';
const LOCATIONS = 'Tầng, khu vực, vị trí';

describe('visibleNavItems', () => {
  it.each([true, false])('hides configuration and workflow from BQL but keeps locations (api mode = %s)', (apiMode) => {
    const labels = visibleNavItems(userOf('BQL'), apiMode).map((item) => item.label);
    expect(labels).toContain(LOCATIONS);
    expect(labels).not.toContain(CONFIG);
    expect(labels).not.toContain(WORKFLOW);
  });

  it.each([true, false])('shows all three entries to ADMIN (api mode = %s)', (apiMode) => {
    const labels = visibleNavItems(userOf('ADMIN'), apiMode).map((item) => item.label);
    expect(labels).toEqual(expect.arrayContaining([CONFIG, WORKFLOW, LOCATIONS]));
  });

  it('shows none of them to Kế toán', () => {
    const labels = visibleNavItems(userOf('ACCOUNTANT'), true).map((item) => item.label);
    expect(labels).not.toContain(CONFIG);
    expect(labels).not.toContain(LOCATIONS);
  });

  describe('Nhật ký thao tác (SPEC AD-S1 AC-8)', () => {
    const AUDIT = 'Nhật ký thao tác';
    const labelsOf = (role: User['role'], apiMode: boolean) => visibleNavItems(userOf(role), apiMode).map((item) => item.label);

    it.each(['ADMIN', 'BQL', 'OWNERS_BOARD'] as const)('shows the entry to %s in api mode, next to Báo cáo', (role) => {
      const items = visibleNavItems(userOf(role), true);
      const audit = items.find((item) => item.label === AUDIT);
      expect(audit).toMatchObject({ to: '/audit', group: 'Theo dõi' });
    });

    it.each(['TECH_CONFIRMER', 'TECH_CONSULTANT', 'ACCOUNTANT'] as const)('hides the entry from %s', (role) => {
      expect(labelsOf(role, true)).not.toContain(AUDIT);
    });

    it('never shows the entry in mock mode', () => {
      expect(labelsOf('ADMIN', false)).not.toContain(AUDIT);
    });
  });
});
