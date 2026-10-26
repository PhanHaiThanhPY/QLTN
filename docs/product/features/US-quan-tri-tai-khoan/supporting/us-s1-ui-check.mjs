// AC-9 evidence for US-S1: admin-demo resets kt-a2's password in the web (api mode) and sees the new history row,
// then kt-a2 signs in with the new password. The seed password is restored at the end, even on failure.
//
// Prerequisites: api-qltn on :5300 with demo seed, web dev server on :5190 started with VITE_DATA_SOURCE=api.
// Run from the repository root:
//   SEED_DEMO_PASSWORD="$(grep -E '^SEED_DEMO_PASSWORD=' api-qltn/.env | cut -d= -f2-)" \
//     node docs/product/features/US-quan-tri-tai-khoan/supporting/us-s1-ui-check.mjs
// Passwords are never printed.
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { signInThroughForm, startBrowser } from '../../../../tools/cdp-browser.mjs';
import { apiCall, restoreSeedPassword } from '../../../../tools/seed-accounts.mjs';

const WEB = process.env.WEB_URL ?? 'http://localhost:5190';
const SEED_PASSWORD = process.env.SEED_DEMO_PASSWORD;
const TARGET = 'kt-a2';
const TARGET_CODE = 'KT-A2';
const NEW_PASSWORD = `Us1-${randomBytes(6).toString('hex')}`;
const SUCCESS_TOAST = `Đã đặt lại mật khẩu cho «${TARGET_CODE}». Hãy gửi mật khẩu mới cho nhân viên qua kênh an toàn.`;
const EVIDENCE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'evidence');

if (!SEED_PASSWORD) throw new Error('SEED_DEMO_PASSWORD is not set');

/** Number of "Đặt lại mật khẩu" rows in the open history list. */
const RESET_ROWS = `[...document.querySelectorAll('[role=dialog] ol li')].filter((li) => li.textContent.includes('Đặt lại mật khẩu')).length`;

const browser = await startBrowser({ evidenceDir: EVIDENCE });
try {
  // 1. admin-demo opens KT-A2 in the employee screen and expands the history.
  await signInThroughForm(browser, WEB, 'admin-demo', SEED_PASSWORD);
  console.log('signed in as admin-demo');
  await browser.navigate(`${WEB}/admin/employees`);
  await browser.waitFor(`document.querySelector('input[aria-label="Tìm nhân viên"]')`, 'employee list', 30000);
  await browser.setField('input[aria-label="Tìm nhân viên"]', TARGET_CODE);
  await browser.waitFor(
    `[...document.querySelectorAll('tr')].some((tr) => tr.textContent.includes(${JSON.stringify(TARGET_CODE)}) && tr.querySelector('button'))`,
    'KT-A2 row',
  );
  await browser.realClick(
    `[...[...document.querySelectorAll('tr')].find((tr) => tr.textContent.includes(${JSON.stringify(TARGET_CODE)}) && tr.querySelector('button')).querySelectorAll('button')].find((b) => b.textContent.trim() === 'Sửa')`,
    'edit button of KT-A2',
  );
  await browser.waitFor(`document.body.innerText.includes('Sửa tài khoản ${TARGET_CODE}')`, 'employee dialog');
  await browser.clickButton('Lịch sử', `document.querySelector('[role=dialog]')`);
  await browser.waitFor(`document.querySelector('[role=dialog] ol li') || document.body.innerText.includes('Chưa có lịch sử.')`, 'history loaded');
  const before = await browser.evaluate(RESET_ROWS);
  await browser.screenshot('US-1-admin-employee-dialog-history');

  // 2. Reset the password through the confirmation dialog.
  await browser.clickButton('Đặt lại mật khẩu', `document.querySelector('[role=dialog]')`);
  await browser.waitFor(`document.querySelector('#rp-new')`, 'reset dialog');
  await browser.setField('#rp-new', NEW_PASSWORD);
  await browser.setField('#rp-confirm', NEW_PASSWORD);
  await browser.screenshot('US-2-reset-dialog-filled');
  await browser.clickButton('Đặt lại', `[...document.querySelectorAll('[role=dialog]')].at(-1)`);
  await browser.waitFor(`document.body.innerText.includes(${JSON.stringify(SUCCESS_TOAST)})`, 'success toast', 30000);
  await browser.waitFor(`${RESET_ROWS} > ${before}`, 'new history row');
  console.log(`history rows "Đặt lại mật khẩu": ${before} -> ${await browser.evaluate(RESET_ROWS)}`);
  await browser.screenshot('US-3-reset-toast-and-history');

  // 3. kt-a2 signs in with the new password; the old one is refused.
  await signInThroughForm(browser, WEB, TARGET, NEW_PASSWORD);
  console.log(`signed in as ${TARGET} with the new password`);
  await browser.screenshot('US-4-kt-a2-signed-in-with-new-password');
  const old = await apiCall(WEB, 'POST', '/auth/login', { body: { username: TARGET, password: SEED_PASSWORD } });
  console.log(`login with the old password answers ${old.status}`);
  if (old.status !== 401) throw new Error('the old password still works');
  console.log('AC-9 US-S1 UI flow: PASS');
} catch (error) {
  await browser.screenshot('US-failed').catch(() => undefined);
  throw error;
} finally {
  await browser.close();
  await restoreSeedPassword(WEB, TARGET, SEED_PASSWORD);
}
