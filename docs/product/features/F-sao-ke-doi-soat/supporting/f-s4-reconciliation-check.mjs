// F-S4 evidence in a real browser (headless Chrome), api mode, demo accounts: tòa A's seeded D1 month reconciled
// (4/4 khớp, chênh lệch 0, lệch/trùng 0/0), a month with an open bank line (a statement of this month with an SMS fee
// not yet recorded), the import dialog refusing a decimal amount by line, BQT's read-only view, BQL's 403, and 375px.
//
// Prerequisites: api-qltn with migration 2026-10-28a and the demo seed, web dev server with VITE_DATA_SOURCE=api
// (WEB_URL, default :5190). Run from the repository root:
//   SEED_DEMO_PASSWORD="$(grep -E '^SEED_DEMO_PASSWORD=' api-qltn/.env | cut -d= -f2-)" \
//     node docs/product/features/F-sao-ke-doi-soat/supporting/f-s4-reconciliation-check.mjs
// Imports one statement of the current month on tòa A (once; a second run finds its lines as duplicates). Passwords
// are never printed. CDP_PORT (default 9344).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { signInThroughForm, sleep, startBrowser } from '../../../../tools/cdp-browser.mjs';
import { apiCall } from '../../../../tools/seed-accounts.mjs';
import { expectOk, signInTokens } from '../../../../tools/repair-flow.mjs';

const WEB = process.env.WEB_URL ?? 'http://localhost:5190';
const PASSWORD = process.env.SEED_DEMO_PASSWORD;
const EVIDENCE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'evidence');

if (!PASSWORD) throw new Error('SEED_DEMO_PASSWORD is not set');

const shot = async (browser, name, url, ready) => {
  await browser.navigate(url);
  await browser.waitFor(ready, name, 30000);
  await sleep(500);
  await browser.screenshot(name);
};
const setInput = (selector, value) => `(() => {
  const input = document.querySelector(${JSON.stringify(selector)});
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  setter.call(input, ${JSON.stringify(value)});
  input.dispatchEvent(new Event('input', { bubbles: true }));
})()`;

const browser = await startBrowser({ evidenceDir: EVIDENCE, port: Number(process.env.CDP_PORT ?? 9344) });
try {
  const tokens = await signInTokens(WEB, PASSWORD, ['ktoan-a', 'bqt', 'bql-a']);
  const ktoan = tokens['ktoan-a'];
  const [fund] = expectOk(await apiCall(WEB, 'GET', '/funds', { token: ktoan }), 'funds');
  const seeded = fund.openingDate.slice(0, 7);
  const view = expectOk(await apiCall(WEB, 'GET', `/funds/${fund.id}/reconciliation?month=${seeded}`, { token: ktoan }), 'month');
  console.log(`AC-F4.16 ${seeded}: ${view.counts.matched}/${view.counts.lines} khớp, chênh lệch ${view.differenceVnd}, lệch/trùng ${view.counts.gaps}/${view.counts.duplicates}`);
  if (!view.matchedMonth) throw new Error('the seeded month is not reconciled');
  const bql = await apiCall(WEB, 'GET', `/funds/${fund.id}/reconciliation?month=${seeded}`, { token: tokens['bql-a'] });
  console.log(`AC-F4.15 BQL reads reconciliation: ${bql.status}`);

  // This month: the bank took an SMS fee nobody has recorded yet (one open bank line, a difference of 11.000 đ).
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
  const current = today.slice(0, 7);
  const ledgerNow = expectOk(await apiCall(WEB, 'GET', `/funds/${fund.id}/ledger?month=${current}`, { token: ktoan }), 'ledger');
  const opening = ledgerNow.figures.openingVnd;
  const day = `05/${current.slice(5)}/${current.slice(0, 4)}`;
  const form = new FormData();
  form.set('periodFrom', `${current}-01`);
  form.set('periodTo', today);
  form.set('openingBalanceVnd', opening);
  form.set('closingBalanceVnd', String(BigInt(opening) - 11000n));
  form.set('lines', JSON.stringify([{ date: day, debit: '11000', description: 'Phi SMS Banking', reference: `SMS${current.replace('-', '')}` }]));
  const res = await fetch(`${WEB}/api/funds/${fund.id}/statements`, { method: 'POST', headers: { Authorization: `Bearer ${ktoan}` }, body: form });
  console.log(`current-month statement: ${res.status}`);

  await signInThroughForm(browser, WEB, 'ktoan-a', PASSWORD);
  await shot(browser, 'F4-1-month-reconciled', `${WEB}/exploitation/reconciliation?month=${seeded}`, `document.body.innerText.includes('Đã khớp') && document.body.innerText.includes('Lệch/trùng 0/0')`);
  await shot(browser, 'F4-2-month-open-line', `${WEB}/exploitation/reconciliation?month=${current}`, `document.body.innerText.includes('Còn lệch') && document.body.innerText.includes('Phi SMS')`);
  await shot(browser, 'F4-3-ledger-flags', `${WEB}/exploitation/fund?month=${seeded}`, `document.body.innerText.includes('Đã đối soát · GD-001')`);

  // The import dialog refusing a decimal amount by line (typed lines, so no file picker is needed).
  await browser.navigate(`${WEB}/exploitation/reconciliation?month=${seeded}`);
  await browser.waitFor(`document.body.innerText.includes('Đã khớp')`, 'page');
  await browser.clickButton('Nhập sao kê');
  await browser.waitFor(`document.querySelector('#st-opening') !== null`, 'import dialog');
  await browser.evaluate(`[...document.querySelectorAll('[role=radio]')].find((b) => b.textContent.trim() === 'Nhập tay').click()`);
  await browser.waitFor(`document.querySelector('[aria-label="Dòng 1: Ghi nợ"]') !== null`, 'manual editor');
  await browser.evaluate(setInput('#st-opening', '60000000'));
  await browser.evaluate(setInput('#st-closing', '58000000'));
  await browser.evaluate(setInput('[aria-label="Dòng 1: Ngày (dd/mm/yyyy)"]', `22/${seeded.slice(5)}/${seeded.slice(0, 4)}`));
  await browser.evaluate(setInput('[aria-label="Dòng 1: Ghi nợ"]', '2.000.000,50'));
  await browser.evaluate(setInput('[aria-label="Dòng 1: Nội dung"]', 'Nop thue'));
  await sleep(300);
  await browser.clickButton('Xem trước');
  await browser.waitFor(`document.body.innerText.includes('Dòng 2: Ghi nợ có phần thập phân.')`, 'preview errors');
  await sleep(400);
  await browser.screenshot('F4-4-import-error');
  await browser.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });

  await signInThroughForm(browser, WEB, 'bqt', PASSWORD);
  await shot(browser, 'F4-5-bqt-readonly', `${WEB}/exploitation/reconciliation?building=${fund.buildingId}&month=${current}`, `document.body.innerText.includes('Phi SMS')`);
  const writes = await browser.evaluate(`['Nhập sao kê', 'Ghép…', 'Xác nhận tất cả đề xuất'].filter((name) => [...document.querySelectorAll('button')].some((b) => b.textContent.trim().startsWith(name)))`);
  console.log(`BQT write buttons: ${JSON.stringify(writes)}`);
  if (writes.length) throw new Error('BQT has write buttons');

  await signInThroughForm(browser, WEB, 'bql-a', PASSWORD);
  const menu = await browser.evaluate(`[...document.querySelectorAll('nav a')].map((a) => a.textContent.trim())`);
  console.log(`BQL menu: Sao kê và đối soát=${menu.includes('Sao kê và đối soát')}`);
  await shot(browser, 'F4-6-bql-403', `${WEB}/exploitation/reconciliation`, `document.body.innerText.includes('Bạn không có quyền xem')`);

  await signInThroughForm(browser, WEB, 'ktoan-a', PASSWORD);
  await browser.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 2, mobile: true });
  for (const [name, month] of [
    ['F4-7-reconciled-375', seeded],
    ['F4-8-open-line-375', current],
  ]) {
    await shot(browser, name, `${WEB}/exploitation/reconciliation?month=${month}`, `document.body.innerText.includes('Lệch/trùng')`);
    const overflow = await browser.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth');
    console.log(`${name} horizontal overflow ${overflow}px`);
    if (overflow > 0) throw new Error(`${name} scrolls horizontally`);
  }
  console.log('F-S4 reconciliation flow: PASS');
} catch (error) {
  await browser.screenshot('F4-failed').catch(() => undefined);
  throw error;
} finally {
  await browser.close();
}
