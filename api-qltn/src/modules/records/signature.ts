/** v1 BR-04 / v2 BR-C-03: a quick hand-drawn signature, PNG data URL only, 1 byte to 200 KB once decoded. */
const PREFIX = 'data:image/png;base64,';
const MAX_BYTES = 200 * 1024;
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

export type SignatureCheck = { ok: true; content: Buffer } | { ok: false; message: string };

/** Decoded PNG bytes, or the field message to show (missing, SVG or another type, too large, not a real PNG). */
export const checkSignature = (value: unknown): SignatureCheck => {
  const text = typeof value === 'string' ? value : '';
  if (!text) return { ok: false, message: 'Cần chữ ký.' };
  const payload = text.startsWith(PREFIX) ? text.slice(PREFIX.length) : '';
  if (!payload || !BASE64.test(payload)) return { ok: false, message: 'Chữ ký phải là ảnh PNG.' };
  const content = Buffer.from(payload, 'base64');
  if (content.length === 0 || content.length > MAX_BYTES) {
    return { ok: false, message: 'Chữ ký phải từ 1 byte đến 200 KB.' };
  }
  if (!PNG_MAGIC.every((byte, index) => content[index] === byte))
    return { ok: false, message: 'Chữ ký phải là ảnh PNG.' };
  return { ok: true, content };
};

export const signatureDataUrl = (content: Buffer): string => `${PREFIX}${content.toString('base64')}`;
