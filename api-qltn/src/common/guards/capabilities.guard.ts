import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { Capability } from '../../domain/permissions';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { CAPABILITIES_KEY } from '../decorators/require-capabilities.decorator';

/** Global guard (after JwtAuthGuard): enforces @RequireCapabilities on the route. */
@Injectable()
export class CapabilitiesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;

    const required = this.reflector.getAllAndOverride<Capability[] | undefined>(CAPABILITIES_KEY, targets);
    if (!required || required.length === 0) return true;

    const user = context.switchToHttp().getRequest<Request>().user;
    const granted = user?.capabilities ?? [];
    if (required.every((capability) => granted.includes(capability))) return true;

    throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Vai trò của bạn không có quyền thao tác này.' });
  }
}
