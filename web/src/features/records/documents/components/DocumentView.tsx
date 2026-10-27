import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { watermarkOf, type PrintableDocument } from '../build-document';
import { printDateTime } from '../print-format';
import { MinutesDocument } from './MinutesDocument';
import { PaymentLetterDocument } from './PaymentLetterDocument';
import { PrintSheet } from './PrintSheet';
import { ProposalDocument } from './ProposalDocument';

interface DocumentViewProps {
  recordId: string;
  recordCode: string;
  document: PrintableDocument;
}

/** Waits for every signature image of the sheet, so a print never misses one (ui-brief §4 Loading). */
const useImagesReady = (sheet: React.RefObject<HTMLDivElement | null>, key: unknown): boolean => {
  const [isReady, setReady] = useState(false);
  useEffect(() => {
    let isCurrent = true;
    setReady(false);
    const images = [...(sheet.current?.querySelectorAll('img') ?? [])];
    // `decode` resolves once the image can be painted; older engines (and jsdom) without it count as ready.
    const decoded = (image: HTMLImageElement): Promise<void> =>
      typeof image.decode === 'function' ? image.decode().catch((error: unknown) => console.error('Không tải được ảnh chữ ký', error)) : Promise.resolve();
    Promise.all(images.map(decoded))
      .then(() => {
        if (isCurrent) setReady(true);
      })
      .catch((error: unknown) => console.error(error));
    return () => {
      isCurrent = false;
    };
  }, [sheet, key]);
  return isReady;
};

/** Toolbar (screen only) and the A4 sheet of one D5 document (ui-brief §2.2). */
export const DocumentView = ({ recordId, recordCode, document }: DocumentViewProps) => {
  const sheet = useRef<HTMLDivElement>(null);
  const [printedAt] = useState(() => printDateTime(new Date().toISOString()));
  const isReady = useImagesReady(sheet, document);
  const title = document.model.title;
  return (
    <div className="d5-page min-h-screen bg-bg px-4 pb-10">
      <div className="d5-no-print sticky top-0 z-10 mx-auto mb-4 flex max-w-[210mm] items-center gap-3 border-b border-line bg-bg py-3">
        <Link to={`/records/${recordId}?tab=documents`} className="inline-flex items-center gap-1 text-sm text-accent hover:underline">
          <ArrowLeft className="size-4" aria-hidden />
          Về hồ sơ {recordCode}
        </Link>
        <p className="min-w-0 flex-1 truncate text-center text-sm font-medium text-ink">{title}</p>
        <Button size="sm" disabled={!isReady} onClick={() => window.print()}>
          <Printer aria-hidden />
          In
        </Button>
      </div>
      <main ref={sheet}>
        <PrintSheet title={title} recordCode={recordCode} printedAt={printedAt} watermark={watermarkOf(document)}>
          {document.kind === 'proposal' ? <ProposalDocument model={document.model} /> : null}
          {document.kind === 'minutes' ? <MinutesDocument model={document.model} /> : null}
          {document.kind === 'payment' ? <PaymentLetterDocument model={document.model} /> : null}
        </PrintSheet>
      </main>
    </div>
  );
};
