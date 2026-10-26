// AC-8 evidence for AU-S1: kt-a2 changes the password in the web (api mode), lands on /login and signs in with
// the new password. The seed password is restored through the admin reset endpoint at the end, even on failure.
//
// Prerequisites: api-qltn on :5300 with demo seed, web dev server on :5190 started with VITE_DATA_SOURCE=api.
// Run from the repository root:
//   SEED_DEMO_PASSWORD="$(grep -E '^SEED_DEMO_PASSWORD=' api-qltn/.env | cut -d= -f2-)" \
//     node docs/product/features/AU-doi-mat-khau/supporting/au-s1-ui-check.mjs
// Passwords are never printed.
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { signInThroughForm, sleep, startBrowser } from '../../../../tools/cdp-browser.mjs';

const WEB = process.env.WEB_URL ?? 'http://localhost:5190';
const SEED_PASSWORD = process.env.SEED_DEMO_PASSWORD;
const USERNAME = 'kt-a2';
const NEW_PASSWORD = `Au1-${randomBytes(6).toString('hex')}`;
const SUCCESS_TOAST = 'Đã đổi mật khẩu. Vui lòng đăng nhập lại bằng mật khẩu mới.';
const EVIDENCE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'evidence');

if (!SEED_PASSWORD) throw new Error('SEED_DEMO_PASSWORD is not set');

const api = async (method, url, { token, body } = {}) => {
  const res = await fetch(`${WEB}/api${url}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json() };
};

/** Login is limited to 10 requests per minute per IP; wait for the window instead of failing the cleanup. */
const loginWithRetry = async (username, password) => {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const res = await api('POST', '/auth/login', { body: { username, password } });
    if (res.status !== 429) return res;
    console.log(`login ${username} rate-limited, retrying in 65 s (attempt ${attempt}/3)`);
    await sleep(65_000);
  }
  throw new Error(`login ${username} stayed rate-limited`);
};

/** Puts kt-a2 back on the seed password through `POST /users/:id/reset-password` as admin-demo. */
const restoreSeedPassword = async () => {
  const admin = await loginWithRetry('admin-demo', SEED_PASSWORD);
  if (admin.status !== 200) throw new Error(`admin login answered ${admin.status}`);
  const token = admin.body.data.accessToken;
  const users = await api('GET', `/users?q=${USERNAME.toUpperCase()}&limit=10`, { token });
  if (users.status !== 200) throw new Error(`listing users answered ${users.status}`);
  const user = users.body.data.data.find((row) => row.code === USERNAME.toUpperCase());
  const reset = await api('POST', `/users/${user.id}/reset-password`, { token, body: { password: SEED_PASSWORD } });
  const check = await loginWithRetry(USERNAME, SEED_PASSWORD);
  console.log(`seed password restored: reset ${reset.status}, login ${check.status}`);
};

const browser = await startBrowser({ evidenceDir: EVIDENCE });
try {
  await signInThroughForm(browser, WEB, USERNAME, SEED_PASSWORD);
  console.log(`signed in as ${USERNAME} with the seed password`);
  await browser.waitFor(`document.querySelector('button[aria-label="Đổi mật khẩu"]')`, 'change password entry');
  await browser.screenshot('AU-1-sidebar-entry');

  await browser.clickButton('Đổi mật khẩu');
  await browser.waitFor(`document.querySelector('#cp-current')`, 'change password dialog');
  await browser.setField('#cp-current', SEED_PASSWORD);
  await browser.setField('#cp-new', NEW_PASSWORD);
  await browser.setField('#cp-confirm', NEW_PASSWORD);
  await browser.screenshot('AU-2-dialog-filled');
  await browser.clickButton('Lưu', `document.querySelector('[role=dialog]')`);

  await browser.waitFor(`location.pathname === '/login'`, 'redirect to /login', 30000);
  await browser.waitFor(`document.body.innerText.includes(${JSON.stringify(SUCCESS_TOAST)})`, 'success toast');
  console.log('redirected to /login with the success toast');
  await browser.screenshot('AU-3-login-after-change');

  await signInThroughForm(browser, WEB, USERNAME, NEW_PASSWORD);
  console.log(`signed in again as ${USERNAME} with the new password`);
  await browser.screenshot('AU-4-signed-in-with-new-password');

  const old = await api('POST', '/auth/login', { body: { username: USERNAME, password: SEED_PASSWORD } });
  console.log(`login with the old password answers ${old.status}`);
  if (old.status !== 401) throw new Error('the old password still works');
  console.log('AC-8 AU-S1 UI flow: PASS');
} catch (error) {
  await browser.screenshot('AU-failed').catch(() => undefined);
  throw error;
} finally {
  await browser.close();
  await restoreSeedPassword();
}
