(() => {
  const key = '__instaCheersV3';
  const maxAccounts = 100;
  if (window[key]) { window[key].show(); return; }
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;right:20px;bottom:20px;z-index:2147483647';
  const root = host.attachShadow({mode:'open'});
  root.innerHTML = `<style>:host{all:initial}section{width:290px;max-height:calc(100vh - 80px);overflow:auto;padding:18px;border:1px solid #454c6a;border-radius:14px;background:#111725;color:#fff;font:14px system-ui;box-shadow:0 8px 40px #0008}h2{font-size:18px;margin:0 0 12px}p{line-height:1.5;color:#c4cbe0}button{border:0;border-radius:8px;padding:10px 14px;margin-right:7px;cursor:pointer;background:#5262ff;color:white;font-weight:700}button:disabled{opacity:.45;cursor:default}#close{float:right;background:transparent;margin:0;padding:0 4px;font-size:22px}label{display:block;margin:12px 0}input[aria-invalid="true"]{outline:2px solid #ff8b9c}input[type="search"],input[type="number"]{box-sizing:border-box;width:100%;padding:8px;margin-top:5px;border:1px solid #454c6a;border-radius:6px;background:#1d263a;color:white}#search{margin:0 0 8px}</style><section><button id="close" aria-label="Close">×</button><h2>InstaCheers <small id="version" style="font-size:11px;color:#c4cbe0"></small></h2><p>Random 5–15 second delays · Escape to stop</p><label>Find accounts<input id="keyword" type="search" maxlength="100" placeholder="e.g. camping"></label><label>Maximum accounts (1–${maxAccounts})<input id="limit" type="number" min="1" max="${maxAccounts}" step="1" value="10"></label><button id="search">Search and follow</button><label><input id="scroll" type="checkbox" checked> Scroll automatically</label><button id="start">Follow this page</button><button id="stop" disabled>Stop</button><p id="status" role="status">Ready.</p><p id="count">0 click attempts</p></section>`;
  document.documentElement.append(host);
  let running = false, timer = null, count = 0, empty = 0, startURL = '';
  let reloads = 0, generation = 0, nextAt = 0, previous = null;
  let discovery = null, searchSubmittedAt = 0, resultsChangedAt = 0, resultSignature = '';
  let searchOpenedAt = 0, submittedInput = null;
  const searchAPI = window.__instaCheersDiscovery;
  const randomDelay = () => (5 + Math.floor(Math.random() * 11)) * 1000;
  const save = async () => {
    const response = await chrome.runtime.sendMessage({type:'follow:set',state:{running,count,startURL,ids:[...ids],reloads,nextAt,scroll:$('scroll').checked,discovery,keyword:$('keyword').value,limit:$('limit').value,status:$('status').textContent}});
    if (response?.error) throw new Error(response.error);
  };
  host.style.display = 'none';
  let seen = new WeakSet();
  const ids = new Set();
  const $ = id => root.getElementById(id);
  $('version').textContent = 'v' + chrome.runtime.getManifest().version;
  const text = el => (el.innerText || el.textContent || '').replace(/\s+/g,' ').trim();
  function identity(el) {
    let row = el.parentElement;
    for (let i=0; row && i<5; i++,row=row.parentElement) {
      const link = row.querySelector('a[href]');
      if (link) { try { const u = new URL(link.href,location.href); if (u.origin === location.origin && /^\/[^/]+\/$/.test(u.pathname) && !['/explore/','/direct/','/accounts/'].includes(u.pathname)) return u.pathname.toLowerCase(); } catch {} }
    }
    return null;
  }
  function candidates() {
    return [...document.querySelectorAll('button,[role="button"]')].filter(el => {
      if (seen.has(el) || el.disabled || el.getAttribute('aria-disabled') === 'true' || el.closest('[role="dialog"]')) return false;
      if (!/^(Folgen|Follow)$/.test(text(el))) return false;
      const style = getComputedStyle(el);
      if (!el.getClientRects().length || style.visibility !== 'visible' || style.display === 'none') return false;
      const id = identity(el);
      return !id || !ids.has(id);
    });
  }
  function stop(message = 'Stopped.') {
    generation++;
    running = false; clearTimeout(timer); timer = null;
    controls(false);
    $('status').textContent = message; save().catch(console.error);
  }
  function controls(active) {
    for (const id of ['start', 'search', 'keyword', 'limit']) $(id).disabled = active;
    $('stop').disabled = !active;
  }
  async function nextProfile(token) {
    const path = discovery.queue.shift();
    if (!path) { stop('Search complete. ' + count + ' click attempts.'); return; }
    discovery.phase = 'profile';
    discovery.current = path;
    discovery.awaitingConfirmation = false;
    discovery.profileStartedAt = Date.now();
    startURL = new URL(path, location.origin).href;
    $('status').textContent = 'Opening ' + path.slice(1, -1) + ' …';
    await save();
    if (running && token === generation) location.assign(startURL);
  }
  async function searchTick(token) {
    if (Date.now() - discovery.startedAt >= 20000) {
      stop(searchSubmittedAt ? 'No matching accounts found. Check the visible Instagram search results and try again.' : 'Instagram search did not open. Open Search on Instagram and try again.'); return;
    }
    let input = searchAPI.input();
    if (!searchSubmittedAt && (!searchOpenedAt || Date.now() - searchOpenedAt >= 3000)) {
      searchAPI.open(); searchOpenedAt = Date.now();
      input = searchAPI.input();
    }
    if (input && (!searchSubmittedAt || (input !== submittedInput && !input.value))) {
      if (searchAPI.submit(input, discovery.keyword)) {
        submittedInput = input;
        searchSubmittedAt = Date.now();
        resultsChangedAt = Date.now(); resultSignature = '';
      } else {
        $('status').textContent = 'Instagram did not accept the search text. Open Search on Instagram and enter the term there.';
        timer = setTimeout(tick,1000); return;
      }
    }
    if (input && searchSubmittedAt && input.value !== discovery.keyword) {
      stop('Search term changed on Instagram. Start a new search to continue.'); return;
    }
    if (input && searchSubmittedAt && Date.now() - searchSubmittedAt >= 3000) {
      const queue = searchAPI.collect(input, discovery.keyword, maxAccounts).filter(path => !ids.has(path)).slice(0, discovery.limit);
      const signature = queue.join(',');
      if (signature !== resultSignature) { resultSignature = signature; resultsChangedAt = Date.now(); }
      if (queue.length && Date.now() - resultsChangedAt >= 2000) {
        discovery.queue = queue;
        await nextProfile(token); return;
      }
    }
    $('status').textContent = searchSubmittedAt ? 'Searching Instagram for “' + discovery.keyword + '” …' : 'Waiting for the Instagram search field to open …';
    timer = setTimeout(tick,1000);
  }
  async function profileTick(token) {
    // Scope follow buttons to the profile header, excluding suggested accounts.
    if (searchAPI.profilePath(location.href) !== discovery.current) {
      stop('Unexpected profile: stopped.'); return;
    }
    const header = document.querySelector('main header');
    const buttons = header ? [...header.querySelectorAll('button,[role="button"]')].filter(el => {
      const style = getComputedStyle(el);
      return el.getClientRects().length && style.visibility === 'visible' && !el.disabled && el.getAttribute('aria-disabled') !== 'true';
    }) : [];
    if (discovery.awaitingConfirmation && buttons.some(el => /^(Follow|Folgen)$/.test(text(el)))) {
      stop('Follow was not confirmed after the delay. Please check Instagram.'); return;
    }
    if ((!discovery.awaitingConfirmation && ids.has(discovery.current)) || buttons.some(el => /^(Following|Requested|Gefolgt|Angefragt|Abonniert)$/.test(text(el)))) {
      ids.add(discovery.current);
      await nextProfile(token); return;
    }
    const button = !discovery.awaitingConfirmation && buttons.find(el => /^(Follow|Folgen)$/.test(text(el)));
    if (!button) {
      if (Date.now() - discovery.profileStartedAt >= 20000) {
        stop('Profile controls not found. Please check Instagram.'); return;
      }
      $('status').textContent = 'Waiting for profile controls …';
      timer = setTimeout(tick,1000); return;
    }
    nextAt = Date.now() + randomDelay();
    button.click(); previous = button; count++;
    ids.add(discovery.current);
    discovery.awaitingConfirmation = true;
    celebrate(button.getBoundingClientRect());
    await save();
    if (!running || token !== generation) return;
    $('count').textContent = count + ' click attempts';
    timer = setTimeout(tick,1000);
  }
  async function tick() {
    const token = generation;
    if (!running) return;
    let searchRouteChanged = false;
    if (location.href !== startURL) {
      const url = new URL(location.href);
      if (discovery?.phase === 'search' && url.origin === location.origin && /^\/explore\/search(?:\/|$)/.test(url.pathname)) { startURL = location.href; searchRouteChanged = true; }
      else { stop('Page changed: stopped.'); return; }
    }
    if (discovery?.phase !== 'search' && document.querySelector('[role="dialog"]')) { stop('Dialog opened: review it and restart if needed.'); return; }
    try {
      if (searchRouteChanged) { await save(); if (!running || token !== generation) return; }
      const errorNode = [...document.querySelectorAll('[role="alert"],[aria-live="assertive"]')].find(el => {
        return el.getClientRects().length && /hochladen fehlgeschlagen|fehler beim|try again later|versuche es später|we restrict|action blocked|upload failed/i.test(text(el));
      });
      if (errorNode) { stop('Instagram reported an error: stopped. Please review.'); return; }
      if (discovery?.phase === 'search') { await searchTick(token); return; }
      if (Date.now() < nextAt) {
        $('status').textContent = 'Next click in ' + Math.ceil((nextAt-Date.now())/1000) + ' s …';
        timer = setTimeout(tick,Math.min(1000,nextAt-Date.now())); return;
      }
      if (previous?.isConnected && /^(Folgen|Follow)$/.test(text(previous))) {
        stop('Follow was not confirmed after the delay. Please check Instagram.'); return;
      }
      previous = null;
      if (discovery?.phase === 'profile') { await profileTick(token); return; }
      const button = candidates()[0];
      if (button) {
        empty = 0; reloads = 0;
        seen.add(button);
        const id = identity(button); if (id) ids.add(id);
        button.scrollIntoView({block:'center',behavior:'instant'});
        const rect = button.getBoundingClientRect();
        nextAt = Date.now() + randomDelay();
        button.click(); previous = button; count++;
        celebrate(rect);
        await save();
        if (!running || token !== generation) return;
        $('count').textContent = count + ' click attempts';
        $('status').textContent = 'Next click in ' + Math.ceil((nextAt-Date.now())/1000) + ' s …';
      } else {
        empty++;
        if (empty >= 8) {
          if (reloads >= 3) { stop('No new accounts after three reloads.'); return; }
          reloads++; $('status').textContent = 'Reloading the page automatically …';
          await save();
          if (running && token === generation) location.reload();
          return;
        }
        if ($('scroll').checked) window.scrollBy({top:Math.max(450,innerHeight * .8),behavior:'instant'});
        $('status').textContent = 'Waiting for more accounts …';
      }
      timer = setTimeout(tick,1000);
    } catch (error) { stop('Error: ' + error.message); }
  }
  $('start').onclick = async () => {
    if (running) return;
    if ($('keyword').value.trim()) { await $('search').onclick(); return; }
    if (/^\/explore\/(?:search\/.*)?$/.test(new URL(location.href).pathname) && !candidates().length) {
      stop('No Follow buttons on this Explore page. Enter a term above and use Search and follow.'); return;
    }
    discovery = null; previous = null;
    running = true; empty = 0; reloads = 0; generation++; startURL = location.href;
    controls(true);
    nextAt = Math.max(nextAt, Date.now() + randomDelay());
    $('status').textContent = 'Starting after a random delay …';
    try { await save(); if(running) timer = setTimeout(tick,1000); } catch(error) { stop(error.message); }
  };
  $('search').onclick = async () => {
    if (running) return;
    const keyword = $('keyword').value.trim();
    const limit = Number($('limit').value);
    if (!keyword || keyword.length > 100) { $('status').textContent = 'Enter a search term (1–100 characters).'; return; }
    $('limit').removeAttribute('aria-invalid');
    if (!Number.isInteger(limit) || limit < 1 || limit > maxAccounts) {
      $('limit').setAttribute('aria-invalid', 'true');
      $('limit').focus();
      $('status').textContent = `Choose a maximum of 1–${maxAccounts} accounts.`; return;
    }
    if (!searchAPI?.open()) { $('status').textContent = 'Instagram search was not found. Open Search on Instagram and try again.'; return; }
    running = true; generation++; previous = null; empty = 0; reloads = 0;
    startURL = location.href;
    discovery = { keyword, limit, phase:'search', startedAt:Date.now(), queue:[], current:null };
    searchSubmittedAt = 0; resultSignature = ''; resultsChangedAt = 0;
    searchOpenedAt = Date.now(); submittedInput = null;
    nextAt = Math.max(nextAt, Date.now() + randomDelay());
    controls(true);
    const token = generation;
    try { await save(); if (running && token === generation) timer = setTimeout(tick,1000); }
    catch (error) { stop('Error: ' + error.message); }
  };
  for (const id of ['keyword', 'limit']) $(id).oninput = () => {
    if (running) return;
    $('limit').removeAttribute('aria-invalid');
    $('status').textContent = 'Ready to search.';
    save().catch(console.error);
  };
  $('stop').onclick = () => stop();
  $('close').onclick = () => { stop(); host.style.display = 'none'; };
  document.addEventListener('keydown', event => { if(event.key === 'Escape' && running) stop(); },true);
  // Shadow DOM retargets inputs to the host for page-level shortcut handlers.
  // Intercept overlay keystrokes before document capture listeners see them,
  // without canceling native editing, Tab navigation, or button activation.
  for (const type of ['keydown', 'keypress', 'keyup']) {
    window.addEventListener(type, event => {
      if (!event.composedPath().includes(host)) return;
      if (type === 'keydown' && event.key === 'Escape' && running) stop();
      event.stopImmediatePropagation();
    }, true);
  }
  // Let control handlers run first, then keep interactions inside the overlay.
  for (const type of ['beforeinput', 'input', 'change', 'compositionstart', 'compositionupdate', 'compositionend', 'copy', 'cut', 'paste', 'click', 'dblclick', 'pointerdown', 'pointerup', 'mousedown', 'mouseup', 'focusin', 'focusout']) {
    root.addEventListener(type, event => event.stopPropagation());
  }


  window[key] = {show(){host.style.display = '';}};
  chrome.runtime.sendMessage({type:'follow:get'}).then(state => {
    if (!state || running) return;
    $('keyword').value = state.keyword ?? state.discovery?.keyword ?? '';
    $('limit').value = state.limit ?? state.discovery?.limit ?? '10';
    if (!state.running) {
      if ($('keyword').value || state.status) { host.style.display = ''; $('status').textContent = state.status || 'Ready to search.'; }
      return;
    }
    if (state.startURL !== location.href) {
      host.style.display = ''; stop('Page changed: stopped. Your search term has been kept.'); return;
    }
    running = true; count = state.count || 0; startURL = state.startURL; reloads = state.reloads || 0; nextAt = state.nextAt || Date.now() + randomDelay();
    discovery = state.discovery || null;
    if (discovery?.phase === 'search') {
      discovery.startedAt = Date.now(); searchOpenedAt = 0;
    }
    for (const id of state.ids || []) ids.add(id);
    $('scroll').checked = state.scroll !== false;
    host.style.display = ''; controls(true);
    $('count').textContent = count + ' click attempts'; $('status').textContent = 'Resumed automatically …';
    timer = setTimeout(tick,2500);
  }).catch(console.error);
  function celebrate(rect) {
    const fx = document.createElement('div');
    const x = Math.max(100,Math.min(innerWidth-100,rect.left + rect.width/2));
    const y = Math.max(100,Math.min(innerHeight-100,rect.top));
    fx.style.cssText = `position:fixed;left:${x}px;top:${y}px;pointer-events:none;z-index:2147483647`;
    root.append(fx);
    const beer = document.createElement('span'); beer.textContent = '🍺';
    beer.style.cssText = 'position:absolute;font-size:42px;left:-21px;top:-35px';fx.append(beer);
    beer.animate([{transform:'scale(1)'},{transform:'scale(1.15)'},{transform:'scale(1)'}],{duration:500,iterations:4});
    for(let i=0;i<6;i++) {
      const b=document.createElement('i');b.style.cssText=`position:absolute;width:5px;height:5px;border-radius:50%;background:white;left:${i*7-20}px;top:-10px`;
      fx.append(b); b.animate([{opacity:0,transform:'translateY(0)'},{opacity:1,offset:.3},{opacity:0,transform:'translateY(-65px)'}],{duration:1000,delay:i*150,iterations:2});
    }
    setTimeout(() => {
      beer.remove();
      for(let i=0;i<20;i++) {
        const d=document.createElement('i');const a=i*Math.PI/10;const radius=45+Math.random()*45;
        d.style.cssText=`position:absolute;width:7px;height:11px;border-radius:50%;background:${i%3?'#FBB03B':'#FFFFFF'}`;fx.append(d);
        d.animate([{transform:'translate(0,0) scale(.5)',opacity:1},{transform:`translate(${Math.cos(a)*radius}px,${Math.sin(a)*radius+20}px) scale(0)`,opacity:0}],{duration:900,easing:'cubic-bezier(.15,.7,.3,1)',fill:'forwards'});
      }
      const word=document.createElement('strong');word.textContent='BOTTLED!';word.style.cssText='position:absolute;left:-80px;top:-22px;font:900 italic 30px system-ui;color:#FBB03B;-webkit-text-stroke:1px #171717;text-shadow:2px 3px #171717;white-space:nowrap';fx.append(word);
      word.animate([{transform:'scale(.2) rotate(-10deg)',opacity:0},{transform:'scale(1.25) rotate(5deg)',opacity:1,offset:.2},{transform:'scale(1) rotate(-3deg)',opacity:1,offset:.4},{transform:'translateY(-8px) rotate(0)',opacity:1,offset:.65},{transform:'translateY(-25px)',opacity:0}],{duration:1000,fill:'forwards'});
    },2000);
    setTimeout(()=>fx.remove(),3100);
  }
})();
