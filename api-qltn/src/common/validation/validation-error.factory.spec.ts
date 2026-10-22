import type { ValidationError } from 'class-validator';
import { flattenValidationErrors, validationExceptionFactory } from './validation-error.factory';

const error = (property: string, constraints: Record<string, string>, children: ValidationError[] = []) =>
  ({ property, constraints, children }) as ValidationError;

describe('validationExceptionFactory', () => {
  it('translates constraints to Vietnamese with field labels and lists every field', () => {
    const exception = validationExceptionFactory([
      error('username', { isNotEmpty: 'username should not be empty' }),
      error('limit', { max: 'limit must not be greater than 100' }),
    ]);
    expect(exception.getResponse()).toEqual({
      code: 'VALIDATION_ERROR',
      message: 'Tên đăng nhập không được để trống.',
      details: {
        fields: [
          { field: 'username', message: 'Tên đăng nhập không được để trống.' },
          { field: 'limit', message: 'Số dòng mỗi trang lớn hơn giá trị cho phép.' },
        ],
      },
    });
  });

  it('flattens nested errors into dotted paths and keeps unknown constraint text', () => {
    const nested = error('checklist', {}, [error('0', {}, [error('unit', { customRule: 'unit is odd' })])]);
    expect(flattenValidationErrors([nested])).toEqual([{ field: 'checklist.0.unit', message: 'unit is odd' }]);
  });
});
