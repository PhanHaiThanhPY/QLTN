import { settlementInstalment } from './payment-settlement';

describe('settlement instalment (FX-S2 BR-FX2-01/02, AC-FX2.5)', () => {
  it('is the settled total minus the transferred advances when it is larger', () => {
    expect(settlementInstalment(10_000_000n, 4_000_000n)).toEqual({ ok: true, amount: 6_000_000n });
    expect(settlementInstalment(9_000_000n, 0n)).toEqual({ ok: true, amount: 9_000_000n });
  });

  it('is 0 when the advances already cover the settled total', () => {
    expect(settlementInstalment(10_000_000n, 10_000_000n)).toEqual({ ok: true, amount: 0n });
  });

  it('refuses a settled total below the transferred advances', () => {
    expect(settlementInstalment(9_000_000n, 10_000_000n)).toEqual({ ok: false, reason: 'below_advances' });
  });

  it('stays exact beyond the float range', () => {
    expect(settlementInstalment(999_999_999_999_999n, 1n)).toEqual({ ok: true, amount: 999_999_999_999_998n });
  });
});
