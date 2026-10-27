import { LIMITS } from '@/domain/constants';
import { browserImageCodec, fitWithin, HEIC_REASON, jpegName, prepareUpload, STILL_TOO_LARGE_REASON } from './upload-prep';
import type { DecodedImage, ImageCodec } from './upload-prep';

const MB = 1024 * 1024;

/** A file whose reported size is `size` without allocating it. */
const fileOf = (name: string, type: string, size: number): File => {
  const file = new File([new Uint8Array(8)], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
};

/** Codec that "decodes" to the given upright size and "encodes" a blob of `encodedBytes`. */
const fakeCodec = (width: number, height: number, encodedBytes = 2 * MB) => {
  const close = vi.fn();
  const codec: ImageCodec = {
    decode: vi.fn(async (): Promise<DecodedImage> => ({ width, height, source: {} as CanvasImageSource, close })),
    encodeJpeg: vi.fn(async () => new Blob([new Uint8Array(encodedBytes)], { type: 'image/jpeg' })),
  };
  return { codec, close };
};

describe('prepareUpload (AT-S1 BR-AT-04, BR-AT-05)', () => {
  it('refuses HEIC by type or extension before decoding anything (AC-AT.9)', async () => {
    const { codec } = fakeCodec(4000, 3000);
    for (const file of [fileOf('IMG_0001.HEIC', '', MB), fileOf('a.jpg', 'image/heic', MB), fileOf('b.heif', 'image/heif', MB)]) {
      expect(await prepareUpload(file, codec)).toEqual({ ok: false, reason: HEIC_REASON });
    }
    expect(codec.decode).not.toHaveBeenCalled();
  });

  it('keeps a small photo as chosen, the same bytes (AC-AT.8)', async () => {
    const { codec, close } = fakeCodec(3000, 2000);
    const file = fileOf('IMG_1.jpg', 'image/jpeg', 3 * MB);
    expect(await prepareUpload(file, codec)).toEqual({ ok: true, file, compressed: false });
    expect(codec.encodeJpeg).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalled();
  });

  it('never compresses a PDF, even a large one', async () => {
    const { codec } = fakeCodec(6000, 4000);
    const file = fileOf('HD-0012.pdf', 'application/pdf', 14 * MB);
    expect(await prepareUpload(file, codec)).toEqual({ ok: true, file, compressed: false });
    expect(codec.decode).not.toHaveBeenCalled();
  });

  it('shrinks a 14 MB photo to a 4 000 px JPEG named .jpg at quality 0.85 (AC-AT.7)', async () => {
    const { codec } = fakeCodec(6000, 4000);
    const result = await prepareUpload(fileOf('IMG_2041.jpeg', 'image/jpeg', 14 * MB), codec);
    expect(codec.encodeJpeg).toHaveBeenCalledWith(expect.anything(), 4000, 2667, 0.85);
    expect(result).toMatchObject({ ok: true, compressed: true });
    if (!result.ok) throw new Error('expected a prepared file');
    expect(result.file.name).toBe('IMG_2041.jpg');
    expect(result.file.type).toBe('image/jpeg');
    expect(result.file.size).toBeLessThanOrEqual(LIMITS.MAX_FILE_BYTES);
  });

  it('keeps a portrait photo upright: the decoded (oriented) size decides the output size', async () => {
    // EXIF orientation 6: 6000×4000 pixels stored, 4000×6000 once turned upright by the decoder.
    const { codec } = fakeCodec(4000, 6000);
    await prepareUpload(fileOf('IMG_dọc.jpg', 'image/jpeg', 14 * MB), codec);
    expect(codec.encodeJpeg).toHaveBeenCalledWith(expect.anything(), 2667, 4000, 0.85);
  });

  it('shrinks a light photo wider than 4 000 px, and a PNG becomes a JPEG', async () => {
    const { codec } = fakeCodec(5000, 1000);
    const result = await prepareUpload(fileOf('panorama.png', 'image/png', 5 * MB), codec);
    expect(codec.encodeJpeg).toHaveBeenCalledWith(expect.anything(), 4000, 800, 0.85);
    expect(result.ok && result.file.name).toBe('panorama.jpg');
  });

  it('refuses a photo still over 10 MB after compression', async () => {
    const { codec } = fakeCodec(6000, 4000, LIMITS.MAX_FILE_BYTES + 1);
    expect(await prepareUpload(fileOf('huge.webp', 'image/webp', 30 * MB), codec)).toEqual({ ok: false, reason: STILL_TOO_LARGE_REASON });
  });

  it('sends an undecodable "image" as chosen so the server or demo names the problem', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const codec: ImageCodec = { decode: vi.fn(async () => Promise.reject(new Error('bad image'))), encodeJpeg: vi.fn() };
    const file = fileOf('note.png', 'image/png', 20);
    expect(await prepareUpload(file, codec)).toEqual({ ok: true, file, compressed: false });
    vi.restoreAllMocks();
  });

  it('decodes with the EXIF orientation applied', async () => {
    const bitmap = { width: 10, height: 20, close: vi.fn() };
    const createImageBitmap = vi.fn(async () => bitmap);
    vi.stubGlobal('createImageBitmap', createImageBitmap);
    const file = fileOf('a.jpg', 'image/jpeg', 10);
    const decoded = await browserImageCodec.decode(file);
    expect(createImageBitmap).toHaveBeenCalledWith(file, { imageOrientation: 'from-image' });
    expect(decoded).toMatchObject({ width: 10, height: 20 });
    vi.unstubAllGlobals();
  });
});

describe('upload-prep helpers', () => {
  it('renames to .jpg and fits within 4 000 px', () => {
    expect(jpegName('IMG_2041.PNG')).toBe('IMG_2041.jpg');
    expect(jpegName('anh.chup.webp')).toBe('anh.chup.jpg');
    expect(jpegName('noext')).toBe('noext.jpg');
    expect(fitWithin(3000, 2000)).toEqual({ width: 3000, height: 2000 });
    expect(fitWithin(8000, 6000)).toEqual({ width: 4000, height: 3000 });
  });
});
