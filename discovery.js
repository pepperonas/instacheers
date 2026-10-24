(() => {
  const labels = /^(search|suche|suchen)$/i;
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

  function input() {
    return [...document.querySelectorAll('input')].find(node => visible(node) &&
      labels.test(node.getAttribute('aria-label') || node.getAttribute('placeholder') || ''));
  }

  function open() {
    if (input()) return true;
    const trigger = [...document.querySelectorAll('a,button,[role="button"]')].find(node => {
      const icon = node.querySelector('svg[aria-label]');
      return visible(node) && (labels.test(text(node)) || labels.test(node.getAttribute('aria-label') || '') || labels.test(icon?.getAttribute('aria-label') || ''));
    });
    if (!trigger) return false;
    trigger.click();
    return true;
  }

  function submit(node, keyword) {
    // Use the native setter so React receives the same input event as a typed query.
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(node, keyword);
    node.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function collect(node, keyword, limit) {
    const query = keyword.toLocaleLowerCase();
    let container = node.parentElement;
    for (let depth = 0; container && depth < 8; depth++, container = container.parentElement) {
      // Never expand the search scope to the entire page or its navigation.
      if (container === document.body || container === document.documentElement || container.querySelector('main,nav,[role="navigation"]')) return [];
      const paths = [...container.querySelectorAll('a[href]')].filter(link =>
        visible(link) && !link.closest('nav,header,footer,[role="navigation"]') &&
        text(link).toLocaleLowerCase().includes(query)
      ).map(link => profilePath(link.href)).filter(Boolean);
      if (paths.length) return [...new Set(paths)].slice(0, limit);
    }
    return [];
  }

  window.__instaCheersDiscovery = { profilePath, input, open, submit, collect };
})();
