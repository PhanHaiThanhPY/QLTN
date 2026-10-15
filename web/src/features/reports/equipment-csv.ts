import { ITEM_CONDITION_LABEL, REPAIR_STATUS_LABEL } from '@/domain/constants';
import type { EquipmentHistory, EquipmentReport } from '@/services/equipment-report-service';
import { buildCsv } from '@/utils/csv';
import { toVnDate } from '@/utils/date';
import type { CsvLookup } from './report-csv';

/** One row per item; money as plain integer VND for spreadsheets. */
export const buildEquipmentCsv = (report: EquipmentReport, lookup: CsvLookup): string =>
  buildCsv(
    ['Mã thiết bị', 'Tên thiết bị', 'Loại', 'Tòa nhà', 'Vị trí', 'Tình trạng', 'Số lần sửa (trong kỳ)', 'Tổng số lần sửa', 'Đang sửa', 'Lần sửa gần nhất', 'Chi phí trong kỳ (VND)', 'Tổng chi phí (VND)', 'Hỏng lặp lại'],
    report.items.map((row) => [
      row.item.code,
      row.item.name,
      row.item.type,
      lookup.buildingName(row.item.buildingId),
      lookup.locationName(row.item.locationId),
      ITEM_CONDITION_LABEL[row.item.condition],
      row.repairCount,
      row.repairCountTotal,
      row.openRepairCount,
      row.lastRepairAt ? toVnDate(row.lastRepairAt) : '',
      row.cost,
      row.costTotal,
      row.isRepeated ? 'Có' : '',
    ]),
  );

/** Every repair of one item with what was done, by whom, when and for how much. */
export const buildEquipmentHistoryCsv = (history: EquipmentHistory): string =>
  buildCsv(
    ['Mã hồ sơ', 'Ngày báo hỏng', 'Tên hồ sơ', 'Hiện tượng', 'Phương án', 'Nhà thầu', 'Chi phí duyệt (VND)', 'Ngày duyệt', 'Bắt đầu thi công', 'Số lần nghiệm thu không đạt', 'Ngày hoàn tất', 'Số ngày xử lý', 'Trạng thái'],
    history.repairs.map((entry) => [
      entry.record.code,
      toVnDate(entry.record.createdAt),
      entry.record.title,
      entry.record.description,
      entry.proposal ?? '',
      entry.contractorName ?? '',
      entry.approvedAmount ?? '',
      entry.approvedAt ? toVnDate(entry.approvedAt) : '',
      entry.constructionStart ?? '',
      entry.acceptanceRounds.filter((round) => round.result === 'FAILED').length,
      entry.record.status === 'COMPLETED' && entry.record.closedAt ? toVnDate(entry.record.closedAt) : '',
      entry.durationDays ?? '',
      REPAIR_STATUS_LABEL[entry.record.status],
    ]),
  );
