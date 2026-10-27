import { useEffect, type ReactNode } from 'react';
import '../print-sheet.css';

interface PrintSheetProps {
  /** Document name for the footer and the page heading (BR-B7-06). */
  title: string;
  recordCode: string;
  printedAt: string;
  /** BR-B7-04: "CHƯA PHÊ DUYỆT" or "CHƯA HOÀN TẤT" across the page while the document is not final. */
  watermark?: string;
  children: ReactNode;
}

/** CSS strings cannot hold a raw quote or backslash; the footer text is generated, so it is escaped. */
const cssString = (text: string): string => `"${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

/**
 * Printed footer on every page with "trang X/Y" (BR-B7-06), from an `@page` margin box for this document. Added only
 * where the browser has a CSS object model; a browser without margin boxes prints without the page footer
 * (accepted by ui-brief §2.2).
 */
const usePageFooter = (footer: string): void => {
  useEffect(() => {
    if (typeof window.CSS === 'undefined') return undefined;
    const style = document.createElement('style');
    style.textContent = `@media print { @page { @bottom-left { content: ${cssString(`${footer} · trang `)} counter(page) "/" counter(pages); font-family: 'Times New Roman', Times, serif; font-size: 9pt; } } }`;
    document.head.appendChild(style);
    return () => style.remove();
  }, [footer]);
};

/** One A4 paper document (ui-brief §2.2); the on-screen footer shows the printed footer's text without page numbers. */
export const PrintSheet = ({ title, recordCode, printedAt, watermark, children }: PrintSheetProps) => {
  const footer = `Bản in từ hệ thống QLTN · ${recordCode} · ${title} · in lúc ${printedAt}`;
  usePageFooter(footer);
  return (
    <article className="d5-sheet" aria-labelledby="d5-title">
      {watermark ? (
        <>
          <div className="d5-watermark" aria-hidden>
            {watermark}
          </div>
          <p className="sr-only">Bản chưa phê duyệt</p>
        </>
      ) : null}
      {children}
      <footer className="d5-footer">{footer}</footer>
    </article>
  );
};
