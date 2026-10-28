import { useSearchParams } from 'react-router';
import { todayVn } from '@/services/runtime';
import type { ReportKind } from '@/services/report-api';

const KINDS: readonly ReportKind[] = ['MONTH', 'QUARTER', 'YEAR', 'RANGE'];
const isKind = (value: string | null): value is ReportKind => KINDS.some((kind) => kind === value);

/** BR-F5-01: the month before this one by default. */
export const previousMonth = (today: string): string => {
  const [year, month] = today.split('-').map(Number);
  return month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, '0')}`;
};

/** The defaults when the kind changes: this quarter, this year, this month as a range. */
export const defaultValue = (kind: ReportKind, today: string): string => {
  if (kind === 'MONTH') return previousMonth(today);
  if (kind === 'QUARTER') return `${today.slice(0, 4)}-Q${Math.floor((Number(today.slice(5, 7)) - 1) / 3) + 1}`;
  if (kind === 'YEAR') return today.slice(0, 4);
  return `${today.slice(0, 8)}01..${today}`;
};

/** The report's kind and value, kept in the address next to the building (useFundScope). */
export const useReportScope = () => {
  const [params, setParams] = useSearchParams();
  const today = todayVn();
  const kindParam = params.get('kind');
  const kind: ReportKind = isKind(kindParam) ? kindParam : 'MONTH';
  const value = params.get('value') ?? defaultValue(kind, today);
  const set = (next: { kind?: ReportKind; value?: string }) => {
    const updated = new URLSearchParams(params);
    if (next.kind) updated.set('kind', next.kind);
    if (next.value !== undefined) updated.set('value', next.value);
    setParams(updated, { replace: true });
  };
  return {
    kind,
    value,
    setKind: (next: ReportKind) => set({ kind: next, value: defaultValue(next, today) }),
    setValue: (next: string) => set({ value: next }),
  };
};
