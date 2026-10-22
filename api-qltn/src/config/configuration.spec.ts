import configuration from './configuration';

const BASE_ENV = {
  CONFIG_POSTGRES_HOST_QLTN: 'localhost',
  CONFIG_POSTGRES_PORT_QLTN: '5434',
  CONFIG_POSTGRES_USER_QLTN: 'qltn',
  CONFIG_POSTGRES_PASSWORD_QLTN: 'pw',
  CONFIG_POSTGRES_DB_QLTN: 'qltn_test',
  CONFIG_JWT_SECRET: 'x'.repeat(40),
};

describe('configuration', () => {
  const original = process.env;
  afterEach(() => {
    process.env = original;
  });

  it('loads defaults for tunables', () => {
    process.env = { ...BASE_ENV };
    const config = configuration();
    expect(config.port).toBe(5300);
    expect(config.auth.accessTokenTtlSeconds).toBe(3600);
    expect(config.database.migrationFailFast).toBe(true);
    expect(config.corsOrigins).toEqual([]);
  });

  it('refuses to boot without a required secret', () => {
    process.env = { ...BASE_ENV, CONFIG_JWT_SECRET: '' };
    expect(() => configuration()).toThrow('CONFIG_JWT_SECRET');
  });

  it('refuses a short JWT secret', () => {
    process.env = { ...BASE_ENV, CONFIG_JWT_SECRET: 'short' };
    expect(() => configuration()).toThrow('tối thiểu');
  });

  it('rejects a non-numeric port', () => {
    process.env = { ...BASE_ENV, SERVICE_PORT: 'abc' };
    expect(() => configuration()).toThrow('SERVICE_PORT');
  });
});
