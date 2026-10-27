import { devLoginDefaults } from './dev-login-defaults';

describe('devLoginDefaults (dev-only login prefill)', () => {
  it('prefills both fields in a dev server when both variables are set', () => {
    expect(devLoginDefaults(true, ' bql-a ', 'mat-khau')).toEqual({ username: 'bql-a', password: 'mat-khau' });
  });

  it('stays empty outside dev, or when either variable is missing or blank', () => {
    expect(devLoginDefaults(false, 'bql-a', 'mat-khau')).toEqual({ username: '', password: '' });
    expect(devLoginDefaults(true, undefined, 'mat-khau')).toEqual({ username: '', password: '' });
    expect(devLoginDefaults(true, 'bql-a', '')).toEqual({ username: '', password: '' });
    expect(devLoginDefaults(true, '  ', 'mat-khau')).toEqual({ username: '', password: '' });
  });
});
