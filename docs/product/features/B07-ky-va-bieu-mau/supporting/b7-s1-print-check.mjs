// AC-B7.1 + AC-B7.13 evidence for B7-S1: the "Biểu mẫu" tab and the three D5 documents, on screen and printed to PDF
// by Chrome (the same engine as "Lưu thành PDF"), in api mode with demo accounts.
//
// Prerequisites: api-qltn on :5300 with demo seed, web dev server started with VITE_DATA_SOURCE=api (WEB_URL,
// default :5190). Run from the repository root:
//   SEED_DEMO_PASSWORD="$(grep -E '^SEED_DEMO_PASSWORD=' api-qltn/.env | cut -d= -f2-)" \
//     node docs/product/features/B07-ky-va-bieu-mau/supporting/b7-s1-print-check.mjs
// Setup through the API (SPEC §4 test record): building A on AQUA; proposal 1 rejected by BQT, proposal 2 approved
// (TVKT then BQT with minutes); a 4 M advance; acceptance round 1 failed, round 2 passed; settlement 10 M; closed.
// Building A goes back to STANDARD at the end. Passwords are never printed.
import { writeFileSync } from 'node:fs';
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
const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());

if (!PASSWORD) throw new Error('SEED_DEMO_PASSWORD is not set');

let tokens;
let buildingId;
const browser = await startBrowser({ evidenceDir: EVIDENCE });
try {
  tokens = await signInTokens(WEB, PASSWORD, ['admin-demo', 'bql-a', 'tvkt', 'bqt', 'ktoan-a']);
  const [bql, tvkt, bqt, ktoan] = [tokens['bql-a'], tokens.tvkt, tokens.bqt, tokens['ktoan-a']];
  const act = async (token, record, route, body) => expectOk(await postRecordAction(WEB, token, record, route, body), route);
  const file = (token, record, purpose, name) => uploadApi(WEB, token, record.id, purpose, `${name}.pdf`, 'application/pdf', pdfBytes(name));
  const buildingA = expectOk(await apiCall(WEB, 'GET', '/buildings', { token: tokens['admin-demo'] }), 'buildings').find((row) => row.code === 'A');
  buildingId = buildingA.id;
  expectOk(await applyTemplate(WEB, tokens['admin-demo'], buildingId, 'AQUA'), 'apply AQUA');

  // Intake.
  const location = expectOk(await apiCall(WEB, 'GET', '/reference', { token: bql }), 'reference').locations.find((row) => row.buildingId === buildingId);
  let record = expectOk(
    await apiCall(WEB, 'POST', '/records', {
      token: bql,
      body: { buildingId, locationId: location.id, title: `[TEST B7 IN] Thay ống cấp nước hành lang tầng 3 ${RUN}`, description: 'Ống cấp nước trần hành lang tầng 3 rò, cần thay đoạn ống.', noMaintenanceItem: true },
    }),
    'create',
  );
  record = await act(bql, record, 'submit', { attachmentIds: [await uploadApi(WEB, bql, record.id, 'SITE_PHOTO', 'hien-truong.png', 'image/png', pngBytes())] });
  record = await act(tvkt, record, 'confirm-repair', { note: 'Đúng hiện trạng, cần thay ống.' });

  // Proposal 1 refused by BQT, proposal 2 approved.
  const board = async (current) => ({ boardMinutesAttachmentIds: [await file(bqt, current, 'BOARD_MINUTES', 'bien-ban-hop-bqt')], signature: signatureDataUrl() });
  record = await act(bql, record, 'submit-proposal', {
    proposalType: 'SUA_CHUA',
    budgetSource: 'KINH_PHI_BAO_TRI',
    requestContent: 'Thay đoạn ống cấp nước bị rò ở hành lang tầng 3.',
    assessment: 'Ống cũ đã mục, thay mới cả đoạn và van khóa; Nam Phát có giá thấp nhất.',
    desiredApprovalDate: TODAY,
    items: [{ name: 'Ống cấp PPR D25 và van khóa', unit: 'gói', quantity: '2' }],
    contractors: [
      { name: 'Công ty Nam Phát', unitPricesVnd: ['5000000'], otherCostVnd: '0', taxVnd: '0', quotationAttachmentIds: [await file(bql, record, 'QUOTATION', 'bao-gia-nam-phat')] },
      { name: 'Công ty Thủy Tín', unitPricesVnd: ['5400000'], otherCostVnd: '0', taxVnd: '0', quotationAttachmentIds: [await file(bql, record, 'QUOTATION', 'bao-gia-thuy-tin')] },
    ],
    proposedContractorIndex: 0,
    shortfallReason: 'Chỉ hai nhà thầu nhận làm trong tuần.',
    incidentAttachmentIds: [await file(bql, record, 'INCIDENT_MINUTES', 'bien-ban-su-viec')],
    signature: signatureDataUrl(),
  });
  record = await act(tvkt, record, 'approve-proposal');
  record = await act(bqt, record, 'reject-proposal', { reason: 'Báo giá chưa có dấu của nhà thầu.', ...(await board(record)) });
  record = await act(bql, record, 'resubmit-proposal', { signature: signatureDataUrl() });
  record = await act(tvkt, record, 'approve-proposal');
  record = await act(bqt, record, 'approve-proposal', await board(record));

  // Construction, a 4 M advance, round 1 failed, round 2 passed.
  record = await act(bql, record, 'start-construction', { startDate: TODAY, plannedEndDate: TODAY, planNote: 'Thi công trong ngày.' });
  const payee = { payeeName: 'CONG TY NAM PHAT', accountNo: '0123456789', bankName: 'Vietcombank' };
  const transfer = async (current, amountVnd, name) => ({ amountVnd, transferDate: TODAY, reference: `FT${RUN}${name}`, proofAttachmentIds: [await file(ktoan, current, 'PAYMENT_PROOF', `chung-tu-${name}`)] });
  record = await act(bql, record, 'submit-advance-request', { amountVnd: '4000000', ...payee, requestAttachmentIds: [await file(bql, record, 'PAYMENT_REQUEST', 'de-nghi-tam-ung')], signature: signatureDataUrl() });
  record = await act(bqt, record, 'approve-advance');
  record = await act(ktoan, record, 'confirm-advance-transfer', await transfer(record, '4000000', 'A'));
  record = await act(bql, record, 'update-construction', { progressPercent: 100, note: 'Hoàn thành khối lượng.' });
  const minutes = async (current) => ({
    completedDate: TODAY,
    inspectedAt: new Date().toISOString(),
    inspectionLocation: 'Hành lang tầng 3',
    content: 'Kiểm tra đoạn ống mới, chạy thử áp lực.',
    photoAttachmentIds: [await uploadApi(WEB, bql, current.id, 'ACCEPTANCE', 'nghiem-thu.png', 'image/png', pngBytes())],
  });
  record = await act(bql, record, 'submit-acceptance', await minutes(record));
  record = await act(bql, record, 'pass-acceptance', { signature: signatureDataUrl() });
  record = await act(bqt, record, 'fail-acceptance', { signature: signatureDataUrl(), note: 'Mối nối thứ 2 còn rò, cần làm lại.' });
  record = await act(bql, record, 'resubmit-acceptance', await minutes(record));
  for (const token of [bql, bqt, tvkt]) record = await act(token, record, 'pass-acceptance', { signature: signatureDataUrl() });

  // Settlement 10 M (instalment 6 M), transfer, close.
  record = await act(bql, record, 'submit-payment-request', {
    amountVnd: '10000000',
    ...payee,
    requestAttachmentIds: [await file(bql, record, 'PAYMENT_REQUEST', 'cong-van-de-nghi')],
    invoiceAttachmentIds: [await file(bql, record, 'INVOICE', 'hoa-don-gtgt')],
    signature: signatureDataUrl(),
  });
  record = await act(bqt, record, 'approve-payment');
  record = await act(ktoan, record, 'confirm-payment-transfer', await transfer(record, '6000000', 'Q'));
  record = await act(bql, record, 'complete');
  console.log(`record ${record.code} completed`);

  // AC-B7.1: the tab lists 6 documents.
  await signInThroughForm(browser, WEB, 'bql-a', PASSWORD);
  await browser.navigate(`${WEB}/records/${record.id}?tab=documents`);
  await browser.waitFor(`document.querySelectorAll('li a[href*="/documents/"]').length === 6`, 'six documents', 30000);
  await sleep(300);
  await browser.screenshot('B7-1-documents-tab');

  // AC-B7.13: each document on screen, then printed to PDF (A4 portrait, CSS page size and margin boxes).
  const links = await browser.evaluate(`[...document.querySelectorAll('li a[href*="/documents/"]')].map((a) => a.getAttribute('href'))`);
  const pick = (kind, index = 0) => links.filter((href) => href.includes(`/documents/${kind}/`))[index];
  const documents = [
    ['B7-2-proposal-attempt-2', pick('proposal', 1)],
    ['B7-3-proposal-attempt-1-refused', pick('proposal', 0)],
    ['B7-4-minutes-round-1-failed', pick('minutes', 0)],
    ['B7-5-minutes-round-2-passed', pick('minutes', 1)],
    ['B7-6-letter-settlement', pick('payment', 1)],
  ];
  for (const [name, href] of documents) {
    await browser.navigate(`${WEB}${href}`);
    await browser.waitFor(`document.querySelector('.d5-sheet') && [...document.querySelectorAll('button')].some((b) => b.textContent.includes('In') && !b.disabled)`, `${name} ready`, 30000);
    const strayText = await browser.evaluate(`/undefined|null|NaN/.test(document.querySelector('.d5-sheet').textContent)`);
    if (strayText) throw new Error(`${name} prints undefined/null/NaN`);
    await sleep(300);
    await browser.screenshot(name);
    const { data } = await browser.send('Page.printToPDF', { preferCSSPageSize: true, printBackground: true });
    writeFileSync(path.join(EVIDENCE, `${name}.pdf`), Buffer.from(data, 'base64'));
    console.log(`pdf ${name}.pdf`);
  }
  console.log('AC-B7.1 + AC-B7.13 B7-S1 print flow: PASS');
} catch (error) {
  await browser.screenshot('B7-failed').catch(() => undefined);
  console.error(await browser.evaluate('location.pathname + "\\n" + document.body.innerText.slice(0, 800)').catch(() => ''));
  throw error;
} finally {
  await browser.close();
  if (tokens && buildingId) {
    const restored = await applyTemplate(WEB, tokens['admin-demo'], buildingId, 'STANDARD');
    console.log(`building A back on STANDARD: ${restored.status}`);
  }
}
