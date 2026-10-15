import { useFieldArray } from 'react-hook-form';
import type { Control, FieldErrors as FormErrors, UseFormRegister } from 'react-hook-form';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { FieldErrors } from '@/domain/errors';
import { EMPTY_CHECKLIST_ROW } from './plan-form-schema';
import type { PlanFormValues } from './plan-form-schema';

interface ChecklistTemplateEditorProps {
  control: Control<PlanFormValues>;
  register: UseFormRegister<PlanFormValues>;
  errors: FormErrors<PlanFormValues>;
  serverErrors: FieldErrors;
}

/** Add/remove/reorder checklist rows: label + required flag. */
export const ChecklistTemplateEditor = ({ control, register, errors, serverErrors }: ChecklistTemplateEditorProps) => {
  const { fields, append, remove, move } = useFieldArray({ control, name: 'checklist' });
  const listError = errors.checklist?.message ?? errors.checklist?.root?.message ?? serverErrors.checklistTemplate;
  return (
    <div className="space-y-2">
      <ol className="space-y-2">
        {fields.map((field, index) => {
          const labelError = errors.checklist?.[index]?.label?.message ?? serverErrors[`checklistTemplate.${index}.label`];
          return (
            <li key={field.id} className="rounded-lg border border-line p-2.5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <span className="text-sm font-medium text-ink-2 sm:w-6">{index + 1}.</span>
                <Input
                  aria-label={`Nhãn mục ${index + 1}`}
                  placeholder="Nội dung kiểm tra"
                  aria-invalid={Boolean(labelError)}
                  className="sm:flex-1"
                  {...register(`checklist.${index}.label`)}
                />
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
