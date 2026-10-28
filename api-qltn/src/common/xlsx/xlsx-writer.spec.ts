import { readXlsx } from '../../modules/fund/statement-file';
import { writeXlsx } from './xlsx-writer';

describe('xlsx writer (SPEC F-S5 BR-F5-05)', () => {
  it('writes sheets that read back with money as numbers in the thousands format', () => {
    const file = writeXlsx([
      {
        name: 'Tổng hợp',
        rows: [
          ['Đầu kỳ', { money: '50000000' }],
          ['Ghi chú', 'A & B <c>'],
        ],
      },
      { name: 'Chi tiết sổ', rows: [['Mã'], ['PT-001']] },
    ]);
    expect(readXlsx(file)).toEqual([
      ['Đầu kỳ', 50000000],
      ['Ghi chú', 'A & B <c>'],
    ]);
    const text = file.toString('latin1');
    expect(text.includes('xl/worksheets/sheet2.xml')).toBe(true);
  });
});
