import { BadRequestException } from '@nestjs/common';
import type { FieldErrorDetail } from './validation-error.factory';

/**
 * Collects business-rule field errors (beyond DTO shape checks) and throws them in
 * the same VALIDATION_ERROR format the ValidationPipe uses. First message per field wins.
 */
export class FieldErrors {
  private readonly items: FieldErrorDetail[] = [];

  add(field: string, message: string): this {
    if (!this.items.some((item) => item.field === field)) this.items.push({ field, message });
    return this;
  }

  when(condition: boolean, field: string, message: string): this {
    return condition ? this.add(field, message) : this;
  }

  merge(details: readonly FieldErrorDetail[]): this {
    for (const detail of details) this.add(detail.field, detail.message);
    return this;
  }

  get list(): readonly FieldErrorDetail[] {
    return this.items;
  }

  throwIfAny(): void {
    if (this.items.length === 0) return;
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: this.items[0].message,
      details: { fields: this.items },
    });
  }
}

export const fieldError = (field: string, message: string): BadRequestException => {
  const errors = new FieldErrors().add(field, message);
  return new BadRequestException({ code: 'VALIDATION_ERROR', message, details: { fields: errors.list } });
};
