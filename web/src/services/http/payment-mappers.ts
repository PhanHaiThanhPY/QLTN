import type { PaymentHistory } from '@/domain/payment';
import { AppError, ERROR_CODE } from '@/domain/errors';
import { asRecord, asString, asStringArray } from '@/domain/validation';
import { MISSING_VERSION_MESSAGE } from './version';

/** `payment` of `GET /records/:id` (S4); copied so screens never mutate the query cache. */
export const mapPaymentHistory = (row: PaymentHistory | undefined): PaymentHistory => ({
  approvedAmountVnd: row?.approvedAmountVnd ?? null,
  transferredTotalVnd: row?.transferredTotalVnd ?? '0',
  draft: row?.draft ? { ...row.draft } : null,
  payments: (row?.payments ?? []).map((payment) => ({ ...payment, decisions: payment.decisions.map((decision) => ({ ...decision })) })),
});

const FIELDS = ['amountVnd', 'payeeName', 'accountNo', 'bankName', 'transferContent'] as const;
const FILES = ['requestAttachmentIds', 'invoiceAttachmentIds'] as const;

/** Route and body keys of each S4 action (T17–T22, A1–A3); unknown payload keys are dropped. */
export const PAYMENT_ROUTES = {
  savePaymentDraft: { route: 'save-payment-draft', text: FIELDS, ids: FILES },
  submitPaymentRequest: { route: 'submit-payment-request', text: [...FIELDS, 'signature'], ids: FILES },
  approvePayment: { route: 'approve-payment', text: ['paymentId'], ids: [] },
  requestPaymentUpdate: { route: 'request-payment-update', text: ['paymentId', 'reason'], ids: [] },
  confirmPaymentTransfer: {
    route: 'confirm-payment-transfer',
    text: ['paymentId', 'amountVnd', 'transferDate', 'reference'],
    ids: ['proofAttachmentIds'],
  },
  completeRecord: { route: 'complete', text: [], ids: [] },
  submitAdvanceRequest: { route: 'submit-advance-request', text: [...FIELDS, 'signature'], ids: ['requestAttachmentIds'] },
  resubmitAdvanceRequest: { route: 'resubmit-advance-request', text: [...FIELDS, 'signature'], ids: ['requestAttachmentIds'] },
  approveAdvance: { route: 'approve-advance', text: ['paymentId'], ids: [] },
  requestAdvanceUpdate: { route: 'request-advance-update', text: ['paymentId', 'reason'], ids: [] },
  confirmAdvanceTransfer: {
    route: 'confirm-advance-transfer',
    text: ['paymentId', 'amountVnd', 'transferDate', 'reference'],
    ids: ['proofAttachmentIds'],
  },
} as const satisfies Record<string, { route: string; text: readonly string[]; ids: readonly string[] }>;
export type PaymentAction = keyof typeof PAYMENT_ROUTES;

export const toPaymentBody = (
  action: PaymentAction,
  payload: unknown,
  expectedVersion: number | undefined,
): Record<string, unknown> => {
  if (expectedVersion === undefined) throw new AppError(ERROR_CODE.CONFLICT, MISSING_VERSION_MESSAGE);
  const row = asRecord(payload);
  const keys = PAYMENT_ROUTES[action];
  const body: Record<string, unknown> = { version: expectedVersion };
  for (const key of keys.text as readonly string[]) if (row[key] !== undefined && row[key] !== '') body[key] = asString(row[key]);
  for (const key of keys.ids as readonly string[]) if (row[key] !== undefined) body[key] = asStringArray(row[key]);
  return body;
};
