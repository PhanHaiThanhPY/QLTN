/** Instalment fields of a settlement draft (T17) or a submission (SPEC B03–B09 v2 §4.4). */
export interface PaymentFields {
  amountVnd?: string;
  payeeName?: string;
  accountNo?: string;
  bankName?: string;
  transferContent?: string;
  requestAttachmentIds?: string[];
  invoiceAttachmentIds?: string[];
}
