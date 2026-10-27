// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { toast } from 'sonner';
import { AppError, ERROR_CODE } from '@/domain/errors';
import type { Attachment } from '@/domain/types';
import { uploadAttachment } from '@/services/file-service';
import { HEIC_REASON } from '@/services/upload-prep';
import { FileUploader } from './FileUploader';
import { OFFLINE_REASON } from './upload-batch';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@/services/file-service', () => ({ uploadAttachment: vi.fn() }));

/** SPEC AT-S1 BR-AT-01/02: the round goes on after a file's own error and reports what did not go up. */
const BAD_CONTENT = 'Nội dung tệp không đúng định dạng JPEG/PNG/WebP/PDF đã khai báo.';
const STEP_DENIED = 'Bước hiện tại không cho tải loại tệp này.';

const pdf = (name: string) => new File(['%PDF-1.4'], name, { type: 'application/pdf' });
const attachmentOf = (fileName: string): Attachment => ({ id: `att-${fileName}`, fileName }) as Attachment;

const select = (container: HTMLElement, files: File[]) => {
  const input = container.querySelector('input[type="file"]');
  if (!(input instanceof HTMLInputElement)) throw new Error('File input not rendered');
  Object.defineProperty(input, 'files', { configurable: true, value: files });
  fireEvent.change(input);
};

describe('FileUploader rounds (AT-S1)', () => {
  const onUploaded = vi.fn();
  const upload = vi.mocked(uploadAttachment);

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    upload.mockImplementation(async ({ fileName }) => attachmentOf(fileName));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    upload.mockReset();
    vi.mocked(toast.success).mockClear();
    onUploaded.mockClear();
  });

  const renderUploader = () =>
    render(<FileUploader subjectType="REPAIR_RECORD" subjectId="rec-1" purpose="SITE_PHOTO" onUploaded={onUploaded} />);

  it('uploads the other 4 files when the 2nd is refused, and reports 4/5 (AC-AT.1)', async () => {
    upload.mockImplementation(async ({ fileName }) => {
      if (fileName === 'b.png') throw new AppError(ERROR_CODE.VALIDATION_ERROR, BAD_CONTENT);
      return attachmentOf(fileName);
    });
    const files = [pdf('a.pdf'), new File(['text'], 'b.png', { type: 'text/plain' }), pdf('c.pdf'), pdf('d.pdf'), pdf('e.pdf')];
    const { container } = renderUploader();
    select(container, files);

    const report = await screen.findByRole('status');
    expect(within(report).getByText('Đã tải 4/5 tệp')).toBeTruthy();
    expect(within(report).getByText('b.png')).toBeTruthy();
    expect(within(report).getByText(BAD_CONTENT)).toBeTruthy();
    expect(upload.mock.calls.map(([input]) => input.fileName)).toEqual(['a.pdf', 'b.png', 'c.pdf', 'd.pdf', 'e.pdf']);
    expect(onUploaded).toHaveBeenCalledWith(['a.pdf', 'c.pdf', 'd.pdf', 'e.pdf'].map((name) => expect.objectContaining({ fileName: name })));
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('goes on after a connection loss and names it (AC-AT.2)', async () => {
    const online = vi.spyOn(navigator, 'onLine', 'get');
    upload.mockImplementation(async ({ fileName }) => {
      if (fileName === '2.pdf') {
        online.mockReturnValue(false);
        throw new AppError(ERROR_CODE.NETWORK_ERROR, 'Không kết nối được máy chủ.');
      }
      online.mockReturnValue(true);
      return attachmentOf(fileName);
    });
    const { container } = renderUploader();
    select(container, [pdf('1.pdf'), pdf('2.pdf'), pdf('3.pdf')]);

    const report = await screen.findByRole('status');
    expect(within(report).getByText('Đã tải 2/3 tệp')).toBeTruthy();
    expect(within(report).getByText(OFFLINE_REASON)).toBeTruthy();
    expect(onUploaded).toHaveBeenCalledWith([expect.objectContaining({ fileName: '1.pdf' }), expect.objectContaining({ fileName: '3.pdf' })]);
  });

  it('stops the round on a step refusal and marks the rest "Chưa tải" (AC-AT.3)', async () => {
    upload.mockRejectedValue(new AppError(ERROR_CODE.FORBIDDEN, STEP_DENIED));
    const { container } = renderUploader();
    select(container, [pdf('1.pdf'), pdf('2.pdf'), pdf('3.pdf')]);

    const report = await screen.findByRole('status');
    expect(within(report).getByText('Đã tải 0/3 tệp')).toBeTruthy();
    expect(within(report).getByText(STEP_DENIED)).toBeTruthy();
    expect(within(report).getAllByText('Chưa tải')).toHaveLength(2);
    expect(upload).toHaveBeenCalledTimes(1);
    expect(report.className).toContain('crit');
    expect(onUploaded).not.toHaveBeenCalled();
  });

  it.each([ERROR_CODE.NOT_FOUND, ERROR_CODE.CONFLICT, ERROR_CODE.UNAUTHORIZED])('stops the round on %s', async (code) => {
    upload.mockRejectedValue(new AppError(code, 'Từ chối.'));
    const { container } = renderUploader();
    select(container, [pdf('1.pdf'), pdf('2.pdf')]);

    await screen.findByRole('status');
    expect(upload).toHaveBeenCalledTimes(1);
  });

  it('only toasts when every file goes up (AC-AT.4)', async () => {
    const { container } = renderUploader();
    select(container, [pdf('1.pdf'), pdf('2.pdf'), pdf('3.pdf')]);

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Đã tải 3 tệp'));
    expect(screen.queryByRole('status')).toBeNull();
    expect(onUploaded).toHaveBeenCalledTimes(1);
  });

  it('refuses HEIC without sending it (AC-AT.9) and closes the report on demand', async () => {
    const { container } = renderUploader();
    select(container, [new File(['x'], 'IMG_0001.HEIC', { type: 'image/heic' })]);

    const report = await screen.findByRole('status');
    expect(within(report).getByText(HEIC_REASON)).toBeTruthy();
    expect(upload).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Đóng báo cáo tải tệp' }));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('shows "Đang tải k/n…" while a file goes up', async () => {
    let release: (value: Attachment) => void = () => undefined;
    upload.mockImplementation(({ fileName }) => new Promise((resolve) => (release = () => resolve(attachmentOf(fileName)))));
    const { container } = renderUploader();
    select(container, [pdf('1.pdf')]);

    expect(await screen.findByText('Đang tải 1/1…')).toBeTruthy();
    release(attachmentOf('1.pdf'));
    await waitFor(() => expect(screen.getByText('Thêm tệp')).toBeTruthy());
  });
});
