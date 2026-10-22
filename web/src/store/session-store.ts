import { create } from 'zustand';
import { IS_API_MODE } from '@/config/data-source';
import { AppError, ERROR_CODE } from '@/domain/errors';
import { fetchViewerProfile, loginWithPassword, logoutWithRefreshToken } from '@/services/http/auth-api';
import { clearApiSession, readApiSession, subscribeApiSession } from '@/services/http/token-store';
import { setSessionUserId } from '@/services/runtime';
import { useUiStore } from './ui-store';

const STORAGE_KEY = 'qltn-demo-session';

const readStored = (): string | null => {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    console.error('Read session failed:', error);
    return null;
  }
};

const writeStored = (userId: string | null): void => {
  try {
    if (userId) localStorage.setItem(STORAGE_KEY, userId);
    else localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Write session failed:', error);
  }
};

interface SessionState {
  userId: string | null;
  /** Simulated demo login (mock mode only). */
  signIn: (userId: string) => void;
  /** Real login against api-qltn (api mode). */
  signInWithPassword: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Sync from another tab (storage event). */
  syncFromStorage: () => void;
}

/** Assistant answers are scoped to the viewer's role; never carry them over to another account. */
const resetAssistantConversation = (): void => useUiStore.getState().resetAssistantConversation();

/** The demo session key is meaningless in api mode: the token store owns the session there. */
const initial = IS_API_MODE ? null : readStored();
setSessionUserId(initial);

/**
 * Session of the current tab.
 * - `mock`: remembers which seeded account is active (unchanged behaviour).
 * - `api`: `userId` is the profile id from `/auth/me`; tokens live in the token store.
 */
export const useSessionStore = create<SessionState>((set, get) => ({
  userId: initial,
  signIn: (userId) => {
    if (IS_API_MODE) throw new AppError(ERROR_CODE.FORBIDDEN, 'Chế độ API yêu cầu đăng nhập bằng tên đăng nhập và mật khẩu.');
    if (get().userId !== userId) resetAssistantConversation();
    writeStored(userId);
    setSessionUserId(userId);
    set({ userId });
  },
  signInWithPassword: async (username, password) => {
    if (!IS_API_MODE) throw new AppError(ERROR_CODE.FORBIDDEN, 'Chế độ mock đăng nhập bằng cách chọn tài khoản demo.');
    const viewer = await loginWithPassword(username, password);
    if (get().userId !== viewer.id) resetAssistantConversation();
    writeStored(null);
    setSessionUserId(viewer.id);
    set({ userId: viewer.id });
  },
  signOut: () => {
    resetAssistantConversation();
    if (IS_API_MODE) {
      const session = readApiSession();
      setSessionUserId(null);
      set({ userId: null });
      clearApiSession();
      if (!session) return Promise.resolve();
      return logoutWithRefreshToken(session.refreshToken).catch((error: unknown) => {
        console.error('Logout failed:', error);
      });
    }
    writeStored(null);
    setSessionUserId(null);
    set({ userId: null });
    return Promise.resolve();
  },
  syncFromStorage: () => {
    if (IS_API_MODE) {
      void bootstrapApiSession();
      return;
    }
    const userId = readStored();
    if (get().userId !== userId) resetAssistantConversation();
    setSessionUserId(userId);
    set({ userId });
  },
}));

const clearSessionState = (): void => {
  resetAssistantConversation();
  setSessionUserId(null);
  useSessionStore.setState({ userId: null });
};

/**
 * Restores an api session on boot (tokens from a previous visit) and exposes the profile id
 * as `userId`, so the shell does not flash the login page.
 */
export const bootstrapApiSession = async (): Promise<void> => {
  if (!IS_API_MODE) return;
  if (!readApiSession()) {
    clearSessionState();
    return;
  }
  try {
    const viewer = await fetchViewerProfile();
    setSessionUserId(viewer.id);
    useSessionStore.setState({ userId: viewer.id });
  } catch (error) {
    console.error('Restore session failed:', error);
    clearApiSession();
    clearSessionState();
  }
};

/**
 * A refresh failure (or another tab signing out) clears the tokens; mirror that in the store
 * so `AppLayout` sends the user back to `/login`.
 */
subscribeApiSession((session) => {
  if (!IS_API_MODE || session) return;
  if (useSessionStore.getState().userId === null) return;
  clearSessionState();
});

export const SESSION_STORAGE_KEY = STORAGE_KEY;
