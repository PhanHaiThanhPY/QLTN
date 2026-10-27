import { AppError, ERROR_CODE } from '@/domain/errors';
import { asRecord } from '@/domain/validation';
import { broadcastChange } from '../change-channel';
import type { Command, CommandResult } from '../command-engine';
import { apiRequest } from './client';
import { MISSING_VERSION_MESSAGE } from './version';

type Handler = (command: Command) => Promise<CommandResult>;

const idOf = (command: Command): string => {
  const id = command.subjectId?.trim() ?? '';
  if (!id) throw new AppError(ERROR_CODE.NOT_FOUND, 'Không tìm thấy dữ liệu quỹ.');
  return encodeURIComponent(id);
};

const versionOf = (command: Command): number => {
  if (command.expectedVersion === undefined) throw new AppError(ERROR_CODE.CONFLICT, MISSING_VERSION_MESSAGE);
  return command.expectedVersion;
};

/** A versioned write on `<path(id)>`; the answer is kept for the screen. */
const versioned =
  (method: 'POST' | 'PUT' | 'PATCH', path: (id: string) => string): Handler =>
  async (command) => {
    const answer = await apiRequest<unknown>(method, path(idOf(command)), { body: { ...asRecord(command.payload), version: versionOf(command) } });
    broadcastChange();
    return { ok: true, subjectId: command.subjectId, data: asRecord(answer) };
  };

/** A new document under `<path(id)>`; the result points at what was created. */
const create =
  (path: (id: string) => string): Handler =>
  async (command) => {
    const answer = asRecord(await apiRequest<unknown>('POST', path(idOf(command)), { body: asRecord(command.payload) }));
    broadcastChange();
    return { ok: true, subjectId: typeof answer.id === 'string' ? answer.id : command.subjectId, data: answer };
  };

/** An unversioned action on `<path(id)>` (the fund lock and the live-pair indexes guard concurrent matching). */
const plain =
  (path: (id: string) => string): Handler =>
  async (command) => {
    const answer = await apiRequest<unknown>('POST', path(idOf(command)), { body: asRecord(command.payload) });
    broadcastChange();
    return { ok: true, subjectId: command.subjectId, data: asRecord(answer) };
  };

const voucher = (suffix: string) => versioned('POST', (id) => `/funds/vouchers/${id}${suffix}`);

/** SPEC F-S3 and F-S4 commands as REST calls (api mode only). Receipts and deposits answer the contract page. */
export const FUND_COMMANDS: Readonly<Record<string, Handler>> = {
  setupFund: versioned('PUT', (id) => `/funds/${id}/setup`),
  approveFundOpening: versioned('POST', (id) => `/funds/${id}/opening/approve`),
  rejectFundOpening: versioned('POST', (id) => `/funds/${id}/opening/reject`),
  createTaxObligation: create((id) => `/funds/${id}/taxes`),
  adjustTaxObligation: versioned('POST', (id) => `/funds/taxes/${id}/adjust`),
  recordTaxPayment: create((id) => `/funds/taxes/${id}/payments`),
  cancelTaxPayment: versioned('POST', (id) => `/funds/tax-payments/${id}/cancel`),
  createFundVoucher: create((id) => `/funds/${id}/vouchers`),
  updateFundVoucher: versioned('PATCH', (id) => `/funds/vouchers/${id}`),
  submitFundVoucher: voucher('/submit'),
  approveFundVoucher: voucher('/approve'),
  requestFundVoucherChanges: voucher('/request-changes'),
  rejectFundVoucher: voucher('/reject'),
  payFundVoucher: voucher('/pay'),
  cancelFundVoucher: voucher('/cancel'),
  approveFundVoucherCancel: voucher('/approve-cancel'),
  rejectFundVoucherCancel: voucher('/reject-cancel'),
  // F-S4: an import sends the template file or typed lines as multipart; the answer counts new lines and suggestions.
  importStatement: async (command) => {
    const payload = asRecord(command.payload);
    const form = payload.form instanceof FormData ? payload.form : new FormData();
    const answer = asRecord(await apiRequest<unknown>('POST', `/funds/${idOf(command)}/statements`, { form }));
    broadcastChange();
    return { ok: true, subjectId: command.subjectId, data: answer };
  },
  deleteStatementImport: plain((id) => `/funds/statement-imports/${id}/delete`),
  matchStatementLine: plain((id) => `/funds/statement-lines/${id}/match`),
  recordFromStatement: plain((id) => `/funds/statement-lines/${id}/record`),
  unmatchStatementLine: plain((id) => `/funds/matches/${id}/unmatch`),
  confirmStatementSuggestions: plain((id) => `/funds/${id}/reconciliation/confirm`),
  recordExploitationReceipt: create((id) => `/exploitation/contracts/${id}/receipts`),
  cancelExploitationReceipt: versioned('POST', (id) => `/exploitation/receipts/${id}/cancel`),
  recordExploitationDeposit: create((id) => `/exploitation/contracts/${id}/deposits`),
  cancelExploitationDeposit: versioned('POST', (id) => `/exploitation/deposits/${id}/cancel`),
};
