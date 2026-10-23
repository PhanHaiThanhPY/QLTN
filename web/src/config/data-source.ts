/**
 * Where the screens read data from (plan decision D1).
 * - `mock` (default): the seeded IndexedDB demo, unchanged.
 * - `api`: the real `api-qltn` backend over HTTP.
 */
export type DataSource = 'mock' | 'api';

const envValue = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const readDataSource = (): DataSource => (envValue(import.meta.env.VITE_DATA_SOURCE).toLowerCase() === 'api' ? 'api' : 'mock');

export const DATA_SOURCE: DataSource = readDataSource();
export const IS_API_MODE = DATA_SOURCE === 'api';

/** Base URL of the backend; Vite proxies `/api` to api-qltn in development. */
export const API_BASE_URL = envValue(import.meta.env.VITE_API_BASE_URL).replace(/\/+$/, '') || '/api';
