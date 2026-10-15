import { buildCsv, csvCell } from './csv';

describe('csv', () => {
  it('should neutralize formula-looking cells', () => {
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(csvCell('+84')).toBe("'+84");
    expect(csvCell('@cmd')).toBe("'@cmd");
  });

  it('should escape quotes, commas and newlines', () => {
    expect(csvCell('a,"b"\nc')).toBe('"a,""b""\nc"');
  });

  it('should start with a UTF-8 BOM', () => {
    expect(buildCsv(['Mã'], [['SC-001']]).startsWith('﻿')).toBe(true);
  });
});
