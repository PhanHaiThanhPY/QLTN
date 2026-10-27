// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { toast } from 'sonner';
import { LIMITS } from '@/domain/constants';
import { USER_ID } from '@/mock/seed-reference';
import { asUser, useFreshDb } from '@/test/helpers';
import { installNodeBlobs } from '@/test/node-blob';
import { FileUploader } from './FileUploader';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

installNodeBlobs();

// Type and size are validated by the file service (shared with every caller); the uploader surfaces its message.
const selectFile = (container: HTMLElement, file: File) => {
  const input = container.querySelector('input[type="file"]');
  if (!(input instanceof HTMLInputElement)) throw new Error('File input not rendered');
  Object.defineProperty(input, 'files', { configurable: true, value: [file] });
  fireEvent.change(input);
};

describe('FileUploader', () => {
  const onUploaded = vi.fn();

  beforeEach(() => {
    useFreshDb();
    asUser(USER_ID.BQL_A);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.mocked(toast.error).mockClear();
    onUploaded.mockClear();
  });

  const renderUploader = () =>
    render(<FileUploader subjectType="REPAIR_RECORD" subjectId="rec-1" purpose="SITE_PHOTO" onUploaded={onUploaded} />);

  it('should restrict the picker to the allowed types', () => {
    const { container } = renderUploader();
    expect(container.querySelector('input[type="file"]')?.getAttribute('accept')).toBe(LIMITS.ALLOWED_MIME_TYPES.join(','));
    expect(screen.getByText(/tối đa 10 MB/)).toBeTruthy();
  });

  it('should reject a file with an unsupported MIME type', async () => {
    const { container } = renderUploader();
    selectFile(container, new File(['hello'], 'note.txt', { type: 'text/plain' }));

    // AT-S1 BR-AT-02: the refusal stays in the report under the button instead of a toast.
    const report = await screen.findByRole('status');
    expect(within(report).getByText('Chỉ hỗ trợ ảnh JPEG/PNG/WebP hoặc PDF.')).toBeTruthy();
    expect(toast.error).not.toHaveBeenCalled();
    expect(onUploaded).not.toHaveBeenCalled();
  });

  it('should reject a file larger than 10 MB', async () => {
    const { container } = renderUploader();
    const file = new File([new Uint8Array(8)], 'big.pdf', { type: 'application/pdf' });
    Object.defineProperty(file, 'size', { value: LIMITS.MAX_FILE_BYTES + 1 });
    selectFile(container, file);

    const report = await screen.findByRole('status');
    expect(within(report).getByText('Tệp vượt quá 10 MB.')).toBeTruthy();
    expect(onUploaded).not.toHaveBeenCalled();
  });
});
