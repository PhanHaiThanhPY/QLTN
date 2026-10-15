import { LIMITS } from './constants';
import { validationError } from './errors';
import type { FieldErrors } from './errors';
import { isValidIsoDate } from '@/utils/date';
import { isValidVndAmount } from '@/utils/money';

/** Collects field errors with Vietnamese messages (spec 5.4, 6.6). */
export class FieldErrorCollector {
  readonly errors: FieldErrors = {};

  add(field: string, message: string): this {
    if (!this.errors[field]) this.errors[field] = message;
    return this;
  }

  when(condition: boolean, field: string, message: string): this {
    return condition ? this.add(field, message) : this;
  }

  text(field: string, label: string, value: unknown, min: number, max: number): this {
    const text = typeof value === 'string' ? value.trim() : '';
    if (text.length < min) return this.add(field, `${label} cần tối thiểu ${min} ký tự.`);
    if (text.length > max) return this.add(field, `${label} tối đa ${max} ký tự.`);
    return this;
  }

  title(field: string, label: string, value: unknown): this {
    return this.text(field, label, value, LIMITS.TITLE_MIN, LIMITS.TITLE_MAX);
  }

  reason(field: string, value: unknown, label = 'Lý do'): this {
    return this.text(field, label, value, LIMITS.REASON_MIN, LIMITS.REASON_MAX);
  }

  amount(field: string, value: unknown, label = 'Số tiền'): this {
    return this.when(!isValidVndAmount(value), field, `${label} phải là số nguyên dương (VND).`);
  }

  date(field: string, value: unknown, label = 'Ngày'): this {
    return this.when(typeof value !== 'string' || !isValidIsoDate(value), field, `${label} không hợp lệ.`);
  }

  /** Drawn signature as an image data URL (PNG from the pad; SVG used by seed data). */
  signature(field: string, value: unknown): this {
    return this.when(!isSignatureDataUrl(value), field, 'Cần chữ ký (vẽ bằng chuột hoặc cảm ứng).');
  }

  required(field: string, value: unknown, message: string): this {
    const isEmpty = value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
    return this.when(isEmpty, field, message);
  }

  get isEmpty(): boolean {
    return Object.keys(this.errors).length === 0;
  }
}

export const asString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
export const asOptionalString = (value: unknown): string | undefined => {
  const text = asString(value);
  return text ? text : undefined;
};
export const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
export const asNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;
/** Integer VND amount after validation: narrows the type at runtime instead of casting (throws when invalid). */
export const requireVndAmount = (value: unknown, field: string, label = 'Số tiền'): number => {
  if (!isValidVndAmount(value)) throw validationError({ [field]: `${label} phải là số nguyên dương (VND).` });
  return value;
};
export const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const SIGNATURE_PREFIXES = ['data:image/png;base64,', 'data:image/svg+xml;base64,'];

export const isSignatureDataUrl = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.length > 100 &&
  value.length <= LIMITS.SIGNATURE_MAX_CHARS &&
  SIGNATURE_PREFIXES.some((prefix) => value.startsWith(prefix));
