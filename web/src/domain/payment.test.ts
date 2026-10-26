import { vndInWords } from './payment';

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
