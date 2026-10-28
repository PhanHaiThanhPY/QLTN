import { Field } from '@/components/ui/field';
import { Input, NativeSelect } from '@/components/ui/input';
import type { ReportKind } from '@/services/report-api';

const KIND_TEXT: Readonly<Record<ReportKind, string>> = { MONTH: 'Tháng', QUARTER: 'Quý', YEAR: 'Năm', RANGE: 'Khoảng tùy chọn' } as const;
const isKind = (value: string): value is ReportKind => Object.hasOwn(KIND_TEXT, value);

interface ReportPeriodPickerProps {
  kind: ReportKind;
  value: string;
  onKind: (kind: ReportKind) => void;
  onValue: (value: string) => void;
}

/** BR-F5-01: month (default: last month), quarter, year or a custom range. */
export const ReportPeriodPicker = ({ kind, value, onKind, onValue }: ReportPeriodPickerProps) => {
  const [from = '', to = ''] = kind === 'RANGE' ? value.split('..') : [];
  const [year = '', quarter = 'Q1'] = kind === 'QUARTER' ? value.split('-') : [];
  return (
    <>
      <Field label="Kỳ" htmlFor="rp-kind">
        <NativeSelect id="rp-kind" value={kind} onChange={(event) => (isKind(event.target.value) ? onKind(event.target.value) : undefined)}>
          {Object.entries(KIND_TEXT).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </NativeSelect>
      </Field>
      {kind === 'MONTH' ? (
        <Field label="Tháng" htmlFor="rp-month">
          <Input id="rp-month" type="month" value={value} onChange={(event) => onValue(event.target.value)} />
        </Field>
      ) : null}
      {kind === 'QUARTER' ? (
        <div className="grid grid-cols-2 gap-2">
          <Field label="Năm" htmlFor="rp-qyear">
            <Input id="rp-qyear" inputMode="numeric" value={year} onChange={(event) => onValue(`${event.target.value}-${quarter}`)} />
          </Field>
          <Field label="Quý" htmlFor="rp-quarter">
            <NativeSelect id="rp-quarter" value={quarter} onChange={(event) => onValue(`${year}-${event.target.value}`)}>
              {['Q1', 'Q2', 'Q3', 'Q4'].map((q) => (
                <option key={q} value={q}>
                  {q.replace('Q', 'Quý ')}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>
      ) : null}
      {kind === 'YEAR' ? (
        <Field label="Năm" htmlFor="rp-year">
          <Input id="rp-year" inputMode="numeric" value={value} onChange={(event) => onValue(event.target.value)} />
        </Field>
      ) : null}
      {kind === 'RANGE' ? (
        <div className="grid grid-cols-2 gap-2">
          <Field label="Từ ngày" htmlFor="rp-from">
            <Input id="rp-from" type="date" value={from} onChange={(event) => onValue(`${event.target.value}..${to}`)} />
          </Field>
          <Field label="Đến ngày" htmlFor="rp-to">
            <Input id="rp-to" type="date" min={from} value={to} onChange={(event) => onValue(`${from}..${event.target.value}`)} />
          </Field>
        </div>
      ) : null}
    </>
  );
};
