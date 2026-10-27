// F-S2 evidence in a real browser (headless Chrome), api mode, demo accounts: MT-001's "Kết quả chọn" and "Hội nghị"
// tabs, HĐ-001 (milestones and receivable schedule), the contract list, the proposal dialog locking an incomplete
// bid, a selection waiting for BQT, Kế toán's view of HĐ-001, and the 375px layout.
//
// Prerequisites: api-qltn with migration 2026-10-27h and demo seed (MT-001 → HĐ-001), web dev server with
// VITE_DATA_SOURCE=api (WEB_URL, default :5190). Run from the repository root:
//   SEED_DEMO_PASSWORD="$(grep -E '^SEED_DEMO_PASSWORD=' api-qltn/.env | cut -d= -f2-)" \
//     node docs/product/features/F-hop-dong-khai-thac/supporting/f-s2-contracts-check.mjs
// Adds one package "[TEST F2 CHỌN] …" closed with two bids and a selection waiting for approval. Passwords are never
// printed. CDP_PORT (default 9344).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { signInThroughForm, sleep, startBrowser } from '../../../../tools/cdp-browser.mjs';
import { apiCall } from '../../../../tools/seed-accounts.mjs';
import { expectOk, signInTokens } from '../../../../tools/repair-flow.mjs';

const WEB = process.env.WEB_URL ?? 'http://localhost:5190';
const PASSWORD = process.env.SEED_DEMO_PASSWORD;
const EVIDENCE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'evidence');
const RUN = new Date().toISOString().replace(/[-:]/g, '').slice(0, 13);
const PDF = Buffer.from('%PDF-1.4\n% tai lieu thu F-S2\n', 'utf8');

if (!PASSWORD) throw new Error('SEED_DEMO_PASSWORD is not set');

const upload = async (token, subjectType, subjectId, purpose, name) => {
  const form = new FormData();
  form.set('subjectType', subjectType);
  form.set('subjectId', subjectId);
  form.set('purpose', purpose);
  form.set('file', new Blob([PDF], { type: 'application/pdf' }), name);
  const res = await fetch(`${WEB}/api/attachments`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
  if (res.status !== 201) throw new Error(`upload ${name} answered ${res.status}`);
  return (await res.json()).data.id;
};
const noOverflow = async (browser, name) => {
  const overflow = await browser.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth');
  console.log(`${name} horizontal overflow ${overflow}px`);
  if (overflow > 0) throw new Error(`${name} scrolls horizontally`);
};

const browser = await startBrowser({ evidenceDir: EVIDENCE, port: Number(process.env.CDP_PORT ?? 9344) });
try {
  const tokens = await signInTokens(WEB, PASSWORD, ['bql-a', 'bqt', 'ktoan-a']);
  const bql = tokens['bql-a'];
  const packages = expectOk(await apiCall(WEB, 'GET', '/exploitation/packages', { token: bql }), 'packages');
  const mt001 = packages.find((row) => row.code === 'MT-001');
  const contracts = expectOk(await apiCall(WEB, 'GET', '/exploitation/contracts', { token: bql }), 'contracts');
  const hd = contracts.rows.find((row) => row.package.id === mt001.id && row.status === 'ACTIVE');
  if (!hd) throw new Error('HĐ-001 is missing: the F-S2 demo seed did not run');
  const ktoanList = await apiCall(WEB, 'GET', `/exploitation/packages/${mt001.id}/outcome`, { token: tokens['ktoan-a'] });
  console.log(`AC-F2.15 Kế toán reads the bids: ${ktoanList.status}`);

  // A closed package with DV-A complete and DV-B missing a document.
  const reference = expectOk(await apiCall(WEB, 'GET', '/reference', { token: bql }), 'reference');
  const lobby = reference.locations.find((row) => row.buildingId === mt001.buildingId && row.name === 'Sảnh chính');
  const partners = expectOk(await apiCall(WEB, 'GET', '/exploitation/partners', { token: bql }), 'partners').filter((row) => ['DV-A', 'DV-B'].includes(row.name));
  const fields = { locationId: lobby.id, kind: 'RETAIL_SPACE', name: `[TEST F2 CHỌN] Mặt bằng tầng trệt ${RUN}` };
  let pkg = expectOk(await apiCall(WEB, 'POST', '/exploitation/packages', { token: bql, body: { ...fields, buildingId: mt001.buildingId } }), 'package');
  const documents = [];
  for (const kind of ['LETTER', 'REQUIREMENTS', 'CRITERIA']) documents.push({ kind, attachmentId: await upload(bql, 'EXPLOITATION_PACKAGE', pkg.id, 'EXPLOITATION_DOCUMENT', `${kind}.pdf`) });
  pkg = expectOk(
    await apiCall(WEB, 'PATCH', `/exploitation/packages/${pkg.id}`, { token: bql, body: { ...fields, version: pkg.version, documents, inviteeIds: partners.map((row) => row.id), deadlineAt: new Date(Date.now() + 5 * 86_400_000).toISOString() } }),
    'prepare',
  );
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
  pkg = expectOk(await apiCall(WEB, 'POST', `/exploitation/packages/${pkg.id}/issue`, { token: bql, body: { version: pkg.version, issuedOn: today } }), 'issue');
  let bidA;
  for (const partner of partners) {
    let bid = expectOk(
      await apiCall(WEB, 'POST', `/exploitation/packages/${pkg.id}/bids`, { token: bql, body: { partnerId: partner.id, receivedAt: new Date().toISOString(), priceVnd: partner.name === 'DV-A' ? '30000000' : '33000000', pricePeriod: 'MONTH' } }),
      'bid',
    ).bid;
    const items = [];
    for (const item of bid.items) {
      if (partner.name === 'DV-B' && item.label === 'Chứng từ điều kiện') continue;
      items.push({ checklistItemId: item.checklistItemId, status: 'RECEIVED', attachmentIds: [await upload(bql, 'EXPLOITATION_BID', bid.id, 'BID_DOCUMENT', `${item.label}.pdf`)] });
    }
    bid = expectOk(await apiCall(WEB, 'POST', `/exploitation/bids/${bid.id}/items`, { token: bql, body: { version: bid.version, items } }), 'items');
    if (partner.name === 'DV-A') bidA = bid;
  }
  const current = expectOk(await apiCall(WEB, 'GET', `/exploitation/packages/${pkg.id}`, { token: bql }), 'detail').package;
  expectOk(await apiCall(WEB, 'POST', `/exploitation/packages/${pkg.id}/close`, { token: bql, body: { version: current.version, reason: 'Đủ hồ sơ của đơn vị được mời.' } }), 'close');

  await signInThroughForm(browser, WEB, 'bql-a', PASSWORD);
  // 1. The proposal dialog: DV-B locked with its reason.
  await browser.navigate(`${WEB}/exploitation/packages/${pkg.id}?tab=selection`);
  await browser.waitFor(`document.body.innerText.includes('Lập đề xuất kết quả')`, 'selection tab', 30000);
  await browser.clickButton('Lập đề xuất kết quả');
  await browser.waitFor(`document.body.innerText.includes('hiếu Chứng từ điều kiện')`, 'proposal dialog');
  await sleep(400);
  await browser.screenshot('F2-1-proposal-dialog');
  await browser.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  const minutes = await upload(bql, 'EXPLOITATION_PACKAGE', pkg.id, 'SELECTION_MINUTES', 'BB-002 Biên bản đánh giá.pdf');
  expectOk(
    await apiCall(WEB, 'POST', `/exploitation/packages/${pkg.id}/selections`, { token: bql, body: { kind: 'PARTNER', bidId: bidA.id, minutesAttachmentId: minutes, basis: 'Hồ sơ đủ điều kiện theo biên bản đánh giá BB-002.' } }),
    'propose',
  );

  // 2–6. MT-001 and HĐ-001 as BQL.
  for (const [name, url, ready] of [
    ['F2-2-mt001-selection', `${WEB}/exploitation/packages/${mt001.id}?tab=selection`, `document.body.innerText.includes('Kết quả lựa chọn') && document.body.innerText.includes('Đã duyệt')`],
    ['F2-3-mt001-assembly', `${WEB}/exploitation/packages/${mt001.id}?tab=assembly`, `document.body.innerText.includes('Quyết nghị NQ-001')`],
    ['F2-4-contract-overview', `${WEB}/exploitation/contracts/${hd.id}`, `document.body.innerText.includes('Mốc hồ sơ liên kết') && document.body.innerText.includes('Đến hạn thu')`],
    ['F2-5-contract-schedule', `${WEB}/exploitation/contracts/${hd.id}?tab=schedule`, `document.querySelector('tfoot') !== null && document.body.innerText.includes('Chưa đến hạn')`],
    ['F2-6-contracts-list', `${WEB}/exploitation/contracts`, `document.body.innerText.includes('${hd.code}') && document.body.innerText.includes('Hiệu lực')`],
  ]) {
    await browser.navigate(url);
    await browser.waitFor(ready, name, 30000);
    await sleep(500);
    await browser.screenshot(name);
  }

  // 7. BQT sees the selection waiting with its buttons.
  await signInThroughForm(browser, WEB, 'bqt', PASSWORD);
  await browser.navigate(`${WEB}/exploitation/packages/${pkg.id}?tab=selection`);
  await browser.waitFor(`document.body.innerText.includes('Chờ duyệt') && document.body.innerText.includes('Yêu cầu sửa')`, 'pending selection', 30000);
  await sleep(400);
  await browser.screenshot('F2-7-bqt-pending-selection');

  // 8. Kế toán reads HĐ-001: no bids, no write buttons.
  await signInThroughForm(browser, WEB, 'ktoan-a', PASSWORD);
  await browser.navigate(`${WEB}/exploitation/contracts/${hd.id}`);
  await browser.waitFor(`document.body.innerText.includes('Mốc hồ sơ liên kết')`, 'ktoan contract', 30000);
  const menu = await browser.evaluate(`[...document.querySelectorAll('nav a')].map((a) => a.textContent.trim())`);
  console.log(`Kế toán menu: Hợp đồng khai thác=${menu.includes('Hợp đồng khai thác')}, Mời thầu khai thác=${menu.includes('Mời thầu khai thác')}`);
  const writes = await browser.evaluate(`['Phụ lục sửa đổi', 'Đưa vào hiệu lực', 'Hủy hợp đồng'].filter((name) => [...document.querySelectorAll('button')].some((b) => b.textContent.trim() === name))`);
  console.log(`Kế toán write buttons: ${JSON.stringify(writes)}`);
  if (writes.length) throw new Error('Kế toán has write buttons');
  await sleep(400);
  await browser.screenshot('F2-8-ktoan-contract');

  // 9–10. 375px as BQL.
  await signInThroughForm(browser, WEB, 'bql-a', PASSWORD);
  await browser.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 2, mobile: true });
  for (const [name, url, ready] of [
    ['F2-9-schedule-375', `${WEB}/exploitation/contracts/${hd.id}?tab=schedule`, `document.body.innerText.includes('Kỳ 1')`],
    ['F2-10-selection-375', `${WEB}/exploitation/packages/${mt001.id}?tab=selection`, `document.body.innerText.includes('Kết quả lựa chọn')`],
  ]) {
    await browser.navigate(url);
    await browser.waitFor(ready, name, 30000);
    await sleep(500);
    await noOverflow(browser, name);
    await browser.screenshot(name);
  }
  console.log('F-S2 contracts flow: PASS');
} catch (error) {
  await browser.screenshot('F2-failed').catch(() => undefined);
  throw error;
} finally {
  await browser.close();
}
