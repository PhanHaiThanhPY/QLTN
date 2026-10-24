import { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input, NativeSelect } from '@/components/ui/input';
import { IS_API_MODE } from '@/config/data-source';
import { REPAIR_STATUS_GROUP_LABEL } from '@/domain/constants';
import type { RepairStatusGroup } from '@/domain/constants';
import type { ReferenceData } from '@/services/reference-service';
import type { RecordFilters } from '@/services/records-service';
import type { RecordFilterField } from '../../hooks/useRecordFilters';

interface RecordFiltersBarProps {
  filters: RecordFilters;
  reference: ReferenceData;
  overdueOnly: boolean;
  hasFilters: boolean;
  onChange: (field: RecordFilterField, value: string) => void;
  onClear: () => void;
}

const STATUS_GROUP_OPTIONS = Object.entries(REPAIR_STATUS_GROUP_LABEL) as [RepairStatusGroup, string][];

/** Search + filters for the record list; values live in the URL. */
export const RecordFiltersBar = ({ filters, reference, overdueOnly, hasFilters, onChange, onClear }: RecordFiltersBarProps) => {
  // Typing must not fire one request per keystroke: the URL (and therefore the query) follows after ~300 ms.
  const [search, setSearch] = useState(filters.q ?? '');
  const sentSearch = useRef(filters.q ?? '');

  useEffect(() => {
    const next = filters.q ?? '';
    if (next === sentSearch.current) return;
    sentSearch.current = next;
    setSearch(next);
  }, [filters.q]);

  useEffect(() => {
    if (search === sentSearch.current) return undefined;
    const timer = setTimeout(() => {
      sentSearch.current = search;
      onChange('q', search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, onChange]);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_minmax(12rem,1fr)_minmax(12rem,1fr)_auto]">
        <Field label="Tìm kiếm" htmlFor="record-q">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden />
            <Input
              id="record-q"
              className="pl-9"
              placeholder="Mã hoặc tên hồ sơ"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </Field>
        <Field label="Tòa nhà" htmlFor="record-building">
          <NativeSelect id="record-building" value={filters.buildingId ?? ''} onChange={(event) => onChange('buildingId', event.target.value)}>
            <option value="">Tất cả tòa nhà</option>
            {reference.buildings.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Trạng thái" htmlFor="record-status">
          <NativeSelect id="record-status" value={filters.statusGroup ?? ''} onChange={(event) => onChange('statusGroup', event.target.value)}>
            <option value="">Tất cả trạng thái</option>
            {STATUS_GROUP_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <div className="flex min-h-10 flex-wrap items-center gap-3 self-end xl:justify-end">
          {!IS_API_MODE ? (
            <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 text-sm text-ink">
              <input type="checkbox" className="size-4 accent-accent" checked={overdueOnly} onChange={(event) => onChange('overdue', event.target.checked ? '1' : '')} />
              Chỉ hồ sơ quá hạn
            </label>
          ) : null}
          {hasFilters ? (
            <Button variant="ghost" size="sm" onClick={onClear}>
              Xóa bộ lọc
            </Button>
          ) : null}
        </div>
      </div>
      {!IS_API_MODE && filters.itemLink ? (
        <div className="inline-flex max-w-full items-center gap-1 rounded-full border border-line bg-surface-2 py-1 pl-3 pr-1 text-sm text-ink">
          <span className="truncate">Đang lọc: hồ sơ chưa gắn thiết bị</span>
          <Button variant="ghost" size="icon" className="shrink-0" aria-label="Bỏ lọc hồ sơ chưa gắn thiết bị" onClick={() => onChange('itemLink', '')}>
            <X aria-hidden />
          </Button>
        </div>
      ) : null}
    </div>
  );
};
