import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';

/** Sequential human-readable codes (VT-01, SC-0001…), allocated atomically inside the caller's transaction. */
@Injectable()
export class CodeCounterService {
  /** `separator` is '' for codes like KQ-TG01 (T-S1). */
  async next(manager: EntityManager, prefix: string, width: number, separator = '-'): Promise<string> {
    const rows = await manager.query<Array<{ value: number }>>(
      `INSERT INTO code_counters (key, value) VALUES ($1, 1)
       ON CONFLICT (key) DO UPDATE SET value = code_counters.value + 1
       RETURNING value`,
      [prefix],
    );
    return `${prefix}${separator}${String(rows[0].value).padStart(width, '0')}`;
  }

  /** Moves a counter forward so later codes continue after seeded ones (never backwards). */
  async ensureAtLeast(manager: EntityManager, prefix: string, value: number): Promise<void> {
    await manager.query(
      `INSERT INTO code_counters (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = GREATEST(code_counters.value, EXCLUDED.value)`,
      [prefix, value],
    );
  }
}
