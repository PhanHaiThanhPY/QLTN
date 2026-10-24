// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readAttachmentBlob, uploadAttachment } from './file-service';

/** The API branch of the file service: multipart upload and binary content, no IndexedDB. */
vi.mock('@/config/data-source', () => ({
  DATA_SOURCE: 'api',
  IS_API_MODE: true,
  API_BASE_URL: '/api',
}));

const successBody = (data: unknown): unknown => ({
  success: true,
  data,
  timestamp: '2026-01-01T00:00:00.000Z',
  correlationId: null,
});

const jsonResponse = (status: number, body: unknown): Response =>
  ({ status, text: async () => (body === null ? '' : JSON.stringify(body)) }) as unknown as Response;

const mockFetch = (handler: (url: string, init: RequestInit) => Response | Promise<Response>) => {
  const mock = vi.fn(handler);
  vi.stubGlobal('fetch', mock);
  return mock;
};

const API_ROW = {
  id: 'att-1',
  subjectType: 'REPAIR_RECORD',
  subjectId: 'rec-1',
  buildingId: 'bld-a',
  purpose: 'SITE_PHOTO',
  fileName: 'anh.png',
  mimeType: 'image/png',
  sizeBytes: 3,
  uploadedBy: 'usr-bql',
  createdAt: '2026-10-24T02:00:00.000Z',
};

describe('file service (api mode)', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should POST multipart fields to /attachments and map the metadata', async () => {
    const mock = mockFetch(() => jsonResponse(201, successBody(API_ROW)));
    const file = new File(['png'], 'anh.png', { type: 'image/png' });

    const uploaded = await uploadAttachment({
      subjectType: 'REPAIR_RECORD',
      subjectId: 'rec-1',
      purpose: 'SITE_PHOTO',
      file,
      fileName: 'anh.png',
    });

    expect(uploaded).toMatchObject({ id: 'att-1', purpose: 'SITE_PHOTO', contentRef: 'att-1', sizeBytes: 3 });
    const [url, init] = mock.mock.calls[0];
    expect(String(url)).toBe('/api/attachments');
    expect(init?.method).toBe('POST');
    expect((init?.headers as Record<string, string>)['Content-Type']).toBeUndefined();
    const body = init?.body as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect(body.get('subjectType')).toBe('REPAIR_RECORD');
    expect(body.get('subjectId')).toBe('rec-1');
    expect(body.get('purpose')).toBe('SITE_PHOTO');
    const sent = body.get('file') as File;
    expect(sent.name).toBe('anh.png');
    expect(sent.type).toBe('image/png');
  });

  it('should GET the stored content as a Blob', async () => {
    const blob = new Blob(['png'], { type: 'image/png' });
    const mock = mockFetch(
      () =>
        ({
          status: 200,
          blob: async () => blob,
          headers: { get: () => 'image/png' },
        }) as unknown as Response,
    );

    await expect(readAttachmentBlob('att-1')).resolves.toEqual({ blob });
    expect(String(mock.mock.calls[0][0])).toBe('/api/attachments/att-1/content');
    expect(mock.mock.calls[0][1]?.method).toBe('GET');
  });
});
