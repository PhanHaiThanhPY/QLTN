import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { UsersService } from '../users/users.service';
import type { JwtPayload } from './jwt-payload';

/**
 * Verifies the HS256 access token, then re-reads the account so that a deactivated
 * account, a role change or a building-scope change takes effect immediately.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly users: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('auth.jwtSecret'),
      algorithms: ['HS256'],
    });
  }

  async validate(payload: Partial<JwtPayload>): Promise<AuthenticatedUser> {
    if (typeof payload.sub !== 'string' || !payload.sub) throw new UnauthorizedException();
    const identity = await this.users.findActiveIdentity(payload.sub);
    if (!identity) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Tài khoản không tồn tại hoặc đã ngừng hoạt động.',
      });
    }
    return identity;
  }
}
