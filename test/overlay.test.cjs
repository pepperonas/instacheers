const test = require('node:test');
const assert = require('node:assert/strict');
const { createHarness } = require('./content-harness.cjs');

function event(path, key = 'i') {
  return {
    key, stopped: false,
    composedPath: () => path,
    stopImmediatePropagation() { this.stopped = true; },
    preventDefault() { assert.fail('Native editing and focus navigation must remain enabled'); }
  };
}

test('isolates all overlay keyboard phases before document capture without canceling native behavior', async () => {
  const h = await createHarness();
  for (const type of ['keydown', 'keypress', 'keyup']) {
    const listener = h.windowListeners.get(type);
    assert.equal(listener.capture, true);
    const inside = event([h.nodes.keyword, h.host, h.document, h.window]);
    listener.fn(inside);
    assert.equal(inside.stopped, true);
    // Instagram input events and shortcuts outside the overlay must still work.
    const outside = event([{}, h.document, h.window]);
    listener.fn(outside);
    assert.equal(outside.stopped, false);
  }
});

test('Escape inside the overlay stops a running session even though page keyboard listeners are bypassed', async () => {
  const h = await createHarness();
  await h.start();
  const escape = event([h.nodes.stop, h.host, h.document, h.window], 'Escape');
  h.windowListeners.get('keydown').fn(escape);
  assert.equal(escape.stopped, true);
  assert.equal(h.state.running, false);
  assert.equal(h.nodes.status.textContent, 'Stopped.');
  await h.advance(20000);
  assert.equal(h.reloads, 0);
});

test('editing and control interactions stop at the shadow boundary without preventing their defaults', async () => {
  const h = await createHarness();
  for (const type of ['beforeinput', 'input', 'change', 'compositionstart', 'compositionupdate', 'compositionend', 'copy', 'cut', 'paste', 'click', 'dblclick', 'pointerdown', 'pointerup', 'mousedown', 'mouseup', 'focusin', 'focusout']) {
    let stopped = false;
    h.rootListeners.get(type)({
      stopPropagation() { stopped = true; },
      preventDefault() { assert.fail('Control interaction defaults must remain enabled'); }
    });
    assert.equal(stopped, true, type);
  }
});
