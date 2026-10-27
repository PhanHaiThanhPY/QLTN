// AC-FX1.5 evidence for slice FX-S1: an administrator of building A opens admin-demo (every building) and gets a
// read-only dialog (BR-FX1-04), then the API refuses the reset with 403 account_scope_exceeded (BR-FX1-02).
//
// Prerequisites: api-qltn on :5300 with demo seed, web dev server with VITE_DATA_SOURCE=api (WEB_URL, default :5190).
// Run from the repository root:
//   SEED_DEMO_PASSWORD="$(grep -E '^SEED_DEMO_PASSWORD=' api-qltn/.env | cut -d= -f2-)" \
//     node docs/product/features/FX-sua-loi-review-27-10/supporting/fx-s1-ui-check.mjs
// The test account TEST-ADMIN-A (building A only) is created once and gets a fresh random password on every run.
// Passwords are never printed.
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { signInThroughForm, sleep, startBrowser } from '../../../../tools/cdp-browser.mjs';
import { apiCall, loginWithRetry } from '../../../../tools/seed-accounts.mjs';

const WEB = process.env.WEB_URL ?? 'http://localhost:5190';
const PASSWORD = process.env.SEED_DEMO_PASSWORD;
const EVIDENCE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'evidence');
const CODE = 'TEST-ADMIN-A';

if (!PASSWORD) throw new Error('SEED_DEMO_PASSWORD is not set');

const expectStatus = (res, status, label) => {
  if (res.status !== status) throw new Error(`${label} answered ${res.status}: ${JSON.stringify(res.body?.error ?? {})}`);
  return res.body?.data;
};

const token = (await loginWithRetry(WEB, 'admin-demo', PASSWORD)).body.data.accessToken;
const buildingA = expectStatus(await apiCall(WEB, 'GET', '/buildings', { token }), 200, 'buildings').find((row) => row.code === 'A');
const adminAPassword = `Fx1-${randomBytes(9).toString('base64url')}`;
const found = expectStatus(await apiCall(WEB, 'GET', `/users?q=${CODE}&limit=5`, { token }), 200, 'find').data.find((row) => row.code === CODE);
if (found) {
  expectStatus(await apiCall(WEB, 'POST', `/users/${found.id}/reset-password`, { token, body: { password: adminAPassword } }), 200, 'reset TEST-ADMIN-A');
} else {
  const roles = expectStatus(await apiCall(WEB, 'GET', '/roles', { token }), 200, 'roles');
  const departments = expectStatus(await apiCall(WEB, 'GET', '/departments', { token }), 200, 'departments');
  expectStatus(
    await apiCall(WEB, 'POST', '/users', {
      token,
      body: {
        code: CODE,
        fullName: '[TEST FX-S1] Quản trị Tòa A',
        password: adminAPassword,
        roleDefId: roles.find((row) => row.code === 'ADMIN' && row.isSystem).id,
        departmentId: departments.find((row) => row.code === 'QTHT').id,
        buildingIds: [buildingA.id],
      },
    }),
    201,
    'create TEST-ADMIN-A',
  );
}

const browser = await startBrowser({ evidenceDir: EVIDENCE });
try {
  await signInThroughForm(browser, WEB, CODE.toLowerCase(), adminAPassword);
  await browser.navigate(`${WEB}/admin/employees`);
  await browser.waitFor(`document.body.innerText.includes('ADMIN-DEMO')`, 'admin-demo listed (AC-FX1.4)', 30000);
  const rowAction = await browser.evaluate(
    `[...document.querySelectorAll('tr')].find((row) => row.firstElementChild?.textContent.trim() === 'ADMIN-DEMO')?.querySelector('button')?.textContent.trim() ?? null`,
  );
  if (rowAction !== 'Xem') throw new Error(`row action of ADMIN-DEMO is ${rowAction}`);
  await browser.realClick(
    `[...document.querySelectorAll('tr')].find((row) => row.firstElementChild?.textContent.trim() === 'ADMIN-DEMO')?.querySelector('button')`,
    'Xem button of ADMIN-DEMO',
  );
  await browser.waitFor(`document.querySelector('[role=dialog] [role=note]')`, 'read-only note');
  const view = await browser.evaluate(`(() => {
    const dialog = document.querySelector('[role=dialog]');
    const buttons = [...dialog.querySelectorAll('button')].map((b) => b.textContent.trim());
    return {
      note: dialog.querySelector('[role=note]').textContent.trim(),
      locked: dialog.querySelector('fieldset').disabled,
      save: buttons.includes('Lưu'),
      reset: buttons.some((text) => text.includes('Đặt lại mật khẩu')),
    };
  })()`);
  if (view.note !== 'Tài khoản có tòa ngoài phạm vi của bạn: chỉ xem.' || !view.locked || view.save || view.reset) {
    throw new Error(`dialog is not read-only: ${JSON.stringify(view)}`);
  }
  await sleep(300);
  await browser.screenshot('FX-S1-1-admin-a-opens-admin-demo-read-only');

  const adminA = (await loginWithRetry(WEB, CODE.toLowerCase(), adminAPassword)).body.data.accessToken;
  const target = expectStatus(await apiCall(WEB, 'GET', '/users?q=ADMIN-DEMO&limit=5', { token: adminA }), 200, 'list').data.find((row) => row.code === 'ADMIN-DEMO');
  // The demo password itself is sent, so an API without the fix would leave admin-demo's password unchanged.
  const refused = await apiCall(WEB, 'POST', `/users/${target.id}/reset-password`, { token: adminA, body: { password: PASSWORD } });
  if (refused.status !== 403 || refused.body?.error?.details?.reason !== 'account_scope_exceeded') {
    throw new Error(`reset answered ${refused.status} ${JSON.stringify(refused.body?.error ?? {})}`);
  }
  console.log('AC-FX1.5 read-only dialog + 403 account_scope_exceeded: PASS');
} catch (error) {
  await browser.screenshot('FX-S1-failed').catch(() => undefined);
  console.error(await browser.evaluate('location.pathname + "\\n" + document.body.innerText.slice(0, 800)').catch(() => ''));
  throw error;
} finally {
  await browser.close();
}
