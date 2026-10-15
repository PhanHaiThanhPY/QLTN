import { create } from 'zustand';
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
  signIn: (userId: string) => void;
  signOut: () => void;
  /** Sync from another tab (storage event). */
  syncFromStorage: () => void;
}

/** Assistant answers are scoped to the viewer's role; never carry them over to another account. */
const resetAssistantConversation = (): void => useUiStore.getState().resetAssistantConversation();

const initial = readStored();
setSessionUserId(initial);

/** Simulated demo login: only remembers which seeded account is active. */
export const useSessionStore = create<SessionState>((set, get) => ({
  userId: initial,
  signIn: (userId) => {
    if (get().userId !== userId) resetAssistantConversation();
    writeStored(userId);
    setSessionUserId(userId);
    set({ userId });
  },
  signOut: () => {
    resetAssistantConversation();
    writeStored(null);
    setSessionUserId(null);
    set({ userId: null });
  },
  syncFromStorage: () => {
    const userId = readStored();
    if (get().userId !== userId) resetAssistantConversation();
    setSessionUserId(userId);
    set({ userId });
  },
}));

export const SESSION_STORAGE_KEY = STORAGE_KEY;
