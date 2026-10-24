(() => {
  const labels = /^(search|search instagram|search accounts|search input|suche|suchen|instagram durchsuchen)(?:…|\.{3})?$/i;
  const reserved = new Set(['accounts', 'about', 'api', 'challenge', 'developer', 'direct', 'directory', 'emails', 'explore', 'legal', 'p', 'privacy', 'reel', 'reels', 'stories', 'web', 'your_activity']);
  const text = node => (node.innerText || node.textContent || '').replace(/\s+/g, ' ').trim();
  const resultRoots = new WeakMap();
  const visible = node => node.getClientRects().length && getComputedStyle(node).visibility === 'visible';

  function normalizeKeyword(value) {
    return String(value || '').trim().replace(/^(?:[#＃]\s*)+/u, '').trim();
  }

  function profilePath(href) {
    try {
      const url = new URL(href, location.href);
      const match = url.pathname.match(/^\/([a-zA-Z0-9._]{1,30})\/?$/);
      if (url.origin !== location.origin || !match || reserved.has(match[1].toLowerCase())) return null;
      return '/' + match[1].toLowerCase() + '/';
    } catch { return null; }
  }

  const labeled = node => ['aria-label', 'placeholder', 'title'].some(name => labels.test(node.getAttribute(name) || ''));
  function input() {
    const fields = [...document.querySelectorAll('input')].filter(node => visible(node) &&
      !node.readOnly && !node.disabled && labeled(node));
    return fields.find(node => node === document.activeElement) ||
      fields.find(node => node.closest?.('[role="dialog"],[role="search"],[role="combobox"]')) || fields[0];
  }

  function open() {
    const field = input();
    if (field) { field.focus(); field.click(); return true; }
    const trigger = [...document.querySelectorAll('a,button,[role="button"],input[readonly],[role="searchbox"]')].find(node => {
      const icon = node.querySelector('svg[aria-label]');
      return visible(node) && (labels.test(text(node)) || labeled(node) || labels.test(icon?.getAttribute('aria-label') || ''));
    });
    if (!trigger) return false;
    trigger.click();
    return true;
  }

  function submit(node, keyword) {
    keyword = normalizeKeyword(keyword);
    if (!keyword) return false;
    // Search launchers can look like inputs, but only the activated field is editable.
    if (node.readOnly || node.disabled) return false;
    node.focus();
    if (node.isConnected === false || document.activeElement !== node) return false;
    // Bypass React's value tracker, then notify controlled-input listeners.
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(node, keyword);
    node.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, inputType: 'insertText', data: keyword }));
    node.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    return node.isConnected !== false && node.value === keyword;
  }

  function paths(container, keyword, limit) {
    const query = normalizeKeyword(keyword).toLocaleLowerCase();
    const found = [...container.querySelectorAll('a[href]')].filter(link =>
      visible(link) && !link.closest('nav,header,footer,[role="navigation"]')
    ).map(link => ({ link, path: profilePath(link.href) })).filter(item => item.path &&
      (text(item.link) + ' ' + (item.link.getAttribute?.('aria-label') || '') + ' ' + item.path).toLocaleLowerCase().includes(query)
    ).map(item => item.path);
    return [...new Set(found)].slice(0, limit);
  }

  function collect(node, keyword, limit) {
    keyword = normalizeKeyword(keyword);
    if (!keyword) return [];
    // Search results may be rendered in a portal rather than under the input.
    const controlled = (node.getAttribute('aria-controls') || node.getAttribute('aria-owns') || '').split(/\s+/).filter(Boolean);
    for (const id of controlled) {
      const results = document.getElementById(id);
      if (results && visible(results)) { resultRoots.set(node, results); return paths(results, keyword, limit); }
    }
    let container = node.parentElement;
    for (let depth = 0; container && depth < 12; depth++, container = container.parentElement) {
      if (container === document.body || container === document.documentElement) return [];
      // An Explore search can live inside main; do not reject that search surface.
      // Stop before expanding a sidebar search to the unrelated main content.
      const main = container.querySelector('main');
      if (main?.contains && !main.contains(node)) {
        if (node.closest?.('header,[role="search"]') && node.value === keyword) {
          resultRoots.set(node, main); return paths(main, keyword, limit);
        }
        return [];
      }
      if (container.querySelector('nav,[role="navigation"]')) return [];
      const found = paths(container, keyword, limit);
      if (found.length) { resultRoots.set(node, container); return found; }
    }
    return [];
  }

  function scroll(node) {
    const controlled = (node.getAttribute('aria-controls') || node.getAttribute('aria-owns') || '').split(/\s+/).filter(Boolean);
    const results = controlled.map(id => document.getElementById(id)).find(Boolean) || resultRoots.get(node);
    // Prefer the results' own scroll container over the outer page.
    for (let parent = results || node.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
      if (parent.scrollHeight > parent.clientHeight && /auto|scroll/.test(getComputedStyle(parent).overflowY)) {
        parent.scrollBy({ top: Math.max(450, parent.clientHeight * .8), behavior: 'instant' });
        return true;
      }
    }
    const page = document.scrollingElement;
    if (page && page.scrollHeight > page.clientHeight) {
      page.scrollBy({ top: Math.max(450, page.clientHeight * .8), behavior: 'instant' });
      return true;
    }
    return false;
  }

  function alternative() {
    const tab = [...document.querySelectorAll('button,[role="tab"],[role="button"],a')].find(node =>
      visible(node) && /^(non[- ]personali[sz]ed|nicht personalisiert)$/i.test(text(node))
    );
    if (!tab) return false;
    if (tab.getAttribute('aria-selected') !== 'true') tab.click();
    return true;
  }

  window.__instaCheersDiscovery = { normalizeKeyword, profilePath, input, open, submit, collect, scroll, alternative };
})();
