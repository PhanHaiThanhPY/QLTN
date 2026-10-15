import { USER_ID } from '@/mock/seed-reference';
import { getMaintenanceReport, getRepairReport } from '@/services/report-service';
import { asUser, SEED_DATE, seedAt } from '@/test/helpers';
import { buildMaintenanceCsv, buildRepairCsv, reportFileName } from './report-csv';

const lookup = { buildingName: (id?: string) => id ?? '', locationName: (id?: string) => id ?? '', itemName: (id?: string) => id ?? '' };

describe('report CSV export', () => {
  beforeEach(async () => {
    await seedAt();
    asUser(USER_ID.BQL_A);
  });

  it('should export one repair row per record with Vietnamese headers', async () => {
    const report = await getRepairReport({});
    const csv = buildRepairCsv(report, lookup);
    const lines = csv.split('\r\n');
    expect(lines[0]).toContain('Mã hồ sơ');
    expect(lines).toHaveLength(report.rows.length + 1);
    expect(csv).not.toContain('bld-b');
  });

  it('should export maintenance rows of the filtered period', async () => {
    const report = await getMaintenanceReport({ dateFrom: SEED_DATE, dateTo: SEED_DATE });
    const lines = buildMaintenanceCsv(report, lookup, SEED_DATE).split('\r\n');
    expect(lines[0]).toContain('Mã lượt');
    expect(lines).toHaveLength(report.rows.length + 1);
  });

  it('should name files with the date', () => {
    expect(reportFileName('bao-cao-sua-chua', '2026-10-12')).toBe('bao-cao-sua-chua-2026-10-12.csv');
  });
});
