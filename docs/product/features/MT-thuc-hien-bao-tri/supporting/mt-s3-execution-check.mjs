// MT-S3 evidence in a real browser (headless Chrome), api mode, demo accounts: a performer filling an occurrence at
// 375px (out-of-range measurement, item error on submit), the reviewer at 375px, the occurrence with a linked
// repair record on a wide screen, and "Việc của tôi". Uses a plan "[TEST MT LƯỢT] …" on item BOM-A09 (made by the
// MT-S1 check) with today's occurrence: kt-a performs, kt-a2 reviews, bql-a manages.
//
// Prerequisites: api-qltn with migration 2026-10-27g and demo seed, web dev server with VITE_DATA_SOURCE=api
// (WEB_URL, default :5190). Run from the repository root:
//   SEED_DEMO_PASSWORD="$(grep -E '^SEED_DEMO_PASSWORD=' api-qltn/.env | cut -d= -f2-)" \
//     node docs/product/features/MT-thuc-hien-bao-tri/supporting/mt-s3-execution-check.mjs
// Passwords are never printed. CDP_PORT (default 9344).
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
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

if (!PASSWORD) throw new Error('SEED_DEMO_PASSWORD is not set');

const photo = async (token, occurrenceId, name) => {
  const form = new FormData();
  form.set('subjectType', 'MAINTENANCE_OCCURRENCE');
  form.set('subjectId', occurrenceId);
  form.set('purpose', 'MAINTENANCE_RESULT');
  form.set('file', new Blob([PNG], { type: 'image/png' }), name);
  const res = await fetch(`${WEB}/api/attachments`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
  if (res.status !== 201) throw new Error(`upload ${name} answered ${res.status}`);
  return (await res.json()).data.id;
};

const narrow = (browser) => browser.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 2, mobile: true });
const wide = (browser) => browser.send('Emulation.setDeviceMetricsOverride', { width: 1366, height: 1000, deviceScaleFactor: 1, mobile: false });
const noOverflow = async (browser, name) => {
  const overflow = await browser.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth');
  console.log(`${name} horizontal overflow ${overflow}px`);
  if (overflow > 0) throw new Error(`${name} scrolls horizontally`);
};
/** The smallest visible control of the main area (ui-brief §4: ≥ 44px), with what it is. */
const smallestTarget = (browser) =>
  browser.evaluate(`(() => {
    const controls = [...document.querySelectorAll('main button, main [role="radio"], main input, main textarea, main select')]
      .filter((el) => el.offsetParent && el.type !== 'file' && el.type !== 'checkbox')
      .map((el) => ({ h: Math.round(el.getBoundingClientRect().height), what: (el.getAttribute('aria-label') || el.textContent || el.id || el.tagName).trim().slice(0, 40) }))
      .sort((a, b) => a.h - b.h);
    return JSON.stringify(controls.slice(0, 3));
  })()`);

const browser = await startBrowser({ evidenceDir: EVIDENCE, port: Number(process.env.CDP_PORT ?? 9344) });
try {
  const tokens = await signInTokens(WEB, PASSWORD, ['bql-a', 'kt-a', 'kt-a2']);
  const reference = expectOk(await apiCall(WEB, 'GET', '/reference', { token: tokens['bql-a'] }), 'reference');
  const item = reference.items.find((row) => row.code === 'BOM-A09');
  if (!item) throw new Error('item BOM-A09 is missing: run the MT-S1 check first');
  const userId = (code) => reference.users.find((row) => row.code === code).id;
  let plan = expectOk(
    await apiCall(WEB, 'POST', '/maintenance-plans', {
      token: tokens['bql-a'],
      body: {
        itemId: item.id,
        name: `[TEST MT LƯỢT] Kiểm tra bơm tăng áp ${RUN}`,
        unit: 'MONTH',
        every: 1,
        startDate: TODAY,
        performerUserId: userId('KT-A'),
        reviewerUserId: userId('KT-A2'),
        checklist: [
          { label: 'Vận hành', kind: 'CHECK', required: true },
          { label: 'Rò rỉ', kind: 'CHECK', required: false, photoRequired: true },
          { label: 'Áp suất', kind: 'MEASUREMENT', required: true, unit: 'bar', min: 2, max: 6 },
        ],
      },
    }),
    'plan',
  );
  plan = expectOk(await apiCall(WEB, 'POST', `/maintenance-plans/${plan.id}/activate`, { token: tokens['bql-a'], body: { version: plan.version } }), 'activate');
  const planDetail = expectOk(await apiCall(WEB, 'GET', `/maintenance-plans/${plan.id}`, { token: tokens['bql-a'] }), 'plan detail');
  const occ = planDetail.occurrences.find((row) => row.scheduledDate === TODAY);
  let detail = expectOk(await apiCall(WEB, 'POST', `/maintenance-occurrences/${occ.id}/start`, { token: tokens['kt-a'], body: { version: occ.version } }), 'start');
  const ids = Object.fromEntries(detail.occurrence.checklist.map((row) => [row.label, row.id]));
  const leakPhoto = await photo(tokens['kt-a'], occ.id, 'ro-ri.png');
  detail = expectOk(
    await apiCall(WEB, 'POST', `/maintenance-occurrences/${occ.id}/save`, {
      token: tokens['kt-a'],
      body: { version: detail.occurrence.version, entries: [{ itemId: ids['Vận hành'], result: 'PASS' }, { itemId: ids['Rò rỉ'], result: 'FAIL', note: 'Có rò tại khớp nối.', attachmentIds: [leakPhoto] }] },
    }),
    'save',
  );
  console.log(`occurrence ${detail.occurrence.code}: ${detail.occurrence.status}`);

  // 1–2. The performer at 375px: an out-of-range measurement, then a submission refused on the items.
  await narrow(browser);
  await signInThroughForm(browser, WEB, 'kt-a', PASSWORD);
  await browser.navigate(`${WEB}/maintenance/occurrences/${occ.id}`);
  await browser.waitFor(`document.querySelector('#value-${ids['Áp suất']}')`, 'work editor', 30000);
  await browser.setField(`#value-${ids['Áp suất']}`, '7');
  await browser.waitFor(`document.body.innerText.includes('Ngoài ngưỡng 2–6 bar')`, 'out of range line');
  await sleep(400);
  await noOverflow(browser, 'MT3-1-work-375');
  console.log(`smallest touch targets ${await smallestTarget(browser)}`);
  await browser.evaluate(`document.querySelector('#item-${ids['Áp suất']}').scrollIntoView({ block: 'center' }), true`);
  await sleep(300);
  await browser.screenshot('MT3-1-work-375');
  await browser.clickButton('Gửi kết quả');
  await browser.waitFor(`document.body.innerText.includes('mục chưa đủ')`, 'item errors');
  await sleep(600);
  await browser.screenshot('MT3-2-submit-errors-375');

  // Submitted over the API with every condition met.
  const pressurePhoto = await photo(tokens['kt-a'], occ.id, 'ap-suat.png');
  const general = await photo(tokens['kt-a'], occ.id, 'tong-quan.png');
  detail = expectOk(await apiCall(WEB, 'GET', `/maintenance-occurrences/${occ.id}`, { token: tokens['kt-a'] }), 'reload');
  detail = expectOk(
    await apiCall(WEB, 'POST', `/maintenance-occurrences/${occ.id}/submit`, {
      token: tokens['kt-a'],
      body: {
        version: detail.occurrence.version,
        entries: [
          { itemId: ids['Vận hành'], result: 'PASS' },
          { itemId: ids['Rò rỉ'], result: 'FAIL', note: 'Có rò tại khớp nối.', attachmentIds: [leakPhoto] },
          { itemId: ids['Áp suất'], value: 7, note: 'Áp suất cao hơn ngưỡng.', attachmentIds: [pressurePhoto] },
        ],
        summary: 'Bơm chạy được; rò tại khớp nối, áp suất cao.',
        attachmentIds: [general],
      },
    }),
    'submit',
  );
  console.log(`submitted round ${detail.occurrence.round}: ${detail.occurrence.status}`);

  // 3. The reviewer at 375px.
  await signInThroughForm(browser, WEB, 'kt-a2', PASSWORD);
  await browser.navigate(`${WEB}/maintenance/occurrences/${occ.id}`);
  await browser.waitFor(`document.body.innerText.includes('Xác nhận hoàn thành') && document.body.innerText.includes('Hướng xử lý')`, 'review panel', 30000);
  await sleep(400);
  await noOverflow(browser, 'MT3-3-review-375');
  await browser.screenshot('MT3-3-review-375');

  // 4. A repair record made from "Rò rỉ", seen by the manager on a wide screen.
  const made = expectOk(await apiCall(WEB, 'POST', `/maintenance-occurrences/${occ.id}/repairs`, { token: tokens['bql-a'], body: { version: detail.occurrence.version, itemId: ids['Rò rỉ'] } }), 'repair');
  console.log(`repair record ${made.code} from Rò rỉ`);
  await wide(browser);
  await signInThroughForm(browser, WEB, 'bql-a', PASSWORD);
  await browser.navigate(`${WEB}/maintenance/occurrences/${occ.id}`);
  await browser.waitFor(`document.body.innerText.includes('${made.code}')`, 'linked record', 30000);
  await sleep(500);
  await browser.screenshot('MT3-4-occurrence-wide-linked-record');
  await browser.navigate(`${WEB}/records/${made.recordId}`);
  await browser.waitFor(`document.body.innerText.includes('Từ lượt bảo trì ${detail.occurrence.code}')`, 'record source line', 30000);
  await sleep(400);
  await browser.screenshot('MT3-5-record-from-item');

  // 6–7. "Việc của tôi" of kt-a2 (pending review), wide and 375px.
  await signInThroughForm(browser, WEB, 'kt-a2', PASSWORD);
  await browser.navigate(`${WEB}/maintenance/schedule`);
  await browser.waitFor(`document.body.innerText.includes('${detail.occurrence.code}') && document.body.innerText.includes('Chờ xác nhận')`, 'my occurrences', 30000);
  await sleep(400);
  await browser.screenshot('MT3-6-my-occurrences');
  await narrow(browser);
  await browser.navigate(`${WEB}/maintenance/schedule`);
  await browser.waitFor(`document.body.innerText.includes('${detail.occurrence.code}')`, 'my occurrences 375', 30000);
  await sleep(400);
  await noOverflow(browser, 'MT3-7-my-occurrences-375');
  await browser.screenshot('MT3-7-my-occurrences-375');
  console.log('MT-S3 execution flow: PASS');
} catch (error) {
  await browser.screenshot('MT3-failed').catch(() => undefined);
  throw error;
} finally {
  await browser.close();
}
