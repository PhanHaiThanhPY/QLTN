import { useState } from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input, NativeSelect } from '@/components/ui/input';
import { Sheet } from '@/components/ui/sheet';
import type { Building } from '@/domain/types';
import { DUE_FILTER_LABEL, hasFilters } from '../task-list';
import type { DueFilter, TaskFilters } from '../task-list';
import { TASK_TYPE_FILTER_LABEL } from '../task-labels';
import type { TaskTypeFilter } from '../task-labels';

interface TaskFilterBarProps {
  filters: TaskFilters;
  buildings: readonly Building[];
  labels: readonly string[];
  /** Mock mode only: the repair / maintenance filter (api mode has repair tasks only until TK-S2). */
  showSubject: boolean;
  onChange: (patch: Partial<TaskFilters>) => void;
  onClear: () => void;
}

const DUE_OPTIONS = Object.keys(DUE_FILTER_LABEL) as DueFilter[];
const SUBJECT_OPTIONS = Object.keys(TASK_TYPE_FILTER_LABEL) as TaskTypeFilter[];

/**
 * Search plus building, task and deadline filters (BR-TK-08). From 768px they sit in one row; on phones the search
 * stays and the selects move into a "Lọc" sheet (ui-brief §2.2).
 */
export const TaskFilterBar = ({ filters, buildings, labels, showSubject, onChange, onClear }: TaskFilterBarProps) => {
  const [sheetOpen, setSheetOpen] = useState(false);
  const selects = (prefix: string) => (
    <>
      <Field label="Tòa nhà" htmlFor={`${prefix}-building`}>
        <NativeSelect id={`${prefix}-building`} value={filters.buildingId} onChange={(event) => onChange({ buildingId: event.target.value })}>
          <option value="">Tất cả tòa nhà</option>
          {buildings.map((building) => <option key={building.id} value={building.id}>{building.name}</option>)}
        </NativeSelect>
      </Field>
      <Field label="Loại việc" htmlFor={`${prefix}-label`}>
        <NativeSelect id={`${prefix}-label`} value={filters.label} onChange={(event) => onChange({ label: event.target.value })}>
          <option value="">Tất cả loại việc</option>
          {labels.map((label) => <option key={label} value={label}>{label}</option>)}
        </NativeSelect>
      </Field>
      <Field label="Hạn" htmlFor={`${prefix}-due`}>
        <NativeSelect id={`${prefix}-due`} value={filters.due} onChange={(event) => onChange({ due: event.target.value as DueFilter })}>
          {DUE_OPTIONS.map((option) => <option key={option} value={option}>{DUE_FILTER_LABEL[option]}</option>)}
        </NativeSelect>
      </Field>
      {showSubject ? (
        <Field label="Nhóm" htmlFor={`${prefix}-subject`}>
          <NativeSelect id={`${prefix}-subject`} value={filters.subject} onChange={(event) => onChange({ subject: event.target.value as TaskTypeFilter })}>
            {SUBJECT_OPTIONS.map((option) => <option key={option} value={option}>{TASK_TYPE_FILTER_LABEL[option]}</option>)}
          </NativeSelect>
        </Field>
      ) : null}
    </>
  );
  const clear = hasFilters(filters) ? (
    <button type="button" onClick={onClear} className="self-end pb-2 text-sm font-semibold text-accent hover:underline">Xóa bộ lọc</button>
  ) : null;

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1.7fr)_repeat(3,minmax(10rem,1fr))_auto]">
      <Field label="Tìm kiếm" htmlFor="task-search">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
            <Input id="task-search" className="pl-9" placeholder="Tìm việc, mã hồ sơ…" value={filters.search} onChange={(event) => onChange({ search: event.target.value })} />
          </div>
          <Button variant="secondary" className="md:hidden" onClick={() => setSheetOpen(true)}>
            <SlidersHorizontal className="size-4" aria-hidden />
            Lọc
          </Button>
        </div>
      </Field>
      <div className="hidden md:contents">{selects('task')}</div>
      <div className="hidden md:flex">{clear}</div>
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen} title="Lọc công việc">
        <div className="space-y-3">
          {selects('task-sheet')}
          <div className="flex gap-2 pt-2">
            <Button variant="secondary" onClick={onClear}>Xóa bộ lọc</Button>
            <Button onClick={() => setSheetOpen(false)}>Xem kết quả</Button>
          </div>
        </div>
      </Sheet>
    </div>
  );
};
