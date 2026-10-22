import { BadRequestException } from '@nestjs/common';
import type { ValidationError } from 'class-validator';
import { fieldLabel } from './field-labels';

/** One invalid field in `error.details.fields`. */
export interface FieldErrorDetail {
  field: string;
  message: string;
}

/** Vietnamese message per class-validator constraint. `{label}` is replaced by the field label. */
const CONSTRAINT_MESSAGES: Readonly<Record<string, string>> = {
  isNotEmpty: '{label} không được để trống.',
  isDefined: 'Thiếu {label}.',
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
  minLength: '{label} quá ngắn.',
  maxLength: '{label} quá dài.',
  min: '{label} nhỏ hơn giá trị cho phép.',
  max: '{label} lớn hơn giá trị cho phép.',
  matches: '{label} không đúng định dạng.',
  whitelistValidation: 'Trường {label} không được phép gửi lên.',
};

function messageFor(field: string, constraint: string, fallback: string): string {
  const template = CONSTRAINT_MESSAGES[constraint];
  return template ? template.replace('{label}', fieldLabel(field)) : fallback;
}

/** Flattens nested validation errors into `path.to.field` entries. */
export function flattenValidationErrors(errors: ValidationError[], parent = ''): FieldErrorDetail[] {
  return errors.flatMap((error) => {
    const path = parent ? `${parent}.${error.property}` : error.property;
    const own = Object.entries(error.constraints ?? {}).map(([constraint, fallback]) => ({
      field: path,
      message: messageFor(error.property, constraint, fallback),
    }));
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
