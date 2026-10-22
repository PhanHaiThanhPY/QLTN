import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { promises as fs } from 'fs';
import * as path from 'path';
import { DataSource } from 'typeorm';

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');
/** Serialises concurrent boots (several instances starting at once) on one migration run. */
const MIGRATION_LOCK_KEY = 4_217_001;

/**
 * Applies `database/migrations/*.sql` in filename order (`YYYY-MM-DD[a-z]-slug.sql`),
 * each in its own transaction, recording applied files in `_migrations`. Runs at boot
 * before the service listens. There is no TypeORM synchronize: schema changes only
 * go through these files.
 */
@Injectable()
export class DatabaseMigrationService {
  private readonly logger = new Logger(DatabaseMigrationService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  async run(): Promise<string[]> {
    const failFast = this.config.get<boolean>('database.migrationFailFast', true);
    const files = await this.listFiles();
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    const applied: string[] = [];

    try {
      await runner.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_KEY]);
      await runner.query(
        `CREATE TABLE IF NOT EXISTS _migrations (name varchar(200) PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`,
      );
      const rows = (await runner.query('SELECT name FROM _migrations')) as Array<{ name: string }>;
      const done = new Set(rows.map((row) => row.name));

      for (const file of files.filter((name) => !done.has(name))) {
        const sql = await fs.readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
        await runner.startTransaction();
        try {
          await runner.query(sql);
          await runner.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
          await runner.commitTransaction();
          applied.push(file);
          this.logger.log(`Applied migration ${file}`);
        } catch (err) {
          await runner.rollbackTransaction();
          const message = `Migration ${file} thất bại: ${(err as Error).message}`;
          if (failFast) throw new Error(`[api-qltn] ${message}`);
          this.logger.error(message, (err as Error).stack);
        }
      }
      if (applied.length === 0) this.logger.log('Schema is up to date');
      return applied;
    } finally {
      await runner.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_KEY]).catch((err: Error) => {
        this.logger.warn(`Could not release migration lock: ${err.message}`);
      });
      await runner.release();
    }
  }

  private async listFiles(): Promise<string[]> {
    const entries = await fs.readdir(MIGRATIONS_DIR);
    return entries.filter((name) => name.endsWith('.sql')).sort();
  }
}
