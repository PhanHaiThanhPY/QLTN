import { useState } from 'react';
import { FileText, Image as ImageIcon, X } from 'lucide-react';
import { ATTACHMENT_PURPOSE_LABEL } from '@/domain/constants';
import type { Attachment } from '@/domain/types';
import { AttachmentViewer } from './AttachmentViewer';

interface AttachmentListProps {
  attachments: Attachment[];
  onRemove?: (attachmentId: string) => void;
  emptyText?: string;
  showPurpose?: boolean;
}

const formatSize = (bytes: number): string => (bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

export const AttachmentList = ({ attachments, onRemove, emptyText = 'Chưa có tệp.', showPurpose = false }: AttachmentListProps) => {
  const [viewing, setViewing] = useState<Attachment | null>(null);
  if (attachments.length === 0) return <p className="text-sm text-ink-3">{emptyText}</p>;
  return (
    <>
      <ul className="flex flex-wrap gap-2">
        {attachments.map((attachment) => {
          const isImage = attachment.mimeType.startsWith('image/');
          const Icon = isImage ? ImageIcon : FileText;
          return (
            <li key={attachment.id} className="flex max-w-full items-center gap-1 rounded-md border border-line bg-surface-2 pr-1">
              <button
                type="button"
                className="flex min-w-0 items-center gap-2 px-2.5 py-1.5 text-left text-sm text-ink hover:text-accent"
                onClick={() => setViewing(attachment)}
              >
                <Icon className="size-4 shrink-0 text-ink-3" aria-hidden />
                <span className="truncate">{attachment.fileName}</span>
                <span className="shrink-0 text-xs text-ink-3">
                  {showPurpose ? `${ATTACHMENT_PURPOSE_LABEL[attachment.purpose]} · ` : ''}
                  {formatSize(attachment.sizeBytes)}
                </span>
              </button>
              {onRemove ? (
                <button type="button" className="rounded p-1 text-ink-3 hover:bg-surface-3" aria-label={`Bỏ ${attachment.fileName}`} onClick={() => onRemove(attachment.id)}>
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
      <AttachmentViewer attachment={viewing} onClose={() => setViewing(null)} />
    </>
  );
};
