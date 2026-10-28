import { spokenRate, termInterest } from './deposit';

describe('deposit domain (web, SPEC T-S1)', () => {
  it('reads a rate aloud (ui-brief §4)', () => {
    expect(spokenRate(6000)).toBe('sáu phẩy không phần trăm một năm');
    expect(spokenRate(5875)).toBe('năm phẩy tám bảy năm phần trăm một năm');
  });

  it('previews the D1 interest of the term', () => {
    expect(termInterest(1_000_000_000n, 6000, 90, 360)).toBe(15_000_000n);
  });
});
