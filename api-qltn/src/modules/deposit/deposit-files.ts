/** T-S1 files, all stored on the invitation (subject DEPOSIT_INVITATION) by a BQL of its building. */
export const DEPOSIT_FILE_PURPOSES = {
  DEPOSIT_INVITATION_LETTER: 'Thư mời chào lãi',
  DEPOSIT_OFFER: 'Bản chào lãi suất',
  DEPOSIT_SELECTION_MINUTES: 'Biên bản chọn ngân hàng',
} as const;
export type DepositFilePurpose = keyof typeof DEPOSIT_FILE_PURPOSES;

export const isDepositFilePurpose = (purpose: string): purpose is DepositFilePurpose =>
  Object.hasOwn(DEPOSIT_FILE_PURPOSES, purpose);

/** An invitation takes files until it is cancelled or decided (minutes may still be replaced while a result waits). */
export const DEPOSIT_FILE_STATUSES: readonly string[] = ['DRAFT', 'OPEN', 'CLOSED', 'SELECTED', 'NO_RESULT'];
