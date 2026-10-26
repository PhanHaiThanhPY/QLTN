// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { workflowStagesOf } from '@/domain/building-config';
import type { RepairRecord, WorkflowStageConfig } from '@/domain/types';
import { ApprovalStepper } from './ApprovalStepper';

/**
 * SPEC RM-S2 AC-2.8 / BR-11: the configuration screens read the chain from the PROPOSAL stage, the record screens
 * from `record.approvalStepKeys` (never from the record's `workflowStageApprovalStepKeys.PROPOSAL`).
 */
vi.mock('@/hooks/useReferenceData', () => ({ useReferenceData: () => ({ userName: () => '—' }) }));

describe('approval chain sources', () => {
  it('draws a record chain from record.approvalStepKeys even when its PROPOSAL stage snapshot differs', () => {
    const record = {
      id: 'rec-1',
      status: 'PENDING_TECH_REVIEW',
      approvalStepKeys: ['TECH', 'BOARD'],
      workflowStageApprovalStepKeys: { PROPOSAL: ['TECH_CONFIRM', 'TECH', 'BOARD'] },
      approvalAssigneeUserIds: {},
    } as unknown as RepairRecord;
    render(<ApprovalStepper record={record} decisions={[]} isCurrent />);

    expect(screen.getByText(/1\. TVKT thẩm định/)).toBeTruthy();
    expect(screen.getByText(/2\. BQT duyệt/)).toBeTruthy();
    expect(screen.queryByText(/Kỹ thuật duyệt/)).toBeNull();
  });

  it('gives the designer the stored PROPOSAL stage, not a stale approvalStepKeys', () => {
    const stored: WorkflowStageConfig[] = workflowStagesOf().map((stage) =>
      stage.key === 'PROPOSAL' ? { ...stage, approvalStepKeys: ['TECH', 'BOARD'] } : stage,
    );
    const stages = workflowStagesOf(stored, ['TECH']);
    expect(stages.find((stage) => stage.key === 'PROPOSAL')?.approvalStepKeys).toEqual(['TECH', 'BOARD']);
  });
});
