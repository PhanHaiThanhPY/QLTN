import { useCallback, useSyncExternalStore } from 'react';

const supported = (): boolean => typeof window !== 'undefined' && typeof window.matchMedia === 'function';

/** Whether a CSS media query matches now; true where matchMedia is missing (tests, old browsers). */
export const useMediaQuery = (query: string): boolean => {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!supported()) return () => undefined;
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => (supported() ? window.matchMedia(query).matches : true),
    () => true,
  );
};
