// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import type { RepairRecord, User } from '@/domain/types';
import type { RecordDetail } from '@/services/records-service';
import { RecordContext } from '../../record-context';
import { EmergencyDialog } from './EmergencyDialog';

/** B06-S1 ui-brief §2.2 / AC-E0.3: limit from the record detail, amount in words, field errors, offline lock. */
const command = vi.hoisted(() => ({ run: vi.fn(), fieldErrors: {} as Record<string, string>, isPending: false }));
vi.mock('../../hooks/useRecordCommand', () => ({ useRecordCommand: () => command }));
vi.mock('@/config/data-source', () => ({ IS_API_MODE: true, DATA_SOURCE: 'api', API_BASE_URL: '/api' }));

const DETAIL = {
  record: { id: 'rec-1', status: 'PENDING_PROPOSAL' } as RepairRecord,
  emergencyPolicy: { limitVnd: 15_000_000, docHours: 24 },
} as RecordDetail;

const renderDialog = (detail: RecordDetail = DETAIL) =>
  render(
    <RecordContext.Provider value={{ detail, viewer: { id: 'usr-bql' } as User }}>
      <EmergencyDialog onClose={() => undefined} />
    </RecordContext.Provider>,
  );

const confirmButton = () => screen.getByRole('button', { name: 'Bắt đầu xử lý' }) as HTMLButtonElement;

describe('EmergencyDialog (api mode)', () => {
  beforeEach(() => {
    command.run.mockReset();
    command.fieldErrors = {};
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  });

  it('shows the building limit and hours, the amount in words, and sends the request', () => {
    renderDialog();
    expect(screen.getByText('Hạn mức khẩn cấp của tòa: 15.000.000 ₫')).toBeTruthy();
    expect(screen.getAllByText(/nộp bổ sung trong 24 giờ/).length).toBeGreaterThan(0);
    expect(confirmButton().disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/Lý do phải xử lý ngay/), { target: { value: 'Ống cấp chính vỡ, nước tràn hầm B1.' } });
    fireEvent.change(screen.getByLabelText(/Nhà thầu thực hiện/), { target: { value: 'Cty TNHH Bình An' } });
    fireEvent.change(screen.getByLabelText(/Chi phí dự kiến/), { target: { value: '12500000' } });
    expect(screen.getByText('Mười hai triệu năm trăm nghìn đồng')).toBeTruthy();
    fireEvent.click(confirmButton());
    expect(command.run).toHaveBeenCalledWith(
      'startEmergencyRepair',
      expect.objectContaining({ reason: 'Ống cấp chính vỡ, nước tràn hầm B1.', contractorName: 'Cty TNHH Bình An', estimatedAmountVnd: 12_500_000 }),
    );
  });

  it('shows the over-limit error under the amount', () => {
    command.fieldErrors = { estimatedAmountVnd: 'Chi phí dự kiến vượt hạn mức khẩn cấp của tòa (15.000.000 ₫). Hãy đi quy trình duyệt thông thường.' };
    renderDialog();
    expect(screen.getByText(/vượt hạn mức khẩn cấp của tòa \(15\.000\.000 ₫\)/)).toBeTruthy();
  });

  it('keeps the button locked while the limit is loading', () => {
    renderDialog({ ...DETAIL, emergencyPolicy: undefined });
    fireEvent.change(screen.getByLabelText(/Lý do phải xử lý ngay/), { target: { value: 'Ống cấp chính vỡ, nước tràn hầm B1.' } });
    fireEvent.change(screen.getByLabelText(/Nhà thầu thực hiện/), { target: { value: 'Cty TNHH Bình An' } });
    fireEvent.change(screen.getByLabelText(/Chi phí dự kiến/), { target: { value: '12500000' } });
    expect(screen.queryByText(/Hạn mức khẩn cấp của tòa/)).toBeNull();
    expect(confirmButton().disabled).toBe(true);
  });

  it('says the connection is lost and locks sending when offline', () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    renderDialog();
    fireEvent.change(screen.getByLabelText(/Lý do phải xử lý ngay/), { target: { value: 'Ống cấp chính vỡ, nước tràn hầm B1.' } });
    fireEvent.change(screen.getByLabelText(/Nhà thầu thực hiện/), { target: { value: 'Cty TNHH Bình An' } });
    fireEvent.change(screen.getByLabelText(/Chi phí dự kiến/), { target: { value: '12500000' } });
    expect(screen.getByText('Đang mất kết nối — chưa gửi được.')).toBeTruthy();
    expect(confirmButton().disabled).toBe(true);
  });
});
