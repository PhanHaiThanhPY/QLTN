import * as api from '../../../api-qltn/src/domain/permissions';
import { ROLE } from './constants';
import { CAPABILITY, roleCapabilities } from './permissions';

/**
 * SPEC RM-S1 AC-1.1 / BR-01: the web mirror must grant exactly what api-qltn enforces (ADR-0001 §3).
 * The backend file has no imports, so it is read straight from the repository.
 */
describe('role matrix parity with api-qltn', () => {
  it('declares the same roles and capabilities', () => {
    expect(Object.values(ROLE).sort()).toEqual([...api.ROLES].sort());
    expect(Object.values(CAPABILITY).sort()).toEqual([...api.CAPABILITIES].sort());
  });

  it.each(Object.values(ROLE))('grants %s the same capabilities in the same order', (role) => {
    expect([...roleCapabilities(role)]).toEqual([...api.roleCapabilities(role)]);
  });
});
