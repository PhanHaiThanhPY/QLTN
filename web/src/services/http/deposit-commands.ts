import { AppError, ERROR_CODE } from '@/domain/errors';
import { asRecord } from '@/domain/validation';
import { broadcastChange } from '../change-channel';
import type { Command, CommandResult } from '../command-engine';
import { apiRequest } from './client';
import { MISSING_VERSION_MESSAGE } from './version';

type Handler = (command: Command) => Promise<CommandResult>;

const idOf = (command: Command): string => {
  const id = command.subjectId?.trim() ?? '';
  if (!id) throw new AppError(ERROR_CODE.NOT_FOUND, 'Không tìm thấy thư mời.');
  return encodeURIComponent(id);
};

const versionOf = (command: Command): number => {
  if (command.expectedVersion === undefined) throw new AppError(ERROR_CODE.CONFLICT, MISSING_VERSION_MESSAGE);
  return command.expectedVersion;
};

/** The invitation page an answer carries points the result at the invitation; a bank answers itself. */
const resultOf = (command: Command, answer: unknown): CommandResult => {
  const data = asRecord(answer);
  const invitation = asRecord(data.invitation);
  const id = typeof invitation.id === 'string' ? invitation.id : data.id;
  return { ok: true, subjectId: typeof id === 'string' ? id : command.subjectId, data };
};

const send =
  (method: 'POST' | 'PUT', path: (id: string) => string, versioned: boolean): Handler =>
  async (command) => {
    const body = versioned ? { ...asRecord(command.payload), version: versionOf(command) } : asRecord(command.payload);
    const answer = await apiRequest<unknown>(method, path(idOf(command)), { body });
    broadcastChange();
    return resultOf(command, answer);
  };

const selection = (suffix: string) => send('POST', (id) => `/deposits/selections/${id}/${suffix}`, true);

/** SPEC T-S1 commands as REST calls (api mode only). Writes on an invitation answer its page. */
export const DEPOSIT_COMMANDS: Readonly<Record<string, Handler>> = {
  createDepositBank: async (command) => {
    const answer = await apiRequest<unknown>('POST', '/deposits/banks', { body: asRecord(command.payload) });
    broadcastChange();
    return resultOf(command, answer);
  },
  updateDepositBank: send('PUT', (id) => `/deposits/banks/${id}`, true),
  deactivateDepositBank: send('POST', (id) => `/deposits/banks/${id}/deactivate`, true),
  createDepositInvitation: async (command) => {
    const answer = await apiRequest<unknown>('POST', '/deposits/invitations', { body: asRecord(command.payload) });
    broadcastChange();
    return resultOf(command, answer);
  },
  updateDepositInvitation: send('PUT', (id) => `/deposits/invitations/${id}`, true),
  sendDepositInvitation: send('POST', (id) => `/deposits/invitations/${id}/send`, true),
  extendDepositInvitation: send('POST', (id) => `/deposits/invitations/${id}/extend`, true),
  closeDepositInvitationEarly: send('POST', (id) => `/deposits/invitations/${id}/close`, true),
  cancelDepositInvitation: send('POST', (id) => `/deposits/invitations/${id}/cancel`, true),
  recordDepositOffer: send('POST', (id) => `/deposits/invitations/${id}/offers`, false),
  updateDepositOffer: send('PUT', (id) => `/deposits/offers/${id}`, true),
  proposeDepositSelection: send('POST', (id) => `/deposits/invitations/${id}/selections`, false),
  resubmitDepositSelection: selection('resubmit'),
  proposeDepositSelectionChange: selection('change'),
  approveDepositSelection: selection('approve'),
  requestDepositSelectionChanges: selection('request-changes'),
  rejectDepositSelection: selection('reject'),
};
