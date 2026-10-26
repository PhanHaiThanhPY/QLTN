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
});
