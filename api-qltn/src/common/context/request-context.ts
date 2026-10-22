import { AsyncLocalStorage } from 'async_hooks';

interface RequestContextStore {
  correlationId: string;
}

const storage = new AsyncLocalStorage<RequestContextStore>();

/** Per-request values available anywhere in the call chain (e.g. the audit writer). */
export const RequestContext = {
  run<T>(store: RequestContextStore, fn: () => T): T {
    return storage.run(store, fn);
  },
  correlationId(): string | null {
    return storage.getStore()?.correlationId ?? null;
  },
};
