// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import type { AcceptanceRound } from '@/domain/execution';
import type { RepairRecord, User } from '@/domain/types';
import { RecordContext } from '../../record-context';
import type { RecordDetail } from '@/services/records-service';
import { MinutesCard } from './MinutesCard';

/** SPEC B03–B09 v2 BR-S3-04 / AC-3.3: the minutes show every member, their conclusion and signature. */
vi.mock('@/hooks/useReferenceData', () => ({
  useReferenceData: () => ({ userName: (id?: string) => (id ? `Người ${id}` : '—'), data: undefined, isLoading: false }),
}));
vi.mock('../shared/RecordFiles', () => ({ RecordFiles: () => null }));

const RECORD = {
  id: 'rec-1',
  managerUserId: 'usr-bql',
  approvalAssigneeUserIds: { BOARD: 'usr-bqt', TECH: 'usr-tvkt' },
  workflowApprovalSteps: [],
} as unknown as RepairRecord;

const round = (overrides: Partial<AcceptanceRound>): AcceptanceRound => ({
  id: 'acc-1',
  roundNo: 1,
  completedDate: '2026-10-26',
  inspectedAt: '2026-10-26T02:00:00.000Z',
  inspectionLocation: 'Hành lang tầng 3',
  content: 'Kiểm tra đoạn ống mới.',
  otherMembers: 'Đại diện cư dân',
  photoAttachmentIds: [],
  memberStepKeys: ['MANAGER', 'BOARD', 'TECH'],
  outcome: 'PENDING',
  submittedBy: 'usr-bql',
  createdAt: '2026-10-26T02:00:00.000Z',
  closedAt: null,
  decisions: [],
  ...overrides,
});

const renderCard = (value: AcceptanceRound) =>
  render(
    <RecordContext.Provider value={{ detail: { record: RECORD } as RecordDetail, viewer: { id: 'usr-bql' } as User }}>
      <MinutesCard round={value} />
    </RecordContext.Provider>,
  );

describe('MinutesCard', () => {
  it('lists the three members as waiting on a new round', () => {
    renderCard(round({}));
    expect(screen.getByText('BQL nghiệm thu')).toBeTruthy();
    expect(screen.getByText('BQT duyệt')).toBeTruthy();
    expect(screen.getByText('TVKT thẩm định')).toBeTruthy();
    expect(screen.getAllByText('Chưa quyết định')).toHaveLength(3);
    expect(screen.getByText('Kết luận chung: Đang nghiệm thu')).toBeTruthy();
  });

  it('shows every signature and the locked conclusion once all passed', () => {
    const decided = ['MANAGER', 'BOARD', 'TECH'].map((stepKey, index) => ({
      id: `dec-${index}`,
      stepKey,
      actorId: `usr-${index}`,
      outcome: 'PASSED' as const,
      note: null,
      attachmentIds: [],
      signatureDataUrl: 'data:image/png;base64,AA',
      createdAt: '2026-10-26T03:00:00.000Z',
    }));
    renderCard(round({ outcome: 'PASSED', closedAt: '2026-10-26T03:00:00.000Z', decisions: decided }));
    expect(screen.getAllByText('ĐẠT')).toHaveLength(3);
    expect(screen.getAllByRole('img')).toHaveLength(3);
    expect(screen.getByText('Kết luận chung: Đạt')).toBeTruthy();
  });
});
