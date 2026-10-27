// AC-B4.1, AC-B4.2, AC-B4.3, AC-B4.6, AC-B4.7, AC-B4.11 evidence for B4-S1: the construction schedule in api mode,
// list, week and month views, and the week at 375px, with demo accounts.
//
// Prerequisites: api-qltn with demo seed and web dev server started with VITE_DATA_SOURCE=api (WEB_URL, default
// :5190). Run from the repository root:
//   SEED_DEMO_PASSWORD="$(grep -E '^SEED_DEMO_PASSWORD=' api-qltn/.env | cut -d= -f2-)" \
//     node docs/product/features/B04-lich-sua-chua/supporting/b4-s1-schedule-check.mjs
// Setup through the API, dates relative to today (T): a construction T-4 → T+1 (crosses the week start), a late one
// T-6 → T-2, one completed today (pending acceptance), one T+2 → T+9 (runs into next week), one approved record
// waiting to be scheduled. Building A goes back to STANDARD at the end. Passwords are never printed.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { signInThroughForm, sleep, startBrowser } from '../../../../tools/cdp-browser.mjs';
import { applyTemplate, expectOk, pngBytes, postRecordAction, readyForConstruction, uploadApi, signInTokens } from '../../../../tools/repair-flow.mjs';

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

let tokens;
let buildingId;
const browser = await startBrowser({ evidenceDir: EVIDENCE });
try {
  tokens = await signInTokens(WEB, PASSWORD, ['admin-demo', 'bql-a', 'tvkt', 'bqt']);
  const bql = tokens['bql-a'];
  const act = async (record, route, body) => expectOk(await postRecordAction(WEB, bql, record, route, body), route);
  const ready = async (label) => {
    const result = await readyForConstruction(WEB, tokens, { title: `[TEST B4 LỊCH] ${label} ${RUN}` });
    buildingId = result.buildingId;
    return result.record;
  };
  const started = async (label, startDate, plannedEndDate) =>
    act(await ready(label), 'start-construction', { startDate, plannedEndDate, planNote: 'Thi công ban ngày.' });

  const running = await started('Thay ống cấp nước hành lang tầng 3', shiftDay(TODAY, -4), shiftDay(TODAY, 1));
  const late = await started('Sửa máy bơm tăng áp', shiftDay(TODAY, -6), shiftDay(TODAY, -2));
  let built = await started('Thay đèn sảnh', shiftDay(TODAY, -1), shiftDay(TODAY, 1));
  built = await act(built, 'update-construction', { progressPercent: 100, note: 'Hoàn thành khối lượng.' });
  built = await act(built, 'submit-acceptance', {
    completedDate: TODAY,
    inspectedAt: new Date().toISOString(),
    inspectionLocation: 'Sảnh tầng 1',
    content: 'Kiểm tra đèn đã thay.',
    photoAttachmentIds: [await uploadApi(WEB, bql, built.id, 'ACCEPTANCE', 'nghiem-thu.png', 'image/png', pngBytes())],
  });
  const long = await started('Sơn lại hành lang tầng 12', shiftDay(TODAY, 2), shiftDay(TODAY, 9));
  let waiting = await ready('Thay van tổng tầng hầm');
  console.log(`records ${[running, late, built, long, waiting].map((row) => row.code).join(' ')}`);

  const grid = (testId) => `document.querySelector('[data-testid="${testId}"]')`;
  const cellsOf = (testId, code) => `[...${grid(testId)}.querySelectorAll('a')].filter((a) => a.textContent.includes('${code}')).length`;
  /** The list and the "Chờ xếp lịch" block both loaded, so the layout no longer moves under a click. */
  const settled = () =>
    browser.waitFor(`document.querySelector('section ul, section p') && document.body.innerText.includes('Lịch thi công') && [...document.querySelectorAll('[role="tab"]')].some((b) => b.textContent.trim() === 'Tuần')`, 'schedule settled', 30000).then(() => sleep(500));
  const awaitingHas = (code) => `[...document.querySelectorAll('section a')].some((a) => a.textContent.includes('${code}'))`;

  // AC-B4.1: the menu opens the real schedule.
  await signInThroughForm(browser, WEB, 'bql-a', PASSWORD);
  await browser.navigate(`${WEB}/records/schedule`);
  // The list pages by 10 and "Chờ xếp lịch" shows the 10 oldest; presence of this run's records is checked on the week.
  await browser.waitFor(`document.body.innerText.includes('Lịch thi công') && !document.body.innerText.includes('chưa nối API')`, 'schedule list', 30000);
  await settled();
  await browser.screenshot('B4-1-list');

  // AC-B4.2 / AC-B4.3 / AC-B4.6: week view.
  await browser.clickButton('Tuần');
  await browser.waitFor(`${grid('week-grid')} && ${cellsOf('week-grid', running.code)} > 0`, 'week grid', 30000);
  const week = await browser.evaluate(`({
    running: ${cellsOf('week-grid', running.code)},
    late: ${cellsOf('week-grid', late.code)},
    lateFlag: [...${grid('week-grid')}.querySelectorAll('a')].some((a) => a.textContent.includes('${late.code}') && a.textContent.includes('Trễ thi công')),
    builtFlag: [...${grid('week-grid')}.querySelectorAll('a')].some((a) => a.textContent.includes('${built.code}') && a.textContent.includes('Trễ thi công')),
    count: document.body.innerText.match(/(\\d+) hồ sơ trong tuần/)?.[1],
  })`);
  console.log(`week ${JSON.stringify(week)}`);
  if (!week.lateFlag || week.builtFlag) throw new Error('late flag wrong in week view');
  await sleep(300);
  await browser.screenshot('B4-2-week');

  // Month view.
  await browser.clickButton('Tháng');
  // Days with more than 3 records list 3 and hide the rest behind "+n" (ui-brief §2.4).
  await browser.waitFor(`${grid('month-grid')} && ${grid('month-grid')}.querySelectorAll('a').length > 0`, 'month grid', 30000);
  console.log(`month "+n" buttons ${await browser.evaluate(`[...${grid('month-grid')}.querySelectorAll('button')].filter((b) => b.textContent.startsWith('+')).length`)}`);
  await sleep(300);
  await browser.screenshot('B4-3-month');

  // AC-B4.7: starting the waiting record moves it from "Chờ xếp lịch" to the calendar (after a reload).
  waiting = await act(waiting, 'start-construction', { startDate: TODAY, plannedEndDate: shiftDay(TODAY, 1), planNote: 'Thi công ban ngày.' });
  await browser.navigate(`${WEB}/records/schedule`);
  // The list pages by 10; the week grid holds every record of the week (up to 200).
  await settled();
  await browser.clickButton('Tuần');
  await browser.waitFor(`${grid('week-grid')} && ${cellsOf('week-grid', waiting.code)} > 0`, 'started record on the week grid', 30000);
  if (await browser.evaluate(awaitingHas(waiting.code))) throw new Error('started record still waits to be scheduled');
  console.log(`AC-B4.7 ${waiting.code} left "Chờ xếp lịch" and is on the calendar`);

  // AC-B4.11: 375px, week as a day list, no horizontal page scroll.
  await browser.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 2, mobile: true });
  await browser.navigate(`${WEB}/records/schedule`);
  await settled();
  await browser.clickButton('Tuần');
  await browser.waitFor(`document.body.textContent.includes('Thứ Hai')`, 'phone week', 30000);
  await sleep(300);
  const overflow = await browser.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth');
  console.log(`375px horizontal overflow ${overflow}px`);
  if (overflow > 0) throw new Error('page scrolls horizontally at 375px');
  await browser.screenshot('B4-4-week-375');
  console.log('B4-S1 schedule flow: PASS');
} catch (error) {
  await browser.screenshot('B4-failed').catch(() => undefined);
  console.error(await browser.evaluate('location.pathname + "\\n" + document.body.innerText.slice(0, 800)').catch(() => ''));
  throw error;
} finally {
  await browser.close();
  if (tokens && buildingId) {
    const restored = await applyTemplate(WEB, tokens['admin-demo'], buildingId, 'STANDARD');
    console.log(`building A back on STANDARD: ${restored.status}`);
  }
}
