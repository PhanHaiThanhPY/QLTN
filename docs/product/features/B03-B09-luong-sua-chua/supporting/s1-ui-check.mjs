// AC-0.3 evidence for slice S1: drives the real web UI in api mode with headless Chrome (CDP, no extra packages).
//
// Prerequisites: api-qltn on :5300 with demo seed, web dev server on :5190 started with VITE_DATA_SOURCE=api.
// Run from the repository root:
//   SEED_DEMO_PASSWORD="$(grep -E '^SEED_DEMO_PASSWORD=' api-qltn/.env | cut -d= -f2-)" \
//     node docs/product/features/B03-B09-luong-sua-chua/supporting/s1-ui-check.mjs
// Flow: bql-a creates and submits a record with one site photo through the form, then kt-a opens the record and
// clicks "Xác nhận cần sửa". Screenshots land next to this script in evidence/. The password is never printed.
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const WEB = process.env.WEB_URL ?? 'http://localhost:5190';
const CHROME = process.env.CHROME_BIN ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PASSWORD = process.env.SEED_DEMO_PASSWORD;
const PORT = 9333;
const HERE = path.dirname(fileURLToPath(import.meta.url));
const EVIDENCE = path.join(HERE, 'evidence');
const RUN = new Date().toISOString().replace(/[-:]/g, '').slice(0, 13);
const TITLE = `[TEST S1 UI] Thấm trần hành lang ${RUN}`;
const NOTE = 'Đã kiểm tra hiện trường, cần thay đoạn ống cấp bị rò.';

if (!PASSWORD) throw new Error('SEED_DEMO_PASSWORD is not set');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** 16x16 solid PNG built in memory, so the upload passes the API's magic-byte check. */
const pngFile = () => {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
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
  const size = 16;
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 2, 0, 0, 0], 8);
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(size * 3, 0x7f)]);
  const pixels = deflateSync(Buffer.concat(Array.from({ length: size }, () => row)));
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', pixels),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  const file = path.join(mkdtempSync(path.join(tmpdir(), 's1-ui-')), 'hien-truong.png');
  writeFileSync(file, png);
  return file;
};

const profile = mkdtempSync(path.join(tmpdir(), 's1-ui-chrome-'));
const chrome = spawn(
  CHROME,
  ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--window-size=1366,1000', 'about:blank'],
  { stdio: 'ignore' },
);

let socket;
let nextId = 0;
const pending = new Map();
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    nextId += 1;
    pending.set(nextId, { resolve, reject });
    socket.send(JSON.stringify({ id: nextId, method, params }));
  });

const evaluate = async (expression) => {
  const { result, exceptionDetails } = await send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (exceptionDetails) throw new Error(`evaluate failed: ${exceptionDetails.exception?.description ?? exceptionDetails.text}`);
  return result.value;
};

const waitFor = async (expression, label, timeoutMs = 20000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await evaluate(`Boolean(${expression})`)) return;
    await sleep(250);
  }
  throw new Error(`timed out waiting for ${label}`);
};

const screenshot = async (name) => {
  const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  const file = path.join(EVIDENCE, `${name}.png`);
  writeFileSync(file, Buffer.from(data, 'base64'));
  console.log(`screenshot ${path.relative(process.cwd(), file)}`);
};

const navigate = async (url) => {
  await send('Page.navigate', { url });
  await waitFor(`document.readyState === 'complete'`, `load ${url}`);
};

/** Sets a React-controlled field through the native setter so the change handlers fire. */
const setField = (selector, value) =>
  evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) throw new Error('missing ${selector}');
    const proto = Object.getPrototypeOf(el);
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(value)});
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);

/** Real mouse click at the element's centre (Radix triggers and items listen to pointer events, not `click()`). */
const realClick = async (elementExpression, label) => {
  const point = await evaluate(`(() => {
    const el = ${elementExpression};
    if (!el) return null;
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  })()`);
  if (!point) throw new Error(`missing ${label}`);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x, y: point.y });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1 });
};

const clickButton = (text, scope = 'document') =>
  realClick(
    `[...${scope}.querySelectorAll('button')].find((b) => b.textContent.trim() === ${JSON.stringify(text)} && !b.disabled)`,
    `enabled button ${text}`,
  );

const signIn = async (username) => {
  await navigate(`${WEB}/login`);
  await evaluate('localStorage.clear(), sessionStorage.clear(), true');
  await navigate(`${WEB}/login`);
  await waitFor(`document.querySelector('#login-username')`, 'login form');
  await setField('#login-username', username);
  await setField('#login-password', PASSWORD);
  await evaluate(`document.querySelector('#login-password').closest('form').requestSubmit(), true`);
  await waitFor(`!location.pathname.startsWith('/login')`, `${username} signed in`);
  console.log(`signed in as ${username}`);
};

const main = async () => {
  mkdirSync(EVIDENCE, { recursive: true });
  for (let attempt = 0; attempt < 120 && !socket; attempt += 1) {
    await sleep(250);
    try {
      const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = targets.find((t) => t.type === 'page');
      if (page) {
        socket = new WebSocket(page.webSocketDebuggerUrl);
        await new Promise((resolve, reject) => {
          socket.onopen = resolve;
          socket.onerror = reject;
        });
      }
    } catch {
      // Chrome is still starting; retry until the debugging endpoint answers.
    }
  }
  if (!socket) throw new Error('Chrome did not expose a page target');
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    const waiter = message.id ? pending.get(message.id) : undefined;
    if (!waiter) return;
    pending.delete(message.id);
    if (message.error) waiter.reject(new Error(message.error.message));
    else waiter.resolve(message.result);
  };
  await send('Page.enable');
  await send('Runtime.enable');
  await send('DOM.enable');

  // 1. bql-a creates and submits the record through the form.
  await signIn('bql-a');
  await navigate(`${WEB}/records/new`);
  await waitFor(`document.querySelector('#rf-title') && document.querySelector('#rf-location')`, 'record form', 60000);
  // Location: open the Radix select and pick the first real location.
  await realClick(`document.querySelector('#rf-location')`, 'location select');
  await waitFor(`document.querySelectorAll('[role=option]').length > 1`, 'location options');
  await realClick(
    `[...document.querySelectorAll('[role=option]')].find((o) => !o.textContent.includes('Chọn vị trí'))`,
    'first location',
  );
  await waitFor(`!document.querySelector('#rf-location').textContent.includes('Chọn vị trí')`, 'location chosen');
  await evaluate(`(() => { const box = document.querySelector('#rf-no-item'); if (box && !box.checked) box.click(); return true; })()`);
  await setField('#rf-title', TITLE);
  await setField('#rf-description', 'Nước thấm từ trần hành lang tầng 3 xuống sàn khi mưa, cần kiểm tra ống cấp.');
  const { root } = await send('DOM.getDocument', { depth: -1 });
  const { nodeId } = await send('DOM.querySelector', { nodeId: root.nodeId, selector: 'input[type=file]' });
  await send('DOM.setFileInputFiles', { nodeId, files: [pngFile()] });
  await sleep(500);
  await screenshot('S1-1-bql-a-form-filled');
  await clickButton('Gửi xác nhận');
  await waitFor(`/^\\/records\\/[0-9a-f-]{36}$/.test(location.pathname)`, 'record detail after submit', 30000);
  await waitFor(`document.body.innerText.includes('Chờ xác nhận')`, 'status Chờ xác nhận');
  const recordPath = await evaluate('location.pathname');
  console.log(`submitted ${recordPath}`);
  await screenshot('S1-2-bql-a-submitted');

  // 2. kt-a opens the same record and confirms the repair.
  await signIn('kt-a');
  await navigate(`${WEB}${recordPath}`);
  await waitFor(`[...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Xác nhận cần sửa' && !b.disabled)`, 'confirm button');
  await screenshot('S1-3-kt-a-before-confirm');
  await clickButton('Xác nhận cần sửa');
  await waitFor(`document.querySelector('#reason-text')`, 'confirm dialog');
  await setField('#reason-text', NOTE);
  await clickButton('Xác nhận cần sửa', `document.querySelector('[role=dialog]')`);
  await waitFor(`document.body.innerText.includes('Chờ lập tờ trình')`, 'status Chờ lập tờ trình', 30000);
  await waitFor(`document.body.innerText.includes('Lịch sử xác nhận hiện trạng') && document.body.innerText.includes(${JSON.stringify(NOTE)})`, 'confirmation history with the note');
  await screenshot('S1-4-kt-a-confirmed-history');
  console.log('AC-0.3 S1 UI flow: PASS');
};

try {
  await main();
} catch (error) {
  // Keep what the page showed when a step failed, then fail the run.
  if (socket) await screenshot('S1-failed').catch(() => undefined);
  if (socket) console.error(await evaluate('location.pathname + "\\n" + document.body.innerText.slice(0, 800)').catch(() => ''));
  throw error;
} finally {
  socket?.close();
  chrome.kill();
  await sleep(500);
  rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
}
