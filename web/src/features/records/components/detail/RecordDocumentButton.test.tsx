// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { toast } from 'sonner';
import type { User } from '@/domain/types';
import type { RecordDetail } from '@/services/records-service';
import { PRINT_URL_REVOKE_DELAY_MS } from '@/utils/print-document';
import { RecordContext } from '../../record-context';
import { RecordDocumentButton } from './RecordDocumentButton';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@/hooks/useReferenceData', () => ({
  useReferenceData: () => ({ buildingName: () => 'A', locationName: () => 'P101', userName: () => 'BQL' }),
}));
vi.mock('./record-document', () => ({ buildRepairDocumentHtml: () => '<!doctype html><p>Bộ biểu mẫu</p>' }));

const BLOB_URL = 'blob:http://localhost/doc-1';

const renderButton = () =>
  render(
    <RecordContext.Provider value={{ detail: {} as RecordDetail, viewer: {} as User }}>
      <RecordDocumentButton />
    </RecordContext.Provider>,
  );

describe('RecordDocumentButton', () => {
  const createObjectURL = vi.fn((blob: Blob) => (blob.type === 'text/html' ? BLOB_URL : 'blob:wrong-type'));
  const revokeObjectURL = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    createObjectURL.mockClear();
    revokeObjectURL.mockClear();
    vi.mocked(toast.error).mockClear();
  });

  it('should open the bundle as an HTML blob and print it once loaded', () => {
    const preview = {
      closed: false,
      location: { href: 'about:blank' },
      document: { readyState: 'loading' },
      opener: window,
      focus: vi.fn(),
      print: vi.fn(),
    };
    const open = vi.spyOn(window, 'open').mockReturnValue(preview as unknown as Window);
    renderButton();

    fireEvent.click(screen.getByRole('button', { name: 'Xem bộ biểu mẫu' }));

    expect(open).toHaveBeenCalledWith(BLOB_URL, '_blank');
    expect(toast.error).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    expect(preview.print).not.toHaveBeenCalled();

    preview.location.href = BLOB_URL;
    preview.document.readyState = 'complete';
    vi.advanceTimersByTime(100);
    expect(preview.print).toHaveBeenCalledTimes(1);
    expect(preview.opener).toBeNull();
    expect(revokeObjectURL).not.toHaveBeenCalled();

    vi.advanceTimersByTime(PRINT_URL_REVOKE_DELAY_MS);
    expect(revokeObjectURL).toHaveBeenCalledWith(BLOB_URL);
  });

  it('should warn and release the blob when the popup is blocked', () => {
    vi.spyOn(window, 'open').mockReturnValue(null);
    renderButton();

    fireEvent.click(screen.getByRole('button', { name: 'Xem bộ biểu mẫu' }));

    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('chặn cửa sổ'));
    expect(revokeObjectURL).toHaveBeenCalledWith(BLOB_URL);
  });
});
