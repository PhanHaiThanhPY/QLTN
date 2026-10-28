// F-S3 evidence in a real browser (headless Chrome), api mode, demo accounts: tòa A's ledger for the seeded D1 month
// (50 + 15 − 5 = 60), HĐ-001's "Khoản thu" tab, the receipt dialog's allocation, the tax month, a voucher waiting for
// BQT, BQL's view (contract yes, ledger no), BQT on a fund not set up, and the 375px layout.
//
// Prerequisites: api-qltn with migration 2026-10-27i and the demo seed, web dev server with VITE_DATA_SOURCE=api
// (WEB_URL, default :5190). Run from the repository root:
//   SEED_DEMO_PASSWORD="$(grep -E '^SEED_DEMO_PASSWORD=' api-qltn/.env | cut -d= -f2-)" \
//     node docs/product/features/F-thu-chi-quy-khai-thac/supporting/f-s3-fund-check.mjs
// Adds one voucher "[TEST F3] …" waiting for approval. Passwords are never printed. CDP_PORT (default 9344).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { signInThroughForm, sleep, startBrowser } from '../../../../tools/cdp-browser.mjs';
import { apiCall } from '../../../../tools/seed-accounts.mjs';
import { expectOk, signInTokens } from '../../../../tools/repair-flow.mjs';

const WEB = process.env.WEB_URL ?? 'http://localhost:5190';
const PASSWORD = process.env.SEED_DEMO_PASSWORD;
const EVIDENCE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'evidence');
const PDF = Buffer.from('%PDF-1.4\n% chung tu F-S3\n', 'utf8');

if (!PASSWORD) throw new Error('SEED_DEMO_PASSWORD is not set');

const upload = async (token, fundId, purpose) => {
  const form = new FormData();
  form.set('subjectType', 'FUND');
  form.set('subjectId', fundId);
  form.set('purpose', purpose);
  form.set('file', new Blob([PDF], { type: 'application/pdf' }), `${purpose}.pdf`);
  const res = await fetch(`${WEB}/api/attachments`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
  if (res.status !== 201) throw new Error(`upload ${purpose} answered ${res.status}`);
  return (await res.json()).data.id;
};
const noOverflow = async (browser, name) => {
  const overflow = await browser.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth');
  console.log(`${name} horizontal overflow ${overflow}px`);
  if (overflow > 0) throw new Error(`${name} scrolls horizontally`);
};
const shot = async (browser, name, url, ready) => {
  await browser.navigate(url);
  await browser.waitFor(ready, name, 30000);
  await sleep(500);
  await browser.screenshot(name);
};

const browser = await startBrowser({ evidenceDir: EVIDENCE, port: Number(process.env.CDP_PORT ?? 9344) });
try {
  const tokens = await signInTokens(WEB, PASSWORD, ['ktoan-a', 'bqt', 'bql-a']);
  const ktoan = tokens['ktoan-a'];
  const [fund] = expectOk(await apiCall(WEB, 'GET', '/funds', { token: ktoan }), 'funds');
  const month = fund.openingDate.slice(0, 7);
  const page = expectOk(await apiCall(WEB, 'GET', `/funds/${fund.id}/ledger?month=${month}`, { token: ktoan }), 'ledger');
  console.log(`AC-F3.17 ${month}: ${JSON.stringify(page.figures)}`);
  if (page.figures.closingVnd !== '60000000') throw new Error('the seeded month does not close at 60 tr');
  const contracts = expectOk(await apiCall(WEB, 'GET', '/exploitation/contracts', { token: ktoan }), 'contracts');
  const hd = contracts.rows.find((row) => row.code === 'HĐ-001');
  const bqlFund = await apiCall(WEB, 'GET', '/funds', { token: tokens['bql-a'] });
  console.log(`AC-F3.16 BQL reads funds: ${bqlFund.status}`);

  // A voucher waiting for BQT.
  let voucher = expectOk(
    await apiCall(WEB, 'POST', `/funds/${fund.id}/vouchers`, {
      token: ktoan,
      body: {
        category: 'SERVICE',
        content: '[TEST F3] Chi bảo dưỡng màn hình quảng cáo sảnh',
        payeeName: 'Công ty Kỹ thuật Ánh Dương',
        payeeAccount: '0451 0000 7788',
        amountVnd: '1500000',
        requestAttachmentId: await upload(ktoan, fund.id, 'VOUCHER_REQUEST'),
      },
    }),
    'voucher',
  );
  voucher = expectOk(await apiCall(WEB, 'POST', `/funds/vouchers/${voucher.id}/submit`, { token: ktoan, body: { version: voucher.version } }), 'submit');

  await signInThroughForm(browser, WEB, 'ktoan-a', PASSWORD);
  await shot(browser, 'F3-1-ledger-month', `${WEB}/exploitation/fund?month=${month}`, `document.querySelector('tfoot')?.textContent.includes('60.000.000')`);
  await shot(browser, 'F3-2-contract-receipts', `${WEB}/exploitation/contracts/${hd.id}?tab=receipts`, `document.querySelector('section[aria-label="Khoản thu tiếp theo"]') !== null && document.body.innerText.includes('PT-002')`);
  await browser.clickButton('Ghi nhận khoản thu');
  await browser.waitFor(`document.querySelector('#pt-amount') !== null`, 'receipt dialog');
  await browser.evaluate(`(() => {
    const input = document.querySelector('#pt-amount');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, '25.000.000');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await browser.waitFor(`document.body.innerText.includes('Đã phân bổ 25.000.000')`, 'allocation');
  await sleep(400);
  await browser.screenshot('F3-3-receipt-allocation');
  await browser.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await shot(browser, 'F3-4-tax-month', `${WEB}/exploitation/tax?month=${month}`, `document.body.innerText.includes('Đã nộp đủ') && document.body.innerText.includes('GNT-001')`);

  await signInThroughForm(browser, WEB, 'bqt', PASSWORD);
  await shot(browser, 'F3-5-bqt-voucher-pending', `${WEB}/exploitation/vouchers/${voucher.id}`, `document.body.innerText.includes('Chờ duyệt') && document.body.innerText.includes('Yêu cầu sửa')`);
  const buildingB = expectOk(await apiCall(WEB, 'GET', '/funds', { token: tokens.bqt }), 'bqt funds').find((row) => !row.openingDate);
  if (buildingB)
    await shot(browser, 'F3-6-bqt-fund-not-set', `${WEB}/exploitation/fund?building=${buildingB.buildingId}`, `document.body.innerText.includes('Kế toán chưa thiết lập quỹ khai thác')`);

  await signInThroughForm(browser, WEB, 'bql-a', PASSWORD);
  const menu = await browser.evaluate(`[...document.querySelectorAll('nav a')].map((a) => a.textContent.trim())`);
  console.log(`BQL menu: Sổ quỹ=${menu.includes('Sổ quỹ')}, Hợp đồng khai thác=${menu.includes('Hợp đồng khai thác')}`);
  await shot(browser, 'F3-7-bql-contract-receipts', `${WEB}/exploitation/contracts/${hd.id}?tab=receipts`, `document.querySelector('section[aria-label="Khoản thu tiếp theo"]') !== null`);
  const writes = await browser.evaluate(`['Ghi nhận khoản thu', 'Nhận cọc'].filter((name) => [...document.querySelectorAll('button')].some((b) => b.textContent.trim() === name))`);
  console.log(`BQL write buttons on Khoản thu: ${JSON.stringify(writes)}`);
  if (writes.length) throw new Error('BQL has write buttons');
  await shot(browser, 'F3-8-bql-ledger-403', `${WEB}/exploitation/fund`, `document.body.innerText.includes('Bạn không có quyền xem sổ quỹ.')`);

  await signInThroughForm(browser, WEB, 'ktoan-a', PASSWORD);
  await browser.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 2, mobile: true });
  for (const [name, url, ready] of [
    ['F3-9-ledger-375', `${WEB}/exploitation/fund?month=${month}`, `document.body.innerText.includes('PC-001')`],
    ['F3-10-receipts-375', `${WEB}/exploitation/contracts/${hd.id}?tab=receipts`, `document.querySelector('section[aria-label="Khoản thu tiếp theo"]') !== null`],
  ]) {
    await shot(browser, name, url, ready);
    await noOverflow(browser, name);
  }
  console.log('F-S3 fund flow: PASS');
} catch (error) {
  await browser.screenshot('F3-failed').catch(() => undefined);
  throw error;
} finally {
  await browser.close();
}
