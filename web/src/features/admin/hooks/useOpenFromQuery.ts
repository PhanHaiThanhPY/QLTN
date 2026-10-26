import { useEffect } from 'react';
import { useSearchParams } from 'react-router';

/** Query parameter a link uses to open an item's dialog, e.g. the operation log (SPEC AD-S1 BR-06). */
export const OPEN_PARAM = 'open';

/**
 * Opens the dialog of `?open=<id>` once the items are loaded, then drops the parameter so closing the dialog does
 * not reopen it. An unknown id is ignored.
 */
export const useOpenFromQuery = <T extends { id: string }>(items: readonly T[], open: (item: T) => void): void => {
  const [params, setParams] = useSearchParams();
  const wanted = params.get(OPEN_PARAM);
  useEffect(() => {
    if (!wanted) return;
    const item = items.find((row) => row.id === wanted);
    if (!item) return;
    open(item);
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete(OPEN_PARAM);
        return next;
      },
      { replace: true },
    );
  }, [wanted, items, open, setParams]);
};
