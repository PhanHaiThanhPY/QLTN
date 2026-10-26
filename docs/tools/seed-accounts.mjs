// Demo-account helpers for the browser evidence scripts: API calls through the web dev proxy, a login that waits out
// the 10/min/IP limit, and restoring a seed password through the admin reset endpoint. Passwords are never printed.
import { sleep } from './cdp-browser.mjs';

/** JSON call to api-qltn through the web dev proxy (`<webUrl>/api`). */
export const apiCall = async (webUrl, method, url, { token, body } = {}) => {
  const res = await fetch(`${webUrl}/api${url}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json() };
};

/** Login is limited to 10 requests per minute per IP; wait for the window instead of failing. */
export const loginWithRetry = async (webUrl, username, password) => {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const res = await apiCall(webUrl, 'POST', '/auth/login', { body: { username, password } });
    if (res.status !== 429) return res;
    console.log(`login ${username} rate-limited, retrying in 65 s (attempt ${attempt}/3)`);
    await sleep(65_000);
  }
  throw new Error(`login ${username} stayed rate-limited`);
};

/** Puts `username` back on the seed password through `POST /users/:id/reset-password` as admin-demo. */
export const restoreSeedPassword = async (webUrl, username, seedPassword) => {
  const admin = await loginWithRetry(webUrl, 'admin-demo', seedPassword);
  if (admin.status !== 200) throw new Error(`admin login answered ${admin.status}`);
  const token = admin.body.data.accessToken;
  const code = username.toUpperCase();
  const users = await apiCall(webUrl, 'GET', `/users?q=${encodeURIComponent(code)}&limit=10`, { token });
  if (users.status !== 200) throw new Error(`listing users answered ${users.status}`);
  const user = users.body.data.data.find((row) => row.code === code);
  const reset = await apiCall(webUrl, 'POST', `/users/${user.id}/reset-password`, { token, body: { password: seedPassword } });
  const check = await loginWithRetry(webUrl, username, seedPassword);
  console.log(`seed password restored: reset ${reset.status}, login ${check.status}`);
};
