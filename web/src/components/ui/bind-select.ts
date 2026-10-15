import type { FieldValues, Path, PathValue, UseFormReturn } from 'react-hook-form';
import type { SelectChangeEvent } from './select';

/**
 * Binds a react-hook-form string field to the controlled VMI-style <Select>.
 * `register` cannot drive it (the dropdown is a button, not a native select).
 */
export const bindSelect = <T extends FieldValues>(
  form: Pick<UseFormReturn<T>, 'watch' | 'setValue' | 'formState'>,
  name: Path<T>,
  onAfterChange?: (value: string) => void,
) => ({
  name,
  value: String(form.watch(name) ?? ''),
  onChange: (event: SelectChangeEvent) => {
    form.setValue(name, event.target.value as PathValue<T, Path<T>>, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: form.formState.isSubmitted,
    });
    onAfterChange?.(event.target.value);
  },
});
