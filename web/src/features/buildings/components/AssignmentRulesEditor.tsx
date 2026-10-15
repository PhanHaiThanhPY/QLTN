import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/input';
import { ASSIGNMENT_ROLES } from '@/domain/building-config';
import { ROLE_LABEL } from '@/domain/constants';
import type { AssignmentRule, Department, Location } from '@/domain/types';

interface AssignmentRulesEditorProps {
  value: AssignmentRule[];
  departments: Department[];
  locations: Location[];
  disabled: boolean;
  onChange: (rules: AssignmentRule[]) => void;
}

const locationLabel = (location: Location): string => `${location.name} · Tầng ${location.floor}`;

/** Compact editor for department-based workflow assignment. Empty locations means the whole building. */
export const AssignmentRulesEditor = ({ value, departments, locations, disabled, onChange }: AssignmentRulesEditorProps) => {
  const add = () => {
    const role = ASSIGNMENT_ROLES.find((candidate) => !value.some((rule) => rule.role === candidate)) ?? ASSIGNMENT_ROLES[0];
    onChange([...value, { departmentId: departments[0]?.id ?? '', role, priority: Math.max(0, ...value.map((rule) => rule.priority)) + 10 }]);
  };
  const update = (index: number, patch: Partial<AssignmentRule>) => onChange(value.map((rule, rowIndex) => (rowIndex === index ? { ...rule, ...patch } : rule)));
  const updateLocations = (index: number, selected: string[]) => update(index, { locationIds: selected.length > 0 ? selected : undefined });

  return (
    <div className="space-y-3 rounded-lg border border-line bg-surface-2 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-ink">Người xử lý theo bộ phận</p>
          <p className="mt-1 text-xs text-ink-3">Hệ thống chọn người theo vai trò và bộ phận. Bỏ trống phạm vi để áp dụng toàn bộ tòa nhà.</p>
        </div>
        {disabled ? null : (
          <Button variant="secondary" size="sm" onClick={add} disabled={departments.length === 0}>
            <Plus className="h-3.5 w-3.5" />
            Thêm quy tắc
          </Button>
        )}
      </div>
      {value.length === 0 ? (
        <p className="rounded-md border border-dashed border-line-2 px-3 py-3 text-xs text-ink-3">Chưa có quy tắc. Hệ thống sẽ dùng cách chọn người theo vai trò và tòa nhà.</p>
      ) : (
        <div className="space-y-2">
          {value.map((rule, index) => (
            <div key={`${rule.role}-${rule.departmentId}-${index}`} className="grid gap-2 rounded-md border border-line bg-surface p-2 md:grid-cols-[1fr_1fr_1.4fr_auto] md:items-center">
              <NativeSelect
                aria-label={`Bộ phận quy tắc ${index + 1}`}
                value={rule.departmentId}
                disabled={disabled}
                onChange={(event) => update(index, { departmentId: event.target.value })}
              >
                <option value="">Chọn bộ phận</option>
                {departments.map((department) => <option key={department.id} value={department.id}>{department.code} · {department.name}</option>)}
              </NativeSelect>
              <NativeSelect
                aria-label={`Vai trò quy tắc ${index + 1}`}
                value={rule.role}
                disabled={disabled}
                onChange={(event) => update(index, { role: event.target.value as AssignmentRule['role'] })}
              >
                {ASSIGNMENT_ROLES.map((role) => <option key={role} value={role}>{ROLE_LABEL[role]}</option>)}
              </NativeSelect>
              <select
                multiple
                aria-label={`Phạm vi vị trí quy tắc ${index + 1}`}
                value={rule.locationIds ?? []}
                disabled={disabled}
                onChange={(event) => updateLocations(index, Array.from(event.target.selectedOptions, (option) => option.value))}
                className="min-h-9 w-full rounded-lg border border-line-2 bg-surface px-2.5 py-1 text-xs text-ink focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {locations.map((location) => <option key={location.id} value={location.id}>{locationLabel(location)}</option>)}
              </select>
              {disabled ? null : (
                <Button variant="ghost" size="icon-sm" aria-label={`Xóa quy tắc ${index + 1}`} onClick={() => onChange(value.filter((_, rowIndex) => rowIndex !== index))}>
                  <Trash2 className="h-4 w-4 text-crit" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
