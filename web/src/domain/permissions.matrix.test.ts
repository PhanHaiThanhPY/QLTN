import { adminMatrixProblems, CAPABILITY, roleCapabilities } from './permissions';

const CAPABILITIES = Object.values(CAPABILITY);

/** RM-S2 BR-RM2-02 on the web mirror: what the menu and buttons are built from follows the same rule as the API. */
describe('ADMIN reads everything, writes nothing (RM-S2 BR-RM2-02)', () => {
  it('holds for the web matrix and fails on a view capability left off ADMIN', () => {
    expect(adminMatrixProblems(CAPABILITIES, roleCapabilities('ADMIN'))).toEqual([]);
    expect(adminMatrixProblems([...CAPABILITIES, 'X_VIEW'], roleCapabilities('ADMIN'))).toEqual(['ADMIN thiếu X_VIEW']);
  });
});
