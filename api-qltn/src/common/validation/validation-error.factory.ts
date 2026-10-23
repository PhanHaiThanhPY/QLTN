import { BadRequestException } from '@nestjs/common';
import type { ValidationError } from 'class-validator';
import { fieldLabel } from './field-labels';

/** One invalid field in `error.details.fields`. */
export interface FieldErrorDetail {
  field: string;
  message: string;
}

/**
 * The first constraint found in this order wins when several fail on the same field:
 * required → type → format → range. A missing value is handled before this list.
 */
const CONSTRAINT_PRIORITY: readonly string[] = [
  'isDefined',
  'isNotEmpty',
  'isString',
  'isInt',
  'isNumber',
  'isBoolean',
  'isArray',
  'isEnum',
  'isIn',
  'isEmail',
  'isUUID',
  'isDateString',
  'isISO8601',
  'matches',
  'isLength',
  'minLength',
  'maxLength',
  'min',
  'max',
  'arrayMinSize',
  'arrayMaxSize',
  'arrayUnique',
  'whitelistValidation',
];

/** Messages without a limit; `{label}` is replaced by the field label. */
const CONSTRAINT_MESSAGES: Readonly<Record<string, string>> = {
  isDefined: '{label} là bắt buộc.',
  isNotEmpty: '{label} là bắt buộc.',
  isString: '{label} phải là chuỗi ký tự.',
  isInt: '{label} phải là số nguyên.',
  isNumber: '{label} phải là số.',
  isBoolean: '{label} phải là có/không.',
  isEmail: '{label} không đúng định dạng email.',
  isUUID: '{label} không hợp lệ.',
  isEnum: '{label} không thuộc danh sách cho phép.',
  isIn: '{label} không thuộc danh sách cho phép.',
  isArray: '{label} phải là danh sách.',
  isDateString: '{label} phải là ngày giờ hợp lệ.',
  isISO8601: '{label} phải là ngày giờ hợp lệ.',
  matches: '{label} không đúng định dạng.',
  arrayUnique: '{label} không được trùng nhau.',
  whitelistValidation: 'Trường {label} không được phép gửi lên.',
};

/**
 * class-validator exposes the constraint values only through its default English
 * message, e.g. "must not be greater than 5". Read the limit back from there.
 */
const LIMIT_PATTERNS: Readonly<Record<string, RegExp>> = {
  minLength: /longer than or equal to (-?\d+(?:[.,]\d+)?)/i,
  maxLength: /shorter than or equal to (-?\d+(?:[.,]\d+)?)/i,
  min: /not be less than (-?\d+(?:[.,]\d+)?)/i,
  max: /not be greater than (-?\d+(?:[.,]\d+)?)/i,
  arrayMinSize: /at least (-?\d+(?:[.,]\d+)?)/i,
  arrayMaxSize: /not more than (-?\d+(?:[.,]\d+)?)/i,
};

const isBlank = (value: unknown): boolean =>
  value === undefined || value === null || (typeof value === 'string' && value.trim() === '');

const limitOf = (constraint: string, fallback: string): string | undefined => {
  const match = LIMIT_PATTERNS[constraint]?.exec(fallback);
  return match?.[1];
};

const LENGTH_MIN = /longer than or equal to (-?\d+)/i;
const LENGTH_MAX = /shorter than or equal to (-?\d+)/i;

/** `@Length(min, max)` shortens its default message to the side that failed; handle both. */
function isLengthMessage(label: string, fallback: string, value: unknown): string | undefined {
  const min = LENGTH_MIN.exec(fallback)?.[1];
  const max = LENGTH_MAX.exec(fallback)?.[1];
  const length = typeof value === 'string' ? value.length : undefined;
  if (min && max) {
    if (length !== undefined && length < Number(min)) return `${label} tối thiểu ${min} ký tự.`;
    if (length !== undefined && length > Number(max)) return `${label} tối đa ${max} ký tự.`;
    return `${label} phải có từ ${min} đến ${max} ký tự.`;
  }
  if (min) return `${label} tối thiểu ${min} ký tự.`;
  if (max) return `${label} tối đa ${max} ký tự.`;
  return undefined;
}

function messageFor(field: string, constraint: string, fallback: string, value: unknown): string {
  const label = fieldLabel(field);
  const template = CONSTRAINT_MESSAGES[constraint];
  if (template) return template.replace('{label}', label);
  const limit = limitOf(constraint, fallback);
  switch (constraint) {
    case 'isLength':
      return isLengthMessage(label, fallback, value) ?? `${label} không đúng độ dài cho phép.`;
    case 'minLength':
      return limit ? `${label} tối thiểu ${limit} ký tự.` : `${label} quá ngắn.`;
    case 'maxLength':
      return limit ? `${label} tối đa ${limit} ký tự.` : `${label} quá dài.`;
    case 'min':
      return limit ? `${label} nhỏ hơn giá trị cho phép (tối thiểu ${limit}).` : `${label} nhỏ hơn giá trị cho phép.`;
    case 'max':
      return limit ? `${label} lớn hơn giá trị cho phép (tối đa ${limit}).` : `${label} lớn hơn giá trị cho phép.`;
    case 'arrayMinSize':
      return limit ? `${label} phải có ít nhất ${limit} phần tử.` : `${label} chưa đủ phần tử.`;
    case 'arrayMaxSize':
      return limit ? `${label} tối đa ${limit} phần tử.` : `${label} quá nhiều phần tử.`;
    default:
      return fallback;
  }
}

/** Exactly one message for a field, whatever class-validator reported for it. */
function detailFor(field: string, error: ValidationError): FieldErrorDetail {
  if (isBlank(error.value)) return { field, message: `${fieldLabel(field)} là bắt buộc.` };
  const constraints = error.constraints ?? {};
  const names = Object.keys(constraints);
  const constraint = CONSTRAINT_PRIORITY.find((name) => names.includes(name)) ?? names[0] ?? '';
  return { field, message: messageFor(field, constraint, constraints[constraint] ?? '', error.value) };
}

/** Flattens nested validation errors into `path.to.field` entries, one entry per field. */
export function flattenValidationErrors(errors: ValidationError[], parent = ''): FieldErrorDetail[] {
  return errors.flatMap((error) => {
    const path = parent ? `${parent}.${error.property}` : error.property;
    const own = Object.keys(error.constraints ?? {}).length > 0 ? [detailFor(path, error)] : [];
    return [...own, ...flattenValidationErrors(error.children ?? [], path)];
  });
}

/** `exceptionFactory` for the global ValidationPipe: Vietnamese messages, every invalid field listed. */
export function validationExceptionFactory(errors: ValidationError[]): BadRequestException {
  const fields = flattenValidationErrors(errors);
  return new BadRequestException({
    code: 'VALIDATION_ERROR',
    message: fields[0]?.message ?? 'Dữ liệu gửi lên không hợp lệ.',
    details: { fields },
  });
}
