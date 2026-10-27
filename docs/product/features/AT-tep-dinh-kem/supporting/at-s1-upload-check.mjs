// AT-S1 evidence in a real browser (headless Chrome), api mode, demo accounts: AC-AT.1 report (wide and 375px),
// AC-AT.5 download byte for byte, AC-AT.6 404 outside the scope, AC-AT.7 a 6 000×4 000 photo with EXIF orientation 6,
// AC-AT.11 the viewer with and without `pixelated`.
//
// Prerequisites: api-qltn with demo seed, web dev server with VITE_DATA_SOURCE=api (WEB_URL, default :5190).
// Run from the repository root:
//   SEED_DEMO_PASSWORD="$(grep -E '^SEED_DEMO_PASSWORD=' api-qltn/.env | cut -d= -f2-)" \
//     node docs/product/features/AT-tep-dinh-kem/supporting/at-s1-upload-check.mjs
// Creates one draft record "[TEST AT TỆP] …" in building A and uploads test files to it. Passwords are never printed.
import { createHash } from 'node:crypto';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { signInThroughForm, sleep, startBrowser } from '../../../../tools/cdp-browser.mjs';
import { apiCall } from '../../../../tools/seed-accounts.mjs';
import { expectOk, pdfBytes, pngBytes, signInTokens, uploadApi } from '../../../../tools/repair-flow.mjs';

const WEB = process.env.WEB_URL ?? 'http://localhost:5190';
const PASSWORD = process.env.SEED_DEMO_PASSWORD;
const EVIDENCE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'evidence');
const RUN = new Date().toISOString().replace(/[-:]/g, '').slice(0, 13);
const INVOICE_NAME = 'HD-0012 Hòa Phát.pdf';
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');

if (!PASSWORD) throw new Error('SEED_DEMO_PASSWORD is not set');

/** In-page helpers: build files and hand them to the first upload input, as a picker would. */
const PAGE_HELPERS = `
window.__at = {
  canvasBlob: (canvas, type, quality) => new Promise((resolve) => canvas.toBlob(resolve, type, quality)),
  smallPng: async (label) => {
    const canvas = Object.assign(document.createElement('canvas'), { width: 240, height: 160 });
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#7aa'; ctx.fillRect(0, 0, 240, 160); ctx.fillStyle = '#123'; ctx.font = '28px sans-serif'; ctx.fillText(label, 20, 90);
    return window.__at.canvasBlob(canvas, 'image/png');
  },
  /** Photo-like landscape pixels with a red block at the stored top-left corner. */
  photo: async (width, height, quality) => {
    const canvas = Object.assign(document.createElement('canvas'), { width, height });
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#d9c7a3'); gradient.addColorStop(1, '#5b6f7e');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, width, height);
    for (let i = 0; i < 9000; i += 1) {
      ctx.strokeStyle = 'rgba(40,40,40,' + (0.1 + Math.random() * 0.4) + ')';
      ctx.lineWidth = 1 + Math.random() * 2;
      ctx.beginPath(); const x = Math.random() * width; const y = Math.random() * height;
      ctx.moveTo(x, y); ctx.lineTo(x + (Math.random() - 0.5) * 300, y + (Math.random() - 0.5) * 300); ctx.stroke();
    }
    const noise = ctx.getImageData(0, 0, width, height);
    for (let i = 0; i < noise.data.length; i += 4) { const n = (Math.random() - 0.5) * 36; noise.data[i] += n; noise.data[i + 1] += n; noise.data[i + 2] += n; }
    ctx.putImageData(noise, 0, 0);
    ctx.fillStyle = '#e00000'; ctx.fillRect(0, 0, Math.round(width / 10), Math.round(height / 10));
    return window.__at.canvasBlob(canvas, 'image/jpeg', quality);
  },
  /** Inserts an EXIF APP1 segment with Orientation = value right after SOI. */
  withOrientation: async (blob, value) => {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const app1 = new Uint8Array([0xff, 0xe1, 0x00, 0x22, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00, 0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08,
      0x00, 0x01, 0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, value, 0x00, 0x00, 0x00, 0x00]);
    return new Blob([bytes.slice(0, 2), app1, bytes.slice(2)], { type: 'image/jpeg' });
  },
  fromBase64: (base64, type) => new Blob([Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))], { type }),
  select: (files) => {
    const input = document.querySelector('input[type="file"]');
    const transfer = new DataTransfer();
    files.forEach((file) => transfer.items.add(file));
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return files.length;
  },
};
true`;

// Own DevTools port (CDP_PORT): the shared default 9333 attaches to another seat's headless Chrome when one is running.
const browser = await startBrowser({ evidenceDir: EVIDENCE, port: Number(process.env.CDP_PORT ?? 9344) });
const downloads = mkdtempSync(path.join(tmpdir(), 'qltn-at-download-'));
try {
  const tokens = await signInTokens(WEB, PASSWORD, ['admin-demo', 'bql-a', 'bql-b']);
  const bql = tokens['bql-a'];
  const buildingA = expectOk(await apiCall(WEB, 'GET', '/buildings', { token: tokens['admin-demo'] }), 'buildings').find((row) => row.code === 'A');
  const location = expectOk(await apiCall(WEB, 'GET', '/reference', { token: bql }), 'reference').locations.find((row) => row.buildingId === buildingA.id);
  const record = expectOk(
    await apiCall(WEB, 'POST', '/records', {
      token: bql,
      body: { buildingId: buildingA.id, locationId: location.id, title: `[TEST AT TỆP] Ảnh hiện trường ${RUN}`, description: 'Kiểm tải nhiều tệp, tải xuống và nén ảnh.', noMaintenanceItem: true },
    }),
    'create draft',
  );
  console.log(`record ${record.code}`);

  // AC-AT.6: a file of building A is 404 for bql-b (scope B only).
  const scoped = await uploadApi(WEB, bql, record.id, 'SITE_PHOTO', 'pham-vi.png', 'image/png', pngBytes());
  const outside = await fetch(`${WEB}/api/attachments/${scoped}/content`, { headers: { Authorization: `Bearer ${tokens['bql-b']}` } });
  console.log(`AC-AT.6 bql-b content of a building A file: ${outside.status}`);
  if (outside.status !== 404) throw new Error('expected 404 outside the scope');

  await signInThroughForm(browser, WEB, 'bql-a', PASSWORD);
  const openForm = async () => {
    await browser.navigate(`${WEB}/records/${record.id}/edit`);
    await browser.waitFor(`document.querySelector('input[type="file"]') && document.body.innerText.includes('Ảnh lớn sẽ được tự thu nhỏ')`, 'upload field', 30000);
    await browser.evaluate(PAGE_HELPERS);
  };
  const reportText = `document.querySelector('[role="status"]')?.innerText ?? ''`;
  await openForm();

  // AC-AT.1: 5 files, the 2nd a text file renamed .png.
  await browser.evaluate(`(async () => window.__at.select([
    new File([await window.__at.smallPng('1')], 'anh-1.png', { type: 'image/png' }),
    new File(['day khong phai anh'], 'bao-gia.png', { type: 'image/png' }),
    new File([await window.__at.smallPng('3')], 'anh-3.png', { type: 'image/png' }),
    new File([await window.__at.smallPng('4')], 'anh-4.png', { type: 'image/png' }),
    new File([await window.__at.smallPng('5')], 'anh-5.png', { type: 'image/png' }),
  ]))()`);
  await browser.waitFor(`${reportText}.includes('Đã tải 4/5 tệp')`, 'report 4/5', 60000);
  console.log(`AC-AT.1 report: ${JSON.stringify(await browser.evaluate(reportText))}`);
  await browser.evaluate(`document.querySelector('[role="status"]').scrollIntoView({ block: 'center' }), true`);
  await sleep(300);
  await browser.screenshot('AT-1-report-wide');
  await browser.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 2, mobile: true });
  await browser.evaluate(`document.querySelector('[role="status"]').scrollIntoView({ block: 'center' }), true`);
  await sleep(400);
  const overflow = await browser.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth');
  console.log(`375px horizontal overflow ${overflow}px`);
  await browser.screenshot('AT-2-report-375');
  await browser.send('Emulation.clearDeviceMetricsOverride');

  // AC-AT.5: the invoice PDF and a PNG downloaded from the viewer are the uploaded bytes, under the original name.
  const invoice = pdfBytes(`hoa don ${RUN}`);
  const png = readFileSync(path.join(EVIDENCE, 'AT-1-report-wide.png'));
  await browser.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads });
  await openForm();
  await browser.evaluate(`window.__at.select([
    new File([window.__at.fromBase64('${invoice.toString('base64')}', 'application/pdf')], '${INVOICE_NAME}', { type: 'application/pdf' }),
    new File([window.__at.fromBase64('${png.toString('base64')}', 'image/png')], 'man-hinh.png', { type: 'image/png' }),
  ])`);
  // Located by a plain-ASCII prefix: the stored name is what the server kept, which the check below compares.
  for (const [name, prefix, bytes] of [[INVOICE_NAME, 'HD-0012', invoice], ['man-hinh.png', 'man-hinh', png]]) {
    const listed = `[...document.querySelectorAll('li button')].find((b) => b.textContent.startsWith(${JSON.stringify(prefix)}))`;
    await browser.waitFor(listed, `${name} listed`, 60000);
    await browser.realClick(listed, `open ${name}`);
    await browser.waitFor(`document.querySelector('[role="dialog"] button[aria-label^="Tải xuống"]:not([disabled])')`, `${name} download ready`, 30000);
    const before = new Set(readdirSync(downloads));
    await browser.realClick(`document.querySelector('[role="dialog"] button[aria-label^="Tải xuống"]')`, `download ${name}`);
    let saved;
    for (let wait = 0; wait < 40 && !saved; wait += 1) {
      await sleep(250);
      saved = readdirSync(downloads).find((file) => !before.has(file) && !file.endsWith('.crdownload'));
    }
    if (!saved) throw new Error(`${name} was not downloaded`);
    const same = sha(readFileSync(path.join(downloads, saved))) === sha(bytes);
    console.log(`AC-AT.5 ${name}: saved as ${JSON.stringify(saved)} (${saved === name ? 'original name' : 'NAME DIFFERS'}), ${same ? 'same bytes' : 'DIFFERENT bytes'}`);
    if (!same) throw new Error(`${name} differs from the upload`);
    if (name === 'man-hinh.png') await browser.screenshot('AT-6-viewer-download');
    await browser.clickButton('Đóng', `document.querySelector('[role="dialog"]')`);
    await sleep(300);
  }

  // AC-AT.7: 6 000×4 000 stored pixels, EXIF orientation 6 (portrait), over 10 MB.
  // Built after the navigation: a page load drops `window.__atBig`.
  await openForm();
  const original = await browser.evaluate(`(async () => {
    let quality = 0.95; let blob = await window.__at.photo(6000, 4000, quality);
    while (blob.size <= 10.5 * 1024 * 1024 && quality < 1) { quality = Math.min(1, quality + 0.02); blob = await window.__at.photo(6000, 4000, quality); }
    window.__atBig = await window.__at.withOrientation(blob, 6);
    return { bytes: window.__atBig.size, quality };
  })()`);
  console.log(`AC-AT.7 original: 6000×4000 stored, orientation 6, ${(original.bytes / 1048576).toFixed(1)} MB (q ${original.quality})`);
  if (original.bytes <= 10 * 1048576) throw new Error('test photo is not over 10 MB');
  await browser.evaluate(`window.__at.select([new File([window.__atBig], 'IMG_DOC_6.jpeg', { type: 'image/jpeg' })])`);
  await browser.waitFor(`[...document.querySelectorAll('button')].some((b) => b.textContent.includes('IMG_DOC_6.jpg'))`, 'compressed photo listed', 120000);
  await browser.realClick(`[...document.querySelectorAll('button')].find((b) => b.textContent.includes('IMG_DOC_6.jpg'))`, 'open compressed photo');
  await browser.waitFor(`document.querySelector('[role="dialog"] img')?.complete && document.querySelector('[role="dialog"] img').naturalWidth > 0`, 'photo shown', 30000);
  const stored = await browser.evaluate(`(async () => {
    const img = document.querySelector('[role="dialog"] img');
    const blob = await (await fetch(img.src)).blob();
    const bitmap = await createImageBitmap(blob, { imageOrientation: 'none' });
    const canvas = Object.assign(document.createElement('canvas'), { width: bitmap.width, height: bitmap.height });
    const ctx = canvas.getContext('2d'); ctx.drawImage(bitmap, 0, 0);
    const [r, g, b] = ctx.getImageData(bitmap.width - 20, 20, 1, 1).data;
    return { width: bitmap.width, height: bitmap.height, bytes: blob.size, type: blob.type, topRight: [r, g, b] };
  })()`);
  console.log(`AC-AT.7 stored: ${JSON.stringify(stored)}`);
  if (stored.width !== 2667 || stored.height !== 4000 || stored.bytes > 10 * 1048576) throw new Error('compressed photo has the wrong size');
  // Orientation 6 turns the stored top-left corner to the top-right: red there means the photo stands upright.
  if (!(stored.topRight[0] > 180 && stored.topRight[1] < 80)) throw new Error('photo is not upright');
  await sleep(300);
  await browser.screenshot('AT-3-viewer-portrait');
  await browser.clickButton('Đóng', `document.querySelector('[role="dialog"]')`);

  // AC-AT.11: a 4 000×3 000 photo (no compression), viewer as shipped vs. with the old `pixelated` rule.
  await browser.evaluate(`(async () => window.__at.select([new File([await window.__at.photo(4000, 3000, 0.8)], 'anh-4000x3000.jpg', { type: 'image/jpeg' })]))()`);
  await browser.waitFor(`[...document.querySelectorAll('button')].some((b) => b.textContent.includes('anh-4000x3000.jpg'))`, '4000×3000 listed', 60000);
  await browser.realClick(`[...document.querySelectorAll('button')].find((b) => b.textContent.includes('anh-4000x3000.jpg'))`, 'open 4000×3000');
  await browser.waitFor(`document.querySelector('[role="dialog"] img')?.complete && document.querySelector('[role="dialog"] img').naturalWidth === 4000`, '4000×3000 shown uncompressed', 30000);
  await sleep(400);
  await browser.screenshot('AT-4-viewer-smooth-after');
  await browser.evaluate(`document.querySelector('[role="dialog"] img').style.imageRendering = 'pixelated', true`);
  await sleep(300);
  await browser.screenshot('AT-5-viewer-pixelated-before');
  console.log('AT-S1 upload flow: PASS');
} catch (error) {
  await browser.screenshot('AT-failed').catch(() => undefined);
  console.error(await browser.evaluate('location.pathname + "\\n" + (document.querySelector(\'[role="status"]\')?.innerText ?? "no report") + "\\n" + [...document.querySelectorAll("li button")].map((b) => b.textContent).join(" | ")').catch(() => ''));
  throw error;
} finally {
  await browser.close();
  rmSync(downloads, { recursive: true, force: true });
}
