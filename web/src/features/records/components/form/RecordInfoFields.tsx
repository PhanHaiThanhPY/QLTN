import type { UseFormReturn } from 'react-hook-form';
import { bindSelect } from '@/components/ui/bind-select';
import { Notice } from '@/components/common/Notice';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { LIMITS, PRIORITY_LABEL } from '@/domain/constants';
import { suggestIncidentPriority } from '@/domain/operational-guidance';
import type { Priority } from '@/domain/constants';
import type { FieldErrors } from '@/domain/errors';
import type { ReferenceData } from '@/services/reference-service';
import { NO_ITEM_VALUE } from './record-form-schema';
import type { RecordFormValues } from './record-form-schema';
import { ReadOnlyValue } from './ReadOnlyValue';

interface RecordInfoFieldsProps {
  form: UseFormReturn<RecordFormValues>;
  reference: ReferenceData;
  isNew: boolean;
  serverErrors: FieldErrors;
}

const PRIORITY_OPTIONS = Object.entries(PRIORITY_LABEL) as [Priority, string][];

/** Building, location, maintenance item, title, description and priority. */
export const RecordInfoFields = ({ form, reference, isNew, serverErrors }: RecordInfoFieldsProps) => {
  const { register, watch, setValue, getValues, formState } = form;
  const errors = formState.errors;
  const buildingId = watch('buildingId');
  const selectedItemId = watch('maintenanceItemId');
  const currentLocationId = watch('locationId');
  const title = watch('title');
  const description = watch('description');
  const priority = watch('priority');
  const priorityGuidance = suggestIncidentPriority(title, description);
  // Inactive locations are hidden unless the record already uses one.
  const locations = reference.locations.filter((row) => row.buildingId === buildingId && (row.active !== false || row.id === currentLocationId));
  const items = reference.items.filter((row) => row.buildingId === buildingId && (row.active || row.id === selectedItemId));
  const buildingOptions = reference.buildings.filter((row) => reference.viewer.buildingIds.includes(row.id));

  const onBuildingChange = () => {
    setValue('locationId', '');
    setValue('maintenanceItemId', '');
  };
  const onItemChange = (itemId: string) => {
    const item = reference.items.find((row) => row.id === itemId);
    if (item && !getValues('locationId')) setValue('locationId', item.locationId, { shouldValidate: true });
  };

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Field label="Tòa nhà" htmlFor="rf-building" required error={errors.buildingId?.message ?? serverErrors.buildingId} hint={isNew ? undefined : 'Hồ sơ đã tạo không đổi tòa nhà.'}>
        {isNew ? (
          <NativeSelect id="rf-building" {...bindSelect(form, 'buildingId', onBuildingChange)}>
            <option value="">Chọn tòa nhà</option>
            {buildingOptions.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </NativeSelect>
        ) : (
          <ReadOnlyValue>{reference.buildings.find((row) => row.id === buildingId)?.name ?? buildingId}</ReadOnlyValue>
        )}
      </Field>
      <Field label="Vị trí" htmlFor="rf-location" hint="Bắt buộc khi gửi xác nhận." error={errors.locationId?.message ?? serverErrors.locationId}>
        <NativeSelect id="rf-location" aria-invalid={Boolean(errors.locationId)} {...bindSelect(form, 'locationId')}>
          <option value="">Chọn vị trí</option>
          {locations.map((row) => (
            <option key={row.id} value={row.id}>
              {row.name} · Tầng {row.floor}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field
        label="Thiết bị / hạng mục"
        htmlFor="rf-item"
        required
        hint="Bắt buộc khi gửi xác nhận. Chọn “Không thuộc thiết bị cụ thể” cho sửa chữa kết cấu chung."
        error={errors.maintenanceItemId?.message ?? serverErrors.maintenanceItemId}
      >
        <NativeSelect id="rf-item" aria-invalid={Boolean(errors.maintenanceItemId)} {...bindSelect(form, 'maintenanceItemId', onItemChange)}>
          <option value="">Chọn thiết bị / hạng mục</option>
          <option value={NO_ITEM_VALUE}>Không thuộc thiết bị cụ thể</option>
          {items.map((row) => (
            <option key={row.id} value={row.id}>
              {row.code} – {row.name}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Mức ưu tiên" htmlFor="rf-priority" required error={errors.priority?.message ?? serverErrors.priority} hint="“Khẩn cấp” không cho bỏ qua bước duyệt.">
        <NativeSelect id="rf-priority" {...bindSelect(form, 'priority')}>
          {PRIORITY_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Tên hồ sơ" htmlFor="rf-title" hint="Bắt buộc khi gửi xác nhận." className="md:col-span-2" error={errors.title?.message ?? serverErrors.title}>
        <Input id="rf-title" maxLength={LIMITS.TITLE_MAX} aria-invalid={Boolean(errors.title)} placeholder="Ví dụ: Rò rỉ nước trần hành lang tầng 5" {...register('title')} />
      </Field>
      <Field
        label="Mô tả hư hỏng"
        htmlFor="rf-description"
        className="md:col-span-2"
        hint={`Bắt buộc ${LIMITS.DESCRIPTION_MIN}–${LIMITS.DESCRIPTION_MAX} ký tự khi gửi xác nhận.`}
        error={errors.description?.message ?? serverErrors.description}
      >
        <Textarea id="rf-description" rows={5} maxLength={LIMITS.DESCRIPTION_MAX} aria-invalid={Boolean(errors.description)} placeholder="Mô tả vị trí, hiện trạng và mức độ hư hỏng..." {...register('description')} />
      </Field>
      {priorityGuidance && priorityGuidance.priority !== priority ? (
        <Notice tone="info" title="Gợi ý vận hành · Phân loại sự cố" className="md:col-span-2">
          {priorityGuidance.reason}
          <Button
            className="mt-2"
            size="sm"
            variant="secondary"
            type="button"
            onClick={() => setValue('priority', priorityGuidance.priority, { shouldDirty: true, shouldValidate: true })}
          >
            Áp dụng mức {PRIORITY_LABEL[priorityGuidance.priority]}
          </Button>
        </Notice>
      ) : null}
    </div>
  );
};
