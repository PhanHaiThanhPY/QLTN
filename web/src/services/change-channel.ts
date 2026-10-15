const CHANNEL_NAME = 'qltn-demo-changes';

type Listener = () => void;

let channel: BroadcastChannel | null = null;
const localListeners = new Set<Listener>();

const getChannel = (): BroadcastChannel | null => {
  if (channel || typeof BroadcastChannel === 'undefined') return channel;
  channel = new BroadcastChannel(CHANNEL_NAME);
  return channel;
};

/** Notifies this tab and other tabs that demo data changed. */
export const broadcastChange = (): void => {
  localListeners.forEach((listener) => listener());
  try {
    getChannel()?.postMessage({ type: 'changed', at: Date.now() });
  } catch (error) {
    console.error('Broadcast change failed:', error);
  }
};

/** Subscribes to changes made in other tabs; returns an unsubscribe function. */
export const subscribeExternalChanges = (listener: Listener): (() => void) => {
  const target = getChannel();
  if (!target) return () => undefined;
  const handler = (): void => listener();
  target.addEventListener('message', handler);
  return () => target.removeEventListener('message', handler);
};

export const subscribeLocalChanges = (listener: Listener): (() => void) => {
  localListeners.add(listener);
  return () => localListeners.delete(listener);
};
