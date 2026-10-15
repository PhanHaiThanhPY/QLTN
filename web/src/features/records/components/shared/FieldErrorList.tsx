import type { FieldErrors } from '@/domain/errors';

interface FieldErrorListProps {
  errors: FieldErrors;
  /** Keys already rendered under their own field. */
  exclude?: readonly string[];
}

/** Server validation messages that have no dedicated input (e.g. "quotes", "acceptance"). */
export const FieldErrorList = ({ errors, exclude = [] }: FieldErrorListProps) => {
  const entries = Object.entries(errors).filter(([key]) => !exclude.includes(key));
  if (entries.length === 0) return null;
  return (
    <ul className="mt-3 space-y-1 rounded-lg border border-crit/30 bg-crit-soft px-3 py-2 text-sm text-crit" role="alert">
      {entries.map(([key, message]) => (
        <li key={key}>{message}</li>
      ))}
    </ul>
  );
};
