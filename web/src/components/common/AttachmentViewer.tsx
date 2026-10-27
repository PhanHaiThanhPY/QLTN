import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { toErrorMessage } from '@/domain/errors';
import type { Attachment } from '@/domain/types';
import { readAttachmentBlob } from '@/services/file-service';
import { downloadBlob } from '@/utils/download';

interface AttachmentViewerProps {
  attachment: Attachment | null;
  onClose: () => void;
}

interface Opened {
  blob: Blob;
  url: string;
}

/**
 * Creates an object URL only while viewing and revokes it on close (spec 9). "Tải xuống" saves the blob being viewed,
 * which is the stored file byte for byte, under its original name (SPEC AT-S1 BR-AT-03).
 */
export const AttachmentViewer = ({ attachment, onClose }: AttachmentViewerProps) => {
  const [opened, setOpened] = useState<Opened | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!attachment) return undefined;
    let objectUrl: string | null = null;
    let isCancelled = false;
    readAttachmentBlob(attachment.id)
      .then(({ blob }) => {
        if (isCancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setOpened({ blob, url: objectUrl });
      })
      .catch((reason: unknown) => {
        console.error('Open attachment failed:', reason);
        if (!isCancelled) setError(toErrorMessage(reason));
      });
    return () => {
      isCancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setOpened(null);
      setError(null);
    };
  }, [attachment]);

  const fileName = attachment?.fileName ?? '';
  const isImage = attachment?.mimeType.startsWith('image/');
  const footer = (
    <>
      {error ? null : (
        <Button
          variant="secondary"
          disabled={!opened}
          aria-label={`Tải xuống ${fileName}`}
          onClick={() => {
            if (opened) downloadBlob(fileName, opened.blob);
          }}
        >
          <Download className="h-4 w-4" aria-hidden />
          Tải xuống
        </Button>
      )}
      <Button variant="secondary" onClick={onClose}>
        Đóng
      </Button>
    </>
  );
  return (
    <Dialog open={Boolean(attachment)} onOpenChange={(open) => !open && onClose()} title={fileName} size="xl" footer={footer}>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {!error && !opened ? <p className="text-sm text-ink-3">Đang mở tệp…</p> : null}
      {opened && isImage ? <img src={opened.url} alt={fileName} className="mx-auto max-h-[70vh] w-auto rounded-lg" /> : null}
      {opened && !isImage ? <iframe src={opened.url} title={fileName} className="h-[70vh] w-full rounded-lg border border-line" /> : null}
    </Dialog>
  );
};
