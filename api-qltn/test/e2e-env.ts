import 'dotenv/config';

/**
 * E2E runs against a dedicated database (default `qltn_e2e`) that the suite wipes.
 * The name must end in `_e2e` so a misconfigured run can never touch dev data.
 */
const database = process.env.E2E_POSTGRES_DB ?? 'qltn_e2e';
if (!database.endsWith('_e2e')) {
  throw new Error(`E2E database "${database}" must end with _e2e`);
}
process.env.CONFIG_POSTGRES_DB_QLTN = database;
process.env.CONFIG_LOGGER_LEVEL = 'ERROR';
process.env.SEED_DEMO_DATA = 'true';
process.env.SEED_DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD || 'e2e-demo-password';
process.env.ACCESS_TOKEN_TTL_SECONDS = '600';
