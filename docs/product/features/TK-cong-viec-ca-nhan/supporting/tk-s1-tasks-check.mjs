// TK-S1 evidence in a real browser (headless Chrome), api mode: "Công việc của tôi" for KT-A and BQT at 1366px and
// 375px, the menu entry (AC-TK.14), and the response time of GET /me/tasks on the dev data (SPEC §5, under 500 ms).
//
// Prerequisites: api-qltn with demo seed, web dev server with VITE_DATA_SOURCE=api (WEB_URL, default :5190).
// Run from the repository root:
//   SEED_DEMO_PASSWORD="$(grep -E '^SEED_DEMO_PASSWORD=' api-qltn/.env | cut -d= -f2-)" \
//     node docs/product/features/TK-cong-viec-ca-nhan/supporting/tk-s1-tasks-check.mjs
// Adds one record "[TEST TK VIỆC] …" waiting for its confirmer so KT-A has a task. Passwords are never printed.
// CDP_PORT (default 9344) keeps this browser apart from another seat's.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { signInThroughForm, sleep, startBrowser } from '../../../../tools/cdp-browser.mjs';
import { apiCall } from '../../../../tools/seed-accounts.mjs';
import { expectOk, pngBytes, postRecordAction, signInTokens, uploadApi } from '../../../../tools/repair-flow.mjs';

const WEB = process.env.WEB_URL ?? 'http://localhost:5190';
const PASSWORD = process.env.SEED_DEMO_PASSWORD;
const EVIDENCE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'evidence');
const RUN = new Date().toISOString().replace(/[-:]/g, '').slice(0, 13);
const TODAY_LABEL = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date());

if (!PASSWORD) throw new Error('SEED_DEMO_PASSWORD is not set');

const browser = await startBrowser({ evidenceDir: EVIDENCE, port: Number(process.env.CDP_PORT ?? 9344) });
try {
  const tokens = await signInTokens(WEB, PASSWORD, ['admin-demo', 'bql-a', 'kt-a', 'bqt']);
  const bql = tokens['bql-a'];
  const buildingA = expectOk(await apiCall(WEB, 'GET', '/buildings', { token: tokens['admin-demo'] }), 'buildings').find((row) => row.code === 'A');
  const location = expectOk(await apiCall(WEB, 'GET', '/reference', { token: bql }), 'reference').locations.find((row) => row.buildingId === buildingA.id);
  let record = expectOk(
    await apiCall(WEB, 'POST', '/records', {
      token: bql,
      body: { buildingId: buildingA.id, locationId: location.id, title: `[TEST TK VIỆC] Rò ống cấp tầng 5 ${RUN}`, description: 'Ống cấp nước trần hành lang tầng 5 rò.', noMaintenanceItem: true, priority: 'HIGH' },
    }),
    'create',
  );
  const photo = await uploadApi(WEB, bql, record.id, 'SITE_PHOTO', 'hien-truong.png', 'image/png', pngBytes());
  record = expectOk(await postRecordAction(WEB, bql, record, 'submit', { attachmentIds: [photo] }), 'submit');
  console.log(`record ${record.code} waits for its confirmer`);

  // SPEC §5: response time of GET /me/tasks on the dev data (median of 7, after one warm-up).
  for (const [who, token] of [['kt-a', tokens['kt-a']], ['bqt', tokens.bqt], ['bql-a', bql]]) {
    const times = [];
    let body;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const started = performance.now();
      body = expectOk(await apiCall(WEB, 'GET', '/me/tasks', { token }), 'me/tasks');
      if (attempt > 0) times.push(performance.now() - started);
    }
    times.sort((a, b) => a - b);
    console.log(`GET /me/tasks ${who}: ${body.counts.open} open, ${body.counts.overdue} overdue, ${body.counts.done} done; median ${times[3].toFixed(0)} ms, max ${times[6].toFixed(0)} ms`);
  }
  const records = expectOk(await apiCall(WEB, 'GET', '/records?limit=100', { token: bql }), 'records').data;
  console.log(`records in scope of bql-a with a deadline: ${records.filter((row) => row.dueAt).length}/${records.length}`);

  for (const user of ['kt-a', 'bqt']) {
    await browser.send('Emulation.clearDeviceMetricsOverride');
    await signInThroughForm(browser, WEB, user, PASSWORD);
    await browser.navigate(`${WEB}/tasks`);
    await browser.waitFor(`document.body.innerText.includes('Hôm nay, ${TODAY_LABEL}') && document.body.innerText.includes('Đã hoàn thành (30 ngày)')`, `${user} tasks page`, 30000);
    const menu = await browser.evaluate(`[...document.querySelectorAll('nav a')].map((a) => a.textContent.trim())`);
    if (!menu.includes('Công việc của tôi')) throw new Error('menu has no "Công việc của tôi" in api mode');
    if (await browser.evaluate(`document.body.innerText.includes('Tháng 10, 2026')`)) throw new Error('the header still names a fixed month');
    await sleep(500);
    await browser.screenshot(`TK-${user}-wide`);
    await browser.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 2, mobile: true });
    await browser.navigate(`${WEB}/tasks`);
    await browser.waitFor(`document.body.innerText.includes('Hôm nay, ${TODAY_LABEL}') && document.body.innerText.includes('Đã xong')`, `${user} phone`, 30000);
    await sleep(500);
    const overflow = await browser.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth');
    const continueCard = await browser.evaluate(`document.querySelector('#continue-task-title')?.closest('section')?.innerText ?? ''`);
    console.log(`${user} 375px: overflow ${overflow}px; continue card: ${JSON.stringify(continueCard.split('\n').slice(0, 3).join(' | '))}`);
    if (overflow > 0) throw new Error(`${user} tasks page scrolls horizontally at 375px`);
    await browser.screenshot(`TK-${user}-375`);
  }
  console.log('TK-S1 tasks flow: PASS');
} catch (error) {
  await browser.screenshot('TK-failed').catch(() => undefined);
  console.error(await browser.evaluate('location.pathname + "\\n" + document.body.innerText.slice(0, 600)').catch(() => ''));
  throw error;
} finally {
  await browser.close();
}
