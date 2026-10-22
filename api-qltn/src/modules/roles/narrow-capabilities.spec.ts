import { BadRequestException } from '@nestjs/common';
import { narrowCapabilities } from './roles.service';

describe('narrowCapabilities', () => {
  it('keeps the base role order and always includes VIEW', () => {
    expect(narrowCapabilities('BQL', ['REPORT_VIEW', 'RECORD_EDIT'])).toEqual(['VIEW', 'RECORD_EDIT', 'REPORT_VIEW']);
  });

  it('refuses capabilities outside the base role', () => {
    expect(() => narrowCapabilities('BQL', ['VIEW', 'PAYMENT_DECIDE'])).toThrow(BadRequestException);
  });
});
