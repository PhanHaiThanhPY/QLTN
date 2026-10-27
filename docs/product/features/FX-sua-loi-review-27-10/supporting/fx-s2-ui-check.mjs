// AC-FX2.6 evidence for slice FX-S2: a settlement equal to the transferred advances (10 M after a 10 M advance) is a
// 0-đồng instalment that needs no transfer, in the web UI (api mode).
//
// Prerequisites: api-qltn on :5300 with demo seed, web dev server started with VITE_DATA_SOURCE=api (WEB_URL,
// default :5190). Run from the repository root:
//   SEED_DEMO_PASSWORD="$(grep -E '^SEED_DEMO_PASSWORD=' api-qltn/.env | cut -d= -f2-)" \
//     node docs/product/features/FX-sua-loi-review-27-10/supporting/fx-s2-ui-check.mjs
// Setup through the API (S1–S4 flows, already evidenced): building A on AQUA, a record approved for 10 000 000 ₫, an
// advance of 10 M approved and transferred, acceptance passed. In the UI: bql-a requests the 10 M settlement without
// a payee, bqt approves, the instalment reads "Không cần chuyển khoản", and bql-a closes the record. Building A goes
// back to STANDARD at the end. Passwords are never printed.
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
  signatureDataUrl,
  uploadApi,
} from '../../../../tools/repair-flow.mjs';

const WEB = process.env.WEB_URL ?? 'http://localhost:5190';
const PASSWORD = process.env.SEED_DEMO_PASSWORD;
const EVIDENCE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'evidence');
const RUN = new Date().toISOString().replace(/[-:]/g, '').slice(0, 13);
const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const inDialog = `document.querySelector('[role=dialog]')`;

if (!PASSWORD) throw new Error('SEED_DEMO_PASSWORD is not set');

const workDir = mkdtempSync(path.join(tmpdir(), 'fx-s2-ui-'));
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
  tokens = await signInTokens(WEB, PASSWORD, ['admin-demo', 'bql-a', 'tvkt', 'bqt', 'ktoan-a']);
  const prepared = await readyForConstruction(WEB, tokens, { title: `[TEST FX-S2 UI] Quyết toán bằng tạm ứng ${RUN}`, unitPriceVnd: '5000000' });
  buildingId = prepared.buildingId;
  const action = (token, record, route, body) => postRecordAction(WEB, token, record, route, body).then((res) => expectOk(res, route));
  let record = await action(tokens['bql-a'], prepared.record, 'start-construction', { startDate: TODAY, plannedEndDate: TODAY, planNote: 'Thi công trong ngày.' });
  const request = await uploadApi(WEB, tokens['bql-a'], record.id, 'PAYMENT_REQUEST', 'de-nghi-tam-ung.pdf', 'application/pdf', pdfBytes('tam ung'));
  record = await action(tokens['bql-a'], record, 'submit-advance-request', {
    amountVnd: '10000000',
    payeeName: 'CONG TY NAM PHAT',
    accountNo: '0123456789',
    bankName: 'Vietcombank',
    requestAttachmentIds: [request],
    signature: signatureDataUrl(),
  });
  record = await action(tokens.bqt, record, 'approve-advance');
  const proof = await uploadApi(WEB, tokens['ktoan-a'], record.id, 'PAYMENT_PROOF', 'chung-tu.pdf', 'application/pdf', pdfBytes('chung tu'));
  record = await action(tokens['ktoan-a'], record, 'confirm-advance-transfer', { amountVnd: '10000000', transferDate: TODAY, reference: `FT${RUN}A`, proofAttachmentIds: [proof] });
  const fresh = expectOk(await apiCall(WEB, 'GET', `/records/${record.id}`, { token: tokens['bql-a'] }), 'detail').record;
  record = await accepted(WEB, tokens, fresh, TODAY);
  const recordUrl = `${WEB}/records/${record.id}?tab=payment`;
  console.log(`record ${record.code}: approved 10 M, advance 10 M transferred, acceptance passed`);

  // 1. bql-a requests the 10 M settlement: the instalment is 0, the payee fields are optional and left empty.
  await signIn('bql-a');
  await browser.navigate(recordUrl);
  await openDialog('Gửi đề nghị thanh toán', '#pay-amount');
  await browser.setField('#pay-amount', '10000000');
  await browser.waitFor(`document.querySelector('[role=dialog]').innerText.includes('0 ₫ · Không cần chuyển khoản')`, 'zero computation');
  await browser.waitFor(`document.querySelector('[role=dialog]').innerText.includes('Tên tài khoản (không bắt buộc)')`, 'optional payee');
  await browser.evaluate(`document.querySelector('#pay-amount').scrollIntoView({ block: 'start' }), true`);
  await sleep(300);
  await browser.screenshot('FX-S2-1-bql-settlement-equal-to-advances');
  await uploadInDialog(0, pdfFile('cong-van-de-nghi-thanh-toan'));
  await uploadInDialog(1, pdfFile('hoa-don-gtgt'));
  await sign('Chữ ký BQL đề nghị thanh toán');
  await confirmIn('Gửi đề nghị');

  // 2. bqt approves: no transfer step, the instalment reads "Không cần chuyển khoản".
  await signIn('bqt');
  await browser.navigate(recordUrl);
  await openDialog('Duyệt', '[role=dialog]');
  await confirmIn('Duyệt');
  await browser.waitFor(`document.body.innerText.includes('Không cần chuyển khoản')`, 'no transfer label', 30000);
  const transferButton = await browser.evaluate(`[...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Xác nhận đã chuyển khoản')`);
  if (transferButton) throw new Error('a transfer button is still offered on the 0-đồng instalment');
  await sleep(300);
  await browser.screenshot('FX-S2-2-bqt-approved-no-transfer');

  // 3. bql-a closes the record (T22, BR-S4-05 unchanged).
  await signIn('bql-a');
  await browser.navigate(recordUrl);
  await openDialog('Đóng hoàn tất', '[role=dialog]');
  await confirmIn('Đóng hồ sơ');
  await browser.waitFor(`document.body.innerText.includes('Hoàn tất') && document.body.innerText.includes('10.000.000')`, 'record completed', 30000);
  await sleep(300);
  await browser.screenshot('FX-S2-3-bql-record-completed');
  console.log('AC-FX2.6 0-đồng settlement UI flow: PASS');
} catch (error) {
  await browser.screenshot('FX-S2-failed').catch(() => undefined);
  console.error(await browser.evaluate('location.pathname + "\\n" + document.body.innerText.slice(0, 800)').catch(() => ''));
  throw error;
} finally {
  await browser.close();
  if (tokens && buildingId) {
    const restored = await applyTemplate(WEB, tokens['admin-demo'], buildingId, 'STANDARD');
    console.log(`building A back on STANDARD: ${restored.status}`);
  }
}
