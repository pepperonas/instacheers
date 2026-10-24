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

module.exports = { browser };
