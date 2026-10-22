/** Access + refresh token pair of the real backend session. */
export interface ApiSession {
  accessToken: string;
  refreshToken: string;
}

export const API_SESSION_STORAGE_KEY = 'qltn-api-session';

type SessionListener = (session: ApiSession | null) => void;

const listeners = new Set<SessionListener>();

const storage = (): Storage | null => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch (error) {
    console.error('Read localStorage failed:', error);
    return null;
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const notify = (session: ApiSession | null): void => {
  for (const listener of listeners) listener(session);
};

/** Current session; `null` when signed out or when the stored value is malformed. */
export const readApiSession = (): ApiSession | null => {
  const raw = storage()?.getItem(API_SESSION_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;
    const { accessToken, refreshToken } = parsed;
    if (typeof accessToken !== 'string' || typeof refreshToken !== 'string') return null;
    if (!accessToken || !refreshToken) return null;
    return { accessToken, refreshToken };
  } catch (error) {
    console.error('Read API session failed:', error);
    return null;
  }
};

export const saveApiSession = (session: ApiSession): void => {
  try {
    storage()?.setItem(API_SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch (error) {
    console.error('Write API session failed:', error);
  }
  notify(session);
};

/** Drops the stored tokens and tells every subscriber the session is gone (expiry or sign-out). */
export const clearApiSession = (): void => {
  try {
    storage()?.removeItem(API_SESSION_STORAGE_KEY);
  } catch (error) {
    console.error('Clear API session failed:', error);
  }
  notify(null);
};

/** Keeps in-memory state (profile cache, session store) in sync with token changes in this tab. */
export const subscribeApiSession = (listener: SessionListener): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
