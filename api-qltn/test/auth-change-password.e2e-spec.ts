import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { App } from 'supertest/types';
import { createApp, errorFields, errorOf } from './app-harness';

const PASSWORD = process.env.SEED_DEMO_PASSWORD ?? '';
const NEW_PASSWORD = 'Doi-mat-khau-AU1';

interface TokensBody {
  data: { accessToken: string; refreshToken: string };
}

/** AU-S1 (docs/product/features/AU-doi-mat-khau/SPEC.md): API side of changing one's own password. */
describe('Change own password, AU-S1 (e2e)', () => {
  let app: NestExpressApplication;
  let server: App;

  const login = (username: string, password: string) =>
    request(server).post('/api/auth/login').send({ username, password });

  const tokensOf = async (username: string, password: string) =>
    ((await login(username, password).expect(200)).body as TokensBody).data;

  const changePassword = (accessToken: string, currentPassword: string, newPassword: string) =>
    request(server)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ currentPassword, newPassword });

  beforeAll(async () => {
    app = await createApp();
    server = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
  });

  it('AC-3: refuses a new password equal to the current one on newPassword and keeps the password', async () => {
    const session = await tokensOf('kt-a', PASSWORD);

    const res = await changePassword(session.accessToken, PASSWORD, PASSWORD).expect(400);
    expect(errorOf(res).code).toBe('VALIDATION_ERROR');
    expect(errorFields(res)).toEqual(['newPassword']);
    expect(errorOf(res).message).toBe('Mật khẩu mới phải khác mật khẩu hiện tại.');

    await login('kt-a', PASSWORD).expect(200);
  });

  it('checks the current password before comparing the new one', async () => {
    const session = await tokensOf('kt-b', PASSWORD);

    const res = await changePassword(session.accessToken, 'sai-mat-khau', 'sai-mat-khau').expect(400);
    expect(errorFields(res)).toEqual(['currentPassword']);
  });

  it('AC-4: a successful change signs every session out and only the new password logs in', async () => {
    const sessionA = await tokensOf('kt-a2', PASSWORD);
    const sessionB = await tokensOf('kt-a2', PASSWORD);

    await changePassword(sessionA.accessToken, PASSWORD, NEW_PASSWORD).expect(200);

    await request(server).post('/api/auth/refresh').send({ refreshToken: sessionB.refreshToken }).expect(401);
    await request(server).post('/api/auth/refresh').send({ refreshToken: sessionA.refreshToken }).expect(401);
    await login('kt-a2', PASSWORD).expect(401);
    await login('kt-a2', NEW_PASSWORD).expect(200);
  });
});
