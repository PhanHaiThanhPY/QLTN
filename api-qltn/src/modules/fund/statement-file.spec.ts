import { xlsxOf } from '../../../test/xlsx-fixture';
import { readCsv, readStatementFile, readXlsx, statementTemplateCsv, StatementFileError } from './statement-file';

describe('statement files (SPEC F-S4 BR-F4-02)', () => {
  it('reads CSV with a BOM, quotes and either separator', () => {
    const csv = Buffer.from(
      '﻿Ngày giao dịch,Ghi có,Nội dung\r\n18/11/2026,"10.000.000","DV-A, ""HĐ-001"""\r\n',
      'utf8',
    );
    expect(readCsv(csv)).toEqual([
      ['Ngày giao dịch', 'Ghi có', 'Nội dung'],
      ['18/11/2026', '10.000.000', 'DV-A, "HĐ-001"'],
    ]);
    expect(readCsv(Buffer.from('a;b\n1;2', 'utf8'))).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
    expect(() => readCsv(Buffer.from([0x61, 0xff, 0x62]))).toThrow(StatementFileError);
  });

  it('reads the first sheet of an XLSX with numbers kept as numbers', () => {
    const file = xlsxOf([
      ['Ngày giao dịch', 'Ghi có', 'Ghi nợ', 'Nội dung'],
      ['18/11/2026', 10000000, null, 'DV-A & co'],
      [46348, null, 2000000.5, 'Nộp thuế'],
    ]);
    expect(readXlsx(file)).toEqual([
      ['Ngày giao dịch', 'Ghi có', 'Ghi nợ', 'Nội dung'],
      ['18/11/2026', 10000000, null, 'DV-A & co'],
      [46348, null, 2000000.5, 'Nộp thuế'],
    ]);
    expect(readStatementFile(file)[1][1]).toBe(10000000);
  });

  it('offers a template with the standard header and two examples', () => {
    const [header, ...examples] = readCsv(statementTemplateCsv());
    expect(header).toEqual(['Ngày giao dịch', 'Ghi có', 'Ghi nợ', 'Nội dung', 'Số tham chiếu', 'Số tài khoản']);
    expect(examples).toHaveLength(2);
  });
});
