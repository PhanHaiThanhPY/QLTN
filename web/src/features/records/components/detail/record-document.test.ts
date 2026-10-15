import { getReferenceData } from '@/services/reference-service';
import { getRecordDetail } from '@/services/records-service';
import { asUser, recordByCode, seedAt } from '@/test/helpers';
import { USER_ID } from '@/mock/seed-reference';
import { buildRepairDocumentHtml } from './record-document';

describe('repair document bundle', () => {
  it('should render the business forms from the current record snapshot', async () => {
    await seedAt();
    asUser(USER_ID.BQL_A);
    const record = await recordByCode('SC-012');
    const detail = await getRecordDetail(record.id);
    const reference = await getReferenceData();
    const html = buildRepairDocumentHtml(detail, {
      buildingName: (id) => reference.buildings.find((row) => row.id === id)?.name ?? id ?? '—',
      locationName: (id) => reference.locations.find((row) => row.id === id)?.name ?? id ?? '—',
      userName: (id) => reference.users.find((row) => row.id === id)?.fullName ?? id ?? '—',
    });

    expect(html).toContain('Biên bản hiện trạng');
    expect(html).toContain('Tờ trình và quyết định');
    expect(html).toContain('Biên bản nghiệm thu');
    expect(html).toContain('Đề nghị và chứng từ thanh toán');
    expect(html).toContain(record.code);
  });
});
