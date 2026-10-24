const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { once } = require('node:events');
const { browser } = require('./harness.cjs');

const fixture = `<!doctype html><html><body>
  <main><input id="launcher" placeholder="Suchen"><div id="grid">Explore posts</div></main>
  <script>
    window.chrome = {runtime: {
      getManifest: () => ({version:'test'}),
      async sendMessage(message) {
        if (message.type === 'follow:set') localStorage.setItem('run', JSON.stringify(message.state));
        return JSON.parse(localStorage.getItem('run') || 'null');
      }
    }};
    document.getElementById('launcher').onclick = () => {
      if (document.getElementById('native-search')) return;
      const panel = document.createElement('div');
      panel.setAttribute('role','search');
      panel.innerHTML = '<input id="native-search" placeholder="Suchen" aria-label="Search Instagram" aria-controls="results">';
      document.querySelector('main').append(panel);
      const results = document.createElement('div');
      results.id = 'results'; results.setAttribute('role','listbox');
      document.body.append(results); // A result portal outside main and the input ancestors.
      const field = document.getElementById('native-search');
      field.oninput = event => {
        if (field === document.activeElement && event.composed && field.value === 'camping') {
          results.innerHTML = '<a href="/camping.one/">Camping One</a><a href="/camping.two/">Camping Two</a><a href="/p/camping/">Camping post</a>';
          localStorage.setItem('query', field.value);
        }
      };
      field.focus();
    };
  </script>
</body></html>`;

async function site(t, render = () => fixture) {
  const server = http.createServer((request, response) => {
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    response.end(render(request.url));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  return 'http://127.0.0.1:' + server.address().port;
}
async function inject(chrome) {
  for (const file of ['discovery.js', 'content.js']) {
    await chrome.evaluate(fs.readFileSync(path.join(__dirname, '..', '..', file), 'utf8'));
  }
}

test('activates Explore search, prefers the focused dialog input over its visible launcher, and saves portal results', { timeout: 30000 }, async t => {
  const origin = await site(t);
  const chrome = await browser(t);
  await chrome.send('Page.navigate', { url: origin + '/explore/' });
  await chrome.evaluate(`new Promise(resolve => {
    if (document.readyState === 'complete') resolve();
    else window.addEventListener('load', resolve, {once:true});
  })`);
  await inject(chrome);
  await chrome.evaluate(`
    window.overlay = [...document.documentElement.children].find(node => node.shadowRoot).shadowRoot;
    window.__instaCheersV3.show();
    overlay.getElementById('keyword').value = 'camping';
    overlay.getElementById('limit').value = '100';
    if (overlay.getElementById('limit').max !== '100') throw new Error('Visible account limit is out of sync');
    overlay.getElementById('search').click();
  `);
  const deadline = Date.now() + 15000;
  let pathname;
  while (Date.now() < deadline) {
    try { pathname = await chrome.evaluate('location.pathname'); } catch { /* Navigation replaces the execution context. */ }
    if (pathname === '/camping.one/') break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.equal(pathname, '/camping.one/');
  assert.equal(await chrome.evaluate(`localStorage.getItem('query')`), 'camping');
  const saved = await chrome.evaluate(`JSON.parse(localStorage.getItem('run'))`);
  assert.equal(saved.startURL, origin + '/camping.one/');
  assert.equal(saved.keyword, 'camping');
  assert.deepEqual(saved.discovery.queue, ['/camping.two/']);
  assert.equal(saved.count, 0);
  assert.equal(saved.discovery.limit, 100);
});

test('skips an already-followed profile and continues to a new account without clicking the relationship control', { timeout: 30000 }, async t => {
  function profile(existing) {
    return `<!doctype html><html><body><main><header>
      <button id="relationship" ${existing ? 'disabled' : ''}>${existing ? 'Gefolgt Dropdownsymbol' : 'Follow'}</button>
      </header></main><script>
      Math.random = () => 0;
      window.chrome = {runtime: {
        getManifest: () => ({version:'test'}),
        async sendMessage(message) {
          if (message.type === 'follow:set') localStorage.setItem('run', JSON.stringify(message.state));
          return JSON.parse(localStorage.getItem('run') || 'null');
        }
      }};
      document.getElementById('relationship').onclick = event => {
        localStorage.setItem('${existing ? 'existingClicks' : 'newClicks'}', String(Number(localStorage.getItem('${existing ? 'existingClicks' : 'newClicks'}') || 0) + 1));
        event.currentTarget.textContent = 'Following';
      };
      </script></body></html>`;
  }
  const origin = await site(t, url => {
    if (url === '/camping.one/') return profile(true);
    if (url === '/camping.two/') return profile(false);
    return fixture.replace('<script>', '<script>Math.random = () => 0;');
  });
  const chrome = await browser(t);
  await chrome.send('Page.navigate', { url: origin + '/explore/' });
  await chrome.evaluate(`new Promise(resolve => {
    if (document.readyState === 'complete') resolve();
    else window.addEventListener('load', resolve, {once:true});
  })`);
  await inject(chrome);
  await chrome.evaluate(`
    const overlay = [...document.documentElement.children].find(node => node.shadowRoot).shadowRoot;
    overlay.getElementById('keyword').value = 'camping';
    overlay.getElementById('limit').value = '2';
    overlay.getElementById('search').click();
  `);
  let injectedPath = '/explore/', outcome;
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    try {
      const pathname = await chrome.evaluate('location.pathname');
      if (pathname !== injectedPath && /^\/camping\.(one|two)\/$/.test(pathname)) {
        await chrome.evaluate(`new Promise(resolve => {
          if (document.readyState === 'complete') resolve();
          else window.addEventListener('load', resolve, {once:true});
        })`);
        await inject(chrome);
        injectedPath = pathname;
      }
      outcome = await chrome.evaluate(`({existing:Number(localStorage.getItem('existingClicks') || 0),new:Number(localStorage.getItem('newClicks') || 0),state:JSON.parse(localStorage.getItem('run'))})`);
      if (outcome.new === 1 && outcome.state.count === 1) break;
    } catch { /* Page navigation replaces the current script context. */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.equal(outcome?.existing, 0);
  assert.equal(outcome?.new, 1);
  assert.equal(outcome.state.count, 1);
  assert.equal(outcome.state.discovery.skipped, 1);
  assert.equal(outcome.state.discovery.inspected, 2);
  await chrome.evaluate(`
    [...document.documentElement.children].find(node => node.shadowRoot).shadowRoot.getElementById('stop').click();
  `);
});

test('a #vanlife entry becomes a vanlife account search instead of getting stuck on hashtag-only results', { timeout: 30000 }, async t => {
  const topicFixture = fixture.replaceAll('camping', 'vanlife')
    .replace("field.value === 'vanlife'", "field.value.replace(/^#/, '') === 'vanlife'")
    .replace('results.innerHTML = ', `results.innerHTML = field.value.startsWith('#') ? '<a href="/explore/tags/vanlife/">#vanlife</a>' : `);
  const origin = await site(t, () => topicFixture);
  const chrome = await browser(t);
  await chrome.send('Page.navigate', { url: origin + '/explore/' });
  await chrome.evaluate(`new Promise(resolve => {
    if (document.readyState === 'complete') resolve();
    else window.addEventListener('load', resolve, {once:true});
  })`);
  await inject(chrome);
  await chrome.evaluate(`
    const overlay = [...document.documentElement.children].find(node => node.shadowRoot).shadowRoot;
    overlay.getElementById('keyword').value = '#vanlife';
    overlay.getElementById('search').click();
  `);
  const deadline = Date.now() + 15000;
  let pathname;
  while (Date.now() < deadline) {
    try { pathname = await chrome.evaluate('location.pathname'); } catch { /* Navigation replaces the context. */ }
    if (pathname === '/vanlife.one/') break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.equal(pathname, '/vanlife.one/');
  assert.equal(await chrome.evaluate(`localStorage.getItem('query')`), 'vanlife');
  const state = await chrome.evaluate(`JSON.parse(localStorage.getItem('run'))`);
  assert.equal(state.keyword, 'vanlife');
  assert.equal(state.discovery.keyword, 'vanlife');
  assert.equal(state.discovery.current, '/vanlife.one/');
});
