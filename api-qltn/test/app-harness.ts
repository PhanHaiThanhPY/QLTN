import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Client } from 'pg';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp, prepareDatabase } from '../src/bootstrap';

const pgConfig = (database: string) => ({
  host: process.env.CONFIG_POSTGRES_HOST_QLTN,
  port: Number(process.env.CONFIG_POSTGRES_PORT_QLTN),
  user: process.env.CONFIG_POSTGRES_USER_QLTN,
  password: process.env.CONFIG_POSTGRES_PASSWORD_QLTN,
  database,
});

/** Creates the e2e database when missing and drops every table in it. */
export async function resetDatabase(): Promise<void> {
  const database = process.env.CONFIG_POSTGRES_DB_QLTN ?? '';
  if (!database.endsWith('_e2e')) throw new Error(`Refusing to reset non-e2e database "${database}"`);

  const admin = new Client(pgConfig('postgres'));
  await admin.connect();
  try {
    const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [database]);
    if (exists.rowCount === 0) await admin.query(`CREATE DATABASE "${database}"`);
  } finally {
    await admin.end();
  }

  const client = new Client(pgConfig(database));
  await client.connect();
  try {
    await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  } finally {
    await client.end();
  }
}

/** Boots the real app (same pipeline as main.ts) on a fresh database. */
export async function createApp(): Promise<NestExpressApplication> {
  await resetDatabase();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({ bodyParser: false, logger: ['error'] });
  configureApp(app, { requestLog: false });
  await prepareDatabase(app);
  await app.init();
  return app;
}

export const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD ?? '';

/** Logs in and returns a request helper that sends the bearer token. */
export async function signIn(server: App, username: string, password = DEMO_PASSWORD) {
  const res = await request(server).post('/api/auth/login').send({ username, password });
  if (res.status !== 200) throw new Error(`login ${username} failed: ${res.status} ${JSON.stringify(res.body)}`);
  const token = (res.body as { data: { accessToken: string } }).data.accessToken;
  const auth = { Authorization: `Bearer ${token}` };
  return {
    token,
    get: (url: string) => request(server).get(url).set(auth),
    post: (url: string, body: object) => request(server).post(url).set(auth).send(body),
    patch: (url: string, body: object) => request(server).patch(url).set(auth).send(body),
    put: (url: string, body: object) => request(server).put(url).set(auth).send(body),
  };
}
export type Session = Awaited<ReturnType<typeof signIn>>;

/** `data` of a success envelope. */
export const dataOf = <T>(res: { body: unknown }): T => (res.body as { data: T }).data;

/** `error` of an error envelope. */
export const errorOf = (res: { body: unknown }) =>
  (res.body as { error: { code: string; message: string; details: { fields?: Array<{ field: string }> } | null } })
    .error;

export const errorFields = (res: { body: unknown }): string[] =>
  (errorOf(res).details?.fields ?? []).map((f) => f.field);
