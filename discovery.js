(() => {
  const labels = /^(search|search instagram|search accounts|search input|suche|suchen|instagram durchsuchen)(?:…|\.{3})?$/i;
  const reserved = new Set(['accounts', 'about', 'api', 'challenge', 'developer', 'direct', 'directory', 'emails', 'explore', 'legal', 'p', 'privacy', 'reel', 'reels', 'stories', 'web', 'your_activity']);
  const text = node => (node.innerText || node.textContent || '').replace(/\s+/g, ' ').trim();
  const visible = node => node.getClientRects().length && getComputedStyle(node).visibility === 'visible';

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
    const query = keyword.toLocaleLowerCase();
    const found = [...container.querySelectorAll('a[href]')].filter(link =>
      visible(link) && !link.closest('nav,header,footer,[role="navigation"]')
    ).map(link => ({ link, path: profilePath(link.href) })).filter(item => item.path &&
      (text(item.link) + ' ' + (item.link.getAttribute?.('aria-label') || '') + ' ' + item.path).toLocaleLowerCase().includes(query)
    ).map(item => item.path);
    return [...new Set(found)].slice(0, limit);
  }

  function collect(node, keyword, limit) {
    // Search results may be rendered in a portal rather than under the input.
    const controlled = (node.getAttribute('aria-controls') || node.getAttribute('aria-owns') || '').split(/\s+/).filter(Boolean);
    for (const id of controlled) {
      const results = document.getElementById(id);
      if (results && visible(results)) return paths(results, keyword, limit);
    }
    let container = node.parentElement;
    for (let depth = 0; container && depth < 12; depth++, container = container.parentElement) {
      if (container === document.body || container === document.documentElement || container.querySelector('nav,[role="navigation"]')) return [];
      // An Explore search can live inside main; do not reject that search surface.
      // Stop before expanding a sidebar search to the unrelated main content.
      const main = container.querySelector('main');
      if (main && !main.contains(node)) return [];
      const found = paths(container, keyword, limit);
      if (found.length) return found;
    }
    return [];
  }

  window.__instaCheersDiscovery = { profilePath, input, open, submit, collect };
})();
