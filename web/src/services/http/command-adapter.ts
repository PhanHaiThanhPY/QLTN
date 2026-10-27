import { toClosePostReviewBody, toStartEmergencyBody } from './emergency-mappers';
import { asRecord, asString, asStringArray } from '@/domain/validation';
import { AppError, ERROR_CODE } from '@/domain/errors';
import { broadcastChange } from '../change-channel';
import type { Command, CommandResult } from '../command-engine';
import { apiRequest } from './client';
import {
  mapBuilding,
  mapDepartment,
  mapLocation,
  mapRoleDefinition,
  mapSkippedConfigParts,
  mapUserProfile,
  toCreateBuildingBody,
  toCreateDepartmentBody,
  toCreateLocationBody,
  toCreateRoleBody,
  toApplyConfigTemplateBody,
  toBulkWorkflowUpdateBody,
  toConfirmRecordBody,
  toCreateRecordBody,
  toCreateUserBody,
  toSetLocationActiveBody,
  toSubmitRecordBody,
  toUpdateBuildingBody,
  toUpdateBuildingConfigBody,
  toUpdateDepartmentBody,
  toUpdateLocationBody,
  toUpdateRoleBody,
  toUpdateRecordDraftBody,
  toUpdateUserBody,
  toWithdrawRecordBody,
} from './mappers';
import { toExecutionBody, type ExecutionAction } from './execution-mappers';
import { markApiNotificationsRead } from './notifications-api';
import { PAYMENT_ROUTES, toPaymentBody, type PaymentAction } from './payment-mappers';
import { toProposalBody, toProposalDecisionBody } from './proposal-mappers';
import type {
  ApiBuilding,
  ApiConfigSaveResult,
  ApiDepartment,
  ApiLocation,
  ApiRepairRecord,
  ApiRole,
  ApiUser,
} from './mappers';

/**
 * Command adapter for `VITE_DATA_SOURCE=api` (plan decision D4).
 * A table `action -> REST call`; a writing screen keeps using `useCommand` unchanged.
 * Only actions listed here are wired; anything else fails loudly instead of silently doing nothing.
 */
type ApiCommandHandler = (command: Command) => Promise<CommandResult>;

/** `POST /users` — the backend derives `username` from `code` and hashes the password. */
const createUser: ApiCommandHandler = async (command) => {
  const body = toCreateUserBody(command.payload);
  const created = await apiRequest<ApiUser>('POST', '/users', { body });
  const user = mapUserProfile(created);
  // Same signal as a Dexie write, so every open screen refetches the list.
  broadcastChange();
  return { ok: true, subjectId: user.id };
};

/** `PATCH /users/:id` — `version` is the optimistic lock; a stale one answers 409 (mapped to CONFLICT). */
const updateUser: ApiCommandHandler = async (command) => {
  const id = command.subjectId?.trim() ?? '';
  if (!id) throw new AppError(ERROR_CODE.NOT_FOUND, 'Không tìm thấy tài khoản.');
  const body = toUpdateUserBody(command.payload, command.expectedVersion);
  const updated = await apiRequest<ApiUser>('PATCH', `/users/${encodeURIComponent(id)}`, { body });
  const user = mapUserProfile(updated);
  broadcastChange();
  return { ok: true, subjectId: user.id };
};

/** `POST /departments` — scope, duplicate code and validation are enforced by the backend. */
const createDepartment: ApiCommandHandler = async (command) => {
  const body = toCreateDepartmentBody(command.payload);
  const created = await apiRequest<ApiDepartment>('POST', '/departments', { body });
  const department = mapDepartment(created);
  broadcastChange();
  return { ok: true, subjectId: department.id };
};

/** `PATCH /departments/:id` — `version` is the optimistic lock; a stale one answers 409 (mapped to CONFLICT). */
const updateDepartment: ApiCommandHandler = async (command) => {
  const id = command.subjectId?.trim() ?? '';
  if (!id) throw new AppError(ERROR_CODE.NOT_FOUND, 'Không tìm thấy bộ phận.');
  const body = toUpdateDepartmentBody(command.payload, command.expectedVersion);
  const updated = await apiRequest<ApiDepartment>('PATCH', `/departments/${encodeURIComponent(id)}`, { body });
  const department = mapDepartment(updated);
  broadcastChange();
  return { ok: true, subjectId: department.id };
};

/**
 * `POST /roles` — the backend supports `sourceRoleId` natively: it copies the source role's base role and
 * capabilities, and returns the new custom role. The web "sao chép vai trò" therefore needs no extra round-trip.
 */
const createRoleDef: ApiCommandHandler = async (command) => {
  const body = toCreateRoleBody(command.payload);
  const created = await apiRequest<ApiRole>('POST', '/roles', { body });
  const role = mapRoleDefinition(created);
  broadcastChange();
  return { ok: true, subjectId: role.id };
};

/** `PATCH /roles/:id` — custom roles only (system roles answer a field error); stale version answers 409. */
const updateRoleDef: ApiCommandHandler = async (command) => {
  const id = command.subjectId?.trim() ?? '';
  if (!id) throw new AppError(ERROR_CODE.NOT_FOUND, 'Không tìm thấy vai trò.');
  const body = toUpdateRoleBody(command.payload, command.expectedVersion);
  const updated = await apiRequest<ApiRole>('PATCH', `/roles/${encodeURIComponent(id)}`, { body });
  const role = mapRoleDefinition(updated);
  broadcastChange();
  return { ok: true, subjectId: role.id };
};

/** `POST /buildings` — the backend starts the configuration from a template and joins the creator's scope. */
const createBuilding: ApiCommandHandler = async (command) => {
  const body = toCreateBuildingBody(command.payload);
  const created = await apiRequest<ApiBuilding>('POST', '/buildings', { body });
  const building = mapBuilding(created);
  broadcastChange();
  return { ok: true, subjectId: building.id };
};

/** `PATCH /buildings/:id` — `version` is the optimistic lock; a stale one answers 409 (mapped to CONFLICT). */
const updateBuilding: ApiCommandHandler = async (command) => {
  const id = command.subjectId?.trim() ?? '';
  if (!id) throw new AppError(ERROR_CODE.NOT_FOUND, 'Không tìm thấy tòa nhà.');
  const body = toUpdateBuildingBody(command.payload, command.expectedVersion);
  const updated = await apiRequest<ApiBuilding>('PATCH', `/buildings/${encodeURIComponent(id)}`, { body });
  const building = mapBuilding(updated);
  broadcastChange();
  return { ok: true, subjectId: building.id };
};

const buildingIdOf = (command: Command): string => {
  const id = command.subjectId?.trim() ?? '';
  if (!id) throw new AppError(ERROR_CODE.NOT_FOUND, 'Không tìm thấy tòa nhà.');
  return id;
};

const locationIdOf = (command: Command): string => {
  const id = asString(asRecord(command.payload).locationId);
  if (!id) throw new AppError(ERROR_CODE.NOT_FOUND, 'Không tìm thấy vị trí.');
  return id;
};

/** `POST /buildings/:id/locations` — the backend enforces a unique name per floor. */
const createLocation: ApiCommandHandler = async (command) => {
  const buildingId = buildingIdOf(command);
  const body = toCreateLocationBody(command.payload);
  const created = await apiRequest<ApiLocation>('POST', `/buildings/${encodeURIComponent(buildingId)}/locations`, { body });
  const location = mapLocation(created);
  broadcastChange();
  return { ok: true, subjectId: location.buildingId, data: { locationId: location.id } };
};

/** `PATCH /buildings/:id/locations/:locationId` — stale version answers 409, duplicate name a field error. */
const updateLocation: ApiCommandHandler = async (command) => {
  const buildingId = buildingIdOf(command);
  const locationId = locationIdOf(command);
  const body = toUpdateLocationBody(command.payload, command.expectedVersion);
  const updated = await apiRequest<ApiLocation>(
    'PATCH',
    `/buildings/${encodeURIComponent(buildingId)}/locations/${encodeURIComponent(locationId)}`,
    { body },
  );
  const location = mapLocation(updated);
  broadcastChange();
  return { ok: true, subjectId: location.buildingId };
};

/** `PATCH /buildings/:id/locations/:locationId/status` — deactivate/reactivate, same version lock. */
const setLocationActive: ApiCommandHandler = async (command) => {
  const buildingId = buildingIdOf(command);
  const locationId = locationIdOf(command);
  const body = toSetLocationActiveBody(command.payload, command.expectedVersion);
  const updated = await apiRequest<ApiLocation>(
    'PATCH',
    `/buildings/${encodeURIComponent(buildingId)}/locations/${encodeURIComponent(locationId)}/status`,
    { body },
  );
  const location = mapLocation(updated);
  broadcastChange();
  return { ok: true, subjectId: location.buildingId };
};

/**
 * `PUT /buildings/:id/config` — the DTO carries every value plus the loaded version; the backend answers
 * `{ config, changes }`, of which only the change count is needed (the mock result shape).
 */
const updateBuildingConfig: ApiCommandHandler = async (command) => {
  const buildingId = buildingIdOf(command);
  const body = toUpdateBuildingConfigBody(command.payload, command.expectedVersion);
  const result = await apiRequest<ApiConfigSaveResult>(
    'PUT',
    `/buildings/${encodeURIComponent(buildingId)}/config`,
    { body },
  );
  broadcastChange();
  return { ok: true, subjectId: buildingId, data: { changes: result.changes.length } };
};

/** `POST /buildings/:id/config/apply-template` — one source (template key or another building) plus version. */
const applyConfigTemplate: ApiCommandHandler = async (command) => {
  const buildingId = buildingIdOf(command);
  const body = toApplyConfigTemplateBody(command.payload, command.expectedVersion);
  const result = await apiRequest<ApiConfigSaveResult>(
    'POST',
    `/buildings/${encodeURIComponent(buildingId)}/config/apply-template`,
    { body },
  );
  broadcastChange();
  return {
    ok: true,
    subjectId: buildingId,
    data: { changes: result.changes.length, skipped: mapSkippedConfigParts(result.skipped) },
  };
};

/** `PUT /building-configs/workflow` — all-or-nothing for several buildings; each target has its own version. */
const updateWorkflowConfig: ApiCommandHandler = async (command) => {
  const body = toBulkWorkflowUpdateBody(command.payload);
  if (body.targets.length === 0) {
    throw new AppError(ERROR_CODE.VALIDATION_ERROR, 'Cần có ít nhất một tòa nhà để áp dụng workflow.', {
      targets: 'Cần có ít nhất một tòa nhà để áp dụng workflow.',
    });
  }
  const result = await apiRequest<{ updated: number }>('PUT', '/building-configs/workflow', { body });
  broadcastChange();
  return { ok: true, subjectId: command.subjectId?.trim() || body.targets[0].buildingId, data: { updated: result.updated } };
};

/** `POST /records` — draft with an `SC-…` code; the backend snapshots the building configuration. */
const createRecord: ApiCommandHandler = async (command) => {
  const body = toCreateRecordBody(command.payload);
  const created = await apiRequest<ApiRepairRecord>('POST', '/records', { body });
  broadcastChange();
  return { ok: true, subjectId: created.id, data: { code: created.code } };
};

/** `PATCH /records/:id` — draft save; `version` is the optimistic lock (stale → 409). */
const saveRecordDraft: ApiCommandHandler = async (command) => {
  const id = command.subjectId?.trim() ?? '';
  if (!id) throw new AppError(ERROR_CODE.NOT_FOUND, 'Không tìm thấy hồ sơ.');
  const body = toUpdateRecordDraftBody(command.payload, command.expectedVersion);
  const updated = await apiRequest<ApiRepairRecord>('PATCH', `/records/${encodeURIComponent(id)}`, { body });
  broadcastChange();
  return { ok: true, subjectId: updated.id };
};

/** `POST /records/:id/submit` — optional draft fields + `version`; failures carry field errors. */
const submitRecord: ApiCommandHandler = async (command) => {
  const id = command.subjectId?.trim() ?? '';
  if (!id) throw new AppError(ERROR_CODE.NOT_FOUND, 'Không tìm thấy hồ sơ.');
  const body = toSubmitRecordBody(command.payload, command.expectedVersion);
  const updated = await apiRequest<ApiRepairRecord>('POST', `/records/${encodeURIComponent(id)}/submit`, { body });
  broadcastChange();
  return { ok: true, subjectId: updated.id };
};

/** `POST /records/:id/withdraw` — mandatory reason + `version`. */
const withdrawRecord: ApiCommandHandler = async (command) => {
  const id = command.subjectId?.trim() ?? '';
  if (!id) throw new AppError(ERROR_CODE.NOT_FOUND, 'Không tìm thấy hồ sơ.');
  const body = toWithdrawRecordBody(command.payload, command.expectedVersion);
  const updated = await apiRequest<ApiRepairRecord>('POST', `/records/${encodeURIComponent(id)}/withdraw`, { body });
  broadcastChange();
  return { ok: true, subjectId: updated.id };
};

/** S1 confirmer actions: `POST /records/:id/<route>` with the note + `version`. */
const CONFIRMATION_ROUTES = {
  requestRecordUpdate: 'request-record-update',
  confirmRepair: 'confirm-repair',
  closeNoRepair: 'close-no-repair',
} as const;

const confirmationCommand =
  (route: (typeof CONFIRMATION_ROUTES)[keyof typeof CONFIRMATION_ROUTES]): ApiCommandHandler =>
  async (command) => {
    const id = command.subjectId?.trim() ?? '';
    if (!id) throw new AppError(ERROR_CODE.NOT_FOUND, 'Không tìm thấy hồ sơ.');
    const body = toConfirmRecordBody(command.payload, command.expectedVersion);
    const updated = await apiRequest<ApiRepairRecord>('POST', `/records/${encodeURIComponent(id)}/${route}`, { body });
    broadcastChange();
    return { ok: true, subjectId: updated.id };
  };

/** S2 proposal actions T04–T09 (SPEC B03–B09 v2): `POST /records/:id/<route>`; the server recomputes every total. */
const PROPOSAL_ROUTES = {
  saveProposalDraft: 'save-proposal-draft',
  submitProposal: 'submit-proposal',
  resubmitProposal: 'resubmit-proposal',
  approveProposal: 'approve-proposal',
  requestProposalUpdate: 'request-proposal-update',
  rejectProposal: 'reject-proposal',
} as const;
type ProposalAction = keyof typeof PROPOSAL_ROUTES;
const PROPOSAL_EDIT_ACTIONS: readonly ProposalAction[] = ['saveProposalDraft', 'submitProposal', 'resubmitProposal'];

const proposalCommand =
  (action: ProposalAction): ApiCommandHandler =>
  async (command) => {
    const id = command.subjectId?.trim() ?? '';
    if (!id) throw new AppError(ERROR_CODE.NOT_FOUND, 'Không tìm thấy hồ sơ.');
    const body = PROPOSAL_EDIT_ACTIONS.includes(action)
      ? toProposalBody(command.payload, command.expectedVersion)
      : toProposalDecisionBody(command.payload, command.expectedVersion);
    const route = PROPOSAL_ROUTES[action];
    const updated = await apiRequest<ApiRepairRecord>('POST', `/records/${encodeURIComponent(id)}/${route}`, { body });
    broadcastChange();
    return { ok: true, subjectId: updated.id };
  };

/** B06-S1 emergency E-T1 and E-T2: `POST /records/:id/<route>`. */
const emergencyCommand =
  (route: 'start-emergency-repair' | 'close-post-review-rejected'): ApiCommandHandler =>
  async (command) => {
    const id = command.subjectId?.trim() ?? '';
    if (!id) throw new AppError(ERROR_CODE.NOT_FOUND, 'Không tìm thấy hồ sơ.');
    const body =
      route === 'start-emergency-repair'
        ? toStartEmergencyBody(command.payload, command.expectedVersion)
        : toClosePostReviewBody(command.payload, command.expectedVersion);
    const updated = await apiRequest<ApiRepairRecord>('POST', `/records/${encodeURIComponent(id)}/${route}`, { body });
    broadcastChange();
    return { ok: true, subjectId: updated.id };
  };

/** S3 construction and acceptance actions T10–T16: `POST /records/:id/<route>`. */
const EXECUTION_ROUTES: Readonly<Record<ExecutionAction, string>> = {
  startConstruction: 'start-construction',
  updateConstruction: 'update-construction',
  submitAcceptance: 'submit-acceptance',
  passAcceptance: 'pass-acceptance',
  failAcceptance: 'fail-acceptance',
  saveRepairEvidence: 'save-repair-evidence',
  resubmitAcceptance: 'resubmit-acceptance',
};

const executionCommand =
  (action: ExecutionAction): ApiCommandHandler =>
  async (command) => {
    const id = command.subjectId?.trim() ?? '';
    if (!id) throw new AppError(ERROR_CODE.NOT_FOUND, 'Không tìm thấy hồ sơ.');
    const body = toExecutionBody(action, command.payload, command.expectedVersion);
    const route = EXECUTION_ROUTES[action];
    const updated = await apiRequest<ApiRepairRecord>('POST', `/records/${encodeURIComponent(id)}/${route}`, { body });
    broadcastChange();
    return { ok: true, subjectId: updated.id };
  };

/** S4 payment actions T17–T22 and A1–A3: `POST /records/:id/<route>`. */
const paymentCommand =
  (action: PaymentAction): ApiCommandHandler =>
  async (command) => {
    const id = command.subjectId?.trim() ?? '';
    if (!id) throw new AppError(ERROR_CODE.NOT_FOUND, 'Không tìm thấy hồ sơ.');
    const body = toPaymentBody(action, command.payload, command.expectedVersion);
    const { route } = PAYMENT_ROUTES[action];
    const updated = await apiRequest<ApiRepairRecord>('POST', `/records/${encodeURIComponent(id)}/${route}`, { body });
    broadcastChange();
    return { ok: true, subjectId: updated.id };
  };

/** `POST /notifications/:id/read` for each id (BR-S3-01a minimum: no bulk route). */
const markNotificationRead: ApiCommandHandler = async (command) => {
  await markApiNotificationsRead(asStringArray(asRecord(command.payload).notificationIds));
  broadcastChange();
  return { ok: true };
};

/**
 * Actions wired to api-qltn. T2a accounts; T2b departments and roles; T2c buildings and locations; T2d configuration;
 * Đợt 2 repair records (draft, submit, withdraw); B03–B09 slice S1 confirmation; v2 slice S2 proposal and approval;
 * v2 slice S3 construction and acceptance; v2 slice S4 payments.
 */
const API_COMMANDS: Readonly<Record<string, ApiCommandHandler>> = {
  createUser,
  updateUser,
  createDepartment,
  updateDepartment,
  createRoleDef,
  updateRoleDef,
  createBuilding,
  updateBuilding,
  createLocation,
  updateLocation,
  setLocationActive,
  updateBuildingConfig,
  applyConfigTemplate,
  updateWorkflowConfig,
  createRecord,
  saveRecordDraft,
  submitRecord,
  withdrawRecord,
  requestRecordUpdate: confirmationCommand(CONFIRMATION_ROUTES.requestRecordUpdate),
  confirmRepair: confirmationCommand(CONFIRMATION_ROUTES.confirmRepair),
  closeNoRepair: confirmationCommand(CONFIRMATION_ROUTES.closeNoRepair),
  saveProposalDraft: proposalCommand('saveProposalDraft'),
  submitProposal: proposalCommand('submitProposal'),
  resubmitProposal: proposalCommand('resubmitProposal'),
  approveProposal: proposalCommand('approveProposal'),
  requestProposalUpdate: proposalCommand('requestProposalUpdate'),
  rejectProposal: proposalCommand('rejectProposal'),
  startEmergencyRepair: emergencyCommand('start-emergency-repair'),
  closePostReviewRejected: emergencyCommand('close-post-review-rejected'),
  markNotificationRead,
  ...(Object.fromEntries(
    (Object.keys(PAYMENT_ROUTES) as PaymentAction[]).map((action) => [action, paymentCommand(action)]),
  ) as Record<PaymentAction, ApiCommandHandler>),
  ...(Object.fromEntries(
    (Object.keys(EXECUTION_ROUTES) as ExecutionAction[]).map((action) => [action, executionCommand(action)]),
  ) as Record<ExecutionAction, ApiCommandHandler>),
};

export const API_UNSUPPORTED_MESSAGE = 'Thao tác này chưa nối API.';

export const isApiAction = (action: string): boolean => Object.hasOwn(API_COMMANDS, action);

/** Runs one command over REST; unregistered actions throw instead of being dropped. */
export const executeApiCommand = async (command: Command): Promise<CommandResult> => {
  const handler = isApiAction(command.action) ? API_COMMANDS[command.action] : undefined;
  if (!handler) throw new AppError(ERROR_CODE.VALIDATION_ERROR, API_UNSUPPORTED_MESSAGE);
  return handler(command);
};
