import { Button } from '@/components/ui/button';
import { Filter } from 'lucide-react';
import { Field } from '@/components/ui/field';
import { Input, NativeSelect } from '@/components/ui/input';
import type { Building } from '@/domain/types';
import type { ReportFilters } from '@/services/report-service';

interface ReportFilterBarProps {
  filters: ReportFilters;
  buildings: Building[];
  onChange: (filters: ReportFilters) => void;
}

/** Building + date range filters; empty values mean "all". */
export const ReportFilterBar = ({ filters, buildings, onChange }: ReportFilterBarProps) => {
  const update = (patch: Partial<ReportFilters>) => onChange({ ...filters, ...patch });
  const hasFilter = Boolean(filters.buildingId || filters.dateFrom || filters.dateTo);

  return (
    <div className="space-y-4 rounded-xl border border-line bg-surface p-4 shadow-none">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2"><span className="flex size-7 items-center justify-center rounded-md bg-accent-soft text-accent"><Filter className="size-4" aria-hidden /></span><div><p className="text-sm font-semibold text-ink">Bộ lọc báo cáo</p><p className="text-xs text-ink-2">Chọn phạm vi dữ liệu cần theo dõi</p></div></div>
        <Button variant="ghost" size="sm" disabled={!hasFilter} onClick={() => onChange({})}>Xóa bộ lọc</Button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:items-end">
        <Field label="Tòa nhà" htmlFor="report-building">
          <NativeSelect id="report-building" value={filters.buildingId ?? ''} onChange={(event) => update({ buildingId: event.target.value || undefined })}>
            <option value="">Tất cả tòa nhà của tôi</option>
            {buildings.map((building) => <option key={building.id} value={building.id}>{building.name}</option>)}
          </NativeSelect>
        </Field>
        <Field label="Từ ngày" htmlFor="report-from">
          <Input id="report-from" type="date" value={filters.dateFrom ?? ''} max={filters.dateTo} onChange={(event) => update({ dateFrom: event.target.value || undefined })} />
        </Field>
        <Field label="Đến ngày" htmlFor="report-to">
          <Input id="report-to" type="date" value={filters.dateTo ?? ''} min={filters.dateFrom} onChange={(event) => update({ dateTo: event.target.value || undefined })} />
        </Field>
      </div>
    </div>
  );
};
