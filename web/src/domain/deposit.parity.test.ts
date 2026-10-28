import * as api from '../../../api-qltn/src/domain/deposit';
import { formatRate, parseRate, termInterest } from './deposit';

/** The web previews must say what the API stores and compares (SPEC T-S1 BR-T1-06, BR-T1-08). */
describe('deposit domain parity with the API', () => {
  it('parses and formats rates the same way', () => {
    for (const text of ['5,875', '5.875', '6', '6,0', '0,05', '30', '30,001', '5,8755', '0', 'abc']) expect(parseRate(text)).toBe(api.parseRate(text));
    for (const milli of [6000, 5875, 5850, 50, 30000]) expect(formatRate(milli)).toBe(api.formatRate(milli));
  });

  it('computes the same interest of a term', () => {
    for (const [amount, rate, days, basis] of [
      [1_000_000_000n, 6000, 90, 360],
      [1_000_000_000n, 6000, 90, 365],
      [1_000n, 18000, 1, 360],
      [9_000_000_000_000_000n, 30000, 3650, 360],
    ] as const)
      expect(termInterest(amount, rate, days, basis)).toBe(api.termInterest(amount, rate, days, basis));
  });
});
