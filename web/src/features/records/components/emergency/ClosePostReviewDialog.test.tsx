// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import type { RepairRecord, User } from '@/domain/types';
import type { RecordDetail } from '@/services/records-service';
import { RecordContext } from '../../record-context';
import { ClosePostReviewDialog } from './ClosePostReviewDialog';

/** B06-S1 BR-E-08 / ui-brief §2.6: the BOARD holder's decision; F-B06-S1-01 error association. */
const command = vi.hoisted(() => ({ run: vi.fn(), fieldErrors: {} as Record<string, string>, isPending: false }));
vi.mock('../../hooks/useRecordCommand', () => ({ useRecordCommand: () => command }));
vi.mock('../shared/AttachmentField', () => ({ AttachmentField: () => null }));

const renderDialog = () =>
  render(
    <RecordContext.Provider value={{ detail: { record: { id: 'rec-1' } as RepairRecord } as RecordDetail, viewer: { id: 'usr-bqt' } as User }}>
      <ClosePostReviewDialog onClose={() => undefined} />
    </RecordContext.Provider>,
  );

describe('ClosePostReviewDialog', () => {
  beforeEach(() => {
    command.run.mockReset();
    command.fieldErrors = {};
  });

  it('sends the decision once it has 5 characters', () => {
    renderDialog();
    const close = screen.getByRole('button', { name: 'Đóng hồ sơ' }) as HTMLButtonElement;
    expect(close.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/Quyết định xử lý chi phí/), { target: { value: 'Nhà thầu tự chịu.' } });
    fireEvent.click(close);
    expect(command.run).toHaveBeenCalledWith('closePostReviewRejected', { reason: 'Nhà thầu tự chịu.', attachmentIds: [] });
  });

  it('F-B06-S1-01: the reason error is announced with the field', () => {
    command.fieldErrors = { reason: 'Quyết định xử lý chi phí cần tối thiểu 5 ký tự.' };
    renderDialog();
    const control = screen.getByLabelText(/Quyết định xử lý chi phí/);
    expect(control.getAttribute('aria-invalid')).toBe('true');
    expect(document.getElementById(control.getAttribute('aria-describedby') ?? '')?.textContent).toBe(command.fieldErrors.reason);
  });
});
