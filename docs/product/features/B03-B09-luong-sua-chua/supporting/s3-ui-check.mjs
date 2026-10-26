// AC-0.3 evidence for slice S3 (SPEC v2): construction and the three-party acceptance minutes in the web UI (api mode).
//
// Prerequisites: api-qltn on :5300 with demo seed, web dev server started with VITE_DATA_SOURCE=api (WEB_URL,
// default :5190). Run from the repository root:
//   SEED_DEMO_PASSWORD="$(grep -E '^SEED_DEMO_PASSWORD=' api-qltn/.env | cut -d= -f2-)" \
//     node docs/product/features/B03-B09-luong-sua-chua/supporting/s3-ui-check.mjs
// Setup through the API (S1/S2 flows, already evidenced): building A on AQUA (ACCEPTANCE = BQL, BQT, TVKT), a record
// approved up to READY_FOR_CONSTRUCTION. In the UI: bql-a starts construction with a plan note, reports 100 % and
// submits the minutes, then passes as BQL; bqt sees the plan notice and passes; tvkt passes, which locks the minutes.
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
const TITLE = `[TEST S3 UI] Thay ống cấp tầng 3 ${RUN}`;
const PLAN_NOTE = 'Thi công 8h–17h, khóa van tổng tầng 3 trong 2 giờ, đã báo cư dân.';

if (!PASSWORD) throw new Error('SEED_DEMO_PASSWORD is not set');

const workDir = mkdtempSync(path.join(tmpdir(), 's3-ui-'));

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
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(48, 0x3c)]);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.concat(Array.from({ length: 16 }, () => row)))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
};
const SIGNATURE = `data:image/png;base64,${pngBytes().toString('base64')}`;

const applyTemplate = async (token, buildingId, templateKey) => {
  const config = await apiCall(WEB, 'GET', `/buildings/${buildingId}/config`, { token });
  return apiCall(WEB, 'POST', `/buildings/${buildingId}/config/apply-template`, {
    token,
    body: { templateKey, version: config.body.data.version },
  });
};

const uploadApi = async (token, recordId, purpose, name, mime, bytes) => {
  const form = new FormData();
  form.set('subjectType', 'REPAIR_RECORD');
  form.set('subjectId', recordId);
  form.set('purpose', purpose);
  form.set('file', new Blob([bytes], { type: mime }), name);
  const res = await fetch(`${WEB}/api/attachments`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
  if (res.status !== 201) throw new Error(`upload ${purpose} answered ${res.status}`);
  return (await res.json()).data.id;
};

const expectOk = (res, label) => {
  if (res.status < 200 || res.status >= 300) throw new Error(`${label} answered ${res.status}: ${JSON.stringify(res.body?.error ?? {})}`);
  return res.body.data;
};

/** Building A on AQUA and a record approved through S1 and S2: READY_FOR_CONSTRUCTION. */
const prepareRecord = async () => {
  const adminToken = (await loginWithRetry(WEB, 'admin-demo', PASSWORD)).body.data.accessToken;
  const buildingA = (await apiCall(WEB, 'GET', '/buildings', { token: adminToken })).body.data.find((row) => row.code === 'A');
  expectOk(await applyTemplate(adminToken, buildingA.id, 'AQUA'), 'apply AQUA');
  const bql = (await loginWithRetry(WEB, 'bql-a', PASSWORD)).body.data.accessToken;
  const tvkt = (await loginWithRetry(WEB, 'tvkt', PASSWORD)).body.data.accessToken;
  const bqt = (await loginWithRetry(WEB, 'bqt', PASSWORD)).body.data.accessToken;
  const pdf = Buffer.from(`%PDF-1.4\n% s3 ${RUN}\n%%EOF\n`);
  const location = (await apiCall(WEB, 'GET', '/reference', { token: bql })).body.data.locations.find((row) => row.buildingId === buildingA.id);
  let record = expectOk(
    await apiCall(WEB, 'POST', '/records', {
      token: bql,
      body: { buildingId: buildingA.id, locationId: location.id, title: TITLE, description: 'Ống cấp nước trần hành lang tầng 3 rò, cần thay đoạn ống.', noMaintenanceItem: true },
    }),
    'create record',
  );
  const photo = await uploadApi(bql, record.id, 'SITE_PHOTO', 'hien-truong.png', 'image/png', pngBytes());
  record = expectOk(await apiCall(WEB, 'POST', `/records/${record.id}/submit`, { token: bql, body: { version: record.version, attachmentIds: [photo] } }), 'submit');
  record = expectOk(await apiCall(WEB, 'POST', `/records/${record.id}/confirm-repair`, { token: tvkt, body: { version: record.version, note: 'Đúng hiện trạng, cần thay ống.' } }), 'confirm');
  const incident = await uploadApi(bql, record.id, 'INCIDENT_MINUTES', 'bien-ban.pdf', 'application/pdf', pdf);
  const quotation = await uploadApi(bql, record.id, 'QUOTATION', 'bao-gia.pdf', 'application/pdf', pdf);
  record = expectOk(
    await apiCall(WEB, 'POST', `/records/${record.id}/submit-proposal`, {
      token: bql,
      body: {
        version: record.version,
        proposalType: 'SUA_CHUA',
        budgetSource: 'KINH_PHI_BAO_TRI',
        requestContent: 'Thay đoạn ống cấp nước bị rò ở hành lang tầng 3.',
        assessment: 'Ống cũ đã mục, thay mới cả đoạn và van khóa.',
        items: [{ name: 'Ống cấp PPR D25', unit: 'm', quantity: '4' }],
        contractors: [{ name: 'Công ty Nam Phát', unitPricesVnd: ['350000'], otherCostVnd: '0', taxVnd: '140000', quotationAttachmentIds: [quotation] }],
        proposedContractorIndex: 0,
        shortfallReason: 'Sự cố gấp, một nhà thầu nhận thi công ngay.',
        incidentAttachmentIds: [incident],
        signature: SIGNATURE,
      },
    }),
    'submit proposal',
  );
  record = expectOk(await apiCall(WEB, 'POST', `/records/${record.id}/approve-proposal`, { token: tvkt, body: { version: record.version } }), 'TVKT approve');
  const minutes = await uploadApi(bqt, record.id, 'BOARD_MINUTES', 'bien-ban-bqt.pdf', 'application/pdf', pdf);
  record = expectOk(
    await apiCall(WEB, 'POST', `/records/${record.id}/approve-proposal`, {
      token: bqt,
      body: { version: record.version, boardMinutesAttachmentIds: [minutes], signature: SIGNATURE },
    }),
    'BQT approve',
  );
  if (record.status !== 'READY_FOR_CONSTRUCTION') throw new Error(`record is ${record.status}`);
  console.log(`record ${record.code} ready for construction`);
  return { record, adminToken, buildingId: buildingA.id };
};

const browser = await startBrowser({ evidenceDir: EVIDENCE });
const inDialog = `document.querySelector('[role=dialog]')`;

/** Draws a stroke across the signature canvas with real pointer events. */
const sign = async (label) => {
  const box = await browser.evaluate(`(() => {
    const el = document.querySelector('canvas[aria-label=${JSON.stringify(label)}]');
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  })()`);
  const point = (t) => ({ x: box.x + box.w * (0.15 + 0.7 * t), y: box.y + box.h * (0.5 + 0.25 * Math.sin(t * 6)) });
  await browser.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point(0) });
  await browser.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point(0), button: 'left', clickCount: 1 });
  for (let step = 1; step <= 20; step += 1) {
    await browser.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point(step / 20), button: 'left', buttons: 1 });
  }
  await browser.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point(1), button: 'left', clickCount: 1 });
};

const openDialog = async (buttonText, readySelector) => {
  await browser.waitFor(`[...document.querySelectorAll('button')].some((b) => b.textContent.trim() === ${JSON.stringify(buttonText)} && !b.disabled)`, `button ${buttonText}`, 30000);
  await browser.clickButton(buttonText);
  await browser.waitFor(`document.querySelector(${JSON.stringify(readySelector)})`, `dialog of ${buttonText}`);
};

const passAs = async (username, recordUrl) => {
  await signInThroughForm(browser, WEB, username, PASSWORD);
  await browser.navigate(recordUrl);
  await openDialog('Đạt', 'canvas[aria-label="Chữ ký thành phần nghiệm thu"]');
  await sign('Chữ ký thành phần nghiệm thu');
  await browser.clickButton('Xác nhận ĐẠT', inDialog);
  await browser.waitFor(`!document.querySelector('[role=dialog]')`, `${username} decision saved`, 30000);
  console.log(`${username} passed`);
};

let setup;
try {
  setup = await prepareRecord();
  const recordPath = `${WEB}/records/${setup.record.id}`;

  // 1. bql-a starts construction with a plan note, reports 100 % and submits the minutes.
  await signInThroughForm(browser, WEB, 'bql-a', PASSWORD);
  await browser.navigate(`${recordPath}?tab=construction`);
  await openDialog('Bắt đầu thi công', '#con-plan');
  await browser.setField('#con-plan', PLAN_NOTE);
  await browser.clickButton('Bắt đầu thi công', inDialog);
  await browser.waitFor(`document.body.innerText.includes(${JSON.stringify(PLAN_NOTE)})`, 'plan saved', 30000);
  await openDialog('Cập nhật tiến độ', '#exe-progress');
  await browser.setField('#exe-progress', '100');
  await browser.setField('#exe-progress-note', 'Đã thay xong 4 m ống và van khóa, chạy thử không rò.');
  await browser.clickButton('Lưu tiến độ', inDialog);
  await browser.waitFor(`!document.querySelector('[role=dialog]') && document.body.innerText.includes('100%')`, 'progress 100', 30000);
  await browser.screenshot('S3-1-bql-construction-100');
  await openDialog('Gửi nghiệm thu', '#min-location');
  await browser.setField('#min-location', 'Hành lang tầng 3');
  await browser.setField('#min-content', 'Kiểm tra 4 m ống PPR D25 và van khóa mới; chạy thử áp lực 30 phút không rò.');
  await browser.setField('#min-others', 'Đại diện cư dân: ông Trần Văn B (căn 305)');
  const photo = path.join(workDir, 'anh-nghiem-thu.png');
  writeFileSync(photo, pngBytes());
  const { root } = await browser.send('DOM.getDocument', { depth: -1 });
  const { nodeIds } = await browser.send('DOM.querySelectorAll', { nodeId: root.nodeId, selector: '[role=dialog] input[type=file]' });
  await browser.send('DOM.setFileInputFiles', { nodeId: nodeIds[0], files: [photo] });
  await browser.waitFor(`document.body.innerText.includes('anh-nghiem-thu.png')`, 'photo uploaded', 30000);
  await browser.screenshot('S3-2-bql-minutes-form');
  await browser.clickButton('Gửi nghiệm thu', inDialog);
  await browser.waitFor(`!document.querySelector('[role=dialog]')`, 'minutes submitted', 30000);
  await browser.navigate(`${recordPath}?tab=acceptance`);
  await browser.waitFor(`document.body.innerText.includes('Biên bản nghiệm thu lượt 1')`, 'minutes round 1', 30000);
  await sleep(300);
  await browser.screenshot('S3-3-minutes-round-1-pending');
  console.log('minutes round 1 created');

  // 2. The three members pass, each with a signature (BQL as MANAGER, then BQT, then TVKT).
  await browser.navigate(`${recordPath}?tab=acceptance`);
  await openDialog('Đạt', 'canvas[aria-label="Chữ ký thành phần nghiệm thu"]');
  await sign('Chữ ký thành phần nghiệm thu');
  await browser.clickButton('Xác nhận ĐẠT', inDialog);
  await browser.waitFor(`!document.querySelector('[role=dialog]')`, 'bql-a decision saved', 30000);
  console.log('bql-a passed');

  await signInThroughForm(browser, WEB, 'bqt', PASSWORD);
  await browser.navigate(`${WEB}/notifications`);
  await browser.waitFor(`document.body.innerText.includes(${JSON.stringify(`Kế hoạch thi công ${setup.record.code}`)})`, 'plan notice for BQT', 30000);
  await browser.screenshot('S3-4-bqt-plan-notification');
  await browser.navigate(`${recordPath}?tab=acceptance`);
  await openDialog('Đạt', 'canvas[aria-label="Chữ ký thành phần nghiệm thu"]');
  await sign('Chữ ký thành phần nghiệm thu');
  await browser.clickButton('Xác nhận ĐẠT', inDialog);
  await browser.waitFor(`!document.querySelector('[role=dialog]')`, 'bqt decision saved', 30000);
  console.log('bqt passed');

  await passAs('tvkt', `${recordPath}?tab=acceptance`);
  await browser.waitFor(`document.body.innerText.includes('Kết luận chung: Đạt') && document.body.innerText.includes('Chờ đề nghị thanh toán')`, 'minutes locked', 30000);
  await sleep(300);
  await browser.screenshot('S3-5-minutes-passed-three-signatures');
  console.log('AC-0.3 S3 UI flow: PASS');
} catch (error) {
  await browser.screenshot('S3-failed').catch(() => undefined);
  console.error(await browser.evaluate('location.pathname + "\\n" + document.body.innerText.slice(0, 800)').catch(() => ''));
  throw error;
} finally {
  await browser.close();
  if (setup) {
    const restored = await applyTemplate(setup.adminToken, setup.buildingId, 'STANDARD');
    console.log(`building A back on STANDARD: ${restored.status}`);
  }
}
