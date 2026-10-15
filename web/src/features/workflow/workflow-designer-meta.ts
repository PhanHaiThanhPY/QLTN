import {
  CheckCircle2,
  CheckSquare2,
  Clock3,
  FileText,
  ListTree,
  Play,
  UserRound,
  UsersRound,
  Workflow,
  type LucideIcon,
} from 'lucide-react';
import { APPROVAL_STEPS } from '@/domain/constants';
import type { ApprovalStepKey, BUSINESS_WORKFLOW_STEPS, BusinessWorkflowStepKey } from '@/domain/constants';
import type { Building, BuildingConfig } from '@/domain/types';

export type ApprovalStepDefinition = (typeof APPROVAL_STEPS)[number];
export type BusinessStepDefinition = (typeof BUSINESS_WORKFLOW_STEPS)[number];
export type WorkflowScope = 'current' | 'all';

export interface WorkflowTarget {
  building: Building;
  config: BuildingConfig;
}

export const DEFAULT_WORKFLOW_NAME = 'Quy trình sửa chữa và bảo trì';
export const DEFAULT_WORKFLOW_DESCRIPTION = 'Quy trình xử lý hồ sơ theo từng bước được cấu hình cho tòa nhà.';

export const STEP_ICON: Record<ApprovalStepKey, LucideIcon> = {
  TECH_CONFIRM: UserRound,
  TECH: CheckSquare2,
  BOARD: UsersRound,
};

export const STEP_TONE: Record<ApprovalStepKey, string> = {
  TECH_CONFIRM: 'bg-info-soft text-info',
  TECH: 'bg-accent-soft text-accent-strong',
  BOARD: 'bg-good-soft text-good',
};

export const BUSINESS_STEP_ICON: Record<BusinessWorkflowStepKey, LucideIcon> = {
  CREATE_RECORD: FileText,
  SUBMIT_CONFIRMATION: Workflow,
  CONFIRM_CONDITION: CheckCircle2,
  PREPARE_PROPOSAL: ListTree,
  START_CONSTRUCTION: Play,
  UPDATE_PROGRESS: Clock3,
  SUBMIT_ACCEPTANCE: CheckCircle2,
  PASS_ACCEPTANCE: CheckCircle2,
  PREPARE_PAYMENT: FileText,
  APPROVE_PAYMENT: CheckSquare2,
  RECORD_PAYMENT: CheckCircle2,
  COMPLETE_RECORD: CheckCircle2,
};

export const stepFor = (key: ApprovalStepKey): ApprovalStepDefinition => APPROVAL_STEPS.find((step) => step.key === key) ?? APPROVAL_STEPS[0];
