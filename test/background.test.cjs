const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function createBackground() {
  let listener, removed;
  const stored = new Map();
  const context = {
    chrome: {
      runtime: { onMessage: { addListener(fn) { listener = fn; } } },
      tabs: { onRemoved: { addListener(fn) { removed = fn; } } },
      storage: { session: {
        async set(values) { for (const [key, value] of Object.entries(values)) stored.set(key, value); },
        async get(key) { return { [key]: stored.get(key) }; },
        async remove(key) { stored.delete(key); }
      } }
    }
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'background.js'), 'utf8'), context);
  return {
    context,
    removed: id => removed(id),
    raw: (...args) => listener(...args),
    message: (type, id, state) => new Promise(resolve => {
      assert.equal(listener({ type, state }, { tab: { id } }, resolve), true);
    })
  };
}

test('session state survives reads and remains isolated between tabs', async () => {
  const h = createBackground();
  const first = { running: true, count: 3, nextAt: 120000, ids: ['/sample/'] };
  const second = { running: false, count: 1 };
  assert.equal(await h.message('follow:get', 1), null);
  assert.deepEqual(await h.message('follow:set', 1, first), first);
  await h.message('follow:set', 2, second);
  assert.deepEqual(await h.message('follow:get', 1), first);
  assert.deepEqual(await h.message('follow:get', 2), second);
  await h.removed(1);
  assert.equal(await h.message('follow:get', 1), null);
  assert.deepEqual(await h.message('follow:get', 2), second);
});

test('ignores unsupported messages and messages without a sender tab', () => {
  const h = createBackground();
  const reply = () => assert.fail('Unexpected reply');
  assert.equal(h.raw({ type: 'unknown' }, { tab: { id: 1 } }, reply), undefined);
  assert.equal(h.raw({ type: 'follow:set' }, {}, reply), undefined);
});

test('returns storage errors through the asynchronous reply', async () => {
  const h = createBackground();
  h.context.chrome.storage.session.get = async () => { throw new Error('Storage unavailable'); };
  const reply = await h.message('follow:get', 1);
  assert.equal(reply.error, 'Storage unavailable');
});
