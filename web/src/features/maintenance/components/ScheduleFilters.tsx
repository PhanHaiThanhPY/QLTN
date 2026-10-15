import { Field } from '@/components/ui/field';
import { Input, NativeSelect } from '@/components/ui/input';
import { OCCURRENCE_STATUS_LABEL } from '@/domain/constants';
import type { OccurrenceStatus } from '@/domain/constants';
import { useReferenceData } from '@/hooks/useReferenceData';
import { locationOptionLabel } from './MaintenanceLocationTrail';
import { userOptionLabel } from '../utils/maintenance-ui';

export interface ScheduleFilterValues {
  buildingId: string;
  locationId: string;
  itemId: string;
  assigneeId: string;
  status: OccurrenceStatus | '';
  indicator: 'OVERDUE' | 'UPCOMING' | '';
  dateFrom: string;
  dateTo: string;
}

export const EMPTY_SCHEDULE_FILTERS: ScheduleFilterValues = {
  buildingId: '',
  locationId: '',
  itemId: '',
  assigneeId: '',
  status: '',
  indicator: '',
  dateFrom: '',
  dateTo: '',
};

interface ScheduleFiltersProps {
  value: ScheduleFilterValues;
  onChange: (next: ScheduleFilterValues) => void;
  showDates: boolean;
}

const STATUS_OPTIONS = Object.entries(OCCURRENCE_STATUS_LABEL) as [OccurrenceStatus, string][];

export const ScheduleFilters = ({ value, onChange, showDates }: ScheduleFiltersProps) => {
  const { data } = useReferenceData();
  const set = <K extends keyof ScheduleFilterValues>(key: K, next: ScheduleFilterValues[K]) => onChange({ ...value, [key]: next });
  const items = (data?.items ?? []).filter(
    (item) => (!value.buildingId || item.buildingId === value.buildingId) && (!value.locationId || item.locationId === value.locationId),
  );
  const locations = (data?.locations ?? []).filter((location) => !value.buildingId || location.buildingId === value.buildingId);
  const assignees = (data?.users ?? []).filter(
    (user) => (user.role === 'BQL' || user.role === 'TECH_CONFIRMER') && (!value.buildingId || user.buildingIds.includes(value.buildingId)),
  );
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
      <Field label="Tòa nhà" htmlFor="f-building">
        <NativeSelect id="f-building" value={value.buildingId} onChange={(event) => onChange({ ...value, buildingId: event.target.value, locationId: '', itemId: '' })}>
          <option value="">Tất cả tòa nhà</option>
          {(data?.buildings ?? []).map((building) => (
            <option key={building.id} value={building.id}>
              {building.name}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Block / tòa nhà" htmlFor="f-location">
        <NativeSelect id="f-location" value={value.locationId} onChange={(event) => set('locationId', event.target.value)}>
          <option value="">Tất cả vị trí</option>
          {locations.map((location) => (
            <option key={location.id} value={location.id}>
              {locationOptionLabel(data, location.id)}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Hạng mục" htmlFor="f-item">
        <NativeSelect id="f-item" value={value.itemId} onChange={(event) => set('itemId', event.target.value)}>
          <option value="">Tất cả hạng mục</option>
          {items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.code} – {item.name}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Người phụ trách" htmlFor="f-assignee">
        <NativeSelect id="f-assignee" value={value.assigneeId} onChange={(event) => set('assigneeId', event.target.value)}>
          <option value="">Tất cả</option>
          {assignees.map((user) => (
            <option key={user.id} value={user.id}>
              {userOptionLabel(user)}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Trạng thái" htmlFor="f-status">
        <NativeSelect id="f-status" value={value.status} onChange={(event) => set('status', event.target.value as OccurrenceStatus | '')}>
          <option value="">Tất cả trạng thái</option>
          {STATUS_OPTIONS.map(([status, label]) => (
            <option key={status} value={status}>
              {label}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Chỉ báo" htmlFor="f-indicator">
        <NativeSelect
          id="f-indicator"
          value={value.indicator}
          onChange={(event) => set('indicator', event.target.value as ScheduleFilterValues['indicator'])}
        >
          <option value="">Tất cả</option>
          <option value="OVERDUE">Quá hạn</option>
          <option value="UPCOMING">Sắp đến hạn</option>
        </NativeSelect>
      </Field>
      {showDates ? (
        <>
          <Field label="Từ ngày" htmlFor="f-from">
            <Input id="f-from" type="date" value={value.dateFrom} onChange={(event) => set('dateFrom', event.target.value)} />
          </Field>
          <Field label="Đến ngày" htmlFor="f-to">
            <Input id="f-to" type="date" value={value.dateTo} onChange={(event) => set('dateTo', event.target.value)} />
          </Field>
        </>
      ) : null}
    </div>
  );
};
