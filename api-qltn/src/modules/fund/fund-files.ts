import type { EntityManager } from 'typeorm';
import type { FieldErrors } from '../../common/validation/field-errors';
import { Attachment } from '../attachments/entities/attachment.entity';
import { SUBJECT_TYPE } from '../audit/entities/audit-event.entity';

/** F-S3 files, all on the fund (subject FUND): one purpose per document slot. */
export const FUND_FILE_PURPOSES = {
  RECEIPT_PROOF: 'Chứng từ khoản thu',
  DEPOSIT_PROOF: 'Chứng từ nhận cọc',
  TAX_FILING: 'Hồ sơ kế toán thuế',
  TAX_PAYMENT_SLIP: 'Giấy nộp tiền thuế',
  VOUCHER_REQUEST: 'Đề nghị chi',
  VOUCHER_PROOF: 'Chứng từ chuyển khoản chi',
  /** F-S4: the statement file of an import, stored by the import itself (not uploadable on its own). */
  STATEMENT_FILE: 'Tệp sao kê',
} as const;
export type FundFilePurpose = keyof typeof FUND_FILE_PURPOSES;

export const isFundFilePurpose = (purpose: string): purpose is FundFilePurpose =>
  Object.hasOwn(FUND_FILE_PURPOSES, purpose);

/** Receipt and deposit proofs are also shown on the contract's "Khoản thu" tab, which BQL reads (D-F3-6). */
export const CONTRACT_READABLE_PURPOSES: readonly string[] = ['RECEIPT_PROOF', 'DEPOSIT_PROOF'];

/** A required file must have been uploaded to this fund with this purpose. */
export const checkFundFile = async (
  manager: EntityManager,
  errors: FieldErrors,
  fundId: string,
  attachmentId: string | null | undefined,
  purpose: FundFilePurpose,
  field: string,
): Promise<void> => {
  const file = attachmentId ? await manager.getRepository(Attachment).findOneBy({ id: attachmentId }) : null;
  errors.when(
    !file || file.subjectType !== SUBJECT_TYPE.FUND || file.subjectId !== fundId || file.purpose !== purpose,
    field,
    `Cần ${FUND_FILE_PURPOSES[purpose].toLowerCase()} tải lên quỹ này.`,
  );
};
