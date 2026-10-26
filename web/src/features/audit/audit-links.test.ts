import type { User } from '@/domain/types';
import { subjectLink } from './audit-links';

/** SPEC AD-S1 AC-9 / BR-06: links follow the viewer's right to open the subject's screen. */
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

describe('subjectLink', () => {
  it('lets BQL open a repair record but not an account', () => {
    const bql = userOf('BQL');
    expect(subjectLink({ subjectType: 'REPAIR_RECORD', subjectId: 'rec-1' }, bql)).toBe('/records/rec-1');
    expect(subjectLink({ subjectType: 'ACCOUNT', subjectId: 'usr-1' }, bql)).toBeNull();
  });

  it('lets ADMIN open accounts, roles, departments and building configuration', () => {
    const admin = userOf('ADMIN');
    expect(subjectLink({ subjectType: 'ACCOUNT', subjectId: 'usr-1' }, admin)).toBe('/admin/employees?open=usr-1');
    expect(subjectLink({ subjectType: 'ROLE', subjectId: 'rol-1' }, admin)).toBe('/admin/roles?open=rol-1');
    expect(subjectLink({ subjectType: 'DEPARTMENT', subjectId: 'dep-1' }, admin)).toBe('/admin/departments?open=dep-1');
    expect(subjectLink({ subjectType: 'BUILDING', subjectId: 'bld-a' }, admin)).toBe('/settings/buildings?b=bld-a');
  });

  it('shows only the code for maintenance subjects and for BQT on a building', () => {
    expect(subjectLink({ subjectType: 'MAINTENANCE_ITEM', subjectId: 'itm-1' }, userOf('ADMIN'))).toBeNull();
    expect(subjectLink({ subjectType: 'BUILDING', subjectId: 'bld-a' }, userOf('OWNERS_BOARD'))).toBeNull();
  });
});
