import type { Attachment, AuditEvent } from '@/domain/types';
import { apiRequest } from './http/client';
import { mapAttachment, mapAuditEvent, type ApiAttachment, type ApiAuditEvent } from './http/mappers';

/** SPEC T-S1 shapes as the API answers them (api mode only). Money is integer VND as a string; rates in ‰ of a %. */
export type InvitationStatus = 'DRAFT' | 'OPEN' | 'CLOSED' | 'SELECTED' | 'NO_RESULT' | 'CANCELLED';
export type DepositSelectionStatus = 'PENDING' | 'NEEDS_CHANGES' | 'APPROVED' | 'REJECTED' | 'SUPERSEDED';
export type PaymentKind = 'END' | 'PERIODIC';
export type PaymentUnit = 'MONTH' | 'DAY';
export type OfferCompleteness = 'COMPLETE' | 'INCOMPLETE';

export interface Bank {
  id: string;
  code: string;
  name: string;
  shortName: string | null;
  branch: string | null;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  active: boolean;
  deactivationReason: string | null;
  version: number;
  invitationCount: number;
}

export interface InvitationRow {
  id: string;
  code: string;
  fundId: string;
  buildingId: string;
  amountVnd: string;
  termDays: number;
  deadlineAt: string | null;
  status: InvitationStatus;
  sentOn: string | null;
  responded: number;
  invited: number;
  selectionStatus: DepositSelectionStatus | null;
  decidedAt: string | null;
  version: number;
}

export interface Invitation {
  id: string;
  code: string;
  fundId: string;
  buildingId: string;
  amountVnd: string;
  termDays: number;
  deadlineAt: string | null;
  expectedDepositOn: string | null;
  conditions: string | null;
  letterAttachmentId: string | null;
  inviteeIds: string[];
  status: InvitationStatus;
  sentOn: string | null;
  closedAt: string | null;
  closeKind: 'DEADLINE' | 'EARLY' | null;
  statusReason: string | null;
  createdBy: string;
  version: number;
}

export interface Offer {
  id: string;
  invitationId: string;
  bankId: string;
  receivedAt: string;
  rateMilli: number;
  dayBasis: 360 | 365;
  paymentKind: PaymentKind;
  paymentEvery: number | null;
  paymentUnit: PaymentUnit | null;
  conditions: string | null;
  attachmentId: string;
  completeness: OfferCompleteness;
  missingNote: string | null;
  isLate: boolean;
  outside: boolean;
  outsideReason: string | null;
  interestVnd: string;
  version: number;
}

export interface ComparisonRow {
  rank: number;
  offerId: string;
  bankId: string;
  bankCode: string;
  bankName: string;
  shortName: string | null;
  rateMilli: number;
  dayBasis: number;
  interestVnd: string;
  paymentKind: PaymentKind;
  paymentEvery: number | null;
  paymentUnit: PaymentUnit | null;
  completeness: OfferCompleteness;
  missingNote: string | null;
  isLate: boolean;
  outside: boolean;
}

export interface Comparison {
  amountVnd: string;
  termDays: number;
  rows: ComparisonRow[];
  mixedBasis: boolean;
  highestOfferId: string | null;
}

export interface DepositSelection {
  id: string;
  code: string;
  minutesCode: string;
  invitationId: string;
  kind: 'BANK' | 'NONE';
  offerId: string | null;
  bankId: string | null;
  minutesAttachmentId: string;
  basis: string;
  notHighestReason: string | null;
  lateReason: string | null;
  comparison: ComparisonRow[];
  status: DepositSelectionStatus;
  replacesId: string | null;
  changeReason: string | null;
  decisions: Array<{ decision: 'SUBMIT' | 'APPROVE' | 'REQUEST_CHANGES' | 'REJECT'; reason: string | null; by: string; at: string }>;
  submittedAt: string;
  createdBy: string;
  version: number;
}

export interface InvitationDetail {
  invitation: Invitation;
  progress: { responded: number; invited: number };
  invitees: Array<Bank & { offerId: string | null }>;
  offers: Offer[];
  comparison: Comparison;
  selections: DepositSelection[];
  banks: Record<string, Bank>;
  files: Record<string, Attachment>;
  audit: AuditEvent[];
}

export const listBanks = (includeInactive = false): Promise<Bank[]> =>
  apiRequest('GET', '/deposits/banks', { query: includeInactive ? { includeInactive: 'true' } : {} });

export const listInvitations = (): Promise<InvitationRow[]> => apiRequest('GET', '/deposits/invitations');

type ApiDetail = Omit<InvitationDetail, 'files' | 'audit'> & { files: Record<string, ApiAttachment>; audit: ApiAuditEvent[] };

export const mapInvitationDetail = (body: ApiDetail): InvitationDetail => ({
  ...body,
  files: Object.fromEntries(Object.entries(body.files).map(([key, file]) => [key, mapAttachment(file)])),
  audit: body.audit.map(mapAuditEvent),
});

export const getInvitation = async (id: string): Promise<InvitationDetail> =>
  mapInvitationDetail(await apiRequest<ApiDetail>('GET', `/deposits/invitations/${encodeURIComponent(id)}`));
