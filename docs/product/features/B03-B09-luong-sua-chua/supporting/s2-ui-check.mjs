// AC-0.3 evidence for slice S2 (SPEC v2): the proposal is prepared and approved in the real web UI in api mode.
//
// Prerequisites: api-qltn on :5300 with demo seed, web dev server on :5190 started with VITE_DATA_SOURCE=api.
// Run from the repository root:
//   SEED_DEMO_PASSWORD="$(grep -E '^SEED_DEMO_PASSWORD=' api-qltn/.env | cut -d= -f2-)" \
//     node docs/product/features/B03-B09-luong-sua-chua/supporting/s2-ui-check.mjs
// Setup through the API: building A on AQUA, bql-a creates and submits a record, tvkt confirms it (S1/RM-S2 flows,
// already evidenced). In the UI: bql-a fills the D5-TT proposal with 3 items × 3 contractors, files and a signature
// and submits; tvkt approves; bqt approves with board minutes and a signature, choosing contractor 2 with a reason.
// Building A goes back to STANDARD at the end, even on failure. Passwords are never printed.
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import { signInThroughForm, sleep, startBrowser } from '../../../../tools/cdp-browser.mjs';
import { apiCall, loginWithRetry } from '../../../../tools/seed-accounts.mjs';

const WEB = process.env.WEB_URL ?? 'http://localhost:5190';
const PASSWORD = process.env.SEED_DEMO_PASSWORD;
const EVIDENCE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'evidence');
const RUN = new Date().toISOString().replace(/[-:]/g, '').slice(0, 13);
const TITLE = `[TEST S2 UI] Rò ống cấp hành lang ${RUN}`;
const ITEMS = [
  { name: 'Ống cấp PPR D25', unit: 'm', quantity: '1.5' },
  { name: 'Van khóa D25', unit: 'cái', quantity: '2' },
  { name: 'Keo dán ống', unit: 'tuýp', quantity: '0.125' },
];
const CONTRACTORS = [
  { name: 'Công ty Thủy Tín', prices: ['333333', '1250000', '80000'], other: '100000', tax: '300000' },
  { name: 'Công ty Nam Phát', prices: ['300000', '1200000', '80000'], other: '0', tax: '286000' },
  { name: 'Công ty Minh Long', prices: ['400000', '1000000', '99999'], other: '50000', tax: '261250' },
];
const SELECTION_REASON = 'Nam Phát bảo hành 24 tháng và thi công ngay trong tuần.';

if (!PASSWORD) throw new Error('SEED_DEMO_PASSWORD is not set');

const workDir = mkdtempSync(path.join(tmpdir(), 's2-ui-'));

/** 16x16 PNG built in memory (passes the API magic-byte check). */
const pngBytes = () => {
  const table = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const byte of buf) c = table[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, sum]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(16, 0);
  header.writeUInt32BE(16, 4);
  header.set([8, 2, 0, 0, 0], 8);
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(48, 0x5a)]);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.concat(Array.from({ length: 16 }, () => row)))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
};

/** Small PDF file on disk for the file inputs. */
const pdfFile = (name) => {
  const file = path.join(workDir, `${name}.pdf`);
  writeFileSync(file, `%PDF-1.4\n% ${name} ${RUN}\n%%EOF\n`);
  return file;
};

const applyTemplate = async (token, buildingId, templateKey) => {
  const config = await apiCall(WEB, 'GET', `/buildings/${buildingId}/config`, { token });
  return apiCall(WEB, 'POST', `/buildings/${buildingId}/config/apply-template`, {
    token,
    body: { templateKey, version: config.body.data.version },
  });
};

/** Building A on AQUA and a record of bql-a confirmed by tvkt (PENDING_PROPOSAL); returns its id. */
const prepareRecord = async () => {
  const admin = await loginWithRetry(WEB, 'admin-demo', PASSWORD);
  const adminToken = admin.body.data.accessToken;
  const buildings = await apiCall(WEB, 'GET', '/buildings', { token: adminToken });
  const buildingA = buildings.body.data.find((row) => row.code === 'A');
  const applied = await applyTemplate(adminToken, buildingA.id, 'AQUA');
  if (applied.status !== 201) throw new Error(`apply AQUA answered ${applied.status}`);

  const bql = (await loginWithRetry(WEB, 'bql-a', PASSWORD)).body.data.accessToken;
  const reference = await apiCall(WEB, 'GET', '/reference', { token: bql });
  const location = reference.body.data.locations.find((row) => row.buildingId === buildingA.id);
  const created = await apiCall(WEB, 'POST', '/records', {
    token: bql,
    body: {
      buildingId: buildingA.id,
      locationId: location.id,
      title: TITLE,
      description: 'Ống cấp nước trên trần hành lang tầng 3 bị rò, nước nhỏ giọt liên tục.',
      noMaintenanceItem: true,
    },
  });
  const record = created.body.data;
  const form = new FormData();
  form.set('subjectType', 'REPAIR_RECORD');
  form.set('subjectId', record.id);
  form.set('purpose', 'SITE_PHOTO');
  form.set('file', new Blob([pngBytes()], { type: 'image/png' }), 'hien-truong.png');
  const photo = await (
    await fetch(`${WEB}/api/attachments`, { method: 'POST', headers: { Authorization: `Bearer ${bql}` }, body: form })
  ).json();
  const submitted = await apiCall(WEB, 'POST', `/records/${record.id}/submit`, {
    token: bql,
    body: { version: record.version, attachmentIds: [photo.data.id] },
  });
  if (submitted.status !== 200) throw new Error(`submit record answered ${submitted.status}`);

  const tvkt = (await loginWithRetry(WEB, 'tvkt', PASSWORD)).body.data.accessToken;
  const confirmed = await apiCall(WEB, 'POST', `/records/${record.id}/confirm-repair`, {
    token: tvkt,
    body: { version: submitted.body.data.version, note: 'Đúng hiện trạng, cần thay đoạn ống.' },
  });
  if (confirmed.body.data?.status !== 'PENDING_PROPOSAL') throw new Error(`confirm answered ${confirmed.status}`);
  console.log(`record ${record.code} waiting for the proposal`);
  return { recordId: record.id, adminToken, buildingId: buildingA.id };
};

const browser = await startBrowser({ evidenceDir: EVIDENCE });

/** Picks an option of a Radix select (the screens' NativeSelect) by its visible text. */
const pickOption = async (triggerSelector, text) => {
  await browser.realClick(`document.querySelector(${JSON.stringify(triggerSelector)})`, triggerSelector);
  await browser.waitFor(`[...document.querySelectorAll('[role=option]')].some((o) => o.textContent.includes(${JSON.stringify(text)}))`, `option ${text}`);
  await browser.realClick(`[...document.querySelectorAll('[role=option]')].find((o) => o.textContent.includes(${JSON.stringify(text)}))`, `option ${text}`);
  await browser.waitFor(`document.querySelector(${JSON.stringify(triggerSelector)}).textContent.includes(${JSON.stringify(text)})`, `${text} chosen`);
};

const byLabel = (label) => `[aria-label=${JSON.stringify(label)}]`;

/** Draws a stroke across the signature canvas with real pointer events. */
const sign = async (label) => {
  const box = await browser.evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(`canvas${byLabel(label)}`)});
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  })()`);
  const point = (t) => ({ x: box.x + box.w * (0.15 + 0.7 * t), y: box.y + box.h * (0.5 + 0.25 * Math.sin(t * 6)) });
  const start = point(0);
  await browser.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...start });
  await browser.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...start, button: 'left', clickCount: 1 });
  for (let step = 1; step <= 20; step += 1) {
    await browser.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point(step / 20), button: 'left', buttons: 1 });
  }
  await browser.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point(1), button: 'left', clickCount: 1 });
};

/** Sets files on the n-th `input[type=file]` inside `scopeSelector` and waits until the upload is listed. */
const uploadInto = async (scopeSelector, index, file) => {
  const { root } = await browser.send('DOM.getDocument', { depth: -1 });
  const { nodeIds } = await browser.send('DOM.querySelectorAll', { nodeId: root.nodeId, selector: `${scopeSelector} input[type=file]` });
  if (!nodeIds[index]) throw new Error(`missing file input ${index} in ${scopeSelector}`);
  await browser.send('DOM.setFileInputFiles', { nodeId: nodeIds[index], files: [file] });
  await browser.waitFor(`document.body.innerText.includes(${JSON.stringify(path.basename(file))})`, `upload ${path.basename(file)}`, 30000);
};

let setup;
try {
  setup = await prepareRecord();
  const recordUrl = `${WEB}/records/${setup.recordId}?tab=approval`;

  // 1. bql-a prepares the proposal (D5-TT) and submits it with a signature.
  await signInThroughForm(browser, WEB, 'bql-a', PASSWORD);
  await browser.navigate(recordUrl);
  await browser.waitFor(`document.querySelector('#quote-request')`, 'proposal editor', 60000);
  await pickOption('#quote-type', 'Sửa chữa');
  await pickOption('#quote-budget', 'Kinh phí bảo trì');
  await browser.setField('#quote-request', 'Xin phê duyệt thay đoạn ống cấp nước bị rò trên trần hành lang tầng 3.');
  await browser.setField('#quote-assessment', 'Ống cũ đã mục, vá không bền; đề xuất thay mới cả đoạn và van khóa.');
  await browser.clickButton('Thêm hạng mục');
  await browser.clickButton('Thêm hạng mục');
  for (const [index, item] of ITEMS.entries()) {
    await browser.setField(byLabel(`Tên hạng mục ${index + 1}`), item.name);
    await browser.setField(byLabel(`Đơn vị hạng mục ${index + 1}`), item.unit);
    await browser.setField(byLabel(`Số lượng hạng mục ${index + 1}`), item.quantity);
  }
  for (const [index, contractor] of CONTRACTORS.entries()) {
    const n = index + 1;
    await browser.setField(byLabel(`Tên nhà thầu ${n}`), contractor.name);
    for (const [line, price] of contractor.prices.entries()) {
      await browser.setField(byLabel(`Đơn giá hạng mục ${line + 1} – nhà thầu ${n}`), price);
    }
    await browser.setField(byLabel(`Chi phí khác – nhà thầu ${n}`), contractor.other);
    await browser.setField(byLabel(`Thuế – nhà thầu ${n}`), contractor.tax);
  }
  // File inputs in page order: quotation of contractors 1–3, then the incident minutes.
  for (const index of [0, 1, 2]) await uploadInto('main', index, pdfFile(`bao-gia-nha-thau-${index + 1}`));
  await uploadInto('main', 3, pdfFile('bien-ban-ghi-nhan'));
  await sign('Chữ ký người trình tờ trình');
  await browser.waitFor(`document.body.innerText.includes('3.410.000')`, 'previewed total of contractor 1');
  await browser.screenshot('S2-1-bql-proposal-form');
  await browser.clickButton('Trình duyệt (lần 1)');
  await browser.waitFor(`document.body.innerText.includes('Chờ tvkt thẩm định')`, 'waiting on TVKT', 30000);
  await browser.screenshot('S2-2-bql-submitted-waiting-tvkt');
  console.log('BQL submitted attempt 1');

  // 2. tvkt approves the first step.
  await signInThroughForm(browser, WEB, 'tvkt', PASSWORD);
  await browser.navigate(recordUrl);
  await browser.waitFor(`[...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Duyệt' && !b.disabled)`, 'TVKT approve button', 60000);
  await browser.clickButton('Duyệt');
  await browser.waitFor(`document.querySelector('[role=dialog]')`, 'approve dialog');
  await browser.clickButton('Duyệt tờ trình', `document.querySelector('[role=dialog]')`);
  await browser.waitFor(`document.body.innerText.includes('Chờ bqt duyệt')`, 'waiting on BQT', 30000);
  await browser.screenshot('S2-3-tvkt-approved-waiting-bqt');
  console.log('TVKT approved');

  // 3. bqt approves with minutes and signature, choosing contractor 2 with a reason.
  await signInThroughForm(browser, WEB, 'bqt', PASSWORD);
  await browser.navigate(recordUrl);
  await browser.waitFor(`[...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Duyệt' && !b.disabled)`, 'BQT approve button', 60000);
  await browser.clickButton('Duyệt');
  await browser.waitFor(`document.querySelector('#decision-contractor')`, 'BQT approve dialog');
  await pickOption('#decision-contractor', 'Nam Phát');
  await browser.waitFor(`document.querySelector('#decision-reason')`, 'selection reason');
  await browser.setField('#decision-reason', SELECTION_REASON);
  await uploadInto('[role=dialog]', 0, pdfFile('bien-ban-hop-bqt'));
  await sign('Chữ ký người giữ bước BQT');
  await sleep(300);
  await browser.screenshot('S2-4-bqt-approve-dialog');
  await browser.clickButton('Duyệt tờ trình', `document.querySelector('[role=dialog]')`);
  await browser.waitFor(`document.body.innerText.includes('Kết quả phê duyệt') && document.body.innerText.includes('3.146.000')`, 'approved result', 30000);
  await browser.screenshot('S2-5-bqt-approved-contractor-2');
  console.log('AC-0.3 S2 UI flow: PASS');
} catch (error) {
  await browser.screenshot('S2-failed').catch(() => undefined);
  console.error(await browser.evaluate('location.pathname + "\\n" + document.body.innerText.slice(0, 800)').catch(() => ''));
  throw error;
} finally {
  await browser.close();
  if (setup) {
    const restored = await applyTemplate(setup.adminToken, setup.buildingId, 'STANDARD');
    console.log(`building A back on STANDARD: ${restored.status}`);
  }
}
