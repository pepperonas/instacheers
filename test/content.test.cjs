const test = require('node:test');
const assert = require('node:assert/strict');
const { createHarness } = require('./content-harness.cjs');

for (const hidden of [false, true]) {
  test(`clicks repeatedly with random delays in a ${hidden ? 'hidden' : 'visible'} tab`, async () => {
    const h = await createHarness({ hidden });
    const first = h.addButton('Follow');
    const second = h.addButton('Folgen');
    await h.start();
    await h.advance(4999);
    assert.equal(first.clicks, 0);
    await h.advance(1);
    assert.equal(first.clicks, 1);
    assert.equal(h.state.count, 1);
    await h.advance(4999);
    assert.equal(second.clicks, 0);
    await h.advance(1);
    assert.equal(second.clicks, 1);
    assert.equal(h.state.count, 2);
  });
}

test('switching tabs mid-run does not pause subsequent clicks', async () => {
  const h = await createHarness();
  const first = h.addButton();
  const second = h.addButton();
  await h.start();
  await h.advance(5000);
  assert.equal(first.clicks, 1);
  h.document.hidden = true;
  await h.advance(5000);
  assert.equal(second.clicks, 1);
  assert.equal(h.state.running, true);
});

test('the upper random-delay boundary is 15 seconds, including the first click', async () => {
  const h = await createHarness({ hidden: true, random: 0.99999 });
  const button = h.addButton();
  await h.start();
  await h.advance(14999);
  assert.equal(button.clicks, 0);
  await h.advance(1);
  assert.equal(button.clicks, 1);
  assert.equal(h.state.nextAt - h.now, 15000);
});

test('late background callbacks do not catch up with a burst of clicks', async () => {
  const h = await createHarness({ hidden: true });
  const first = h.addButton();
  const second = h.addButton();
  await h.start();
  await h.delayedCallback(60000);
  assert.equal(first.clicks, 1);
  assert.equal(second.clicks, 0);
  assert.equal(h.state.nextAt, h.now + 5000);
  await h.advance(4999);
  assert.equal(second.clicks, 0);
  await h.advance(1);
  assert.equal(second.clicks, 1);
});

for (const method of ['stop', 'escape']) {
  test(`${method} cancels a hidden-tab run and prevents later clicks`, async () => {
    const h = await createHarness({ hidden: true });
    const button = h.addButton();
    await h.start();
    h[method]();
    await h.advance(60000);
    assert.equal(button.clicks, 0);
    assert.equal(h.state.running, false);
    assert.equal(h.nodes.start.disabled, false);
    assert.equal(h.nodes.stop.disabled, true);
    assert.equal(h.reloads, 0);
  });
}

for (const reason of ['navigation', 'dialog', 'error']) {
  test(`still stops for ${reason} in a hidden tab`, async () => {
    const h = await createHarness({ hidden: true });
    const button = h.addButton();
    await h.start();
    if (reason === 'navigation') h.location.href += '?changed=1';
    if (reason === 'dialog') h.document.dialog = {};
    if (reason === 'error') h.document.alerts = [{ innerText: 'Try again later', getClientRects: () => [{}] }];
    await h.advance(5000);
    assert.equal(button.clicks, 0);
    assert.equal(h.state.running, false);
    assert.match(h.nodes.status.textContent, /stopped|restart/);
  });
}

test('an unconfirmed previous follow stops further background clicks', async () => {
  const h = await createHarness({ hidden: true });
  const first = h.addButton('Follow', { confirmed: false });
  const second = h.addButton();
  await h.start();
  await h.advance(10000);
  assert.equal(first.clicks, 1);
  assert.equal(second.clicks, 0);
  assert.equal(h.state.running, false);
  assert.match(h.nodes.status.textContent, /not confirmed/);
});

test('skips requested, disabled, dialog, and duplicate-profile buttons', async () => {
  const h = await createHarness({ hidden: true });
  const skipped = [h.addButton('Requested'), h.addButton('Angefragt'), h.addButton('Follow', { disabled: true }), h.addButton('Follow', { dialog: true })];
  const first = h.addButton('Follow', { profile: 'same-account' });
  const duplicate = h.addButton('Folgen', { profile: 'same-account' });
  const next = h.addButton('Follow', { profile: 'another-account' });
  await h.start();
  await h.advance(10000);
  assert.equal(first.clicks, 1);
  assert.equal(duplicate.clicks, 0);
  assert.equal(next.clicks, 1);
  for (const button of skipped) assert.equal(button.clicks, 0);
});

test('scrolls and saves a resumable reload in a hidden tab with no new accounts', async () => {
  const h = await createHarness({ hidden: true });
  await h.start();
  await h.advance(12000);
  assert.equal(h.scrolls, 7);
  assert.equal(h.reloads, 1);
  assert.equal(h.state.running, true);
  assert.equal(h.state.reloads, 1);
});

test('resumes a hidden-tab run without losing its deadline, count, or processed profiles', async () => {
  const h = await createHarness({ hidden: true, state: {
    running: true, startURL: 'https://www.instagram.com/explore/people/', count: 4,
    ids: ['/already-processed/'], reloads: 1, nextAt: 110000, scroll: false
  } });
  const duplicate = h.addButton('Follow', { profile: 'already-processed' });
  const next = h.addButton();
  await h.advance(9999);
  assert.equal(next.clicks, 0);
  await h.advance(1);
  assert.equal(next.clicks, 1);
  assert.equal(duplicate.clicks, 0);
  assert.equal(h.state.count, 5);
  assert.equal(h.state.scroll, false);
});

test('stops after three unsuccessful reloads even in a hidden tab', async () => {
  const h = await createHarness({ hidden: true, state: {
    running: true, startURL: 'https://www.instagram.com/explore/people/', reloads: 3, nextAt: 100000
  } });
  await h.advance(10000);
  assert.equal(h.reloads, 0);
  assert.equal(h.state.running, false);
  assert.match(h.nodes.status.textContent, /three reloads/);
});

test('does not resume a stopped run or a run belonging to another URL', async () => {
  for (const state of [
    { running: false, startURL: 'https://www.instagram.com/explore/people/' },
    { running: true, startURL: 'https://www.instagram.com/another-page/' }
  ]) {
    const h = await createHarness({ hidden: true, state });
    const button = h.addButton();
    await h.advance(60000);
    assert.equal(button.clicks, 0);
    assert.equal(h.timers.size, 0);
  }
});
