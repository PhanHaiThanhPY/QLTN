import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectDataSource } from '@nestjs/typeorm';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { DataSource, EntityManager, IsNull } from 'typeorm';
import { UsersService, type UserProfile } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import type { JwtPayload } from './jwt-payload';
import { hashPassword, verifyPassword } from './password';

export interface ClientMeta {
  userAgent?: string;
  ip?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  /** Access-token lifetime in seconds. */
  expiresIn: number;
  user: UserProfile;
}

const INVALID_CREDENTIALS = 'Tên đăng nhập hoặc mật khẩu không đúng.';
const INVALID_SESSION = 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.';
const DAY_MS = 24 * 60 * 60 * 1000;

export const hashRefreshToken = (token: string): string => createHash('sha256').update(token).digest('hex');

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  /** Hash of a random secret: makes unknown usernames cost the same bcrypt time as wrong passwords. */
  private timingDummyHash?: Promise<string>;

  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async login(username: string, password: string, meta: ClientMeta): Promise<AuthTokens> {
    const user = await this.users.findForLogin(username);
    const passwordOk = await verifyPassword(password, user?.passwordHash ?? (await this.dummyHash()));
    if (!user || !user.passwordHash || !passwordOk) {
      throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: INVALID_CREDENTIALS });
    }
    if (!user.isActive) {
      throw new UnauthorizedException({ code: 'ACCOUNT_INACTIVE', message: 'Tài khoản đã ngừng hoạt động.' });
    }
    const refreshToken = await this.dataSource.transaction((manager) => this.storeRefreshToken(manager, user.id, meta));
    await this.users.markLoggedIn(user.id);
    return this.buildTokens(user, refreshToken.plain);
  }

  /**
   * Rotates a refresh token: the presented token is revoked and a new one issued.
   * Presenting an already-rotated token means it leaked, so every session of that
   * account is revoked (reuse detection).
   */
  async refresh(presented: string, meta: ClientMeta): Promise<AuthTokens> {
    const outcome = await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(RefreshToken);
      const current = await repo.findOne({
        where: { tokenHash: hashRefreshToken(presented) },
        lock: { mode: 'pessimistic_write' },
      });
      if (!current) return { kind: 'invalid' as const };
      if (current.revokedAt) {
        await this.revokeAllForUser(manager, current.userId);
        return { kind: 'reused' as const, userId: current.userId };
      }
      if (current.expiresAt.getTime() <= Date.now()) return { kind: 'invalid' as const };

      const next = await this.storeRefreshToken(manager, current.userId, meta);
      await repo.update({ id: current.id }, { revokedAt: new Date(), replacedBy: next.id });
      return { kind: 'rotated' as const, userId: current.userId, plain: next.plain };
    });

    if (outcome.kind === 'reused') {
      this.logger.warn(`Refresh token reuse detected for user ${outcome.userId}; all sessions revoked`);
    }
    if (outcome.kind !== 'rotated') {
      throw new UnauthorizedException({ code: 'INVALID_REFRESH_TOKEN', message: INVALID_SESSION });
    }
    const identity = await this.users.findActiveIdentity(outcome.userId);
    if (!identity) {
      throw new UnauthorizedException({ code: 'ACCOUNT_INACTIVE', message: 'Tài khoản đã ngừng hoạt động.' });
    }
    return this.buildTokens(identity, outcome.plain);
  }

  /** Changes the caller's password after checking the current one; every session is signed out. */
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.users.findWithPassword(userId);
    const ok = user?.passwordHash ? await verifyPassword(currentPassword, user.passwordHash) : false;
    if (!user || !ok) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Mật khẩu hiện tại không đúng.',
        details: { fields: [{ field: 'currentPassword', message: 'Mật khẩu hiện tại không đúng.' }] },
      });
    }
    const passwordHash = await hashPassword(newPassword);
    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(User).update({ id: userId }, { passwordHash });
      await this.revokeAllForUser(manager, userId);
    });
  }

  /** Revokes one refresh token. Idempotent: unknown or already revoked tokens are ignored. */
  async logout(presented: string): Promise<void> {
    await this.dataSource
      .getRepository(RefreshToken)
      .update({ tokenHash: hashRefreshToken(presented), revokedAt: IsNull() }, { revokedAt: new Date() });
  }

  private dummyHash(): Promise<string> {
    this.timingDummyHash ??= hashPassword(randomBytes(16).toString('hex'));
    return this.timingDummyHash;
  }

  private async revokeAllForUser(manager: EntityManager, userId: string): Promise<void> {
    await manager.getRepository(RefreshToken).update({ userId, revokedAt: IsNull() }, { revokedAt: new Date() });
  }

  private async storeRefreshToken(manager: EntityManager, userId: string, meta: ClientMeta) {
    const plain = randomBytes(32).toString('base64url');
    const ttlDays = this.config.getOrThrow<number>('auth.refreshTokenTtlDays');
    const repo = manager.getRepository(RefreshToken);
    const saved = await repo.save(
      repo.create({
        userId,
        tokenHash: hashRefreshToken(plain),
        expiresAt: new Date(Date.now() + ttlDays * DAY_MS),
        userAgent: meta.userAgent?.slice(0, 300) ?? null,
        ip: meta.ip?.slice(0, 64) ?? null,
      }),
    );
    return { id: saved.id, plain };
  }

  private async buildTokens(user: Pick<User, 'id' | 'username' | 'role'>, refreshToken: string): Promise<AuthTokens> {
    const expiresIn = this.config.getOrThrow<number>('auth.accessTokenTtlSeconds');
    const payload: JwtPayload = { sub: user.id, username: user.username, role: user.role, jti: randomUUID() };
    const accessToken = await this.jwt.signAsync(payload, { expiresIn, algorithm: 'HS256' });
    const profile = await this.users.getProfile(user.id);
    if (!profile) throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: INVALID_CREDENTIALS });
    return { accessToken, refreshToken, tokenType: 'Bearer', expiresIn, user: profile };
  }
}
