import { CAPABILITY, type Capability, effectiveCapabilities, isRole, ROLES, roleCapabilities } from './permissions';

describe('permissions', () => {
  it('never gives ADMIN a business decision capability', () => {
    const decisions: Capability[] = [
      CAPABILITY.RECORD_CONFIRM,
      CAPABILITY.PROPOSAL_DECIDE,
      CAPABILITY.ACCEPTANCE_DECIDE,
      CAPABILITY.PAYMENT_DECIDE,
      CAPABILITY.MAINTENANCE_REVIEW,
    ];
    expect(roleCapabilities('ADMIN').filter((c) => decisions.includes(c))).toEqual([]);
  });

  it('grants every role VIEW', () => {
    for (const role of ROLES) expect(roleCapabilities(role)).toContain(CAPABILITY.VIEW);
  });

  it('returns the full role set when no custom role is assigned', () => {
    expect(effectiveCapabilities('BQL', null)).toEqual([...roleCapabilities('BQL')]);
  });

  it('lets a custom role only narrow, never widen, the system role', () => {
    const custom = [CAPABILITY.VIEW, CAPABILITY.RECORD_EDIT, CAPABILITY.PAYMENT_DECIDE];
    expect(effectiveCapabilities('BQL', custom)).toEqual([CAPABILITY.VIEW, CAPABILITY.RECORD_EDIT]);
  });

  it('recognises only system roles', () => {
    expect(isRole('BQL')).toBe(true);
    expect(isRole('OWNER')).toBe(false);
    expect(isRole(undefined)).toBe(false);
  });
});
