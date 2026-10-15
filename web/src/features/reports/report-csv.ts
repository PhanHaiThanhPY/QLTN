import { OCCURRENCE_STATUS_LABEL, PRIORITY_LABEL, REPAIR_STATUS_LABEL } from '@/domain/constants';
import type { IsoDate } from '@/domain/types';
import type { MaintenanceReport, RepairReport } from '@/services/report-service';
import { occurrenceIndicator } from '@/services/maintenance-service';
import type { OccurrenceIndicator } from '@/services/maintenance-service';
import { buildCsv } from '@/utils/csv';
import { toVnDate } from '@/utils/date';

export interface CsvLookup {
  buildingName: (id?: string) => string;
  locationName: (id?: string) => string;
  itemName: (id?: string) => string;
}

export const INDICATOR_LABEL: Record<Exclude<OccurrenceIndicator, null>, string> = {
  OVERDUE: 'Quá hạn',
  UPCOMING: 'Sắp đến hạn',
  LATE_COMPLETION: 'Hoàn thành trễ',
} as const;

const indicatorText = (indicator: OccurrenceIndicator): string => (indicator ? INDICATOR_LABEL[indicator] : '');

/** Repair rows (records created in the period), money as plain integer VND for spreadsheets. */
export const buildRepairCsv = (report: RepairReport, lookup: CsvLookup): string =>
  buildCsv(
    [
      'Mã hồ sơ',
      'Tên hồ sơ',
      'Tòa nhà',
      'Vị trí',
      'Trạng thái',
      'Mức ưu tiên',
      'Ngày tạo',
      'Giá trị duyệt (VND)',
      'Ngày duyệt',
      'Đã thanh toán (VND)',
      'Ngày thanh toán',
    ],
    report.rows.map((row) => [
      row.record.code,
      row.record.title,
      lookup.buildingName(row.record.buildingId),
      lookup.locationName(row.record.locationId),
      REPAIR_STATUS_LABEL[row.record.status],
      PRIORITY_LABEL[row.record.priority],
      toVnDate(row.record.createdAt),
      row.approvedAmount ?? '',
      row.approvedAt ? toVnDate(row.approvedAt) : '',
      row.paidAmount || '',
      row.paidDate ?? '',
    ]),
  );

/** Maintenance occurrence rows scheduled in the period. */
export const buildMaintenanceCsv = (report: MaintenanceReport, lookup: CsvLookup, today: IsoDate): string =>
  buildCsv(
    ['Mã lượt', 'Hạng mục', 'Tòa nhà', 'Ngày dự kiến', 'Trạng thái', 'Loại lượt', 'Ngày hoàn thành', 'Chỉ báo', 'Số hồ sơ sửa chữa liên kết'],
    report.rows.map((row) => [
      row.code,
      lookup.itemName(row.itemId),
      lookup.buildingName(row.buildingId),
      row.scheduledDate,
      OCCURRENCE_STATUS_LABEL[row.status],
      row.occurrenceKind === 'MANUAL' ? 'Lượt bù thủ công' : 'Theo lịch',
      row.completedAt ? toVnDate(row.completedAt) : '',
      indicatorText(occurrenceIndicator(row, today)),
      row.repairRecordIds.length,
    ]),
  );

export const reportFileName = (prefix: string, today: IsoDate): string => `${prefix}-${today}.csv`;
