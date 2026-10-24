const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createHarness } = require('./content-harness.cjs');

test('the popup opens the renamed content-script API in the active Instagram tab', async () => {
  const page = await createHarness();
  let open, closed = false, showCalls = 0;
  const show = page.window.__instaCheersV3.show;
  page.window.__instaCheersV3.show = () => { showCalls++; show(); };
  const status = {};
  const injections = [];
  const project = path.join(__dirname, '..');
  vm.runInNewContext(fs.readFileSync(path.join(project, 'popup.js'), 'utf8'), {
    document: { getElementById: id => id === 'status' ? status : {
      addEventListener(event, fn) { open = fn; }
    } },
    window: { close() { closed = true; } },
    chrome: {
      tabs: { async query() { return [{ id: 7, url: page.location.href }]; } },
      scripting: { async executeScript(script) {
        assert.equal(script.target.tabId, 7);
        injections.push(script);
        if (script.files) {
          for (const file of script.files) page.run(fs.readFileSync(path.join(project, file), 'utf8'));
        } else {
          // Chrome executes serialized functions in the tab, without the popup's globals.
          page.run(`(${script.func.toString()})()`);
        }
      } }
    }
  });
  assert.equal(page.host.style.display, 'none');
  await open();
  assert.equal(injections.length, 2);
  assert.equal(showCalls, 2);
  assert.equal(page.host.style.display, '');
  assert.equal(status.textContent, undefined);
  assert.equal(closed, true);
});
