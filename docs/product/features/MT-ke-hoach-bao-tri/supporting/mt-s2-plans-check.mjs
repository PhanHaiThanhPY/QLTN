// MT-S2 evidence in a real browser (headless Chrome), api mode, demo accounts: the plans menu and list, the plan form
// with an item preselected (AC-MT2.1 draft), a running plan with a "Lịch đã đổi" occurrence and its ⋯ menu
// (AC-MT2.12), the schedule change dialog, the item's "Bảo trì" tab, and the list and plan page at 375px.
//
// Prerequisites: api-qltn with migration 2026-10-27e and demo seed, web dev server with VITE_DATA_SOURCE=api
// (WEB_URL, default :5190). Run from the repository root:
//   SEED_DEMO_PASSWORD="$(grep -E '^SEED_DEMO_PASSWORD=' api-qltn/.env | cut -d= -f2-)" \
//     node docs/product/features/MT-ke-hoach-bao-tri/supporting/mt-s2-plans-check.mjs
// Adds one plan "[TEST MT KẾ HOẠCH] …" on item BOM-A09 of building A (made by the MT-S1 check) and ends it at the
// close, so the item can still be stopped. Passwords are never printed. CDP_PORT (default 9344).
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
let cleanup;
try {
  const tokens = await signInTokens(WEB, PASSWORD, ['bql-a']);
  const bql = tokens['bql-a'];
  const reference = expectOk(await apiCall(WEB, 'GET', '/reference', { token: bql }), 'reference');
  const item = reference.items.find((row) => row.code === 'BOM-A09');
  if (!item) throw new Error('item BOM-A09 is missing: run the MT-S1 check first');
  const userId = (code) => reference.users.find((row) => row.code === code).id;

  // A running monthly plan, then a two-weekly schedule from day 14: the day-16 occurrence is flagged (AC-MT2.12).
  let plan = expectOk(
    await apiCall(WEB, 'POST', '/maintenance-plans', {
      token: bql,
      body: {
        itemId: item.id,
        name: `[TEST MT KẾ HOẠCH] Kiểm tra bơm tăng áp ${RUN}`,
        unit: 'MONTH',
        every: 1,
        startDate: shiftDay(TODAY, 16),
        performerUserId: userId('KT-A'),
        reviewerUserId: userId('KT-A2'),
        contractorName: 'Công ty CP Cơ điện Sao Việt',
        checklist: [
          { label: 'Vận hành êm, không rung', kind: 'CHECK', required: true },
          { label: 'Rò rỉ phớt và mặt bích', kind: 'CHECK', required: false, photoRequired: true },
          { label: 'Áp suất đầu đẩy', kind: 'MEASUREMENT', required: true, unit: 'bar', min: 2, max: 6 },
        ],
      },
    }),
    'create plan',
  );
  console.log(`AC-MT2.1 ${plan.code}: ${plan.status}`);
  cleanup = async () => {
    const current = expectOk(await apiCall(WEB, 'GET', `/maintenance-plans/${plan.id}`, { token: bql }), 'plan').plan;
    if (current.status !== 'ENDED') {
      expectOk(await apiCall(WEB, 'POST', `/maintenance-plans/${plan.id}/end`, { token: bql, body: { version: current.version, reason: 'Kết thúc kế hoạch thử của bằng chứng MT-S2.' } }), 'end plan');
    }
  };
  plan = expectOk(await apiCall(WEB, 'POST', `/maintenance-plans/${plan.id}/activate`, { token: bql, body: { version: plan.version } }), 'activate');
  plan = expectOk(
    await apiCall(WEB, 'POST', `/maintenance-plans/${plan.id}/change-schedule`, {
      token: bql,
      body: { version: plan.version, unit: 'WEEK', every: 2, effectiveFrom: shiftDay(TODAY, 14), anchorDate: shiftDay(TODAY, 14), reason: 'Nhà cung cấp khuyến nghị kiểm tra dày hơn.' },
    }),
    'change schedule',
  );
  const detail = expectOk(await apiCall(WEB, 'GET', `/maintenance-plans/${plan.id}`, { token: bql }), 'detail');
  const scheduled = detail.occurrences.filter((row) => row.status === 'SCHEDULED');
  console.log(`AC-MT2.12 occurrences: ${scheduled.map((row) => `${row.scheduledDate}${row.scheduleChanged ? '*' : ''}`).sort().join(', ')}`);

  await signInThroughForm(browser, WEB, 'bql-a', PASSWORD);

  await browser.navigate(`${WEB}/maintenance/plans`);
  await browser.waitFor(`document.body.innerText.includes('${plan.code}') && document.body.innerText.includes('Đang chạy')`, 'plans list', 30000);
  const menu = await browser.evaluate(`[...document.querySelectorAll('nav a')].map((a) => a.textContent.trim())`);
  console.log(`menu: Kế hoạch bảo trì=${menu.includes('Kế hoạch bảo trì')}, Lịch bảo trì=${menu.includes('Lịch bảo trì')}`);
  if (!menu.includes('Kế hoạch bảo trì')) throw new Error('plans are not in the menu');
  await sleep(500);
  await browser.screenshot('MT2-1-plans');

  await browser.navigate(`${WEB}/maintenance/plans/new?itemId=${item.id}`);
  await browser.waitFor(`document.querySelector('#plan-name') && document.body.innerText.includes('Các lượt đầu dự kiến')`, 'plan form', 30000);
  await browser.setField('#plan-name', 'Kiểm tra bơm tăng áp hằng tháng');
  await sleep(500);
  await browser.screenshot('MT2-2-plan-form');

  await browser.navigate(`${WEB}/maintenance/plans/${plan.id}`);
  await browser.waitFor(`document.body.innerText.includes('lượt có lịch đã đổi')`, 'plan page', 30000);
  await sleep(400);
  await browser.screenshot('MT2-3-plan-page');
  const flagged = scheduled.find((row) => row.scheduleChanged);
  const ddmm = `${flagged.scheduledDate.slice(8)}/${flagged.scheduledDate.slice(5, 7)}`;
  await browser.realClick(`[...document.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === 'Thao tác cho lượt ${flagged.code}, ${ddmm}' && b.offsetParent)`, 'occurrence menu');
  await browser.waitFor(`[...document.querySelectorAll('[role="menuitem"]')].some((m) => m.textContent === 'Giữ lượt này')`, 'menu items');
  await sleep(300);
  await browser.screenshot('MT2-4-occurrence-menu');
  await browser.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await sleep(300);

  await browser.clickButton('Đổi chu kỳ');
  await browser.waitFor(`document.querySelector('#sc-every')`, 'schedule dialog');
  await sleep(400);
  await browser.screenshot('MT2-5-change-schedule');
  await browser.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });

  await browser.navigate(`${WEB}/maintenance/items/${item.id}?tab=maintenance`);
  await browser.waitFor(`document.body.innerText.includes('Lượt sắp tới') && document.body.innerText.includes('${plan.code}') && document.body.innerText.includes('Lần kế tiếp')`, 'item maintenance tab', 30000);
  await sleep(600);
  await browser.screenshot('MT2-6-item-maintenance');

  await browser.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 2, mobile: true });
  for (const [name, url, ready] of [
    ['MT2-7-plans-375', `${WEB}/maintenance/plans`, `document.body.innerText.includes('${plan.code}')`],
    ['MT2-8-plan-375', `${WEB}/maintenance/plans/${plan.id}`, `document.body.innerText.includes('Lượt bảo trì')`],
  ]) {
    await browser.navigate(url);
    await browser.waitFor(ready, name, 30000);
    await sleep(500);
    const overflow = await browser.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth');
    console.log(`${name} horizontal overflow ${overflow}px`);
    if (overflow > 0) throw new Error(`${name} scrolls horizontally`);
    await browser.screenshot(name);
  }
  console.log('MT-S2 plans flow: PASS');
} catch (error) {
  await browser.screenshot('MT2-failed').catch(() => undefined);
  throw error;
} finally {
  await cleanup?.().catch((error) => console.error(`cleanup failed: ${error.message}`));
  await browser.close();
}
