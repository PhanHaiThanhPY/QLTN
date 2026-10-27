// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import type { QuoteSubmission } from '@/domain/quote-proposal';
import type { EmergencyInfo, RepairRecord, User, WorkflowApprovalStep } from '@/domain/types';
import type { RecordDetail } from '@/services/records-service';
import { RecordContext } from '../../record-context';
import { QuoteDecisionDialog } from './QuoteDecisionDialog';

/** B06-S1 ui-brief §2.5 / AC-E0.3: "Không duyệt hậu kiểm" in the BQT rejection of an emergency record. */
const command = vi.hoisted(() => ({ run: vi.fn(), fieldErrors: {} as Record<string, string>, isPending: false }));
vi.mock('../../hooks/useRecordCommand', () => ({ useRecordCommand: () => command }));
vi.mock('../shared/AttachmentField', () => ({ AttachmentField: () => null }));
vi.mock('@/components/common/SignaturePad', () => ({ SignaturePad: () => null }));

const BOARD: WorkflowApprovalStep = { key: 'BOARD', status: 'PENDING_BOARD_APPROVAL', role: 'OWNERS_BOARD', actor: 'BQT', label: 'BQT duyệt' };
const TECH: WorkflowApprovalStep = { key: 'TECH', status: 'PENDING_TECH_REVIEW', role: 'TECH_CONSULTANT', actor: 'TVKT', label: 'TVKT thẩm định' };
const EMERGENCY = { reason: 'Ống vỡ.', docsDueAt: '2026-10-28T02:10:00.000Z' } as EmergencyInfo;

const submission = (attemptNo: number): QuoteSubmission =>
  ({ id: `sub-${attemptNo}`, attemptNo, content: { contractors: [], contractorTotals: [], proposedContractorIndex: 0 } }) as unknown as QuoteSubmission;

const renderDialog = (step: WorkflowApprovalStep, attemptNo = 1, emergency: EmergencyInfo | null = EMERGENCY) =>
  render(
    <RecordContext.Provider value={{ detail: { record: { id: 'rec-1', emergency: emergency ?? undefined } as RepairRecord } as RecordDetail, viewer: { id: 'usr-bqt' } as User }}>
      <QuoteDecisionDialog mode="rejectProposal" step={step} submission={submission(attemptNo)} isLastStep onClose={() => undefined} />
    </RecordContext.Provider>,
  );

const toggle = () => screen.queryByRole('checkbox', { name: /Không duyệt hậu kiểm/ }) as HTMLInputElement | null;

describe('QuoteDecisionDialog post-review choice', () => {
  beforeEach(() => command.run.mockReset());

  it('lets the BOARD holder end the post-review with a warning and a danger button', () => {
    renderDialog(BOARD);
    expect(toggle()?.checked).toBe(false);
    expect(screen.queryByRole('alert')).toBeNull();
    fireEvent.click(toggle() as HTMLInputElement);
    expect(screen.getByRole('alert').textContent).toContain('Không có khoản thanh toán nào');
    fireEvent.change(screen.getByLabelText(/Lý do/), { target: { value: 'Chi phí không hợp lý.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Không duyệt hậu kiểm' }));
    expect(command.run).toHaveBeenCalledWith('rejectProposal', expect.objectContaining({ finalPostReview: true, reason: 'Chi phí không hợp lý.' }));
  });

  it('ticks and locks the box on the third submission', () => {
    renderDialog(BOARD, 3);
    expect(toggle()?.checked).toBe(true);
    expect(toggle()?.disabled).toBe(true);
    expect(screen.getByText(/Lần trình cuối \(3\/3\): từ chối sẽ kết thúc hậu kiểm/)).toBeTruthy();
  });

  it('is not offered at another step', () => {
    renderDialog(TECH);
    expect(toggle()).toBeNull();
  });

  it('is not offered on a regular record', () => {
    renderDialog(BOARD, 1, null);
    expect(toggle()).toBeNull();
    fireEvent.change(screen.getByLabelText(/Lý do/), { target: { value: 'Chi phí không hợp lý.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Từ chối tờ trình' }));
    expect(command.run.mock.calls[0][1]).not.toHaveProperty('finalPostReview');
  });
});
