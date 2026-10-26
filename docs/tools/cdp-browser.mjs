// Minimal headless Chrome driver over the DevTools protocol (Node 22+, no extra packages), shared by the
// browser evidence scripts under docs/product/features/*/supporting/. Values typed into fields are never printed.
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const DEFAULT_CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Starts Chrome and returns page helpers. `evidenceDir` receives the screenshots.
 * Call `close()` in a `finally` block.
 */
export const startBrowser = async ({ evidenceDir, port = 9333, chromeBin = process.env.CHROME_BIN ?? DEFAULT_CHROME }) => {
  mkdirSync(evidenceDir, { recursive: true });
  const profile = mkdtempSync(path.join(tmpdir(), 'qltn-cdp-'));
  const chrome = spawn(
    chromeBin,
    ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--window-size=1366,1000', 'about:blank'],
    { stdio: 'ignore' },
  );

  let socket;
  for (let attempt = 0; attempt < 120 && !socket; attempt += 1) {
    await sleep(250);
    try {
      const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const page = targets.find((target) => target.type === 'page');
      if (page) {
        const candidate = new WebSocket(page.webSocketDebuggerUrl);
        await new Promise((resolve, reject) => {
          candidate.onopen = resolve;
          candidate.onerror = reject;
        });
        socket = candidate;
      }
    } catch {
      // Chrome is still starting; retry until the debugging endpoint answers.
    }
  }
  if (!socket) {
    chrome.kill();
    throw new Error('Chrome did not expose a page target');
  }

  let nextId = 0;
  const pending = new Map();
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    const waiter = message.id ? pending.get(message.id) : undefined;
    if (!waiter) return;
    pending.delete(message.id);
    if (message.error) waiter.reject(new Error(message.error.message));
    else waiter.resolve(message.result);
  };
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      nextId += 1;
      pending.set(nextId, { resolve, reject });
      socket.send(JSON.stringify({ id: nextId, method, params }));
    });

  const evaluate = async (expression) => {
    const { result, exceptionDetails } = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
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
    const file = path.join(evidenceDir, `${name}.png`);
    writeFileSync(file, Buffer.from(data, 'base64'));
    console.log(`screenshot ${path.relative(process.cwd(), file)}`);
  };

  const navigate = async (url) => {
    await send('Page.navigate', { url });
    await waitFor(`document.readyState === 'complete'`, `load ${url}`);
  };

  /** Sets a form field through the native setter so React and react-hook-form see the change. */
  const setField = (selector, value) =>
    evaluate(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) throw new Error('missing ${selector}');
      Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value').set.call(el, ${JSON.stringify(value)});
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()`);

  /** Real mouse click at the element's centre (Radix triggers and items listen to pointer events). */
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

  /** Clicks the enabled button whose text or aria-label equals `name`, inside `scope` (a JS expression). */
  const clickButton = (name, scope = 'document') =>
    realClick(
      `[...${scope}.querySelectorAll('button')].find((b) => (b.textContent.trim() === ${JSON.stringify(name)} || b.getAttribute('aria-label') === ${JSON.stringify(name)}) && !b.disabled)`,
      `enabled button ${name}`,
    );

  const close = async () => {
    socket.close();
    chrome.kill();
    await sleep(500);
    rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
  };

  await send('Page.enable');
  await send('Runtime.enable');
  await send('DOM.enable');
  return { send, evaluate, waitFor, screenshot, navigate, setField, realClick, clickButton, close };
};

/** Signs in through the real login form (`/login`) after clearing any stored session. */
export const signInThroughForm = async (browser, webUrl, username, password) => {
  await browser.navigate(`${webUrl}/login`);
  await browser.evaluate('localStorage.clear(), sessionStorage.clear(), true');
  await browser.navigate(`${webUrl}/login`);
  await browser.waitFor(`document.querySelector('#login-username')`, 'login form');
  await browser.setField('#login-username', username);
  await browser.setField('#login-password', password);
  await browser.evaluate(`document.querySelector('#login-password').closest('form').requestSubmit(), true`);
  await browser.waitFor(`!location.pathname.startsWith('/login')`, `${username} signed in`);
};
