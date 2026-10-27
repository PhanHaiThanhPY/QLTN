import { API_QUICK_FILTERS, apiAttentionItems, countApiQuickFilters, visibleApiRows, warrantyKpi } from './item-api-ui';
import { detailOf, rowOf } from './__fixtures__/api-items';

describe('equipment helpers of api mode (MT-S1)', () => {
  const rows = [
    rowOf('CAM-A01', { warranty: 'EXPIRING', needsAttention: true }),
    rowOf('BOM-A01', { openRepairCount: 1, repairCount: 2, needsAttention: true }),
    rowOf('BC-A01'),
  ];

  it('has no "Quá hạn bảo trì" view without plans (BR-MT-07)', () => {
    expect(API_QUICK_FILTERS.map((entry) => entry.label)).toEqual(['Tất cả', 'Cần xử lý', 'Đang sửa chữa', 'Sắp hết bảo hành']);
  });

  it('counts and filters by the flags the API computed', () => {
    expect(countApiQuickFilters(rows)).toEqual({ all: 3, attention: 2, repairing: 1, warranty: 1, overdue: 0 });
    expect(visibleApiRows(rows, 'repairing', 'code').map((row) => row.item.code)).toEqual(['BOM-A01']);
    expect(visibleApiRows(rows, 'all', 'code').map((row) => row.item.code)).toEqual(['BC-A01', 'BOM-A01', 'CAM-A01']);
  });

  it('prints the warranty card as days left, ended or none (BR-MT-11)', () => {
    expect(warrantyKpi('EXPIRING', '2026-11-16', '2026-10-27').value).toBe('Còn 20 ngày');
    expect(warrantyKpi('EXPIRED', '2026-01-01', '2026-10-27').value).toBe('Đã hết');
    expect(warrantyKpi('NONE', undefined, '2026-10-27').value).toBe('Không có');
  });

  it('lists open repairs, condition and warranty as needing attention (BR-MT-08)', () => {
    const items = apiAttentionItems(detailOf({}, { condition: 'NEEDS_ATTENTION', conditionNote: 'Phớt rỉ nước' }));
    expect(items.map((entry) => entry.title)).toEqual(['SC-102 đang mở', 'Tình trạng cần chú ý', 'Bảo hành sắp hết']);
    expect(items[0].to).toBe('/records/rec-h2');
  });
});
