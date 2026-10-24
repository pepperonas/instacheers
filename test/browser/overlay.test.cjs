const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { once } = require('node:events');

async function browser(t) {
  const executable = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  assert.ok(fs.existsSync(executable), 'Set CHROME_PATH to a Chrome/Chromium executable.');
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'instacheers-focus-'));
  const child = spawn(executable, [
    '--headless=new', '--no-first-run', '--no-default-browser-check',
    '--remote-debugging-pipe', '--user-data-dir=' + profile, 'about:blank'
  ], { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'] });
  const exited = once(child, 'exit');
  let id = 0, buffer = '';
  const pending = new Map();
  function send(method, params = {}, sessionId) {
    return new Promise((resolve, reject) => {
      const messageID = ++id;
      const timeout = setTimeout(() => {
        pending.delete(messageID);
        reject(new Error('Chrome protocol timed out: ' + method));
      }, 10000);
      pending.set(messageID, { resolve, reject, timeout });
      child.stdio[3].write(JSON.stringify({ id: messageID, method, params, sessionId }) + '\0');
    });
  }
  child.stdio[4].on('data', chunk => {
    buffer += chunk;
    let end;
    while ((end = buffer.indexOf('\0')) !== -1) {
      const message = JSON.parse(buffer.slice(0, end));
      buffer = buffer.slice(end + 1);
      const request = pending.get(message.id);
      if (!request) continue;
      pending.delete(message.id);
      clearTimeout(request.timeout);
      if (message.error) request.reject(new Error(message.error.message));
      else request.resolve(message.result);
    }
  });
  child.on('error', error => {
    for (const request of pending.values()) { clearTimeout(request.timeout); request.reject(error); }
    pending.clear();
  });
  t.after(async () => {
    try { await send('Browser.close'); } catch { child.kill(); }
    await exited;
    for (const request of pending.values()) { clearTimeout(request.timeout); request.reject(new Error('Chrome closed')); }
    await fs.promises.rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  });
  const { targetInfos } = await send('Target.getTargets');
  const { sessionId } = await send('Target.attachToTarget', { targetId: targetInfos.find(target => target.type === 'page').targetId, flatten: true });
  return {
    send: (method, params) => send(method, params, sessionId),
    async evaluate(expression) {
      const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId);
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.text + ': ' + result.exceptionDetails.exception?.description);
      return result.result.value;
    }
  };
}

test('typing camping stays in the overlay despite document shortcuts; native editing and Escape still work', { timeout: 30000 }, async t => {
  const chrome = await browser(t);
  await chrome.evaluate(`
    document.body.innerHTML = '<input id="page-search" placeholder="Search">';
    window.pageKeys = 0; window.pageClicks = 0; window.laterWindowKeys = 0;
    // A page shortcut sees the shadow host instead of the inner input.
    // Register it before the content script, in the document capture phase.
    document.addEventListener('keydown', event => {
      pageKeys++;
      if (event.key === 'i' && !event.target.matches('input,textarea')) {
        document.getElementById('page-search').focus();
      }
    }, true);
    document.addEventListener('click', () => pageClicks++);
    window.chrome = { runtime: { async sendMessage(message) {
      if (message.type === 'follow:set') window.runState = structuredClone(message.state);
      return null;
    } } };
  `);
  const root = path.join(__dirname, '..', '..');
  for (const file of ['discovery.js', 'content.js']) await chrome.evaluate(fs.readFileSync(path.join(root, file), 'utf8'));
  await chrome.evaluate(`
    window.overlay = [...document.documentElement.children].find(node => node.shadowRoot).shadowRoot;
    window.__instaCheersV3.show();
    window.addEventListener('keydown', () => laterWindowKeys++, true);
    overlay.getElementById('keyword').focus();
  `);
  async function key(key, text, code, modifiers = 0) {
    await chrome.send('Input.dispatchKeyEvent', { type: 'keyDown', key, text, windowsVirtualKeyCode: code, modifiers });
    await chrome.send('Input.dispatchKeyEvent', { type: 'keyUp', key, windowsVirtualKeyCode: code, modifiers });
  }
  for (const char of 'camping') await key(char, char, char.toUpperCase().charCodeAt(0));
  assert.equal(await chrome.evaluate(`overlay.getElementById('keyword').value`), 'camping');
  assert.equal(await chrome.evaluate(`overlay.activeElement.id`), 'keyword');
  assert.equal(await chrome.evaluate(`document.getElementById('page-search').value`), '');
  assert.equal(await chrome.evaluate('pageKeys'), 0);
  assert.equal(await chrome.evaluate('laterWindowKeys'), 0);

  await key('Backspace', undefined, 8);
  assert.equal(await chrome.evaluate(`overlay.getElementById('keyword').value`), 'campin');
  await chrome.send('Input.insertText', { text: 'g & hiking' });
  assert.equal(await chrome.evaluate(`overlay.getElementById('keyword').value`), 'camping & hiking');
  await key('Tab', undefined, 9);
  assert.equal(await chrome.evaluate('overlay.activeElement.id'), 'limit');
  await key('Tab', undefined, 9, 8);
  assert.equal(await chrome.evaluate('overlay.activeElement.id'), 'keyword');

  const point = await chrome.evaluate(`(() => {
    const rect = overlay.getElementById('start').getBoundingClientRect();
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  })()`);
  await chrome.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
  await chrome.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
  assert.equal(await chrome.evaluate('runState.running'), true);
  assert.equal(await chrome.evaluate('pageClicks'), 0);
  await chrome.evaluate(`overlay.getElementById('stop').focus()`);
  await key('Escape', undefined, 27);
  assert.equal(await chrome.evaluate('runState.running'), false);

  await chrome.evaluate(`document.getElementById('page-search').focus()`);
  await key('i', 'i', 73);
  assert.equal(await chrome.evaluate(`document.getElementById('page-search').value`), 'i');
  assert.ok(await chrome.evaluate('pageKeys > 0 && laterWindowKeys > 0'));
});
