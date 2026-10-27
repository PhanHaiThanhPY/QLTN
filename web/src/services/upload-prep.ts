import { LIMITS } from '@/domain/constants';

/** SPEC AT-S1 D-AT-1: longest edge kept after compression, and the JPEG quality used. */
export const MAX_IMAGE_EDGE = 4000;
export const JPEG_QUALITY = 0.85;

export const HEIC_REASON =
  'Ảnh HEIC chưa được hỗ trợ. Trên iPhone, vào Cài đặt › Camera › Định dạng, chọn «Tương thích nhất», hoặc chụp màn hình ảnh rồi tải lại.';
export const STILL_TOO_LARGE_REASON = 'Ảnh vẫn vượt quá 10 MB sau khi nén.';

/** Raster types the browser can redraw; PDF and anything else go up untouched (BR-AT-04). */
const COMPRESSIBLE_TYPES: readonly string[] = ['image/jpeg', 'image/png', 'image/webp'];
const HEIC_TYPES: readonly string[] = ['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence'];

/** A decoded image, already turned upright from its EXIF orientation. */
export interface DecodedImage {
  width: number;
  height: number;
  source: CanvasImageSource;
  close: () => void;
}

/** Browser image functions, injectable so the rules are testable without a real decoder. */
export interface ImageCodec {
  decode: (file: File) => Promise<DecodedImage>;
  encodeJpeg: (image: DecodedImage, width: number, height: number, quality: number) => Promise<Blob>;
}

export type PreparedUpload = { ok: true; file: File; compressed: boolean } | { ok: false; reason: string };

const canvasToBlob = (canvas: HTMLCanvasElement, quality: number): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Canvas could not encode JPEG'))), 'image/jpeg', quality);
  });

/**
 * `createImageBitmap` with `imageOrientation: 'from-image'` applies EXIF orientation while decoding, so the redrawn
 * JPEG (which carries no EXIF) stands the same way the photo was taken (BR-AT-04, AC-AT.7).
 */
export const browserImageCodec: ImageCodec = {
  decode: async (file) => {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    return { width: bitmap.width, height: bitmap.height, source: bitmap, close: () => bitmap.close() };
  },
  encodeJpeg: async (image, width, height, quality) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D context unavailable');
    context.imageSmoothingQuality = 'high';
    context.drawImage(image.source, 0, 0, width, height);
    return canvasToBlob(canvas, quality);
  },
};

const extensionOf = (name: string): string => name.slice(name.lastIndexOf('.') + 1).toLowerCase();

/** BR-AT-05: by declared type or by the `.heic`/`.heif` extension (some pickers send an empty type). */
export const isHeic = (file: File): boolean =>
  HEIC_TYPES.includes(file.type.toLowerCase()) || ['heic', 'heif'].includes(extensionOf(file.name));

/** "IMG_2041.PNG" → "IMG_2041.jpg"; a name without a dot just gains the extension. */
export const jpegName = (name: string): string => {
  const dot = name.lastIndexOf('.');
  return `${dot > 0 ? name.slice(0, dot) : name}.jpg`;
};

/** Size that keeps the aspect ratio with the longest edge at most `MAX_IMAGE_EDGE`. */
export const fitWithin = (width: number, height: number): { width: number; height: number } => {
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
};

/**
 * SPEC AT-S1 BR-AT-04/05: HEIC is refused before any request; a JPEG/PNG/WebP over 10 MB or wider than 4 000 px is
 * redrawn as a JPEG of at most 4 000 px; anything else (smaller images, PDF, other types) is sent as chosen, so the
 * server keeps judging type and content as before.
 */
export const prepareUpload = async (file: File, codec: ImageCodec = browserImageCodec): Promise<PreparedUpload> => {
  if (isHeic(file)) return { ok: false, reason: HEIC_REASON };
  if (!COMPRESSIBLE_TYPES.includes(file.type) || file.size === 0) return { ok: true, file, compressed: false };
  let image: DecodedImage;
  try {
    image = await codec.decode(file);
  } catch (error) {
    // Not a decodable image (e.g. a renamed text file): let the upload report the server's or demo's reason.
    console.error('Image decode failed, uploading as chosen:', error);
    return { ok: true, file, compressed: false };
  }
  try {
    const isLarge = file.size > LIMITS.MAX_FILE_BYTES || Math.max(image.width, image.height) > MAX_IMAGE_EDGE;
    if (!isLarge) return { ok: true, file, compressed: false };
    const size = fitWithin(image.width, image.height);
    const blob = await codec.encodeJpeg(image, size.width, size.height, JPEG_QUALITY);
    if (blob.size > LIMITS.MAX_FILE_BYTES) return { ok: false, reason: STILL_TOO_LARGE_REASON };
    return { ok: true, file: new File([blob], jpegName(file.name), { type: 'image/jpeg', lastModified: file.lastModified }), compressed: true };
  } finally {
    image.close();
  }
};
