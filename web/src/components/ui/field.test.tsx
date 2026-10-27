// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { Field } from './field';

/** F-B06-S1-01: a field error (or hint) is announced with its control. */
describe('Field', () => {
  it('marks the control invalid and describes it by the error line', () => {
    render(
      <Field label="Lý do" htmlFor="f-reason" error="Lý do cần tối thiểu 5 ký tự." hint="5–1000 ký tự.">
        <textarea id="f-reason" />
      </Field>,
    );
    const control = screen.getByLabelText('Lý do');
    const error = screen.getByRole('alert');
    expect(control.getAttribute('aria-invalid')).toBe('true');
    expect(control.getAttribute('aria-describedby')).toBe(error.id);
    expect(error.id).toBe('f-reason-error');
  });

  it('describes a valid control by its hint and keeps an existing description', () => {
    render(
      <Field label="Số tiền" htmlFor="f-amount" hint="Số nguyên VND.">
        <input id="f-amount" aria-describedby="f-amount-words" />
      </Field>,
    );
    const control = screen.getByLabelText('Số tiền');
    expect(control.getAttribute('aria-invalid')).toBeNull();
    expect(control.getAttribute('aria-describedby')).toBe('f-amount-words f-amount-hint');
    expect(screen.getByText('Số nguyên VND.').id).toBe('f-amount-hint');
  });

  it('leaves a wrapped control alone', () => {
    render(
      <Field label="Tên" htmlFor="f-name" error="Bắt buộc.">
        <div>
          <input id="f-name" />
        </div>
      </Field>,
    );
    expect(screen.getByLabelText('Tên').getAttribute('aria-describedby')).toBeNull();
  });
});
