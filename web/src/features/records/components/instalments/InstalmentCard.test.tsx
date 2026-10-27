// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { PaymentInstalment } from '@/domain/payment';
import type { RepairRecord, User } from '@/domain/types';
import type { RecordDetail } from '@/services/records-service';
import { RecordContext } from '../../record-context';
import { InstalmentCard } from './InstalmentCard';

/** FX-S2 BR-FX2-06 / AC-FX2.1: a 0-đồng settlement reads "Không cần chuyển khoản" and offers no transfer. */
vi.mock('@/hooks/useReferenceData', () => ({
  useReferenceData: () => ({ userName: (id?: string) => (id ? `Người ${id}` : '—'), data: undefined, isLoading: false }),
}));
vi.mock('../shared/RecordFiles', () => ({ RecordFiles: () => null }));

const RECORD = {
  id: 'rec-1',
  managerUserId: 'usr-bql',
  approvalAssigneeUserIds: { BOARD: 'usr-bqt' },
  workflowApprovalSteps: [],
} as unknown as RepairRecord;

const settlement = (overrides: Partial<PaymentInstalment>): PaymentInstalment => ({
  id: 'pay-2',
  kind: 'QUYET_TOAN',
  seqNo: 2,
  status: 'TRANSFERRED',
  revisionNo: 1,
  settlementAmountVnd: '10000000',
  amountVnd: '0',
  payeeName: '',
  accountNo: '',
  bankName: '',
  transferContent: 'BQT A THANH TOAN CHI PHI SC-001',
  requestAttachmentIds: [],
  invoiceAttachmentIds: [],
  chainStepKeys: ['BOARD'],
  currentStepKey: null,
  submittedBy: 'usr-bql',
  submittedAt: '2026-10-27T02:00:00.000Z',
  transferDate: null,
  transferReference: null,
  proofAttachmentIds: [],
  confirmedBy: null,
  confirmedAt: null,
  decisions: [],
  signatureDataUrl: null,
  ...overrides,
});

const renderCard = (payment: PaymentInstalment) =>
  render(
    <RecordContext.Provider value={{ detail: { record: RECORD } as RecordDetail, viewer: { id: 'usr-bqt' } as User }}>
      <TooltipProvider>
        <InstalmentCard payment={payment} />
      </TooltipProvider>
    </RecordContext.Provider>,
  );

describe('InstalmentCard', () => {
  it('shows a done 0-đồng settlement as "Không cần chuyển khoản", with the computation and no transfer button', () => {
    renderCard(settlement({}));
    expect(screen.getAllByText('Không cần chuyển khoản')).toHaveLength(2);
    expect(screen.queryByText('Đã chuyển khoản')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Xác nhận đã chuyển khoản' })).toBeNull();
    expect(screen.getByText(/10\.000\.000 ₫ − tạm ứng đã chuyển 10\.000\.000 ₫/)).toBeTruthy();
    expect(screen.getByText('Không đồng')).toBeTruthy();
  });

  it('keeps the transfer button on a settlement above 0 waiting for the transfer', () => {
    renderCard(settlement({ status: 'PENDING_TRANSFER', amountVnd: '6000000', payeeName: 'NAM PHAT', accountNo: '0123456789', bankName: 'VCB' }));
    expect(screen.getByText('Chờ chuyển khoản')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Xác nhận đã chuyển khoản' })).toBeTruthy();
    expect(screen.getByText('NAM PHAT · 0123456789 · VCB')).toBeTruthy();
  });
});
