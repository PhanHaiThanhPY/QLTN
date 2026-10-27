import { X } from 'lucide-react';
import { Notice } from './Notice';
import type { BatchResult } from './upload-batch';

interface UploadReportProps {
  result: BatchResult;
  onClose: () => void;
}

/**
 * Result of a round with refused files, right under its upload button (SPEC AT-S1 BR-AT-02, ui-brief §2.1). It stays
 * until closed or until the next round; `Notice` is a polite status region, so the first line is read without moving
 * focus. Only refused and unsent files are listed: uploaded ones appear in the file list as usual.
 */
export const UploadReport = ({ result, onClose }: UploadReportProps) => {
  const sent = result.total - result.failed.length;
  return (
    <Notice
      tone={sent === 0 ? 'danger' : 'warning'}
      className="mt-2"
      title={
        <span className="flex items-start justify-between gap-2">
          <span>
            Đã tải {sent}/{result.total} tệp
          </span>
          <button
            type="button"
            aria-label="Đóng báo cáo tải tệp"
            onClick={onClose}
            className="-mr-2 -mt-1 flex size-8 shrink-0 items-center justify-center rounded-md text-ink-3 hover:bg-surface-2 hover:text-ink"
          >
            <X className="size-4" aria-hidden />
          </button>
        </span>
      }
    >
      <ul className="mt-1 space-y-1.5">
        {result.failed.map((file, index) => (
          <li key={`${index}-${file.name}`} className="sm:flex sm:gap-3">
            <span className="block font-medium text-ink sm:max-w-[40%] sm:shrink-0 sm:truncate" title={file.name}>
              {file.name}
            </span>
            <span className={file.notSent ? 'block text-ink-3' : 'block text-ink-2'}>{file.reason}</span>
          </li>
        ))}
      </ul>
    </Notice>
  );
};
