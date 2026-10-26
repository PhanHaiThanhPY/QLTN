import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input, NativeSelect } from '@/components/ui/input';
import {
  AUDIT_ACTION_LABEL,
  AUDIT_ACTIONS_BY_SUBJECT,
  AUDIT_SUBJECT_LABEL,
  auditActionLabel,
} from '@/domain/audit-labels';
import type { ReferenceData } from '@/services/reference-service';
import type { AuditLogFilters } from '@/services/http/audit-log-api';

interface AuditFiltersBarProps {
  filters: AuditLogFilters;
  reference: ReferenceData | undefined;
  onChange: (patch: Partial<AuditLogFilters>) => void;
  onReset: () => void;
}

/** Subjects the API serves; maintenance subjects appear in rows only once their module is connected. */
const SUBJECT_OPTIONS = ['REPAIR_RECORD', 'BUILDING', 'ACCOUNT', 'ROLE', 'DEPARTMENT'] as const;
const ALL_ACTIONS = Object.keys(AUDIT_ACTION_LABEL);

/** Filters of the operation log (SPEC AD-S1 §3 step 3); every change goes back to page 1 in the parent. */
export const AuditFiltersBar = ({ filters, reference, onChange, onReset }: AuditFiltersBarProps) => {
  const [code, setCode] = useState(filters.subjectCode);
  const actions = filters.subjectType ? (AUDIT_ACTIONS_BY_SUBJECT[filters.subjectType] ?? []) : ALL_ACTIONS;
  const applyCode = () => {
    if (code.trim() !== filters.subjectCode) onChange({ subjectCode: code.trim() });
  };

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Field label="Tòa nhà" htmlFor="audit-building">
        <NativeSelect id="audit-building" value={filters.buildingId} onChange={(event) => onChange({ buildingId: event.target.value })}>
          <option value="">Tất cả tòa trong phạm vi</option>
          {(reference?.buildings ?? []).map((building) => (
            <option key={building.id} value={building.id}>
              {building.code} – {building.name}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Từ ngày" htmlFor="audit-from">
        <Input id="audit-from" type="date" value={filters.dateFrom} onChange={(event) => onChange({ dateFrom: event.target.value })} />
      </Field>
      <Field label="Đến ngày" htmlFor="audit-to" hint="Tối đa 366 ngày.">
        <Input id="audit-to" type="date" value={filters.dateTo} onChange={(event) => onChange({ dateTo: event.target.value })} />
      </Field>
      <Field label="Người thực hiện" htmlFor="audit-actor">
        <NativeSelect id="audit-actor" value={filters.actorId} onChange={(event) => onChange({ actorId: event.target.value })}>
          <option value="">Tất cả</option>
          {(reference?.users ?? []).map((user) => (
            <option key={user.id} value={user.id}>
              {user.fullName} ({user.code})
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Loại đối tượng" htmlFor="audit-subject">
        <NativeSelect
          id="audit-subject"
          value={filters.subjectType}
          onChange={(event) => onChange({ subjectType: event.target.value, action: '' })}
        >
          <option value="">Tất cả</option>
          {SUBJECT_OPTIONS.map((subject) => (
            <option key={subject} value={subject}>
              {AUDIT_SUBJECT_LABEL[subject]}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Hành động" htmlFor="audit-action">
        <NativeSelect id="audit-action" value={filters.action} onChange={(event) => onChange({ action: event.target.value })}>
          <option value="">Tất cả</option>
          {actions.map((action) => (
            <option key={action} value={action}>
              {auditActionLabel(action)}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Mã đối tượng" htmlFor="audit-code" hint="Ví dụ SC-001; Enter để lọc.">
        <Input
          id="audit-code"
          value={code}
          maxLength={60}
          placeholder="SC-001"
          onChange={(event) => setCode(event.target.value)}
          onBlur={applyCode}
          onKeyDown={(event) => {
            if (event.key === 'Enter') applyCode();
          }}
        />
      </Field>
      <div className="flex items-end">
        <Button
          variant="secondary"
          onClick={() => {
            setCode('');
            onReset();
          }}
        >
          Đặt lại bộ lọc
        </Button>
      </div>
    </div>
  );
};
