// F-S5 evidence in a real browser (headless Chrome), api mode, demo accounts: tòa A's seeded D1 month on the report
// (theo sao kê, 50 + 15 − 5 = 60, 5 tr còn phải thu kept apart) in light and dark, the A4 print (PNG and PDF), BQL's
// 403 and missing menu entry, the seeded TL-001 on HĐ-001 "Chưa thể đóng", then, once 5 tr is collected, "Đủ điều
// kiện", the close confirmation and the closed read-only tab; 375px for the report and the tab.
//
// Prerequisites: api-qltn with migration 2026-10-28b and the demo seed on a fresh database (the run closes TL-001),
// web dev server with VITE_DATA_SOURCE=api (WEB_URL, default :5190). Run from the repository root:
//   SEED_DEMO_PASSWORD="$(grep -E '^SEED_DEMO_PASSWORD=' api-qltn/.env | cut -d= -f2-)" \
//     node docs/product/features/F-bao-cao-thanh-ly/supporting/f-s5-report-termination-check.mjs
// Passwords are never printed. CDP_PORT (default 9344).
import { writeFile } from 'node:fs/promises';
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
  await sleep(600);
  await browser.screenshot(name);
};
const noOverflow = async (browser, name) => {
  const overflow = await browser.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth');
  console.log(`${name} horizontal overflow ${overflow}px`);
  if (overflow > 0) throw new Error(`${name} scrolls horizontally`);
};
const text = (needle) => `document.body.innerText.includes(${JSON.stringify(needle)})`;

const browser = await startBrowser({ evidenceDir: EVIDENCE, port: Number(process.env.CDP_PORT ?? 9344) });
try {
  const tokens = await signInTokens(WEB, PASSWORD, ['ktoan-a', 'bqt', 'bql-a']);
  const ktoan = tokens['ktoan-a'];
  const [fund] = expectOk(await apiCall(WEB, 'GET', '/funds', { token: ktoan }), 'funds');
  const seeded = fund.openingDate.slice(0, 7);
  const query = `fundId=${fund.id}&kind=MONTH&value=${seeded}`;
  const report = expectOk(await apiCall(WEB, 'GET', `/exploitation/report?${query}`, { token: ktoan }), 'report');
  const f = report.figures;
  console.log(`AC-F5.1 ${seeded}: ${report.source} · ${f.openingVnd} + ${f.inVnd} − ${f.outVnd} = ${f.closingVnd} · còn phải thu ${report.outstandingVnd}`);
  if (report.source !== 'STATEMENT') throw new Error('the seeded month is not reported by the statement');
  const bqlReport = await apiCall(WEB, 'GET', `/exploitation/report?${query}`, { token: tokens['bql-a'] });
  console.log(`AC-F5.6 BQL reads the report: ${bqlReport.status}`);
  const contracts = expectOk(await apiCall(WEB, 'GET', '/exploitation/contracts', { token: tokens['bql-a'] }), 'contracts').rows;
  const hd = contracts.find((row) => row.code === 'HĐ-001');
  const tab = `${WEB}/exploitation/contracts/${hd.id}?tab=termination`;
  const reportUrl = `${WEB}/exploitation/report?building=${fund.buildingId}&kind=MONTH&value=${seeded}`;

  await signInThroughForm(browser, WEB, 'ktoan-a', PASSWORD);
  await shot(browser, 'F5-1-report-light', reportUrl, `${text('Theo sao kê')} && ${text('50 + 15 − 5 = 60')}`);
  await browser.evaluate(`localStorage.setItem('qltn-demo-theme', 'dark'), true`);
  await shot(browser, 'F5-2-report-dark', reportUrl, `${text('Theo sao kê')} && ${text('50 + 15 − 5 = 60')}`);
  await browser.evaluate(`localStorage.setItem('qltn-demo-theme', 'light'), true`);
  await shot(
    browser,
    'F5-3-print',
    `${WEB}/exploitation/report/print?building=${fund.buildingId}&kind=MONTH&value=${seeded}`,
    `${text('Người lập')} && ${text('Theo sao kê')}`,
  );
  const { data } = await browser.send('Page.printToPDF', { preferCSSPageSize: true, printBackground: true });
  await writeFile(path.join(EVIDENCE, 'F5-3-print.pdf'), Buffer.from(data, 'base64'));
  console.log('pdf docs/product/features/F-bao-cao-thanh-ly/supporting/evidence/F5-3-print.pdf');
  await browser.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 2, mobile: true });
  await shot(browser, 'F5-4-report-375', reportUrl, text('Theo sao kê'));
  await noOverflow(browser, 'F5-4-report-375');
  // Below 640px the waterfall is a 4-row table with small bars (ui-brief §3).
  await browser.evaluate(`document.querySelector('main table')?.scrollIntoView({ block: 'center' }), true`);
  await sleep(400);
  await browser.screenshot('F5-4b-report-375-table');
  await browser.send('Emulation.clearDeviceMetricsOverride');

  await signInThroughForm(browser, WEB, 'bql-a', PASSWORD);
  const menu = await browser.evaluate(`[...document.querySelectorAll('nav a')].map((a) => a.textContent.trim())`);
  console.log(`BQL menu: Báo cáo thu chi=${menu.includes('Báo cáo thu chi')}`);
  if (menu.includes('Báo cáo thu chi')) throw new Error('BQL sees the report entry');
  await shot(browser, 'F5-5-tab-not-closable', tab, `${text('Chưa thể đóng')} && ${text('Còn 5.000.000 đ')}`);

  // Kế toán collects the 5 tr still owed (a receipt with its proof): every condition then holds.
  const form = new FormData();
  form.set('subjectType', 'FUND');
  form.set('subjectId', fund.id);
  form.set('purpose', 'RECEIPT_PROOF');
  form.set('file', new Blob([Buffer.from('%PDF-1.4\n% F-S5 evidence\n')], { type: 'application/pdf' }), 'giay-bao-co.pdf');
  const uploaded = await fetch(`${WEB}/api/attachments`, { method: 'POST', headers: { Authorization: `Bearer ${ktoan}` }, body: form });
  const proof = (await uploaded.json()).data;
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
  const paid = await apiCall(WEB, 'POST', `/exploitation/contracts/${hd.id}/receipts`, {
    token: ktoan,
    body: { receivedOn: today, amountVnd: '5000000', attachmentId: proof.id },
  });
  console.log(`receipt 5 tr on HĐ-001: ${paid.status}`);
  await shot(browser, 'F5-6-tab-closable', tab, text('Đủ điều kiện đóng'));
  await browser.clickButton('Đóng hồ sơ');
  await browser.waitFor(`document.querySelector('[role=dialog]') && ${text('không mở lại được')}`, 'close confirmation');
  await sleep(400);
  await browser.screenshot('F5-7-close-confirm');
  await browser.clickButton('Đóng hồ sơ', `document.querySelector('[role=dialog]')`);
  await browser.waitFor(`${text('Đã đóng hồ sơ')} && !document.querySelector('[role=dialog]')`, 'closed');
  await sleep(600);
  await browser.screenshot('F5-8-tab-closed');
  const writes = await browser.evaluate(
    `['Đóng hồ sơ', 'Ghi bàn giao', 'Tải biên bản', 'Hủy hồ sơ thanh lý'].filter((name) => [...document.querySelectorAll('button')].some((b) => b.textContent.trim() === name && !b.disabled))`,
  );
  console.log(`closed tab enabled write buttons: ${JSON.stringify(writes)}`);
  if (writes.length) throw new Error('the closed file still has write buttons');

  await browser.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 2, mobile: true });
  await shot(browser, 'F5-9-tab-375', tab, text('Đã thanh lý ngày'));
  await noOverflow(browser, 'F5-9-tab-375');
  console.log('F-S5 report and termination flow: PASS');
} catch (error) {
  await browser.screenshot('F5-failed').catch(() => undefined);
  throw error;
} finally {
  await browser.close();
}
