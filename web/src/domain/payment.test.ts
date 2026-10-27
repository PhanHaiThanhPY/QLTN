import { instalmentStatusLabel, isNoTransferInstalment, vndInWords } from './payment';

describe('vndInWords (SPEC B03–B09 v2 §4.4)', () => {
  it.each([
    ['4000000', 'Bốn triệu đồng'],
    ['6000000', 'Sáu triệu đồng'],
    ['10000000', 'Mười triệu đồng'],
    ['3146000', 'Ba triệu một trăm bốn mươi sáu nghìn đồng'],
    ['1005000', 'Một triệu không trăm lẻ năm nghìn đồng'],
    ['215', 'Hai trăm mười lăm đồng'],
    ['21', 'Hai mươi mốt đồng'],
    ['1500000000', 'Một tỷ năm trăm triệu đồng'],
    ['0', 'Không đồng'],
  ])('reads %s', (value, words) => {
    expect(vndInWords(value)).toBe(words);
  });
});

describe('0-đồng settlement instalment (FX-S2 BR-FX2-04/06)', () => {
  it('needs no transfer only for a settlement of 0', () => {
    expect(isNoTransferInstalment({ kind: 'QUYET_TOAN', amountVnd: '0' })).toBe(true);
    expect(isNoTransferInstalment({ kind: 'QUYET_TOAN', amountVnd: '6000000' })).toBe(false);
    expect(isNoTransferInstalment({ kind: 'TAM_UNG', amountVnd: '0' })).toBe(false);
  });

  it('reads "Không cần chuyển khoản" once done, the usual label otherwise', () => {
    expect(instalmentStatusLabel({ kind: 'QUYET_TOAN', amountVnd: '0', status: 'TRANSFERRED' })).toBe('Không cần chuyển khoản');
    expect(instalmentStatusLabel({ kind: 'QUYET_TOAN', amountVnd: '0', status: 'PENDING_APPROVAL' })).toBe('Chờ duyệt');
    expect(instalmentStatusLabel({ kind: 'QUYET_TOAN', amountVnd: '6000000', status: 'TRANSFERRED' })).toBe('Đã chuyển khoản');
  });
});
