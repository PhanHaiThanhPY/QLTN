import { create } from 'zustand';

type Theme = 'light' | 'dark';
const THEME_KEY = 'qltn-demo-theme';
const ASSISTANT_MESSAGES_KEY = 'qltn-demo-assistant-messages';

export interface AssistantChatMessage {
  id: string;
  role: 'assistant' | 'user';
  content: string;
  context?: string;
}

const isAssistantChatMessage = (value: unknown): value is AssistantChatMessage => {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === 'string' && (row.role === 'assistant' || row.role === 'user') && typeof row.content === 'string';
};

const readAssistantMessages = (): AssistantChatMessage[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.sessionStorage.getItem(ASSISTANT_MESSAGES_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isAssistantChatMessage).slice(-40) : [];
  } catch (error) {
    console.error('Read assistant messages failed:', error);
    return [];
  }
};

const saveAssistantMessages = (messages: AssistantChatMessage[]): void => {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(ASSISTANT_MESSAGES_KEY, JSON.stringify(messages));
  } catch (error) {
    console.error('Save assistant messages failed:', error);
  }
};

const readTheme = (): Theme => {
  try {
    return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light';
  } catch (error) {
    console.error('Read theme failed:', error);
    return 'light';
  }
};

const applyTheme = (theme: Theme): void => {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch (error) {
    console.error('Save theme failed:', error);
  }
};

interface UiState {
  theme: Theme;
  isSidebarOpen: boolean;
  isSidebarCollapsed: boolean;
  isAssistantOpen: boolean;
  isAssistantCollapsed: boolean;
  assistantMessages: AssistantChatMessage[];
  assistantQueuedPrompt: string | null;
  toggleTheme: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebarCollapsed: () => void;
  toggleAssistant: () => void;
  setAssistantOpen: (open: boolean) => void;
  setAssistantCollapsed: (collapsed: boolean) => void;
  addAssistantMessage: (message: AssistantChatMessage) => void;
  clearAssistantMessages: () => void;
  /** Drops chat history and any queued prompt, e.g. when the signed-in account changes. */
  resetAssistantConversation: () => void;
  queueAssistantPrompt: (prompt: string) => void;
  clearAssistantQueuedPrompt: () => void;
}

const initialTheme = readTheme();
if (typeof document !== 'undefined') applyTheme(initialTheme);

/** Per-viewer UI conveniences (theme, sidebar). */
export const useUiStore = create<UiState>((set, get) => ({
  theme: initialTheme,
  isSidebarOpen: false,
  isSidebarCollapsed: false,
  isAssistantOpen: false,
  isAssistantCollapsed: true,
  assistantMessages: readAssistantMessages(),
  assistantQueuedPrompt: null,
  toggleTheme: () => {
    const theme: Theme = get().theme === 'dark' ? 'light' : 'dark';
    applyTheme(theme);
    set({ theme });
  },
  setSidebarOpen: (open) => set({ isSidebarOpen: open }),
  toggleSidebarCollapsed: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
  toggleAssistant: () => set((state) => ({ isAssistantOpen: !state.isAssistantOpen, isAssistantCollapsed: false })),
  setAssistantOpen: (open) => set({ isAssistantOpen: open, isAssistantCollapsed: !open }),
  setAssistantCollapsed: (collapsed) => set({ isAssistantCollapsed: collapsed, isAssistantOpen: !collapsed }),
  addAssistantMessage: (message) => set((state) => {
    const assistantMessages = [...state.assistantMessages, message].slice(-40);
    saveAssistantMessages(assistantMessages);
    return { assistantMessages };
  }),
  clearAssistantMessages: () => {
    saveAssistantMessages([]);
    set({ assistantMessages: [] });
  },
  resetAssistantConversation: () => {
    saveAssistantMessages([]);
    set({ assistantMessages: [], assistantQueuedPrompt: null });
  },
  queueAssistantPrompt: (prompt) => set({ assistantQueuedPrompt: prompt }),
  clearAssistantQueuedPrompt: () => set({ assistantQueuedPrompt: null }),
}));
