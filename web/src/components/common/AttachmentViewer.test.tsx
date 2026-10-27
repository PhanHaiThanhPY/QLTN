// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Attachment } from '@/domain/types';
import { AppError, ERROR_CODE } from '@/domain/errors';
import { readAttachmentBlob } from '@/services/file-service';
import { downloadBlob } from '@/utils/download';
import { AttachmentViewer } from './AttachmentViewer';

vi.mock('@/services/file-service', () => ({ readAttachmentBlob: vi.fn() }));
vi.mock('@/utils/download', () => ({ downloadBlob: vi.fn() }));

/** SPEC AT-S1 BR-AT-03 / BR-AT-06: download the viewed bytes under the original name; smooth image scaling. */
const invoice = { id: 'att-1', fileName: 'HD-0012 Hòa Phát.pdf', mimeType: 'application/pdf' } as Attachment;
const photo = { id: 'att-2', fileName: 'hien-truong.png', mimeType: 'image/png' } as Attachment;

describe('AttachmentViewer (AT-S1)', () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => 'blob:view');
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.mocked(downloadBlob).mockClear();
  });

  it('locks "Tải xuống" while opening, then saves the same blob under the original name (AC-AT.5)', async () => {
    const blob = new Blob(['%PDF-1.4 hóa đơn'], { type: 'application/pdf' });
    let open: (value: { blob: Blob }) => void = () => undefined;
    vi.mocked(readAttachmentBlob).mockReturnValue(new Promise((resolve) => (open = resolve)));
    render(<AttachmentViewer attachment={invoice} onClose={vi.fn()} />);

    const button = screen.getByRole('button', { name: 'Tải xuống HD-0012 Hòa Phát.pdf' });
    expect(button.hasAttribute('disabled')).toBe(true);
    expect(screen.getByText('Đang mở tệp…')).toBeTruthy();

    open({ blob });
    await waitFor(() => expect(button.hasAttribute('disabled')).toBe(false));
    fireEvent.click(button);
    expect(downloadBlob).toHaveBeenCalledWith('HD-0012 Hòa Phát.pdf', blob);
  });

  it('hides "Tải xuống" when the file cannot be opened (AC-AT.6 keeps the 404)', async () => {
    vi.mocked(readAttachmentBlob).mockRejectedValue(new AppError(ERROR_CODE.NOT_FOUND, 'Không tìm thấy tệp hoặc tệp ngoài phạm vi.'));
    render(<AttachmentViewer attachment={invoice} onClose={vi.fn()} />);

    expect(await screen.findByText('Không tìm thấy tệp hoặc tệp ngoài phạm vi.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Tải xuống/ })).toBeNull();
    // The dialog's × and the footer button (ui-brief §2.2) both close it.
    expect(screen.getAllByRole('button', { name: 'Đóng' })).toHaveLength(2);
  });

  it('shows photos with smooth scaling, not pixelated (AC-AT.11)', async () => {
    vi.mocked(readAttachmentBlob).mockResolvedValue({ blob: new Blob(['png'], { type: 'image/png' }) });
    render(<AttachmentViewer attachment={photo} onClose={vi.fn()} />);

    const image = await screen.findByRole('img', { name: 'hien-truong.png' });
    expect(image.className).not.toContain('pixelated');
  });
});
