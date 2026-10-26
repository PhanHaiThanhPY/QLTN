// AC-0.3 evidence for slice S4 (SPEC v2): an advance, then the settlement and the close, in the web UI (api mode).
//
// Prerequisites: api-qltn on :5300 with demo seed, web dev server started with VITE_DATA_SOURCE=api (WEB_URL,
// default :5190). Run from the repository root:
//   SEED_DEMO_PASSWORD="$(grep -E '^SEED_DEMO_PASSWORD=' api-qltn/.env | cut -d= -f2-)" \
//     node docs/product/features/B03-B09-luong-sua-chua/supporting/s4-ui-check.mjs
// Setup through the API (S1–S3 flows, already evidenced): building A on AQUA, a record approved for 10 000 000 ₫ and in
// construction. In the UI: bql-a requests a 4 M advance, bqt approves, ktoan-a confirms the transfer. The acceptance is
// passed through the API. Then bql-a requests the 10 M settlement (6 M instalment), bqt approves and confirms the
// transfer, and bql-a closes the record. Building A goes back to STANDARD at the end. Passwords are never printed.
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { signInThroughForm, sleep, startBrowser } from '../../../../tools/cdp-browser.mjs';
import { apiCall } from '../../../../tools/seed-accounts.mjs';
import {
  accepted,
  applyTemplate,
  expectOk,
  pdfBytes,
  postRecordAction,
  readyForConstruction,
  signInTokens,
} from '../../../../tools/repair-flow.mjs';

const WEB = process.env.WEB_URL ?? 'http://localhost:5190';
const PASSWORD = process.env.SEED_DEMO_PASSWORD;
const EVIDENCE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'evidence');
const RUN = new Date().toISOString().replace(/[-:]/g, '').slice(0, 13);
const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const inDialog = `document.querySelector('[role=dialog]')`;

if (!PASSWORD) throw new Error('SEED_DEMO_PASSWORD is not set');

const workDir = mkdtempSync(path.join(tmpdir(), 's4-ui-'));
const pdfFile = (name) => {
  const file = path.join(workDir, `${name}.pdf`);
  writeFileSync(file, pdfBytes(name));
  return file;
};

const browser = await startBrowser({ evidenceDir: EVIDENCE });

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

const uploadInDialog = async (index, file) => {
  const { root } = await browser.send('DOM.getDocument', { depth: -1 });
  const { nodeIds } = await browser.send('DOM.querySelectorAll', { nodeId: root.nodeId, selector: '[role=dialog] input[type=file]' });
  await browser.send('DOM.setFileInputFiles', { nodeId: nodeIds[index], files: [file] });
  await browser.waitFor(`document.body.innerText.includes(${JSON.stringify(path.basename(file))})`, `upload ${path.basename(file)}`, 30000);
};

const openDialog = async (buttonText, readySelector) => {
  await browser.waitFor(`[...document.querySelectorAll('button')].some((b) => b.textContent.trim() === ${JSON.stringify(buttonText)} && !b.disabled)`, `button ${buttonText}`, 30000);
  await browser.clickButton(buttonText);
  await browser.waitFor(`document.querySelector(${JSON.stringify(readySelector)})`, `dialog of ${buttonText}`);
};

const confirmIn = async (label) => {
  await browser.clickButton(label, inDialog);
  await browser.waitFor(`!document.querySelector('[role=dialog]')`, `${label} done`, 30000);
};

/** The payment request dialog: amount, payee, files (contractor request, then invoice), signature. */
const fillRequest = async (amount, files) => {
  if (amount) await browser.setField('#pay-amount', amount);
  await browser.setField('#pay-payee', 'CONG TY NAM PHAT');
  await browser.setField('#pay-account', '0123456789');
  await browser.setField('#pay-bank', 'Vietcombank – CN Hà Nội');
  for (const [index, file] of files.entries()) await uploadInDialog(index, file);
  await sign('Chữ ký BQL đề nghị thanh toán');
};

const confirmTransfer = async (reference, proofName) => {
  await openDialog('Xác nhận đã chuyển khoản', '#tr-ref');
  await browser.setField('#tr-ref', reference);
  await uploadInDialog(0, pdfFile(proofName));
};

/** Sign-in through the form; the login limit is 10/min/IP, so a throttled attempt waits out the window and retries. */
const signIn = async (username) => {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await signInThroughForm(browser, WEB, username, PASSWORD);
      return;
    } catch (error) {
      const throttled = await browser.evaluate(`document.body.innerText.includes('Too Many Requests')`).catch(() => false);
      if (!throttled || attempt === 3) throw error;
      console.log(`login ${username} rate-limited, retrying in 65 s`);
      await sleep(65_000);
    }
  }
};

let tokens;
let buildingId;
try {
  tokens = await signInTokens(WEB, PASSWORD, ['admin-demo', 'bql-a', 'tvkt', 'bqt']);
  const prepared = await readyForConstruction(WEB, tokens, { title: `[TEST S4 UI] Thanh toán thay ống ${RUN}`, unitPriceVnd: '5000000' });
  buildingId = prepared.buildingId;
  const started = expectOk(
    await postRecordAction(WEB, tokens['bql-a'], prepared.record, 'start-construction', { startDate: TODAY, plannedEndDate: TODAY, planNote: 'Thi công trong ngày.' }),
    'start construction',
  );
  const recordUrl = `${WEB}/records/${started.id}?tab=payment`;
  console.log(`record ${started.code} in construction, approved 10 000 000`);

  // 1. Advance 4 M during construction: bql-a requests, bqt approves, ktoan-a confirms the transfer.
  await signIn('bql-a');
  await browser.navigate(recordUrl);
  await openDialog('Đề nghị tạm ứng', '#pay-amount');
  await fillRequest('4000000', [pdfFile('de-nghi-tam-ung')]);
  await browser.waitFor(`document.body.innerText.includes('Bốn triệu đồng')`, 'amount in words');
  await browser.screenshot('S4-1-bql-advance-request');
  await confirmIn('Gửi đề nghị');
  await signIn('bqt');
  await browser.navigate(recordUrl);
  await openDialog('Duyệt', '[role=dialog]');
  await confirmIn('Duyệt');
  await signIn('ktoan-a');
  await browser.navigate(recordUrl);
  await confirmTransfer(`FT${RUN}A`, 'chung-tu-tam-ung');
  await confirmIn('Xác nhận đã chuyển khoản');
  await browser.waitFor(`document.body.innerText.includes('Đã chuyển khoản') && document.body.innerText.includes('Đang thi công')`, 'advance transferred', 30000);
  await sleep(300);
  await browser.screenshot('S4-2-ktoan-advance-transferred');
  console.log('advance 4 M transferred; record still in construction');

  // 2. Acceptance through the API (S3, already evidenced).
  const fresh = expectOk(await apiCall(WEB, 'GET', `/records/${started.id}`, { token: tokens['bql-a'] }), 'detail').record;
  await accepted(WEB, tokens, fresh, TODAY);

  // 3. Settlement 10 M → instalment 6 M: bql-a requests, bqt approves and confirms the transfer, bql-a closes.
  await signIn('bql-a');
  await browser.navigate(recordUrl);
  await openDialog('Gửi đề nghị thanh toán', '#pay-amount');
  await fillRequest(null, [pdfFile('cong-van-de-nghi-thanh-toan'), pdfFile('hoa-don-gtgt')]);
  await browser.waitFor(`document.body.innerText.includes('6.000.000')`, 'settlement computation');
  await browser.screenshot('S4-3-bql-settlement-request');
  await confirmIn('Gửi đề nghị');
  await signIn('bqt');
  await browser.navigate(recordUrl);
  await openDialog('Duyệt', '[role=dialog]');
  await confirmIn('Duyệt');
  await confirmTransfer(`FT${RUN}Q`, 'chung-tu-quyet-toan');
  await confirmIn('Xác nhận đã chuyển khoản');
  await signIn('bql-a');
  await browser.navigate(recordUrl);
  await openDialog('Đóng hoàn tất', '[role=dialog]');
  await confirmIn('Đóng hồ sơ');
  await browser.waitFor(`document.body.innerText.includes('Hoàn tất') && document.body.innerText.includes('10.000.000')`, 'record completed', 30000);
  await sleep(300);
  await browser.screenshot('S4-4-bql-record-completed');
  console.log('AC-0.3 S4 UI flow: PASS');
} catch (error) {
  await browser.screenshot('S4-failed').catch(() => undefined);
  console.error(await browser.evaluate('location.pathname + "\\n" + document.body.innerText.slice(0, 800)').catch(() => ''));
  throw error;
} finally {
  await browser.close();
  if (tokens && buildingId) {
    const restored = await applyTemplate(WEB, tokens['admin-demo'], buildingId, 'STANDARD');
    console.log(`building A back on STANDARD: ${restored.status}`);
  }
}
