import { getDb } from '@/storage/db';
import { canAccessLocation } from '@/domain/permissions';
import type { AppError } from '@/domain/errors';
import { asUser, run, seedAt } from '@/test/helpers';
import { USER_ID } from '@/mock/seed-reference';

const expectValidation = async (promise: Promise<unknown>, field: string): Promise<void> => {
  try {
    await promise;
  } catch (error) {
    const appError = error as AppError;
    expect(appError.code).toBe('VALIDATION_ERROR');
    expect(appError.fieldErrors?.[field]).toBeDefined();
    return;
  }
  throw new Error(`Expected validation error for ${field}`);
};

describe('organization and scoped employee setup', () => {
  beforeEach(async () => {
    await seedAt();
  });

  it('should seed departments and create an employee with role and location scope', async () => {
    const db = getDb();
    const departments = await db.departments.toArray();
    expect(departments.map((department) => department.code)).toEqual(expect.arrayContaining(['BQL', 'KT', 'TVKT', 'BQT']));

    asUser(USER_ID.ADMIN);
    const created = await run('createUser', 'ACCOUNT', undefined, {
      code: 'KT-A3',
      fullName: 'Nguyễn Văn Minh',
      departmentId: 'dep-technical',
      jobTitle: 'Kỹ thuật viên',
      email: 'minh@example.com',
      phone: '0901234567',
      roleDefId: 'role-tech_confirmer',
      buildingIds: ['bld-a'],
      locationIds: ['loc-a-5'],
    });
    const user = await db.users.get(created.subjectId as string);
    expect(user?.departmentId).toBe('dep-technical');
    expect(user?.locationIds).toEqual(['loc-a-5']);
    expect(canAccessLocation(user as NonNullable<typeof user>, 'bld-a', 'loc-a-5')).toBe(true);
    expect(canAccessLocation(user as NonNullable<typeof user>, 'bld-a', 'loc-a-b1')).toBe(false);
  });

  it('should let ADMIN maintain a department inside the assigned building scope', async () => {
    asUser(USER_ID.ADMIN);
    const created = await run('createDepartment', 'ACCOUNT', undefined, {
      code: 'VH',
      name: 'Vận hành',
      description: 'Theo dõi vận hành hằng ngày.',
      buildingIds: ['bld-a', 'bld-b'],
    });
    const department = await getDb().departments.get(created.subjectId as string);
    expect(department?.name).toBe('Vận hành');
    expect(department?.buildingIds).toEqual(['bld-a', 'bld-b']);
  });

  it('should require a department and keep it aligned with the employee building scope', async () => {
    asUser(USER_ID.ADMIN);
    await expectValidation(
      run('createUser', 'ACCOUNT', undefined, { code: 'KT-A4', fullName: 'Không có bộ phận', roleDefId: 'role-tech_confirmer', buildingIds: ['bld-a'] }),
      'departmentId',
    );
    const department = await run('createDepartment', 'ACCOUNT', undefined, { code: 'KTB', name: 'Kỹ thuật tòa B', buildingIds: ['bld-b'] });
    await expectValidation(
      run('createUser', 'ACCOUNT', undefined, { code: 'KT-B4', fullName: 'Sai phạm vi', departmentId: department.subjectId, roleDefId: 'role-tech_confirmer', buildingIds: ['bld-a'] }),
      'departmentId',
    );
    const scopedDepartment = await run('createDepartment', 'ACCOUNT', undefined, { code: 'KTA', name: 'Kỹ thuật tòa A', buildingIds: ['bld-a'] });
    await run('createUser', 'ACCOUNT', undefined, { code: 'KT-A6', fullName: 'Nhân viên tòa A', departmentId: scopedDepartment.subjectId, roleDefId: 'role-tech_confirmer', buildingIds: ['bld-a'] });
    await expectValidation(
      run('updateDepartment', 'ACCOUNT', scopedDepartment.subjectId, { code: 'KTA', name: 'Kỹ thuật tòa A', buildingIds: ['bld-b'] }),
      'buildingIds',
    );
  });

  it('should reject an assignee whose location scope does not cover the repair location', async () => {
    asUser(USER_ID.ADMIN);
    const created = await run('createUser', 'ACCOUNT', undefined, {
      code: 'KT-A5',
      fullName: 'Kỹ thuật khu vực mái',
      departmentId: 'dep-technical',
      roleDefId: 'role-tech_confirmer',
      buildingIds: ['bld-a'],
      locationIds: ['loc-a-roof'],
    });
    asUser(USER_ID.BQL_A);
    await expectValidation(
      run('createRecord', 'REPAIR_RECORD', undefined, {
        buildingId: 'bld-a',
        locationId: 'loc-a-5',
        confirmationUserId: created.subjectId,
        title: 'Kiểm tra khu vực không phù hợp',
        description: 'Kỹ thuật được gán sai phạm vi vị trí.',
        priority: 'NORMAL',
      }),
      'confirmationUserId',
    );
  });
});
