import type { NestExpressApplication } from '@nestjs/platform-express';
import request, { type Response } from 'supertest';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { DatabaseMigrationService } from '../src/database/database-migration.service';
import { DatabaseSeedService } from '../src/database/seeds/database-seed.service';
import { createApp } from './app-harness';

const PASSWORD = process.env.SEED_DEMO_PASSWORD ?? '';

interface ErrorBody {
  error: { code: string; message: string; details: { fields?: Array<{ field: string }> } | null };
}

interface MeBody {
  data: Record<string, unknown> & { capabilities: string[] };
}

const errorOf = (res: Response) => (res.body as ErrorBody).error;

interface TokensBody {
  data: { accessToken: string; refreshToken: string; expiresIn: number; user: { buildingIds: string[] } };
}

describe('Auth (e2e)', () => {
  let app: NestExpressApplication;
  let server: App;
  let dataSource: DataSource;

  const login = (username: string, password = PASSWORD) =>
    request(server).post('/api/auth/login').send({ username, password });

  beforeAll(async () => {
    app = await createApp();
    server = app.getHttpServer();
    dataSource = app.get<DataSource>(DataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  it('migrations and seed are idempotent on a second boot', async () => {
    expect(await app.get(DatabaseMigrationService).run()).toEqual([]);
    await app.get(DatabaseSeedService).run();
    const [{ count }] = await dataSource.query<Array<{ count: number }>>('SELECT count(*)::int AS count FROM users');
    expect(count).toBe(10);
  });

  it('serves the health check without a token, in the standard envelope', async () => {
    const res = await request(server).get('/api/public/health-check').expect(200);
    expect(res.body).toMatchObject({ success: true, data: { status: 'ok', database: 'up' } });
    expect(res.headers['x-correlation-id']).toBeTruthy();
  });

  it('rejects protected routes without a token', async () => {
    const res = await request(server).get('/api/auth/me').expect(401);
    expect(res.body).toMatchObject({ success: false, error: { code: 'UNAUTHORIZED' } });
  });

  it('returns the same error for an unknown user and a wrong password', async () => {
    const unknown = await login('khong-ton-tai').expect(401);
    const wrong = await login('bql-a', 'wrong-password').expect(401);
    expect(errorOf(unknown)).toEqual(errorOf(wrong));
    expect(errorOf(wrong).code).toBe('INVALID_CREDENTIALS');
  });

  it('refuses an inactive account', async () => {
    const res = await login('kt-a-cu').expect(401);
    expect(errorOf(res).code).toBe('ACCOUNT_INACTIVE');
  });

  it('validates the body in Vietnamese and forbids unknown fields', async () => {
    const res = await request(server).post('/api/auth/login').send({ username: 'bql-a', extra: 1 }).expect(400);
    expect(errorOf(res).code).toBe('VALIDATION_ERROR');
    const fields = (errorOf(res).details?.fields ?? []).map((f) => f.field);
    expect(fields).toEqual(expect.arrayContaining(['password', 'extra']));
  });

  it('logs in, exposes the building-scoped profile and never the password hash', async () => {
    const res = await login('BQL-A').expect(200);
    const body = res.body as TokensBody;
    expect(body.data.expiresIn).toBe(600);
    expect(body.data.user.buildingIds).toHaveLength(1);

    const me = await request(server).get('/api/auth/me').set('Authorization', `Bearer ${body.data.accessToken}`);
    expect(me.status).toBe(200);
    const profile = (me.body as MeBody).data;
    expect(profile).toMatchObject({ code: 'BQL-A', role: 'BQL', departmentName: 'Ban quản lý' });
    expect(profile.capabilities).toContain('RECORD_EDIT');
    expect(profile.capabilities).not.toContain('ACCOUNT_MANAGE');
    expect(JSON.stringify(me.body)).not.toMatch(/password/i);
  });

  it('rotates refresh tokens and revokes every session when a used token is replayed', async () => {
    const first = ((await login('kt-a').expect(200)).body as TokensBody).data;
    const rotated = (await request(server).post('/api/auth/refresh').send({ refreshToken: first.refreshToken }))
      .body as TokensBody;
    expect(rotated.data.refreshToken).not.toBe(first.refreshToken);

    await request(server).post('/api/auth/refresh').send({ refreshToken: first.refreshToken }).expect(401);
    // Replay of the old token revoked the family: the newer token is dead too.
    const after = await request(server).post('/api/auth/refresh').send({ refreshToken: rotated.data.refreshToken });
    expect(after.status).toBe(401);
    expect(errorOf(after).code).toBe('INVALID_REFRESH_TOKEN');
  });

  it('logout revokes the refresh token and is idempotent', async () => {
    const tokens = ((await login('tvkt').expect(200)).body as TokensBody).data;
    await request(server).post('/api/auth/logout').send({ refreshToken: tokens.refreshToken }).expect(200);
    await request(server).post('/api/auth/logout').send({ refreshToken: tokens.refreshToken }).expect(200);
    await request(server).post('/api/auth/refresh').send({ refreshToken: tokens.refreshToken }).expect(401);
  });

  it('rejects an existing access token as soon as the account is deactivated', async () => {
    const tokens = ((await login('bqt').expect(200)).body as TokensBody).data;
    const auth = { Authorization: `Bearer ${tokens.accessToken}` };
    await request(server).get('/api/auth/me').set(auth).expect(200);

    await dataSource.query(`UPDATE users SET is_active = false WHERE username = 'bqt'`);
    await request(server).get('/api/auth/me').set(auth).expect(401);
    await request(server).post('/api/auth/refresh').send({ refreshToken: tokens.refreshToken }).expect(401);
  });

  it('rejects a token signed with another secret', async () => {
    const forged =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwMDAwMDAwMC0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDAifQ.' +
      'c2lnbmF0dXJlLW5vdC12YWxpZA';
    await request(server).get('/api/auth/me').set('Authorization', `Bearer ${forged}`).expect(401);
  });
});
