/**
 * Typed configuration for api-qltn.
 *
 * Tunables (TTL, port, log level) have sensible defaults. Connection settings and
 * secrets do NOT: a missing value throws at boot so the service never runs on a
 * guessable default secret.
 */

function env(name: string): string | undefined {
  return process.env[name]?.trim() || undefined;
}

/** Reads a required variable. Missing or empty → throw, the service does not start. */
function required(name: string): string {
  const value = env(name);
  if (!value) {
    throw new Error(`[api-qltn] Thiếu biến môi trường bắt buộc: ${name}. Xem .env.example để biết danh sách đầy đủ.`);
  }
  return value;
}

function positiveInt(name: string, fallback: number): number {
  const raw = env(name);
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`[api-qltn] Biến ${name} phải là số nguyên dương (đang là "${raw}").`);
  }
  return value;
}

const MIN_JWT_SECRET_LENGTH = 32;

function jwtSecret(): string {
  const secret = required('CONFIG_JWT_SECRET');
  if (secret.length < MIN_JWT_SECRET_LENGTH) {
    throw new Error(`[api-qltn] CONFIG_JWT_SECRET phải dài tối thiểu ${MIN_JWT_SECRET_LENGTH} ký tự.`);
  }
  return secret;
}

export interface AppConfig {
  port: number;
  nodeEnv: string;
  timezone: string;
  corsOrigins: string[];
  database: {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
    migrationFailFast: boolean;
  };
  auth: {
    jwtSecret: string;
    accessTokenTtlSeconds: number;
    refreshTokenTtlDays: number;
  };
  seed: {
    demoData: boolean;
    demoPassword: string | undefined;
  };
}

export default (): AppConfig => ({
  port: positiveInt('SERVICE_PORT', 5300),
  nodeEnv: env('CONFIG_ENV_MODE') ?? 'development',
  timezone: env('APP_TIMEZONE') ?? 'Asia/Ho_Chi_Minh',
  corsOrigins: (env('CORS_ORIGINS') ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  database: {
    host: required('CONFIG_POSTGRES_HOST_QLTN'),
    port: positiveInt('CONFIG_POSTGRES_PORT_QLTN', 5432),
    username: required('CONFIG_POSTGRES_USER_QLTN'),
    password: required('CONFIG_POSTGRES_PASSWORD_QLTN'),
    database: required('CONFIG_POSTGRES_DB_QLTN'),
    migrationFailFast: env('MIGRATION_FAIL_FAST') !== 'false',
  },
  auth: {
    jwtSecret: jwtSecret(),
    accessTokenTtlSeconds: positiveInt('ACCESS_TOKEN_TTL_SECONDS', 3600),
    refreshTokenTtlDays: positiveInt('REFRESH_TOKEN_TTL_DAYS', 7),
  },
  seed: {
    demoData: env('SEED_DEMO_DATA') === 'true',
    demoPassword: env('SEED_DEMO_PASSWORD'),
  },
});
