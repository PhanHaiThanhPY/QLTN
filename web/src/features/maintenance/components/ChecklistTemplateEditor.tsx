import { useFieldArray, useWatch } from 'react-hook-form';
import type { Control, FieldErrors as FormErrors, UseFormRegister } from 'react-hook-form';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, NativeSelect } from '@/components/ui/input';
import type { FieldErrors } from '@/domain/errors';
import { EMPTY_CHECKLIST_ROW } from './plan-form-schema';
import type { PlanFormValues } from './plan-form-schema';

interface ChecklistTemplateEditorProps {
  control: Control<PlanFormValues>;
  register: UseFormRegister<PlanFormValues>;
  errors: FormErrors<PlanFormValues>;
  serverErrors: FieldErrors;
}

/** Add/remove/reorder checklist rows and configure check or measurement input. */
export const ChecklistTemplateEditor = ({ control, register, errors, serverErrors }: ChecklistTemplateEditorProps) => {
  const { fields, append, remove, move } = useFieldArray({ control, name: 'checklist' });
  const checklist = useWatch({ control, name: 'checklist' });
  const listError = errors.checklist?.message ?? errors.checklist?.root?.message ?? serverErrors.checklistTemplate;
  return (
    <div className="space-y-2">
      <ol className="space-y-2">
        {fields.map((field, index) => {
          const labelError = errors.checklist?.[index]?.label?.message ?? serverErrors[`checklistTemplate.${index}.label`];
          return (
            <li key={field.id} className="rounded-lg border border-line p-2.5">
              <div className="grid gap-2 sm:grid-cols-[1.5rem_minmax(0,1fr)_10rem_auto] sm:items-center">
                <span className="text-sm font-medium text-ink-2 sm:w-6">{index + 1}.</span>
                <Input
                  aria-label={`Nhãn mục ${index + 1}`}
                  placeholder="Nội dung kiểm tra"
                  aria-invalid={Boolean(labelError)}
                  className="sm:flex-1"
                  {...register(`checklist.${index}.label`)}
                />
                <NativeSelect aria-label={`Kiểu nhập mục ${index + 1}`} {...register(`checklist.${index}.inputType`)}>
                  <option value="CHECK">Đạt / không đạt</option>
                  <option value="MEASUREMENT">Nhập số đo</option>
                </NativeSelect>
                <div className="flex items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-sm text-ink">
                    <input type="checkbox" className="h-4 w-4 accent-accent" {...register(`checklist.${index}.required`)} />
                    Bắt buộc
                  </label>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" aria-label="Chuyển lên" disabled={index === 0} onClick={() => move(index, index - 1)}>
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Chuyển xuống"
                      disabled={index === fields.length - 1}
                      onClick={() => move(index, index + 1)}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" aria-label="Xóa mục" disabled={fields.length <= 1} onClick={() => remove(index)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
              {errors.checklist?.[index]?.inputType?.message ? <p className="mt-1 text-xs text-crit">{errors.checklist[index]?.inputType?.message}</p> : null}
              {(() => {
                const inputType = checklist[index]?.inputType;
                return inputType === 'MEASUREMENT' ? (
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <Input placeholder="Đơn vị (VD: °C, bar)" aria-label={`Đơn vị mục ${index + 1}`} {...register(`checklist.${index}.unit`)} />
                    <Input type="number" step="any" placeholder="Tối thiểu" aria-label={`Giá trị tối thiểu mục ${index + 1}`} {...register(`checklist.${index}.minValue`, { setValueAs: (value) => (value === '' ? undefined : Number(value)) })} />
                    <Input type="number" step="any" placeholder="Tối đa" aria-label={`Giá trị tối đa mục ${index + 1}`} {...register(`checklist.${index}.maxValue`, { setValueAs: (value) => (value === '' ? undefined : Number(value)) })} />
                  </div>
                ) : null;
              })()}
              {errors.checklist?.[index]?.unit?.message || errors.checklist?.[index]?.minValue?.message || errors.checklist?.[index]?.maxValue?.message ? (
                <p className="mt-1 text-xs text-crit">
                  {errors.checklist[index]?.unit?.message ?? errors.checklist[index]?.minValue?.message ?? errors.checklist[index]?.maxValue?.message}
                </p>
              ) : null}
              {labelError ? (
                <p className="mt-1 text-xs text-crit" role="alert">
                  {labelError}
                </p>
              ) : null}
            </li>
          );
        })}
      </ol>
      {listError ? (
        <p className="text-xs text-crit" role="alert">
          {listError}
        </p>
      ) : null}
      <Button variant="secondary" size="sm" onClick={() => append({ ...EMPTY_CHECKLIST_ROW })}>
        <Plus className="h-4 w-4" />
        Thêm mục
      </Button>
    </div>
  );
};
