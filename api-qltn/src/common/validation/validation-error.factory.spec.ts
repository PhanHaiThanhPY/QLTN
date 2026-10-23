import type { ValidationError } from 'class-validator';
import { flattenValidationErrors, validationExceptionFactory } from './validation-error.factory';

const error = (
  property: string,
  constraints: Record<string, string>,
  children: ValidationError[] = [],
  value: unknown = undefined,
) => ({ property, constraints, children, value }) as ValidationError;

/** The four rows of the spec table plus the priority rules. */
describe('validationExceptionFactory', () => {
  it('reports a missing login password as required, once, and drops its other constraints', () => {
    const exception = validationExceptionFactory([
      error('password', {
        isString: 'password must be a string',
        isNotEmpty: 'password should not be empty',
        maxLength: 'password must be shorter than or equal to 200 characters',
      }),
    ]);

    expect(exception.getResponse()).toEqual({
      code: 'VALIDATION_ERROR',
      message: 'Mật khẩu là bắt buộc.',
      details: { fields: [{ field: 'password', message: 'Mật khẩu là bắt buộc.' }] },
    });
  });

  it('reports a null value and an empty trimmed string as required', () => {
    for (const value of [null, '   ']) {
      expect(
        flattenValidationErrors([
          error('fullName', { minLength: 'fullName must be longer than or equal to 3 characters' }, [], value),
        ]),
      ).toEqual([{ field: 'fullName', message: 'Họ tên là bắt buộc.' }]);
    }
  });

  it('reports a missing config field as required instead of the min/max range', () => {
    const fields = flattenValidationErrors([
      error('emergencyDocHours', {
        isInt: 'emergencyDocHours must be an integer number',
        min: 'emergencyDocHours must not be less than 4',
        max: 'emergencyDocHours must not be greater than 72',
      }),
      error('version', { isInt: 'version must be an integer number', min: 'version must not be less than 1' }),
    ]);

    expect(fields).toEqual([
      { field: 'emergencyDocHours', message: 'Số giờ bổ sung hồ sơ là bắt buộc.' },
      { field: 'version', message: 'Phiên bản là bắt buộc.' },
    ]);
  });

  it('uses Vietnamese labels and one sentence per user field', () => {
    const fields = flattenValidationErrors([
      error('buildingIds', {
        isArray: 'buildingIds must be an array',
        isUuid: 'buildingIds must be a UUID',
      }),
      error('fullName', { isLength: 'fullName must be longer than or equal to 3 characters' }, [], 'An'),
    ]);

    expect(fields).toEqual([
      { field: 'buildingIds', message: 'Tòa nhà được giao là bắt buộc.' },
      { field: 'fullName', message: 'Họ tên tối thiểu 3 ký tự.' },
    ]);
  });

  it('keeps the limit of a failed range check', () => {
    const fields = flattenValidationErrors([
      error('priceRatio', { max: 'priceRatio must not be greater than 5' }, [], 9),
      error('password', { maxLength: 'password must be shorter than or equal to 72 characters' }, [], 'x'.repeat(73)),
      error('limit', { max: 'limit must not be greater than 100' }, [], 500),
    ]);

    expect(fields).toEqual([
      { field: 'priceRatio', message: 'Giá bất thường lớn hơn giá trị cho phép (tối đa 5).' },
      { field: 'password', message: 'Mật khẩu tối đa 72 ký tự.' },
      { field: 'limit', message: 'Số dòng mỗi trang lớn hơn giá trị cho phép (tối đa 100).' },
    ]);
  });

  it('prefers the type error over range errors of the same field', () => {
    const fields = flattenValidationErrors([
      error(
        'version',
        { isInt: 'version must be an integer number', min: 'version must not be less than 1' },
        [],
        'abc',
      ),
    ]);

    expect(fields).toEqual([{ field: 'version', message: 'Phiên bản phải là số nguyên.' }]);
  });

  it('flattens nested errors into dotted paths and labels them by the last segment', () => {
    const nested = error('taskDueDays', {}, [
      error('APPROVE_PROPOSAL', {
        isInt: 'APPROVE_PROPOSAL must be an integer number',
        min: 'APPROVE_PROPOSAL must not be less than 1',
        max: 'APPROVE_PROPOSAL must not be greater than 30',
      }),
    ]);

    expect(flattenValidationErrors([nested])).toEqual([
      { field: 'taskDueDays.APPROVE_PROPOSAL', message: 'Mỗi bước duyệt tờ trình là bắt buộc.' },
    ]);
  });

  it('reports an invalid array element in Vietnamese for an each constraint', () => {
    const fields = flattenValidationErrors([
      error('buildingIds', { isUuid: 'each value in buildingIds must be a UUID' }, [], ['abc']),
      error('roleDefId', { isUuid: 'roleDefId must be a UUID' }, [], 'abc'),
    ]);

    expect(fields).toEqual([
      { field: 'buildingIds', message: 'Tòa nhà được giao có phần tử không hợp lệ.' },
      { field: 'roleDefId', message: 'Vai trò không hợp lệ.' },
    ]);
  });

  it('never falls back to the English class-validator text for an unknown constraint', () => {
    const nested = error('checklist', {}, [error('0', {}, [error('unit', { customRule: 'unit is odd' }, [], 3)])]);
    expect(flattenValidationErrors([nested])).toEqual([{ field: 'checklist.0.unit', message: 'unit không hợp lệ.' }]);
    expect(flattenValidationErrors([error('description', { futureRule: 'description is odd' }, [], 'x')])).toEqual([
      { field: 'description', message: 'Mô tả không hợp lệ.' },
    ]);
  });
});
