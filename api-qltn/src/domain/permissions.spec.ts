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

  it('shows exploitation bids to BQL and BQT only, and lets only BQL manage them (F-S1 BR-F1-11)', () => {
    expect(ROLES.filter((role) => roleCapabilities(role).includes(CAPABILITY.EXPLOITATION_VIEW))).toEqual([
      'BQL',
      'OWNERS_BOARD',
    ]);
    expect(ROLES.filter((role) => roleCapabilities(role).includes(CAPABILITY.EXPLOITATION_MANAGE))).toEqual(['BQL']);
  });

  it('lets BQT approve selections and BQL, BQT and Kế toán see contracts (F-S2 BR-F2-13)', () => {
    expect(ROLES.filter((role) => roleCapabilities(role).includes(CAPABILITY.EXPLOITATION_APPROVE))).toEqual([
      'OWNERS_BOARD',
    ]);
    expect(ROLES.filter((role) => roleCapabilities(role).includes(CAPABILITY.EXPLOITATION_CONTRACT_VIEW))).toEqual([
      'BQL',
      'OWNERS_BOARD',
      'ACCOUNTANT',
    ]);
  });

  it('lets Kế toán and BQT read the fund and only BQT approve (F-S3 BR-F3-14, D-F3-6)', () => {
    expect(ROLES.filter((role) => roleCapabilities(role).includes(CAPABILITY.FUND_VIEW))).toEqual([
      'OWNERS_BOARD',
      'ACCOUNTANT',
    ]);
    expect(ROLES.filter((role) => roleCapabilities(role).includes(CAPABILITY.FUND_APPROVE))).toEqual(['OWNERS_BOARD']);
    expect(ROLES.filter((role) => roleCapabilities(role).includes(CAPABILITY.FUND_OPERATE))).toEqual(['ACCOUNTANT']);
    // F-S5 BR-F5-15, D-F5-5: the fund report is for BQT and Kế toán.
    expect(ROLES.filter((role) => roleCapabilities(role).includes(CAPABILITY.FUND_REPORT))).toEqual([
      'OWNERS_BOARD',
      'ACCOUNTANT',
    ]);
  });

  it('lets ADMIN, BQL, BQT and Kế toán see deposits, BQL write and BQT approve (T-S1 BR-T1-12, RM-S2 BR-RM2-02)', () => {
    expect(ROLES.filter((role) => roleCapabilities(role).includes(CAPABILITY.DEPOSIT_VIEW))).toEqual([
      'ADMIN',
      'BQL',
      'OWNERS_BOARD',
      'ACCOUNTANT',
    ]);
    expect(ROLES.filter((role) => roleCapabilities(role).includes(CAPABILITY.DEPOSIT_MANAGE))).toEqual(['BQL']);
    expect(ROLES.filter((role) => roleCapabilities(role).includes(CAPABILITY.DEPOSIT_APPROVE))).toEqual([
      'OWNERS_BOARD',
    ]);
  });

  describe('matrix v2 (ADR-0001, SPEC RM-S1)', () => {
    it('gives the building configuration to ADMIN only and the locations to ADMIN and BQL (DF-11)', () => {
      const withConfig = ROLES.filter((role) => roleCapabilities(role).includes(CAPABILITY.BUILDING_CONFIG));
      const withLocations = ROLES.filter((role) => roleCapabilities(role).includes(CAPABILITY.LOCATION_MANAGE));
      expect(withConfig).toEqual(['ADMIN']);
      expect(withLocations).toEqual(['ADMIN', 'BQL']);
    });

    it('defines Kế toán with VIEW, REPORT_VIEW, PAYMENT_CONFIRM, FUND_OPERATE (BR-02), contracts (F-S2) and the fund (F-S3)', () => {
      expect([...roleCapabilities('ACCOUNTANT')].sort()).toEqual(
        [
          'DEPOSIT_VIEW',
          'EXPLOITATION_CONTRACT_VIEW',
          'FUND_OPERATE',
          'FUND_REPORT',
          'FUND_VIEW',
          'PAYMENT_CONFIRM',
          'REPORT_VIEW',
          'VIEW',
        ].sort(),
      );
    });

    it('lets TVKT and BQT confirm the site condition and BQL, BQT accept (DF-01, DF-06)', () => {
      expect(roleCapabilities('TECH_CONSULTANT')).toContain(CAPABILITY.RECORD_CONFIRM);
      expect(roleCapabilities('OWNERS_BOARD')).toContain(CAPABILITY.RECORD_CONFIRM);
      expect(roleCapabilities('OWNERS_BOARD')).toContain(CAPABILITY.ACCEPTANCE_DECIDE);
      expect(roleCapabilities('BQL')).toContain(CAPABILITY.ACCEPTANCE_DECIDE);
    });

    it('lets only BQT and Kế toán confirm transfers and only Kế toán run fund operations (DF-08, DF-10)', () => {
      expect(ROLES.filter((role) => roleCapabilities(role).includes(CAPABILITY.PAYMENT_CONFIRM))).toEqual([
        'OWNERS_BOARD',
        'ACCOUNTANT',
      ]);
      expect(ROLES.filter((role) => roleCapabilities(role).includes(CAPABILITY.FUND_OPERATE))).toEqual(['ACCOUNTANT']);
    });
  });

  it('gives the operation log to ADMIN, BQL and BQT only (AD-S1 BR-01)', () => {
    expect(ROLES.filter((role) => roleCapabilities(role).includes(CAPABILITY.AUDIT_VIEW))).toEqual([
      'ADMIN',
      'BQL',
      'OWNERS_BOARD',
    ]);
  });

  it('recognises only system roles', () => {
    expect(isRole('BQL')).toBe(true);
    expect(isRole('OWNER')).toBe(false);
    expect(isRole(undefined)).toBe(false);
  });
});
