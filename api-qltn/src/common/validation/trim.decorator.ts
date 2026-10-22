import { Transform } from 'class-transformer';

/** Trims string input before validation; other types pass through for the validators to reject. */
export const Trim = () =>
  Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value));

/** Trims and upper-cases codes (building, department, account codes). */
export const TrimUpper = () =>
  Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toUpperCase() : value));

/** Trims; an empty string becomes null so optional text can be cleared. */
export const TrimToNull = () =>
  Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    const text = value.trim();
    return text === '' ? null : text;
  });

const BOOLEAN_STRINGS: Readonly<Record<string, boolean>> = { true: true, false: false };

/** Query-string booleans: "true"/"false" become booleans; anything else is left for @IsBoolean to reject. */
export const ToBoolean = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && value in BOOLEAN_STRINGS ? BOOLEAN_STRINGS[value] : value,
  );
