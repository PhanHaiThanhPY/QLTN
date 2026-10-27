// AC-E0.3 evidence for B06-S1: emergency repair and post-review in the web UI (api mode), with demo accounts.
//
// Prerequisites: api-qltn on :5300 with demo seed, web dev server started with VITE_DATA_SOURCE=api (WEB_URL,
// default :5190). Run from the repository root:
//   SEED_DEMO_PASSWORD="$(grep -E '^SEED_DEMO_PASSWORD=' api-qltn/.env | cut -d= -f2-)" \
//     node docs/product/features/B06-xu-ly-khan-cap/supporting/b06-s1-ui-check.mjs
// Setup through the API: building A on AQUA (limit 15 M, 24 h), a record confirmed by TVKT (PENDING_PROPOSAL).
// In the UI: bql-a starts the emergency (header button, dialog), sees the emergency card and the list flag. Then,
// through the API, the 16 M proposal is submitted and approved by TVKT; in the UI bqt opens the rejection with
// "Không duyệt hậu kiểm"; the rejection itself goes through the API (board minutes), and bqt closes the record in the
// UI. Building A goes back to STANDARD at the end. Passwords are never printed.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { signInThroughForm, sleep, startBrowser } from '../../../../tools/cdp-browser.mjs';
import { apiCall } from '../../../../tools/seed-accounts.mjs';
import {
  applyTemplate,
  expectOk,
  pdfBytes,
  pngBytes,
  postRecordAction,
  signatureDataUrl,
  signInTokens,
  uploadApi,
} from '../../../../tools/repair-flow.mjs';

const WEB = process.env.WEB_URL ?? 'http://localhost:5190';
const PASSWORD = process.env.SEED_DEMO_PASSWORD;
const EVIDENCE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'evidence');
const RUN = new Date().toISOString().replace(/[-:]/g, '').slice(0, 13);
const inDialog = `document.querySelector('[role=dialog]')`;

if (!PASSWORD) throw new Error('SEED_DEMO_PASSWORD is not set');

const browser = await startBrowser({ evidenceDir: EVIDENCE });

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

const openDialog = async (buttonText, readySelector) => {
  await browser.waitFor(`[...document.querySelectorAll('button')].some((b) => b.textContent.trim() === ${JSON.stringify(buttonText)} && !b.disabled)`, `button ${buttonText}`, 30000);
  await browser.clickButton(buttonText);
  await browser.waitFor(`document.querySelector(${JSON.stringify(readySelector)})`, `dialog of ${buttonText}`);
};

let tokens;
let buildingId;
try {
  tokens = await signInTokens(WEB, PASSWORD, ['admin-demo', 'bql-a', 'tvkt', 'bqt']);
  const buildingA = expectOk(await apiCall(WEB, 'GET', '/buildings', { token: tokens['admin-demo'] }), 'buildings').find((row) => row.code === 'A');
  buildingId = buildingA.id;
  expectOk(await applyTemplate(WEB, tokens['admin-demo'], buildingId, 'AQUA'), 'apply AQUA');
  const bql = tokens['bql-a'];
  const location = expectOk(await apiCall(WEB, 'GET', '/reference', { token: bql }), 'reference').locations.find((row) => row.buildingId === buildingId);
  let record = expectOk(
    await apiCall(WEB, 'POST', '/records', {
      token: bql,
      body: { buildingId, locationId: location.id, title: `[TEST B06 UI] Vỡ ống cấp nước chính ${RUN}`, description: 'Ống cấp nước chính bị vỡ, nước tràn hành lang.', noMaintenanceItem: true },
    }),
    'create record',
  );
  const photo = await uploadApi(WEB, bql, record.id, 'SITE_PHOTO', 'hien-truong.png', 'image/png', pngBytes());
  record = expectOk(await postRecordAction(WEB, bql, record, 'submit', { attachmentIds: [photo] }), 'submit');
  record = expectOk(await postRecordAction(WEB, tokens.tvkt, record, 'confirm-repair', { note: 'Đúng hiện trạng, cần xử lý ngay.' }), 'confirm');
  const recordUrl = `${WEB}/records/${record.id}`;
  console.log(`record ${record.code} waiting for its proposal`);

  // 1. bql-a: the header offers "Xử lý khẩn cấp"; the dialog shows the 15 M limit, the amount in words; start.
  await signIn('bql-a');
  await browser.navigate(recordUrl);
  await openDialog('Xử lý khẩn cấp', '#em-reason');
  await browser.waitFor(`${inDialog}.innerText.includes('Hạn mức khẩn cấp của tòa: 15.000.000')`, 'limit from the API');
  await browser.setField('#em-reason', 'Ống cấp chính vỡ, nước tràn hành lang, nguy cơ ngập tủ điện.');
  await browser.setField('#em-contractor', 'Cty TNHH Bình An');
  await browser.setField('#em-amount', '12500000');
  await browser.waitFor(`${inDialog}.innerText.includes('Mười hai triệu năm trăm nghìn đồng')`, 'amount in words');
  await sleep(300);
  await browser.screenshot('B06-1-bql-emergency-dialog');
  await browser.clickButton('Bắt đầu xử lý', inDialog);
  await browser.waitFor(`!document.querySelector('[role=dialog]')`, 'emergency started', 30000);
  await browser.waitFor(`document.body.innerText.includes('Còn khoảng 24 giờ để bổ sung hồ sơ') && document.body.innerText.includes('Chờ duyệt hậu kiểm')`, 'emergency card', 30000);
  await sleep(300);
  await browser.screenshot('B06-2-bql-emergency-card');

  // 2. The list flags the record as an emergency.
  await browser.navigate(`${WEB}/records`);
  await browser.waitFor(`document.body.innerText.includes(${JSON.stringify(record.code)}) && document.body.innerText.includes('Khẩn cấp')`, 'list flag', 30000);
  await sleep(300);
  await browser.screenshot('B06-3-records-list-emergency-flag');

  // 3. Through the API: a 16 M proposal (over the 15 M limit) submitted, TVKT approves; the record waits on BQT.
  record = expectOk(await apiCall(WEB, 'GET', `/records/${record.id}`, { token: bql }), 'detail').record;
  const quotation = await uploadApi(WEB, bql, record.id, 'QUOTATION', 'bao-gia.pdf', 'application/pdf', pdfBytes('bao gia'));
  const incident = await uploadApi(WEB, bql, record.id, 'INCIDENT_MINUTES', 'bien-ban.pdf', 'application/pdf', pdfBytes('bien ban'));
  record = expectOk(
    await postRecordAction(WEB, bql, record, 'submit-proposal', {
      proposalType: 'SUA_CHUA',
      budgetSource: 'KINH_PHI_BAO_TRI',
      requestContent: 'Thay đoạn ống cấp chính bị vỡ.',
      assessment: 'Ống đã mục, thay cả đoạn và van khóa.',
      items: [{ name: 'Ống cấp chính D90', unit: 'đoạn', quantity: '2' }],
      contractors: [{ name: 'Cty TNHH Bình An', unitPricesVnd: ['8000000'], otherCostVnd: '0', taxVnd: '0', quotationAttachmentIds: [quotation] }],
      proposedContractorIndex: 0,
      shortfallReason: 'Sự cố gấp, một nhà thầu nhận làm ngay.',
      incidentAttachmentIds: [incident],
      signature: signatureDataUrl(),
    }),
    'submit proposal',
  );
  record = expectOk(await postRecordAction(WEB, tokens.tvkt, record, 'approve-proposal'), 'TVKT approve');

  // 4. bqt: the rejection dialog offers "Không duyệt hậu kiểm"; ticking it warns and turns the button red.
  await signIn('bqt');
  await browser.navigate(`${recordUrl}?tab=approval`);
  await openDialog('Từ chối', '#decision-reason');
  await browser.setField('#decision-reason', 'Chi phí vượt hạn mức, không có biên bản hiện trường.');
  await browser.realClick(`[...document.querySelectorAll('[role=dialog] label')].find((label) => label.textContent.includes('Không duyệt hậu kiểm'))?.querySelector('input')`, 'post-review checkbox');
  await browser.waitFor(`${inDialog}.querySelector('[role=alert]') && [...${inDialog}.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Không duyệt hậu kiểm')`, 'post-review warning');
  await sleep(300);
  await browser.screenshot('B06-4-bqt-reject-without-post-review');
  await browser.clickButton('Hủy', inDialog);

  // 5. The rejection with board minutes goes through the API; bqt then records the decision and closes in the UI.
  const minutes = await uploadApi(WEB, tokens.bqt, record.id, 'BOARD_MINUTES', 'bien-ban-bqt.pdf', 'application/pdf', pdfBytes('bqt'));
  record = expectOk(
    await postRecordAction(WEB, tokens.bqt, record, 'reject-proposal', {
      reason: 'Chi phí vượt hạn mức, không có biên bản hiện trường.',
      finalPostReview: true,
      boardMinutesAttachmentIds: [minutes],
      signature: signatureDataUrl(),
    }),
    'BQT post-review rejection',
  );
  await browser.navigate(recordUrl);
  await browser.waitFor(`document.body.innerText.includes('BQT ghi quyết định xử lý chi phí rồi đóng hồ sơ')`, 'post-review rejected card', 30000);
  await sleep(300);
  await browser.screenshot('B06-5-bqt-post-review-rejected');
  await openDialog('Ghi quyết định và đóng', '#prr-reason');
  await browser.setField('#prr-reason', 'Nhà thầu tự chịu phần chi phí đã làm.');
  await browser.clickButton('Đóng hồ sơ', inDialog);
  await browser.waitFor(`document.body.innerText.includes('Đã đóng: không được duyệt hậu kiểm') && document.body.innerText.includes('Nhà thầu tự chịu phần chi phí đã làm.')`, 'record closed', 30000);
  await sleep(300);
  await browser.screenshot('B06-6-bqt-record-closed');
  console.log('AC-E0.3 B06-S1 UI flow: PASS');
} catch (error) {
  await browser.screenshot('B06-failed').catch(() => undefined);
  console.error(await browser.evaluate('location.pathname + "\\n" + document.body.innerText.slice(0, 800)').catch(() => ''));
  throw error;
} finally {
  await browser.close();
  if (tokens && buildingId) {
    const restored = await applyTemplate(WEB, tokens['admin-demo'], buildingId, 'STANDARD');
    console.log(`building A back on STANDARD: ${restored.status}`);
  }
}
