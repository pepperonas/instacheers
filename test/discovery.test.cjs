const test = require('node:test');
const assert = require('node:assert/strict');
const { createHarness } = require('./content-harness.cjs');

const profileState = (overrides = {}) => ({
  running: true, startURL: 'https://www.instagram.com/camping.one/', nextAt: 100000,
  ids: [], count: 0,
  discovery: { keyword: 'camping', phase: 'profile', limit: 10, current: '/camping.one/', queue: ['/camping.two/'], profileStartedAt: 100000 },
  ...overrides
});

async function createProfileHarness(options) {
  return createHarness({ ...options, href: options.state.startURL });
}

test('uses the native search input and only collects matching same-origin account links', async () => {
  const h = await createHarness();
  const input = h.openSearch([
    'Camping.One', 'camping.one', 'other',
    { name: 'Camping Two', href: '/camping.two/' },
    { name: 'Camping posts', href: '/p/ABC/' },
    { name: 'Camping elsewhere', href: 'https://example.com/camping/' },
    { name: 'Camping hidden', href: '/camping.hidden/', hidden: true },
    { name: 'Camping navigation', href: '/camping.nav/', navigation: true },
    { name: 'Camping explore', href: '/explore/' }
  ]);
  await h.search('camping', 2);
  await h.advance(1000);
  assert.equal(input.value, 'camping');
  assert.equal(input.lastEvent.type, 'input');
  assert.equal(input.lastEvent.bubbles, true);
  await h.advance(5000);
  assert.equal(h.location.href, 'https://www.instagram.com/camping.one/');
  assert.equal(h.state.discovery.phase, 'profile');
  assert.deepEqual(h.state.discovery.queue, ['/camping.two/']);
  assert.equal(h.state.startURL, h.location.href);
  assert.equal(h.state.count, 0);
});

test('does not broaden search discovery to the whole page', async () => {
  const h = await createHarness();
  const input = h.openSearch(['camping.suggestion']);
  input.parentElement.querySelector = () => ({}); // The ancestor contains page navigation.
  await h.search();
  await h.advance(20000);
  assert.equal(h.state.running, false);
  assert.match(h.nodes.status.textContent, /No matching accounts/);
  assert.equal(h.location.href, 'https://www.instagram.com/explore/people/');
});

test('rejects empty keywords and invalid account limits without starting', async () => {
  const h = await createHarness();
  h.openSearch(['camping.one']);
  for (const [query, limit] of [[' ', 10], ['x'.repeat(101), 10], ['camping', 0], ['camping', 51], ['camping', 1.5]]) {
    await h.search(query, limit);
    assert.equal(h.state, undefined);
    assert.equal(h.timers.size, 0);
  }
});

test('explains when the Instagram search surface is unavailable', async () => {
  const h = await createHarness();
  await h.search();
  assert.match(h.nodes.status.textContent, /search was not found/);
  assert.equal(h.state, undefined);
});

test('Stop during search prevents later profile navigation and clicks', async () => {
  const h = await createHarness();
  h.openSearch(['camping.one']);
  await h.search();
  await h.advance(1000);
  h.stop();
  await h.advance(30000);
  assert.equal(h.state.running, false);
  assert.equal(h.location.href, 'https://www.instagram.com/explore/people/');
  assert.equal(h.nodes.search.disabled, false);
});

test('a profile run follows only the profile header, waits, and saves the next navigation', async () => {
  const h = await createProfileHarness({ hidden: true, state: profileState() });
  const suggested = h.addButton();
  const target = h.addButton();
  h.document.profileHeader = { querySelectorAll: () => [target] };
  await h.advance(2500);
  assert.equal(target.clicks, 1);
  assert.equal(suggested.clicks, 0);
  assert.equal(h.state.count, 1);
  assert.ok(h.state.ids.includes('/camping.one/'));
  await h.advance(4999);
  assert.equal(h.location.href, 'https://www.instagram.com/camping.one/');
  await h.advance(1);
  assert.equal(h.location.href, 'https://www.instagram.com/camping.two/');
  assert.equal(h.state.startURL, h.location.href);
});

for (const label of ['Following', 'Requested', 'Gefolgt', 'Angefragt']) {
  test(`skips a profile marked ${label} without clicking`, async () => {
    const h = await createProfileHarness({ state: profileState() });
    const button = h.addButton(label);
    h.document.profileHeader = { querySelectorAll: () => [button] };
    await h.advance(2500);
    assert.equal(button.clicks, 0);
    assert.equal(h.location.href, 'https://www.instagram.com/camping.two/');
    assert.equal(h.state.count, 0);
  });
}

test('does not advance to another account if the follow was not confirmed', async () => {
  const h = await createProfileHarness({ state: profileState() });
  const button = h.addButton('Follow', { confirmed: false });
  h.document.profileHeader = { querySelectorAll: () => [button] };
  await h.advance(7500);
  assert.equal(button.clicks, 1);
  assert.equal(h.state.running, false);
  assert.match(h.nodes.status.textContent, /not confirmed/);
  assert.equal(h.location.href, 'https://www.instagram.com/camping.one/');
});

test('stops instead of following suggested accounts if the profile header is missing', async () => {
  const h = await createProfileHarness({ state: profileState() });
  const suggested = h.addButton();
  await h.advance(20500);
  assert.equal(suggested.clicks, 0);
  assert.equal(h.state.running, false);
  assert.match(h.nodes.status.textContent, /Profile controls not found/);
});

test('finishes the search when its last queued profile is already processed', async () => {
  const state = profileState({ ids: ['/camping.one/'], count: 3 });
  state.discovery.queue = [];
  const h = await createProfileHarness({ state });
  await h.advance(2500);
  assert.equal(h.state.running, false);
  assert.equal(h.state.count, 3);
  assert.match(h.nodes.status.textContent, /Search complete/);
});

test('a resumed profile run honors its persisted click deadline', async () => {
  const h = await createProfileHarness({ state: profileState({ nextAt: 110000 }) });
  const button = h.addButton();
  h.document.profileHeader = { querySelectorAll: () => [button] };
  await h.advance(9999);
  assert.equal(button.clicks, 0);
  await h.advance(1);
  assert.equal(button.clicks, 1);
});

test('rechecks an unconfirmed follow after a profile reload instead of clicking or advancing', async () => {
  const state = profileState({ ids: ['/camping.one/'], count: 1 });
  state.discovery.awaitingConfirmation = true;
  const h = await createProfileHarness({ state });
  const button = h.addButton();
  h.document.profileHeader = { querySelectorAll: () => [button] };
  await h.advance(2500);
  assert.equal(button.clicks, 0);
  assert.equal(h.state.running, false);
  assert.match(h.nodes.status.textContent, /not confirmed/);
  assert.equal(h.location.href, state.startURL);
});

test('refuses to process a different profile than the queued target', async () => {
  const state = profileState({ startURL: 'https://www.instagram.com/unrelated/' });
  const h = await createProfileHarness({ state });
  const button = h.addButton();
  h.document.profileHeader = { querySelectorAll: () => [button] };
  await h.advance(2500);
  assert.equal(button.clicks, 0);
  assert.equal(h.state.running, false);
  assert.match(h.nodes.status.textContent, /Unexpected profile/);
});

test('changing the native search query stops the pending account discovery', async () => {
  const h = await createHarness();
  const input = h.openSearch(['camping.one']);
  await h.search();
  await h.advance(1000);
  input.value = 'another topic';
  await h.advance(1000);
  assert.equal(h.state.running, false);
  assert.match(h.nodes.status.textContent, /Search term changed/);
});

test('opens native search through a labeled navigation icon before entering the query', async () => {
  const h = await createHarness();
  h.document.triggers = [{
    innerText: '', getClientRects: () => [{}], getAttribute: () => null,
    querySelector: () => ({ getAttribute: () => 'Search' }),
    click() { h.openSearch(['camping.one']); }
  }];
  await h.search();
  await h.advance(6000);
  assert.equal(h.location.href, 'https://www.instagram.com/camping.one/');
});

test('a complete search resumes across multiple profile page loads and stops at its limit', async () => {
  const search = await createHarness();
  search.openSearch(['camping.one', 'camping.two', 'camping.three']);
  await search.search('camping', 2);
  await search.advance(6000);
  const first = await createHarness({ href: search.location.href, state: search.state, startAt: search.now });
  const firstButton = first.addButton();
  first.document.profileHeader = { querySelectorAll: () => [firstButton] };
  await first.advance(8500);
  assert.equal(firstButton.clicks, 1);
  assert.equal(first.location.href, 'https://www.instagram.com/camping.two/');
  const second = await createHarness({ href: first.location.href, state: first.state, startAt: first.now });
  const secondButton = second.addButton('Requested');
  second.document.profileHeader = { querySelectorAll: () => [secondButton] };
  await second.advance(10000);
  assert.equal(secondButton.clicks, 0);
  assert.equal(second.state.count, 1);
  assert.equal(second.state.running, false);
  assert.match(second.nodes.status.textContent, /Search complete/);
  assert.equal(second.location.href, 'https://www.instagram.com/camping.two/');
});

test('Stop while the queue is being saved cancels the pending navigation', async () => {
  const h = await createProfileHarness({ state: profileState({ ids: ['/camping.one/'] }) });
  let release, saved;
  const saveStarted = new Promise(resolve => { saved = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  h.setSaveHandler(message => {
    if (message.state.running) { saved(); return gate; }
    return null;
  });
  const tick = h.advance(2500);
  await saveStarted;
  assert.equal(h.location.href, 'https://www.instagram.com/camping.one/');
  h.stop();
  release();
  await tick;
  assert.equal(h.location.href, 'https://www.instagram.com/camping.one/');
  assert.equal(h.state.running, false);
});

test('a storage error stops the run before opening the next profile', async () => {
  const h = await createProfileHarness({ state: profileState({ ids: ['/camping.one/'] }) });
  // Let Stop persist successfully after the failed queue save.
  let failed = false;
  h.setSaveHandler(message => {
    if (message.state.running && !failed) { failed = true; return { error: 'Storage unavailable' }; }
    return null;
  });
  await h.advance(2500);
  assert.equal(h.location.href, 'https://www.instagram.com/camping.one/');
  assert.equal(h.state.running, false);
  assert.match(h.nodes.status.textContent, /Storage unavailable/);
});
