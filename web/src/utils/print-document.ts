/** How long the blob URL stays valid: the new tab must finish loading it first. */
export const PRINT_URL_REVOKE_DELAY_MS = 60_000;
const PRINT_POLL_INTERVAL_MS = 100;
const PRINT_POLL_MAX_ATTEMPTS = 100;

const isPreviewReady = (preview: Window, url: string): boolean =>
  preview.location.href === url && preview.document.readyState === 'complete';

/** Calls print() from the opener once the blob document has loaded (bounded polling). */
const printWhenLoaded = (preview: Window, url: string): void => {
  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    try {
      if (preview.closed || attempts > PRINT_POLL_MAX_ATTEMPTS) {
        window.clearInterval(timer);
        return;
      }
      if (!isPreviewReady(preview, url)) return;
      window.clearInterval(timer);
      // The generated document never needs its opener; drop the back-reference once loaded.
      preview.opener = null;
      preview.focus();
      preview.print();
    } catch (error) {
      window.clearInterval(timer);
      console.error('Print preview failed:', error);
    }
  }, PRINT_POLL_INTERVAL_MS);
};

/**
 * Opens a standalone HTML document in a new tab via a blob URL and prints it.
 * The document carries no script (the CSP `script-src 'self'` applies to blob documents too),
 * so printing is triggered from the opener. Returns false when the popup was blocked.
 */
export const openPrintableHtml = (html: string): boolean => {
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  // No 'noopener' here: with it window.open() always returns null and print() cannot be called.
  const preview = window.open(url, '_blank');
  if (!preview) {
    URL.revokeObjectURL(url);
    return false;
  }
  window.setTimeout(() => URL.revokeObjectURL(url), PRINT_URL_REVOKE_DELAY_MS);
  printWhenLoaded(preview, url);
  return true;
};
