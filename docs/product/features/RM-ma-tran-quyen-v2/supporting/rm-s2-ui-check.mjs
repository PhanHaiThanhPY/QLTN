// AC-2.9 evidence for RM-S2: ADMIN applies the AQUA template to building A in the web (api mode), BQL creates and
// submits a record without choosing a confirmer, TVKT finds it and confirms it. Building A goes back to the STANDARD
// template at the end, even on failure.
//
// Prerequisites: api-qltn on :5300 with demo seed, web dev server on :5190 started with VITE_DATA_SOURCE=api.
// Run from the repository root:
//   SEED_DEMO_PASSWORD="$(grep -E '^SEED_DEMO_PASSWORD=' api-qltn/.env | cut -d= -f2-)" \
//     node docs/product/features/RM-ma-tran-quyen-v2/supporting/rm-s2-ui-check.mjs
// Passwords are never printed.
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import { signInThroughForm, sleep, startBrowser } from '../../../../tools/cdp-browser.mjs';
import { apiCall, loginWithRetry } from '../../../../tools/seed-accounts.mjs';

const WEB = process.env.WEB_URL ?? 'http://localhost:5190';
const PASSWORD = process.env.SEED_DEMO_PASSWORD;
const EVIDENCE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'evidence');
const RUN = new Date().toISOString().replace(/[-:]/g, '').slice(0, 13);
const TITLE = `[TEST RM-S2 UI] Thấm trần sảnh ${RUN}`;
const NOTE = 'TVKT đã kiểm tra hiện trường, cần sửa chống thấm.';
const AQUA_OPTION = 'Mẫu: Aqua – theo quy trình Ban quản trị';

if (!PASSWORD) throw new Error('SEED_DEMO_PASSWORD is not set');

/** 16x16 PNG built in memory (passes the API magic-byte check). */
const pngFile = () => {
  const table = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const byte of buf) c = table[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, sum]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(16, 0);
  header.writeUInt32BE(16, 4);
  header.set([8, 2, 0, 0, 0], 8);
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(48, 0x5a)]);
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.concat(Array.from({ length: 16 }, () => row)))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  const file = path.join(mkdtempSync(path.join(tmpdir(), 'rm-s2-ui-')), 'hien-truong.png');
  writeFileSync(file, png);
  return file;
};

/** Puts building A back on the STANDARD template through the API as admin-demo. */
const restoreStandard = async () => {
  const admin = await loginWithRetry(WEB, 'admin-demo', PASSWORD);
  const token = admin.body.data.accessToken;
  const buildings = await apiCall(WEB, 'GET', '/buildings', { token });
  const a = buildings.body.data.find((row) => row.code === 'A');
  const config = await apiCall(WEB, 'GET', `/buildings/${a.id}/config`, { token });
  const res = await apiCall(WEB, 'POST', `/buildings/${a.id}/config/apply-template`, {
    token,
    body: { templateKey: 'STANDARD', version: config.body.data.version },
  });
  console.log(`building A back on STANDARD: ${res.status}`);
};

const browser = await startBrowser({ evidenceDir: EVIDENCE });
try {
  // 1. ADMIN applies AQUA to building A from "Tòa nhà và cấu hình".
  await signInThroughForm(browser, WEB, 'admin-demo', PASSWORD);
  await browser.navigate(`${WEB}/settings/buildings`);
  await browser.waitFor(`[...document.querySelectorAll('tr')].some((tr) => tr.textContent.includes('Tòa A'))`, 'building list', 60000);
  await browser.realClick(
    `[...[...document.querySelectorAll('tr')].find((tr) => tr.textContent.includes('Tòa A')).querySelectorAll('button')].find((b) => b.textContent.trim() === 'Chi tiết')`,
    'detail of building A',
  );
  await browser.waitFor(`[...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Áp dụng cấu hình mẫu')`, 'apply template button', 60000);
  // Opening the detail changes ?b= and reloads the settings once; wait until the dialog has settled.
  await browser.waitFor(`location.search.includes('b=') && document.body.innerText.includes('Chi tiết Tòa A')`, 'detail dialog', 30000);
  await sleep(1500);
  await browser.waitFor(`document.body.innerText.includes('Chi tiết Tòa A')`, 'detail dialog after reload', 30000);
  // A plain button deep inside the scrolling detail dialog: a DOM click is the reliable path here.
  await browser.evaluate(
    `[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Áp dụng cấu hình mẫu').click(), true`,
  );
  await browser.waitFor(`document.querySelector('#tpl-source')`, 'template dialog');
  await sleep(500);
  await browser.realClick(`document.querySelector('#tpl-source')`, 'template select');
  await browser.waitFor(`[...document.querySelectorAll('[role=option]')].some((o) => o.textContent.includes(${JSON.stringify(AQUA_OPTION)}))`, 'AQUA option');
  await browser.realClick(
    `[...document.querySelectorAll('[role=option]')].find((o) => o.textContent.includes(${JSON.stringify(AQUA_OPTION)}))`,
    'AQUA option',
  );
  await browser.waitFor(`document.querySelector('#tpl-source').textContent.includes('Aqua')`, 'AQUA chosen');
  await browser.screenshot('RM2-1-admin-apply-aqua');
  await browser.realClick(
    `[...[...document.querySelectorAll('[role=dialog]')].at(-1).querySelectorAll('button')].find((b) => /^Áp dụng \\d/.test(b.textContent.trim()) && !b.disabled)`,
    'apply button',
  );
  await browser.waitFor(`!document.querySelector('#tpl-source')`, 'dialog closed', 30000);
  console.log('ADMIN applied AQUA to building A');

  // 2. BQL creates and submits a record, leaving the confirmer on "Theo cấu hình tòa".
  await signInThroughForm(browser, WEB, 'bql-a', PASSWORD);
  await browser.navigate(`${WEB}/records/new`);
  await browser.waitFor(`document.querySelector('#rf-title') && document.querySelector('#rf-location')`, 'record form', 60000);
  await browser.realClick(`document.querySelector('#rf-location')`, 'location select');
  await browser.waitFor(`document.querySelectorAll('[role=option]').length > 1`, 'location options');
  await browser.realClick(`[...document.querySelectorAll('[role=option]')].find((o) => !o.textContent.includes('Chọn vị trí'))`, 'first location');
  await browser.evaluate(`(() => { const box = document.querySelector('#rf-no-item'); if (box && !box.checked) box.click(); return true; })()`);
  await browser.setField('#rf-title', TITLE);
  await browser.setField('#rf-description', 'Nước thấm từ trần sảnh tầng trệt, cần người xác nhận theo cấu hình Aqua.');
  const { root } = await browser.send('DOM.getDocument', { depth: -1 });
  const { nodeId } = await browser.send('DOM.querySelector', { nodeId: root.nodeId, selector: 'input[type=file]' });
  await browser.send('DOM.setFileInputFiles', { nodeId, files: [pngFile()] });
  await browser.waitFor(`document.querySelector('#rf-confirmationUserId')?.textContent.includes('Theo cấu hình tòa')`, 'confirmer left on configuration');
  await browser.screenshot('RM2-2-bql-form-confirmer-auto');
  await browser.clickButton('Gửi xác nhận');
  await browser.waitFor(`/^\\/records\\/[0-9a-f-]{36}$/.test(location.pathname)`, 'record detail', 30000);
  await browser.waitFor(`document.body.innerText.includes('Chờ xác nhận') && document.body.innerText.includes('Võ Thanh Tâm')`, 'TVKT assigned');
  const recordPath = await browser.evaluate('location.pathname');
  console.log(`BQL submitted ${recordPath}; confirmer is TVKT`);
  await browser.screenshot('RM2-3-bql-submitted-tvkt-assigned');

  // 3. TVKT finds the record in the list and confirms it.
  await signInThroughForm(browser, WEB, 'tvkt', PASSWORD);
  await browser.navigate(`${WEB}/records`);
  await browser.waitFor(`document.body.innerText.includes(${JSON.stringify(TITLE)})`, 'record in TVKT list', 30000);
  await browser.screenshot('RM2-4-tvkt-list');
  await browser.navigate(`${WEB}${recordPath}`);
  await browser.waitFor(`[...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Xác nhận cần sửa' && !b.disabled)`, 'confirm button', 30000);
  await browser.clickButton('Xác nhận cần sửa');
  await browser.waitFor(`document.querySelector('#reason-text')`, 'confirm dialog');
  await browser.setField('#reason-text', NOTE);
  await browser.clickButton('Xác nhận cần sửa', `document.querySelector('[role=dialog]')`);
  await browser.waitFor(`document.body.innerText.includes('Chờ lập tờ trình') && document.body.innerText.includes(${JSON.stringify(NOTE)})`, 'confirmed by TVKT', 30000);
  await browser.screenshot('RM2-5-tvkt-confirmed');
  console.log('AC-2.9 RM-S2 UI flow: PASS');
} catch (error) {
  await browser.screenshot('RM2-failed').catch(() => undefined);
  console.error(await browser.evaluate('location.pathname + "\\n" + document.body.innerText.slice(0, 600)').catch(() => ''));
  throw error;
} finally {
  await browser.close();
  await restoreStandard();
}
