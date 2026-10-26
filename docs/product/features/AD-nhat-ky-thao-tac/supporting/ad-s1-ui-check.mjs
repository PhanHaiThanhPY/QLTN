// AC-11 evidence for AD-S1: the operation log in the real web UI (api mode).
//
// Prerequisites: api-qltn on :5300 with demo seed and at least one "Xác nhận cần sửa" on building A in the last
// 7 days (any S1/S2 run makes one), web dev server started with VITE_DATA_SOURCE=api (WEB_URL, default :5190).
// Run from the repository root:
//   SEED_DEMO_PASSWORD="$(grep -E '^SEED_DEMO_PASSWORD=' api-qltn/.env | cut -d= -f2-)" \
//     node docs/product/features/AD-nhat-ky-thao-tac/supporting/ad-s1-ui-check.mjs
// Flow: ADMIN filters building A + "Hồ sơ sửa chữa" + "Xác nhận cần sửa", opens the record from the log, exports the CSV (checked for
// the BOM and the rows); BQL sees the menu entry but no system-wide row. Passwords are never printed.
import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { signInThroughForm, sleep, startBrowser } from '../../../../tools/cdp-browser.mjs';

const WEB = process.env.WEB_URL ?? 'http://localhost:5190';
const PASSWORD = process.env.SEED_DEMO_PASSWORD;
const EVIDENCE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'evidence');
const ACTION = 'Xác nhận cần sửa';

if (!PASSWORD) throw new Error('SEED_DEMO_PASSWORD is not set');

const browser = await startBrowser({ evidenceDir: EVIDENCE });

/** Picks an option of a Radix select (NativeSelect) by its visible text. */
const pickOption = async (triggerSelector, text) => {
  await sleep(300);
  await browser.realClick(`document.querySelector(${JSON.stringify(triggerSelector)})`, triggerSelector);
  await browser.waitFor(`[...document.querySelectorAll('[role=option]')].some((o) => o.textContent.includes(${JSON.stringify(text)}))`, `option ${text}`);
  await browser.realClick(`[...document.querySelectorAll('[role=option]')].find((o) => o.textContent.includes(${JSON.stringify(text)}))`, `option ${text}`);
  await browser.waitFor(`document.querySelector(${JSON.stringify(triggerSelector)}).textContent.includes(${JSON.stringify(text)})`, `${text} chosen`);
  // Let the closing popover release the page before the next control is clicked.
  await sleep(500);
};

const tableRows = `[...document.querySelectorAll('main table tbody tr')]`;

try {
  for (const name of readdirSync(EVIDENCE).filter((file) => file.startsWith('nhat-ky-thao-tac-'))) rmSync(path.join(EVIDENCE, name));
  await browser.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: EVIDENCE });

  // 1. ADMIN filters building A and "Xác nhận cần sửa".
  await signInThroughForm(browser, WEB, 'admin-demo', PASSWORD);
  await browser.navigate(`${WEB}/audit`);
  await browser.waitFor(`document.querySelector('#audit-building') && ${tableRows}.length > 0`, 'operation log', 60000);
  await pickOption('#audit-building', 'A –');
  await pickOption('#audit-subject', 'Hồ sơ sửa chữa');
  await pickOption('#audit-action', ACTION);
  await browser.waitFor(
    `${tableRows}.length > 0 && ${tableRows}.every((tr) => tr.textContent.includes(${JSON.stringify(ACTION)}) && tr.children[1].textContent.trim() === 'A')`,
    'filtered rows',
    30000,
  );
  await sleep(300);
  await browser.screenshot('AD-1-admin-filter-a-confirm-repair');
  console.log(await browser.evaluate(`${tableRows}.length + ' rows for building A + ${ACTION}'`));

  // 2. Open the record from the log.
  const code = await browser.evaluate(`${tableRows}[0].querySelector('a').textContent.trim()`);
  await browser.realClick(`${tableRows}[0].querySelector('a')`, 'record link');
  await browser.waitFor(`/^\\/records\\/[0-9a-f-]{36}$/.test(location.pathname) && document.body.innerText.includes(${JSON.stringify(code)})`, 'record detail', 30000);
  await browser.screenshot('AD-2-admin-opened-record');
  console.log(`opened ${code} from the log`);

  // 3. Export the CSV of the same filter and read it back.
  await browser.evaluate('history.back(), true');
  await browser.waitFor(`document.querySelector('#audit-building') && ${tableRows}.length > 0`, 'operation log again', 30000);
  await browser.clickButton('Xuất CSV');
  let file;
  for (let attempt = 0; attempt < 40 && !file; attempt += 1) {
    await sleep(250);
    file = readdirSync(EVIDENCE).find((name) => /^nhat-ky-thao-tac-\d{8}-\d{4}\.csv$/.test(name));
  }
  if (!file || !existsSync(path.join(EVIDENCE, file))) throw new Error('CSV was not downloaded');
  const bytes = readFileSync(path.join(EVIDENCE, file));
  const text = bytes.subarray(3).toString('utf8');
  const hasBom = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
  console.log(`CSV ${file}: BOM ${hasBom}, ${text.trimEnd().split('\r\n').length - 1} rows, header: ${text.split('\r\n')[0]}`);
  if (!hasBom || !text.includes(ACTION)) throw new Error('CSV content is not as expected');
  await browser.screenshot('AD-3-admin-exported');

  // 4. BQL sees the menu entry but no system-wide row.
  await signInThroughForm(browser, WEB, 'bql-a', PASSWORD);
  await browser.waitFor(`[...document.querySelectorAll('nav a')].some((a) => a.textContent.includes('Nhật ký thao tác'))`, 'BQL menu entry', 30000);
  await browser.navigate(`${WEB}/audit`);
  await browser.waitFor(`${tableRows}.length > 0`, 'BQL operation log', 60000);
  const globalRows = await browser.evaluate(`${tableRows}.filter((tr) => tr.children[1].textContent.includes('Toàn hệ thống')).length`);
  if (globalRows !== 0) throw new Error(`BQL sees ${globalRows} system-wide rows`);
  await browser.screenshot('AD-4-bql-no-system-rows');
  console.log('AC-11 AD-S1 UI flow: PASS');
} catch (error) {
  await browser.screenshot('AD-failed').catch(() => undefined);
  console.error(await browser.evaluate('location.pathname + "\\n" + document.body.innerText.slice(0, 800)').catch(() => ''));
  throw error;
} finally {
  await browser.close();
}
