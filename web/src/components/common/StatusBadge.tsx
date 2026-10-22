import { StatusPill } from '@/components/ui/badge';
import type { StatusTone } from '@/components/ui/badge';
import {
  OCCURRENCE_STATUS_LABEL,
  PLAN_STATUS_LABEL,
  REPAIR_STATUS_GROUP_BY_STATUS,
  REPAIR_STATUS_GROUP_LABEL,
  REPAIR_STATUS_LABEL,
} from '@/domain/constants';
import type { OccurrenceStatus, PlanStatus, RepairStatus } from '@/domain/constants';

/** Tone meaning: good=done, warn=waiting on someone, crit=rejected/failed, info=work in progress, neutral=draft/closed. */
export const REPAIR_STATUS_TONE: Record<RepairStatus, StatusTone> = {
  DRAFT: 'neutral',
  PENDING_CONFIRMATION: 'warn',
  NEEDS_RECORD_UPDATE: 'warn',
  PENDING_PROPOSAL: 'warn',
  EMERGENCY_IN_PROGRESS: 'info',
  PENDING_TECH_APPROVAL: 'warn',
  PENDING_TECH_REVIEW: 'warn',
  PENDING_BOARD_APPROVAL: 'warn',
  PENDING_CUSTOM_APPROVAL: 'warn',
  PENDING_CUSTOM_PAYMENT_APPROVAL: 'warn',
  NEEDS_SUBMISSION_UPDATE: 'warn',
  REJECTED_RESUBMITTABLE: 'crit',
  READY_FOR_CONSTRUCTION: 'info',
  IN_CONSTRUCTION: 'info',
  PENDING_ACCEPTANCE: 'warn',
  NEEDS_REPAIR: 'crit',
  PENDING_PAYMENT_REQUEST: 'info',
  PENDING_PAYMENT_APPROVAL: 'warn',
  NEEDS_PAYMENT_UPDATE: 'warn',
  PENDING_PAYMENT: 'info',
  COMPLETED: 'good',
  CLOSED_NO_REPAIR: 'neutral',
  UNRESOLVED: 'crit',
  CLOSED_WITHDRAWN: 'neutral',
};

export const OCCURRENCE_STATUS_TONE: Record<OccurrenceStatus, StatusTone> = {
  SCHEDULED: 'neutral',
  IN_PROGRESS: 'info',
  PENDING_REVIEW: 'warn',
  REWORK: 'warn',
  COMPLETED: 'good',
  CANCELLED: 'neutral',
};

export const PLAN_STATUS_TONE: Record<PlanStatus, StatusTone> = { DRAFT: 'neutral', ACTIVE: 'good', PAUSED: 'neutral' };

export const RepairStatusBadge = ({ status }: { status: RepairStatus }) => (
  <StatusPill tone={REPAIR_STATUS_TONE[status]}>
    <span title={REPAIR_STATUS_LABEL[status]}>{REPAIR_STATUS_GROUP_LABEL[REPAIR_STATUS_GROUP_BY_STATUS[status]]}</span>
  </StatusPill>
);

export const OccurrenceStatusBadge = ({ status }: { status: OccurrenceStatus }) => (
  <StatusPill tone={OCCURRENCE_STATUS_TONE[status]}>{OCCURRENCE_STATUS_LABEL[status]}</StatusPill>
);

export const PlanStatusBadge = ({ status }: { status: PlanStatus }) => (
  <StatusPill tone={PLAN_STATUS_TONE[status]}>{PLAN_STATUS_LABEL[status]}</StatusPill>
);
