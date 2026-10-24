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
  assert.ok(input.events.some(event => event.type === 'input' && event.composed));
  assert.equal(input.focused, true);
  assert.equal(input.clicked, true);
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
  assert.match(h.nodes.status.textContent, /No matching account/);
  assert.equal(h.location.href, 'https://www.instagram.com/explore/people/');
});

test('rejects empty keywords and invalid account limits without starting', async () => {
  const h = await createHarness();
  h.openSearch(['camping.one']);
  for (const [query, limit] of [[' ', 10], ['x'.repeat(101), 10], ['camping', 0], ['camping', 101], ['camping', 1.5]]) {
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
  assert.match(second.nodes.status.textContent, /Account limit reached/);
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

test('activates a read-only Explore search launcher instead of filling it', async () => {
  const h = await createHarness({ href: 'https://www.instagram.com/explore/' });
  const launcher = h.openSearch();
  launcher.readOnly = true;
  launcher.click = () => { h.openSearch(['camping.one']); };
  h.document.triggers = [launcher];
  await h.search();
  assert.equal(launcher.value, '');
  await h.advance(6000);
  assert.equal(h.location.href, 'https://www.instagram.com/camping.one/');
});

test('collects search results linked through aria-controls outside the input ancestors', async () => {
  const h = await createHarness();
  const input = h.openSearch();
  const original = input.getAttribute;
  input.getAttribute = name => name === 'aria-controls' ? 'account-results' : original(name);
  h.document.portals['account-results'] = {
    getClientRects: () => [{}],
    querySelectorAll: () => [{
      innerText: '', href: '/camping.hiddenlabel/',
      getClientRects: () => [{}], closest: () => null
    }]
  };
  await h.search();
  await h.advance(6000);
  assert.equal(h.location.href, 'https://www.instagram.com/camping.hiddenlabel/');
});

test('does not reject an inline Explore search simply because it is inside main', async () => {
  const h = await createHarness();
  const input = h.openSearch(['camping.one']);
  const searchMain = input.parentElement;
  const wrapper = { querySelector: selector => selector === 'main' ? { contains: node => node === input } : null, querySelectorAll: searchMain.querySelectorAll };
  input.parentElement = wrapper;
  await h.search();
  await h.advance(6000);
  assert.equal(h.location.href, 'https://www.instagram.com/camping.one/');
});

test('reopens and resubmits a saved keyword search after refresh with a fresh discovery deadline', async () => {
  const h = await createHarness({ state: {
    running: true, keyword: 'camping', limit: '2', startURL: 'https://www.instagram.com/explore/people/',
    discovery: { keyword: 'camping', limit: 2, phase: 'search', startedAt: 1, queue: [] }
  } });
  const input = h.openSearch(['camping.one']);
  await h.advance(7500);
  assert.equal(input.value, 'camping');
  assert.equal(h.location.href, 'https://www.instagram.com/camping.one/');
});

test('retains the edited keyword, limit, and stopped status after refreshing without restarting', async () => {
  const h = await createHarness();
  h.nodes.keyword.value = 'camping';
  h.nodes.limit.value = '4';
  h.nodes.keyword.oninput();
  const saved = h.state;
  assert.equal(saved.keyword, 'camping');
  assert.equal(saved.limit, '4');
  assert.equal(saved.running, false);
  const refreshed = await createHarness({ state: saved });
  assert.equal(refreshed.nodes.keyword.value, 'camping');
  assert.equal(refreshed.nodes.limit.value, '4');
  assert.equal(refreshed.nodes.status.textContent, 'Ready to search.');
  assert.equal(refreshed.host.style.display, '');
  assert.equal(refreshed.timers.size, 0);
});

test('does not reload an Explore post grid without Follow buttons', async () => {
  const h = await createHarness({ href: 'https://www.instagram.com/explore/' });
  await h.start();
  await h.advance(60000);
  assert.equal(h.reloads, 0);
  assert.equal(h.state.running, false);
  assert.match(h.nodes.status.textContent, /No Follow buttons/);
});

test('Start with a keyword runs account search instead of the empty-page reload loop', async () => {
  const h = await createHarness({ href: 'https://www.instagram.com/explore/' });
  h.nodes.keyword.value = 'camping';
  h.openSearch(['camping.one']);
  await h.start();
  await h.advance(6000);
  assert.equal(h.reloads, 0);
  assert.equal(h.location.href, 'https://www.instagram.com/camping.one/');
});

test('distinguishes an unopened search from an empty result list', async () => {
  const h = await createHarness();
  h.document.triggers = [{
    innerText: 'Search', getClientRects: () => [{}], getAttribute: () => null,
    querySelector: () => null, click() {}
  }];
  await h.search();
  await h.advance(20000);
  assert.equal(h.state.running, false);
  assert.match(h.nodes.status.textContent, /search did not open/);
});

test('persists an Instagram search-route change without confusing it with unrelated navigation', async () => {
  const h = await createHarness({ href: 'https://www.instagram.com/explore/' });
  h.openSearch(['camping.one']);
  await h.search();
  h.location.href = 'https://www.instagram.com/explore/search/';
  await h.advance(1000);
  assert.equal(h.state.running, true);
  assert.equal(h.state.startURL, h.location.href);
  h.location.href = 'https://www.instagram.com/unrelated/';
  await h.advance(1000);
  assert.equal(h.state.running, false);
  assert.match(h.nodes.status.textContent, /Page changed/);
});

test('prefers the focused search input when an older editable launcher stays visible', async () => {
  const h = await createHarness();
  const launcher = h.openSearch();
  const field = h.openSearch(['camping.one']);
  h.document.inputs = [launcher, field];
  field.focus();
  await h.search();
  await h.advance(6000);
  assert.equal(launcher.value, '');
  assert.equal(field.value, 'camping');
  assert.equal(h.location.href, 'https://www.instagram.com/camping.one/');
});

for (const limit of [1, 50, 100]) {
  test(`accepts a ${limit}-account search and does not truncate it at the old 50-account ceiling`, async () => {
    const h = await createHarness();
    h.openSearch(Array.from({ length: 110 }, (_, index) => 'camping.' + index));
    await h.search('camping', limit);
    await h.advance(6000);
    assert.equal(h.state.running, true);
    assert.equal(h.state.discovery.limit, limit);
    assert.equal(h.state.discovery.queue.length, limit - 1);
    assert.equal(h.location.href, 'https://www.instagram.com/camping.0/');
  });
}

test('an out-of-range account count focuses the invalid field and explains the supported range', async () => {
  const h = await createHarness();
  h.openSearch(['camping.one']);
  await h.search('camping', 101);
  assert.equal(h.state, undefined);
  assert.equal(h.nodes.limit.attributes['aria-invalid'], 'true');
  assert.equal(h.nodes.limit.focused, true);
  assert.equal(h.nodes.status.textContent, 'Choose a maximum of 1–100 accounts.');
  h.nodes.limit.value = '100';
  h.nodes.limit.oninput();
  assert.equal(h.nodes.limit.attributes['aria-invalid'], undefined);
  assert.equal(h.nodes.status.textContent, 'Ready to search.');
});

for (const label of ['Following ▾', 'Gefolgt Dropdownsymbol', 'Angefragt ✓', 'Requested pending']) {
  test(`skips an existing relationship labeled ${label}, including disabled controls`, async () => {
    const h = await createProfileHarness({ state: profileState() });
    const button = h.addButton(label, { disabled: true });
    h.document.profileHeader = { querySelectorAll: () => [button] };
    await h.advance(2500);
    assert.equal(button.clicks, 0);
    assert.equal(h.state.count, 0);
    assert.equal(h.state.discovery.skipped, 1);
    assert.equal(h.location.href, 'https://www.instagram.com/camping.two/');
    assert.match(h.nodes.progress.textContent, /1 skipped/);
  });
}

test('recognizes an aria-labeled Following control with no visible text', async () => {
  const h = await createProfileHarness({ state: profileState() });
  const button = h.addButton('');
  button.getAttribute = name => name === 'aria-label' ? 'Following camping.one' : null;
  h.document.profileHeader = { querySelectorAll: () => [button] };
  await h.advance(2500);
  assert.equal(button.clicks, 0);
  assert.equal(h.state.discovery.skipped, 1);
  assert.equal(h.location.href, 'https://www.instagram.com/camping.two/');
});

test('returns to the saved search after skipping the last profile instead of ending the run', async () => {
  const state = profileState();
  state.discovery.queue = [];
  state.discovery.searchURL = 'https://www.instagram.com/explore/';
  state.discovery.inspected = 1;
  const h = await createProfileHarness({ state });
  const button = h.addButton('Following ▾');
  h.document.profileHeader = { querySelectorAll: () => [button] };
  await h.advance(2500);
  assert.equal(button.clicks, 0);
  assert.equal(h.state.running, true);
  assert.equal(h.state.discovery.phase, 'search');
  assert.equal(h.state.discovery.skipped, 1);
  assert.equal(h.state.startURL, state.discovery.searchURL);
  assert.equal(h.location.href, state.discovery.searchURL);
});

function link(name) {
  return { innerText: name, href: '/' + name + '/', getClientRects: () => [{}], closest: () => null };
}

test('keeps processed IDs after a stopped-run refresh and scrolls past known results to a new account', async () => {
  const h = await createHarness({ state: { running: false, ids: ['/camping.old/'], keyword: 'camping' } });
  const input = h.openSearch(['camping.old']);
  const results = input.parentElement;
  Object.assign(results, {
    scrollHeight: 1000, clientHeight: 100, computedStyle: { overflowY: 'auto' },
    scrollBy() { results.querySelectorAll = () => [link('camping.old'), link('camping.new')]; }
  });
  await h.search();
  await h.advance(8000);
  assert.equal(h.location.href, 'https://www.instagram.com/camping.new/');
  assert.ok(h.state.ids.includes('/camping.old/'));
  assert.equal(h.state.count, 0);
});

test('tries non-personalized search once when visible accounts were already processed', async () => {
  const h = await createHarness({ state: { running: false, ids: ['/camping.old/'] } });
  const input = h.openSearch(['camping.old']);
  let switches = 0;
  h.document.tabs = [{
    innerText: 'Nicht personalisiert', getClientRects: () => [{}], getAttribute: () => 'false',
    click() { switches++; input.parentElement.querySelectorAll = () => [link('camping.new')]; }
  }];
  await h.search();
  await h.advance(8000);
  assert.equal(switches, 1);
  assert.equal(h.location.href, 'https://www.instagram.com/camping.new/');
  assert.equal(h.state.discovery.alternative, true);
});

test('reports exhausted known results distinctly and bounds unsuccessful scrolling', async () => {
  const h = await createHarness({ state: { running: false, ids: ['/camping.old/'] } });
  const input = h.openSearch(['camping.old']);
  let scrolls = 0;
  Object.assign(input.parentElement, {
    scrollHeight: 1000, clientHeight: 100, computedStyle: { overflowY: 'auto' },
    scrollBy() { scrolls++; }
  });
  await h.search();
  await h.advance(15000);
  assert.equal(scrolls, 3);
  assert.equal(h.state.running, false);
  assert.match(h.nodes.status.textContent, /No new accounts remain/);
  assert.doesNotMatch(h.nodes.status.textContent, /No matching/);
});

test('does not count a confirmed new follow as an already-followed skip', async () => {
  const state = profileState({ count: 1, ids: ['/camping.one/'] });
  state.discovery.awaitingConfirmation = true;
  const h = await createProfileHarness({ state });
  const button = h.addButton('Following ▾');
  h.document.profileHeader = { querySelectorAll: () => [button] };
  await h.advance(2500);
  assert.equal(button.clicks, 0);
  assert.equal(h.state.discovery.skipped || 0, 0);
  assert.equal(h.state.count, 1);
});

test('reads result rows from a main sibling of a search header without including navigation links', async () => {
  const h = await createHarness();
  const input = h.openSearch();
  input.closest = () => ({});
  const main = { contains: () => false, querySelectorAll: () => [link('camping.new')] };
  input.parentElement = {
    querySelector: selector => selector === 'main' ? main : {},
    querySelectorAll: () => []
  };
  await h.search();
  await h.advance(6000);
  assert.equal(h.location.href, 'https://www.instagram.com/camping.new/');
});
