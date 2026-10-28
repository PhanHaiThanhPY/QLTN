// RM-S2 evidence in a real browser (headless Chrome), api mode: admin-demo's menu with every group, the fund ledger
// (account masked, "chỉ xem" line once), HĐ-001 and MT-001 without action buttons, the fund report.
//
// Prerequisites: api-qltn with the demo seed, web dev server with VITE_DATA_SOURCE=api (WEB_URL, default :5190). Run
// from the repository root:
//   SEED_DEMO_PASSWORD="$(grep -E '^SEED_DEMO_PASSWORD=' api-qltn/.env | cut -d= -f2-)" \
//     node docs/product/features/RM-admin-xem-toan-bo/supporting/rm-s2-admin-view-check.mjs
// Read only; passwords are never printed. CDP_PORT (default 9344).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { signInThroughForm, sleep, startBrowser } from '../../../../tools/cdp-browser.mjs';
import { apiCall } from '../../../../tools/seed-accounts.mjs';
import { expectOk, signInTokens } from '../../../../tools/repair-flow.mjs';

const WEB = process.env.WEB_URL ?? 'http://localhost:5190';
const PASSWORD = process.env.SEED_DEMO_PASSWORD;
const EVIDENCE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'evidence');
const NOTE = 'Bạn đang xem với quyền Quản trị — chỉ xem.';
const WRITES = [
  'Ghi nhận khoản thu',
  'Nhận cọc',
  'Phụ lục sửa đổi',
  'Lập phiếu chi',
  'Ghi nhận thuế',
  'Nhập sao kê',
  'Thiết lập quỹ',
  'Lập gói',
  'Phát hành',
  'Duyệt',
  'Lập thư mời',
  'Lập hồ sơ thanh lý',
];

if (!PASSWORD) throw new Error('SEED_DEMO_PASSWORD is not set');

const text = (needle) => `document.body.innerText.includes(${JSON.stringify(needle)})`;
const shot = async (browser, name, url, ready) => {
  await browser.navigate(url);
  await browser.waitFor(ready, name, 30000);
  await sleep(700);
  await browser.screenshot(name);
};
const audit = async (browser, name) => {
  const found = await browser.evaluate(
    `${JSON.stringify(WRITES)}.filter((label) => [...document.querySelectorAll('button')].some((b) => b.textContent.trim().startsWith(label) && b.offsetParent !== null))`,
  );
  const notes = await browser.evaluate(`[...document.querySelectorAll('*')].filter((el) => el.childElementCount === 0 && el.textContent.trim() === ${JSON.stringify(NOTE)}).length`);
  console.log(`${name}: action buttons ${JSON.stringify(found)}, "chỉ xem" lines ${notes}`);
  if (found.length) throw new Error(`${name} shows action buttons to ADMIN`);
  if (notes !== 1) throw new Error(`${name} shows the "chỉ xem" line ${notes} times`);
};

const browser = await startBrowser({ evidenceDir: EVIDENCE, port: Number(process.env.CDP_PORT ?? 9344) });
try {
  const { 'admin-demo': admin } = await signInTokens(WEB, PASSWORD, ['admin-demo']);
  const funds = expectOk(await apiCall(WEB, 'GET', '/funds', { token: admin }), 'funds');
  const fund = funds.find((row) => row.openingDate) ?? funds[0];
  console.log(`AC-RM2.4 ADMIN fund account: accountNo=${fund.accountNo} masked=${fund.accountMasked}`);
  if (fund.accountNo !== null) throw new Error('ADMIN sees the full account number');
  const month = fund.openingDate.slice(0, 7);
  const contracts = expectOk(await apiCall(WEB, 'GET', '/exploitation/contracts', { token: admin }), 'contracts').rows;
  const hd001 = contracts.find((row) => row.code === 'HĐ-001');
  const packages = expectOk(await apiCall(WEB, 'GET', '/exploitation/packages', { token: admin }), 'packages');
  const mt001 = packages.find((row) => row.code === 'MT-001');

  await signInThroughForm(browser, WEB, 'admin-demo', PASSWORD);
  await browser.waitFor(`[...document.querySelectorAll('nav a')].some((a) => a.textContent.trim() === 'Nhân viên')`, 'menu loaded', 30000);
  const menu = await browser.evaluate(`[...document.querySelectorAll('nav a')].map((a) => a.textContent.trim())`);
  const expected = ['Hồ sơ sửa chữa', 'Kế hoạch bảo trì', 'Mời thầu khai thác', 'Hợp đồng khai thác', 'Sổ quỹ', 'Thuế', 'Phiếu chi', 'Sao kê và đối soát', 'Báo cáo thu chi', 'Thư mời chào lãi', 'Ngân hàng', 'Nhật ký thao tác', 'Nhân viên'];
  const missing = expected.filter((label) => !menu.includes(label));
  console.log(`AC-RM2.1 ADMIN menu missing: ${JSON.stringify(missing)}`);
  if (missing.length) throw new Error('ADMIN menu misses entries');
  await shot(browser, 'RM2-1-menu-and-ledger', `${WEB}/exploitation/fund?building=${fund.buildingId}&month=${month}`, `${text('****')} && ${text(NOTE)}`);
  await audit(browser, 'ledger');
  await shot(browser, 'RM2-2-contract-hd001', `${WEB}/exploitation/contracts/${hd001.id}?tab=receipts`, `${text('HĐ-001')} && ${text(NOTE)}`);
  await audit(browser, 'HĐ-001');
  await shot(browser, 'RM2-3-package-mt001', `${WEB}/exploitation/packages/${mt001.id}`, `${text('MT-001')} && ${text(NOTE)}`);
  await audit(browser, 'MT-001');
  await shot(browser, 'RM2-4-report', `${WEB}/exploitation/report?building=${fund.buildingId}&kind=MONTH&value=${month}`, `${text('Theo sao kê')} && ${text(NOTE)}`);
  await shot(browser, 'RM2-5-settings-no-note', `${WEB}/settings/buildings`, `!${text(NOTE)} && ${text('Tòa')}`);
  console.log('RM-S2 admin view flow: PASS');
} catch (error) {
  await browser.screenshot('RM2-failed').catch(() => undefined);
  throw error;
} finally {
  await browser.close();
}
