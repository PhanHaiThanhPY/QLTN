import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CAPABILITIES_KEY } from '../decorators/require-capabilities.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { CapabilitiesGuard } from './capabilities.guard';

function context(
  meta: Record<string, unknown>,
  capabilities?: string[],
): { guard: CapabilitiesGuard; ctx: ExecutionContext } {
  const reflector = { getAllAndOverride: (key: string) => meta[key] } as unknown as Reflector;
  const ctx = {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ user: capabilities ? { capabilities } : undefined }) }),
  } as unknown as ExecutionContext;
  return { guard: new CapabilitiesGuard(reflector), ctx };
}

describe('CapabilitiesGuard', () => {
  it('allows routes without requirements', () => {
    const { guard, ctx } = context({}, ['VIEW']);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows public routes even without a user', () => {
    const { guard, ctx } = context({ [IS_PUBLIC_KEY]: true, [CAPABILITIES_KEY]: ['ACCOUNT_MANAGE'] });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('requires every listed capability', () => {
    const { guard, ctx } = context({ [CAPABILITIES_KEY]: ['VIEW', 'ACCOUNT_MANAGE'] }, ['VIEW']);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('passes when all capabilities are held', () => {
    const { guard, ctx } = context({ [CAPABILITIES_KEY]: ['VIEW', 'ACCOUNT_MANAGE'] }, ['VIEW', 'ACCOUNT_MANAGE']);
    expect(guard.canActivate(ctx)).toBe(true);
  });
});
