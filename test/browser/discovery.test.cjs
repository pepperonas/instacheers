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

async function site(t) {
  const server = http.createServer((request, response) => {
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    response.end(fixture);
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
    overlay.getElementById('limit').value = '2';
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
});
