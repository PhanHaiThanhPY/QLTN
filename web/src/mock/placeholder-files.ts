/** Small generated sample files for seed data (no binary assets in the repo). */

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

const crc32 = (bytes: Uint8Array): number => {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
};

const adler32 = (bytes: Uint8Array): number => {
  let a = 1;
  let b = 0;
  for (const byte of bytes) {
    a = (a + byte) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
};

const u32 = (value: number): number[] => [(value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255];

const chunk = (type: string, data: Uint8Array): number[] => {
  const typeBytes = [...type].map((char) => char.charCodeAt(0));
  const body = new Uint8Array([...typeBytes, ...data]);
  return [...u32(data.length), ...body, ...u32(crc32(body))];
};

/** Uncompressed zlib stream made of stored deflate blocks. */
const zlibStored = (raw: Uint8Array): Uint8Array => {
  const out: number[] = [0x78, 0x01];
  const MAX = 65535;
  for (let offset = 0; offset < raw.length; offset += MAX) {
    const block = raw.subarray(offset, offset + MAX);
    const isLast = offset + MAX >= raw.length ? 1 : 0;
    out.push(isLast, block.length & 255, block.length >>> 8, ~block.length & 255, (~block.length >>> 8) & 255, ...block);
  }
  out.push(...u32(adler32(raw)));
  return new Uint8Array(out);
};

const hexToRgb = (hex: string): [number, number, number] => {
  const value = Number.parseInt(hex.replace('#', ''), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
};

/** PNG with a diagonal two-tone pattern so different samples look distinct. */
export const makeSamplePng = (colorA: string, colorB: string, width = 96, height = 64): Blob => {
  const [r1, g1, b1] = hexToRgb(colorA);
  const [r2, g2, b2] = hexToRgb(colorB);
  const raw = new Uint8Array((width * 3 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * (width * 3 + 1);
    raw[row] = 0;
    for (let x = 0; x < width; x += 1) {
      const isA = Math.floor((x + y) / 12) % 2 === 0;
      raw.set(isA ? [r1, g1, b1] : [r2, g2, b2], row + 1 + x * 3);
    }
  }
  const header = new Uint8Array([...u32(width), ...u32(height), 8, 2, 0, 0, 0]);
  const bytes = [
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ...chunk('IHDR', header),
    ...chunk('IDAT', zlibStored(raw)),
    ...chunk('IEND', new Uint8Array()),
  ];
  return new Blob([new Uint8Array(bytes)], { type: 'image/png' });
};

const asciiOnly = (text: string): string =>
  text.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/[^\x20-\x7e]/g, '');

/** Minimal one-page PDF with an ASCII title (sample document, not a legal form). */
export const makeSamplePdf = (title: string): Blob => {
  const text = asciiOnly(title).replace(/[()\\]/g, '');
  const content = `BT /F1 16 Tf 60 760 Td (${text}) Tj 0 -28 Td /F1 11 Tf (Tai lieu mau - demo, khong co gia tri phap ly) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((body, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([pdf], { type: 'application/pdf' });
};
