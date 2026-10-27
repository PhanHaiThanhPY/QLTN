import { csvCell } from './audit-log.service';

describe('csvCell (FX-S3 BR-FX3-05, AC-FX3.7)', () => {
  it.each([
    ['=HYPERLINK("x")', `"'=HYPERLINK(""x"")"`],
    ['+1', "'+1"],
    ['-5', "'-5"],
    ['@a', "'@a"],
    ['\tlệnh', "'\tlệnh"],
    ['\r=1', `"'\r=1"`],
    ['abc', 'abc'],
    ['a,b', '"a,b"'],
    ['', ''],
  ])('writes %j as %j', (value, cell) => {
    expect(csvCell(value)).toBe(cell);
  });
});
