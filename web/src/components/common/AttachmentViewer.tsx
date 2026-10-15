import { useEffect, useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { toErrorMessage } from '@/domain/errors';
import type { Attachment } from '@/domain/types';
import { readAttachmentBlob } from '@/services/file-service';

interface AttachmentViewerProps {
  attachment: Attachment | null;
  onClose: () => void;
}

/** Creates an object URL only while viewing and revokes it on close (spec 9). */
export const AttachmentViewer = ({ attachment, onClose }: AttachmentViewerProps) => {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!attachment) return undefined;
    let objectUrl: string | null = null;
    let isCancelled = false;
    readAttachmentBlob(attachment.id)
      .then(({ blob }) => {
        if (isCancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch((reason: unknown) => {
        console.error('Open attachment failed:', reason);
        if (!isCancelled) setError(toErrorMessage(reason));
      });
    return () => {
      isCancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setUrl(null);
      setError(null);
    };
  }, [attachment]);

  const isImage = attachment?.mimeType.startsWith('image/');
  return (
    <Dialog open={Boolean(attachment)} onOpenChange={(open) => !open && onClose()} title={attachment?.fileName ?? ''} size="xl">
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {!error && !url ? <p className="text-sm text-ink-3">Đang mở tệp…</p> : null}
      {url && isImage ? <img src={url} alt={attachment?.fileName} className="mx-auto max-h-[70vh] w-auto rounded-lg [image-rendering:pixelated]" /> : null}
      {url && !isImage ? <iframe src={url} title={attachment?.fileName} className="h-[70vh] w-full rounded-lg border border-line" /> : null}
    </Dialog>
  );
};
