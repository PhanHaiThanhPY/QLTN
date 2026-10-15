import type { DemoSettings } from '@/domain/types';
import { validationError } from '@/domain/errors';
import { getDb } from '@/storage/db';

const SETTINGS_KEY = 'settings';
const DEFAULT_SETTINGS: DemoSettings = { latencyMs: 0, failNextCommand: false };
export const LATENCY_LIMITS = { MIN: 0, MAX: 5000 } as const;

const isSettings = (value: unknown): value is DemoSettings =>
  typeof value === 'object' &&
  value !== null &&
  Number.isFinite((value as DemoSettings).latencyMs) &&
  typeof (value as DemoSettings).failNextCommand === 'boolean';

export const getSettings = async (): Promise<DemoSettings> => {
  const row = await getDb().meta.get(SETTINGS_KEY);
  return isSettings(row?.value) ? row.value : DEFAULT_SETTINGS;
};

/** Latency must be a finite number (NaN/Infinity rejected); it is rounded to whole ms and clamped. */
export const saveSettings = async (settings: DemoSettings): Promise<void> => {
  if (typeof settings.latencyMs !== 'number' || !Number.isFinite(settings.latencyMs)) {
    throw validationError({ latencyMs: `Độ trễ là số từ ${LATENCY_LIMITS.MIN} đến ${LATENCY_LIMITS.MAX} ms.` });
  }
  const latencyMs = Math.max(LATENCY_LIMITS.MIN, Math.min(LATENCY_LIMITS.MAX, Math.round(settings.latencyMs)));
  await getDb().meta.put({ key: SETTINGS_KEY, value: { latencyMs, failNextCommand: settings.failNextCommand === true } });
};
