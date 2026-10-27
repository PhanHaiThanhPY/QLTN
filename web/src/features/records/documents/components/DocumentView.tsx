import { useCallback, useState } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, Printer } from 'lucide-react';
import { Notice } from '@/components/common/Notice';
import { Button } from '@/components/ui/button';
import { signatureKey, signaturesOf, watermarkOf, type PrintableDocument } from '../build-document';
import { printDateTime } from '../print-format';
import { MinutesDocument } from './MinutesDocument';
import { PaymentLetterDocument } from './PaymentLetterDocument';
import { PrintSheet } from './PrintSheet';
import { ProposalDocument } from './ProposalDocument';
import { SignatureLoadContext, type SignatureLoadState } from './signature-load';

interface DocumentViewProps {
  recordId: string;
  recordCode: string;
  document: PrintableDocument;
}

/**
 * Toolbar (screen only) and the A4 sheet of one D5 document (ui-brief §2.2). "In" stays disabled until every
 * signature image of the sheet has loaded; a failed one blocks printing and asks to reload (F-B7-S1-02), so a document
 * is never printed without a signature it has.
 */
export const DocumentView = ({ recordId, recordCode, document }: DocumentViewProps) => {
  const [printedAt] = useState(() => printDateTime(new Date().toISOString()));
  const [loadStates, setLoadStates] = useState<Readonly<Record<string, SignatureLoadState>>>({});
  const report = useCallback((key: string, state: SignatureLoadState) => setLoadStates((previous) => ({ ...previous, [key]: state })), []);
  const signatures = signaturesOf(document);
  const failedNames = signatures.filter((signature) => loadStates[signatureKey(signature)] === 'failed').map((signature) => signature.signerName);
  const isReady = signatures.every((signature) => loadStates[signatureKey(signature)] === 'loaded');
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
      {failedNames.length > 0 ? (
        <div className="d5-no-print mx-auto mb-4 max-w-[210mm]">
          <Notice tone="danger" title={`Không tải được chữ ký của ${failedNames.join(', ')}. Tải lại trang để in đủ chữ ký.`}>
            <Button className="mt-2" variant="outline" size="sm" onClick={() => window.location.reload()}>
              Tải lại
            </Button>
          </Notice>
        </div>
      ) : null}
      <main>
        <SignatureLoadContext.Provider value={report}>
          <PrintSheet title={title} recordCode={recordCode} printedAt={printedAt} watermark={watermarkOf(document)}>
            {document.kind === 'proposal' ? <ProposalDocument model={document.model} /> : null}
            {document.kind === 'minutes' ? <MinutesDocument model={document.model} /> : null}
            {document.kind === 'payment' ? <PaymentLetterDocument model={document.model} /> : null}
          </PrintSheet>
        </SignatureLoadContext.Provider>
      </main>
    </div>
  );
};
