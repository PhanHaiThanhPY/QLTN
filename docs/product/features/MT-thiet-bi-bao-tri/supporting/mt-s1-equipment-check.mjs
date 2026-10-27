// MT-S1 evidence in a real browser (headless Chrome), api mode, demo accounts: AC-MT.14 menu, the equipment list,
// the item page, the record form picking an item (AC-MT.9: location filled from the item), the record detail line
// linking the item, and the list and item page at 375px.
//
// Prerequisites: api-qltn with migration 2026-10-27c and demo seed, web dev server with VITE_DATA_SOURCE=api
// (WEB_URL, default :5190). Run from the repository root:
//   SEED_DEMO_PASSWORD="$(grep -E '^SEED_DEMO_PASSWORD=' api-qltn/.env | cut -d= -f2-)" \
//     node docs/product/features/MT-thiet-bi-bao-tri/supporting/mt-s1-equipment-check.mjs
// Reuses item BOM-A09 of building A when it exists (creates it otherwise) and adds one draft record
// "[TEST MT THIẾT BỊ] …" linked to it. Passwords are never printed. CDP_PORT (default 9344) keeps this browser apart
// from another seat's.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { signInThroughForm, sleep, startBrowser } from '../../../../tools/cdp-browser.mjs';
import { apiCall } from '../../../../tools/seed-accounts.mjs';
import { expectOk, signInTokens } from '../../../../tools/repair-flow.mjs';

const WEB = process.env.WEB_URL ?? 'http://localhost:5190';
const PASSWORD = process.env.SEED_DEMO_PASSWORD;
const EVIDENCE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'evidence');
const RUN = new Date().toISOString().replace(/[-:]/g, '').slice(0, 13);
const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const shiftDay = (date, days) => {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
};

if (!PASSWORD) throw new Error('SEED_DEMO_PASSWORD is not set');

const browser = await startBrowser({ evidenceDir: EVIDENCE, port: Number(process.env.CDP_PORT ?? 9344) });
try {
  const tokens = await signInTokens(WEB, PASSWORD, ['admin-demo', 'bql-a']);
  const bql = tokens['bql-a'];
  const buildingA = expectOk(await apiCall(WEB, 'GET', '/buildings', { token: tokens['admin-demo'] }), 'buildings').find((row) => row.code === 'A');
  const reference = expectOk(await apiCall(WEB, 'GET', '/reference', { token: bql }), 'reference');
  const pumpRoom = reference.locations.find((row) => row.buildingId === buildingA.id && row.name === 'Phòng bơm & bể nước ngầm');
  const owner = reference.users.find((row) => row.code === 'BQL-A');
  let item = reference.items.find((row) => row.buildingId === buildingA.id && row.code === 'BOM-A09');
  if (!item) {
    item = expectOk(
      await apiCall(WEB, 'POST', '/maintenance-items', {
        token: bql,
        body: {
          buildingId: buildingA.id,
          code: 'BOM-A09',
          name: 'Bơm tăng áp',
          type: 'Bơm nước',
          locationId: pumpRoom.id,
          ownerUserId: owner.id,
          model: 'Ebara CDX 120/12',
          supplier: 'Công ty CP Cơ điện Sao Việt',
          installDate: shiftDay(TODAY, -300),
          warrantyUntil: shiftDay(TODAY, 20),
          description: 'Lưu lượng 8 m³/h, cột áp 30 m.',
        },
      }),
      'create BOM-A09',
    );
  }
  console.log(`item ${item.code} ${item.id}`);
  const listed = expectOk(await apiCall(WEB, 'GET', '/maintenance-items', { token: bql }), 'list');
  console.log(`items in scope of bql-a: ${listed.length}; with warranty ending: ${listed.filter((row) => row.warranty === 'EXPIRING').map((row) => row.item.code).join(', ')}`);

  await signInThroughForm(browser, WEB, 'bql-a', PASSWORD);

  // AC-MT.14: "Thiết bị" in the menu, plans and maintenance schedule not.
  await browser.navigate(`${WEB}/maintenance/items`);
  await browser.waitFor(`document.body.innerText.includes('BOM-A09') && document.body.innerText.includes('Hiển thị')`, 'equipment list', 30000);
  const menu = await browser.evaluate(`[...document.querySelectorAll('nav a')].map((a) => a.textContent.trim())`);
  console.log(`AC-MT.14 menu: Thiết bị=${menu.includes('Thiết bị')}, Kế hoạch bảo trì=${menu.includes('Kế hoạch bảo trì')}, Lịch bảo trì=${menu.includes('Lịch bảo trì')}, Lịch sửa chữa=${menu.includes('Lịch sửa chữa')}`);
  if (!menu.includes('Thiết bị') || menu.includes('Kế hoạch bảo trì') || menu.includes('Lịch bảo trì')) throw new Error('menu does not match AC-MT.14');
  await sleep(500);
  await browser.screenshot('MT-1-list');

  await browser.navigate(`${WEB}/maintenance/items/${item.id}`);
  await browser.waitFor(`document.body.innerText.includes('Số lần sửa chữa') && document.body.innerText.includes('Tổng quan')`, 'item page', 30000);
  if (await browser.evaluate(`[...document.querySelectorAll('[role="tab"]')].some((t) => t.textContent.includes('Bảo trì'))`)) throw new Error('item page shows a "Bảo trì" tab');
  await sleep(400);
  await browser.screenshot('MT-2-item-page');

  // AC-MT.9: from "Báo sự cố" (?itemId=) the form picks the item and fills the location; the draft is then saved.
  await browser.navigate(`${WEB}/records/new?itemId=${item.id}`);
  await browser.waitFor(`document.querySelector('#rf-item') && document.body.innerText.includes('BOM-A09')`, 'record form with item', 30000);
  await sleep(400);
  await browser.evaluate(`document.querySelector('#rf-item').scrollIntoView({ block: 'center' }), true`);
  await sleep(300);
  await browser.screenshot('MT-3-record-form-item');
  const record = expectOk(
    await apiCall(WEB, 'POST', '/records', {
      token: bql,
      body: { buildingId: buildingA.id, title: `[TEST MT THIẾT BỊ] Bơm tăng áp kêu to ${RUN}`, description: 'Bơm tăng áp kêu to và rung khi chạy.', maintenanceItemId: item.id },
    }),
    'create linked draft',
  );
  console.log(`AC-MT.9 draft ${record.code}: location filled = ${record.locationId === pumpRoom.id}`);
  if (record.locationId !== pumpRoom.id) throw new Error('location was not taken from the item');
  await browser.navigate(`${WEB}/records/${record.id}`);
  await browser.waitFor(`[...document.querySelectorAll('a')].some((a) => a.textContent.includes('BOM-A09') && a.getAttribute('href') === '/maintenance/items/${item.id}')`, 'record detail item link', 30000);
  await sleep(400);
  await browser.evaluate(`[...document.querySelectorAll('a')].find((a) => a.textContent.includes('BOM-A09')).scrollIntoView({ block: 'center' }), true`);
  await sleep(300);
  await browser.screenshot('MT-4-record-detail-item');

  // Responsive: 375px, no horizontal page scroll.
  await browser.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 2, mobile: true });
  for (const [name, url, ready] of [
    ['MT-5-list-375', `${WEB}/maintenance/items`, `document.body.innerText.includes('BOM-A09')`],
    ['MT-6-item-375', `${WEB}/maintenance/items/${item.id}`, `document.body.innerText.includes('Số lần sửa chữa')`],
  ]) {
    await browser.navigate(url);
    await browser.waitFor(ready, name, 30000);
    await sleep(500);
    const overflow = await browser.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth');
    console.log(`${name} horizontal overflow ${overflow}px`);
    if (overflow > 0) throw new Error(`${name} scrolls horizontally`);
    await browser.screenshot(name);
  }
  console.log('MT-S1 equipment flow: PASS');
} catch (error) {
  await browser.screenshot('MT-failed').catch(() => undefined);
  console.error(await browser.evaluate('location.pathname + "\\n" + document.body.innerText.slice(0, 600)').catch(() => ''));
  throw error;
} finally {
  await browser.close();
}
