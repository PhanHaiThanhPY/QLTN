import { ERROR_CODE, isAppError, toErrorMessage } from '@/domain/errors';
import type { Attachment } from '@/domain/types';
import type { PreparedUpload } from '@/services/upload-prep';

export const NOT_SENT_REASON = 'Chưa tải';
export const OFFLINE_REASON = 'Mất kết nối — chưa tải được tệp này.';

/**
 * SPEC AT-S1 BR-AT-01 / D-AT-2: a permission or step refusal (403, 404, 409) applies to every file of the round, and
 * an expired session (401) is handled by the app; both stop the round. Any other error belongs to its file only.
 */
const STOPPING_CODES: readonly string[] = [
  ERROR_CODE.FORBIDDEN,
  ERROR_CODE.NOT_FOUND,
  ERROR_CODE.CONFLICT,
  ERROR_CODE.INVALID_TRANSITION,
  ERROR_CODE.UNAUTHORIZED,
];

export interface FailedFile {
  name: string;
  reason: string;
  /** Not attempted because the round stopped before it. */
  notSent: boolean;
}

export interface BatchResult {
  uploaded: Attachment[];
  failed: FailedFile[];
  total: number;
}

export type BatchPhase = 'preparing' | 'uploading';

export interface BatchSteps {
  prepare: (file: File) => Promise<PreparedUpload>;
  upload: (file: File) => Promise<Attachment>;
  /** 1-based position of the file being handled, for "Đang tải 2/5…". */
  onProgress?: (phase: BatchPhase, position: number, total: number) => void;
}

/** Reason shown for a failed file: offline gets its own sentence (ui-brief §4), otherwise the server's or demo's words. */
const reasonOf = (error: unknown): string => {
  if (isAppError(error) && error.code === ERROR_CODE.NETWORK_ERROR && !navigator.onLine) return OFFLINE_REASON;
  return toErrorMessage(error);
};

/** Uploads the files one by one in the chosen order and reports every file that did not go up (BR-AT-01, BR-AT-02). */
export const uploadBatch = async (files: readonly File[], steps: BatchSteps): Promise<BatchResult> => {
  const uploaded: Attachment[] = [];
  const failed: FailedFile[] = [];
  for (const [index, file] of files.entries()) {
    try {
      steps.onProgress?.('preparing', index + 1, files.length);
      const prepared = await steps.prepare(file);
      if (!prepared.ok) {
        failed.push({ name: file.name, reason: prepared.reason, notSent: false });
        continue;
      }
      steps.onProgress?.('uploading', index + 1, files.length);
      uploaded.push(await steps.upload(prepared.file));
    } catch (error) {
      console.error(`Upload of ${file.name} failed:`, error);
      failed.push({ name: file.name, reason: reasonOf(error), notSent: false });
      if (isAppError(error) && STOPPING_CODES.includes(error.code)) {
        files.slice(index + 1).forEach((rest) => failed.push({ name: rest.name, reason: NOT_SENT_REASON, notSent: true }));
        break;
      }
    }
  }
  return { uploaded, failed, total: files.length };
};
