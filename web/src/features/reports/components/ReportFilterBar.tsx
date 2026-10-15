import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Filter, SlidersHorizontal, X } from 'lucide-react';
import { Field } from '@/components/ui/field';
import { Input, NativeSelect } from '@/components/ui/input';
import { Sheet } from '@/components/ui/sheet';
import { REPAIR_STATUS_LABEL, OCCURRENCE_STATUS_LABEL } from '@/domain/constants';
import type { Building } from '@/domain/types';
import type { ReportFilters } from '@/services/report-service';
import { formatDate } from '@/utils/date';

interface ReportFilterBarProps {
  filters: ReportFilters;
  buildings: Building[];
  onChange: (filters: ReportFilters) => void;
}

/** Building + date range filters; empty values mean "all". */
export const ReportFilterBar = ({ filters, buildings, onChange }: ReportFilterBarProps) => {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const update = (patch: Partial<ReportFilters>) => onChange({ ...filters, ...patch });
  const hasFilter = Boolean(filters.buildingId || filters.dateFrom || filters.dateTo || filters.repairStatus || filters.maintenanceStatus);
  const filterCount = [filters.buildingId, filters.dateFrom, filters.dateTo, filters.repairStatus, filters.maintenanceStatus].filter(Boolean).length;
  const clear = () => onChange({});
  const activeLabels = [
    filters.buildingId ? buildings.find((building) => building.id === filters.buildingId)?.name ?? filters.buildingId : undefined,
    filters.dateFrom ? `Từ ${formatDate(filters.dateFrom)}` : undefined,
    filters.dateTo ? `Đến ${formatDate(filters.dateTo)}` : undefined,
    filters.repairStatus ? REPAIR_STATUS_LABEL[filters.repairStatus] : undefined,
    filters.maintenanceStatus ? OCCURRENCE_STATUS_LABEL[filters.maintenanceStatus] : undefined,
  ].filter((label): label is string => Boolean(label));

  const renderFields = (prefix: string) => (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:items-end">
      <Field label="Tòa nhà" htmlFor={`${prefix}-report-building`}>
        <NativeSelect id={`${prefix}-report-building`} className="h-11 lg:h-9" value={filters.buildingId ?? ''} onChange={(event) => update({ buildingId: event.target.value || undefined })}>
          <option value="">Tất cả tòa nhà của tôi</option>
          {buildings.map((building) => <option key={building.id} value={building.id}>{building.name}</option>)}
        </NativeSelect>
      </Field>
      <Field label="Từ ngày" htmlFor={`${prefix}-report-from`}>
        <Input id={`${prefix}-report-from`} className="h-11 lg:h-9" type="date" value={filters.dateFrom ?? ''} max={filters.dateTo} onChange={(event) => update({ dateFrom: event.target.value || undefined })} />
      </Field>
      <Field label="Đến ngày" htmlFor={`${prefix}-report-to`}>
        <Input id={`${prefix}-report-to`} className="h-11 lg:h-9" type="date" value={filters.dateTo ?? ''} min={filters.dateFrom} onChange={(event) => update({ dateTo: event.target.value || undefined })} />
      </Field>
      <Field label="Trạng thái sửa chữa" htmlFor={`${prefix}-report-repair-status`}>
        <NativeSelect id={`${prefix}-report-repair-status`} className="h-11 lg:h-9" value={filters.repairStatus ?? ''} onChange={(event) => update({ repairStatus: event.target.value as ReportFilters['repairStatus'] || undefined })}>
          <option value="">Tất cả trạng thái</option>
          {Object.entries(REPAIR_STATUS_LABEL).map(([status, label]) => <option key={status} value={status}>{label}</option>)}
        </NativeSelect>
      </Field>
      <Field label="Trạng thái bảo trì" htmlFor={`${prefix}-report-maintenance-status`}>
        <NativeSelect id={`${prefix}-report-maintenance-status`} className="h-11 lg:h-9" value={filters.maintenanceStatus ?? ''} onChange={(event) => update({ maintenanceStatus: event.target.value as ReportFilters['maintenanceStatus'] || undefined })}>
          <option value="">Tất cả trạng thái</option>
          {Object.entries(OCCURRENCE_STATUS_LABEL).map(([status, label]) => <option key={status} value={status}>{label}</option>)}
        </NativeSelect>
      </Field>
    </div>
  );

  return (
    <div className="space-y-4 rounded-xl border border-line bg-surface p-4 shadow-none">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2"><span className="flex size-7 items-center justify-center rounded-md bg-accent-soft text-accent"><Filter className="size-4" aria-hidden /></span><div><p className="text-sm font-semibold text-ink">Bộ lọc báo cáo</p><p className="text-xs text-ink-2">Chọn phạm vi dữ liệu cần theo dõi</p></div></div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="min-h-11 lg:hidden" onClick={() => setAdvancedOpen(true)}><SlidersHorizontal className="size-4" />Bộ lọc{filterCount > 0 ? ` (${filterCount})` : ''}</Button>
          <Button variant="ghost" size="sm" disabled={!hasFilter} onClick={clear}>Xóa bộ lọc</Button>
        </div>
      </div>
      <div className="hidden lg:block">{renderFields('desktop')}</div>
      <div className="flex flex-wrap gap-2 lg:hidden">
        {activeLabels.length === 0 ? <span className="text-xs text-ink-3">Tất cả dữ liệu trong phạm vi được cấp quyền</span> : activeLabels.map((label) => <span key={label} className="inline-flex min-h-8 items-center gap-1 rounded-full bg-accent-soft px-2.5 text-xs font-medium text-accent">{label}<button type="button" className="flex size-5 items-center justify-center rounded-full hover:bg-accent/10" aria-label={`Bỏ lọc ${label}`} onClick={clear}><X className="size-3" /></button></span>)}
      </div>
      <Sheet open={advancedOpen} onOpenChange={setAdvancedOpen} placement="bottom" title="Bộ lọc báo cáo" description="Chọn phạm vi rồi đóng bảng để cập nhật báo cáo.">
        <div className="space-y-5">{renderFields('mobile')}<Button variant="navy" size="lg" className="min-h-11 w-full" onClick={() => setAdvancedOpen(false)}>Áp dụng bộ lọc</Button></div>
      </Sheet>
    </div>
  );
};
