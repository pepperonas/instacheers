(() => {
  const key = '__cheersMateV3';
  if (window[key]) { window[key].show(); return; }
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;right:20px;bottom:20px;z-index:2147483647';
  const root = host.attachShadow({mode:'open'});
  root.innerHTML = `<style>:host{all:initial}section{width:290px;padding:18px;border:1px solid #454c6a;border-radius:14px;background:#111725;color:#fff;font:14px system-ui;box-shadow:0 8px 40px #0008}h2{font-size:18px;margin:0 0 12px}p{line-height:1.5;color:#c4cbe0}button{border:0;border-radius:8px;padding:10px 14px;margin-right:7px;cursor:pointer;background:#5262ff;color:white;font-weight:700}button:disabled{opacity:.45;cursor:default}#close{float:right;background:transparent;margin:0;padding:0 4px;font-size:22px}label{display:block;margin:12px 0}</style><section><button id="close" aria-label="Close">×</button><h2>Cheers Mate</h2><p>Random 5–15 second delays · Escape to stop</p><label><input id="scroll" type="checkbox" checked> Scroll automatically</label><button id="start">Start</button><button id="stop" disabled>Stop</button><p id="status" role="status">Ready.</p><p id="count">0 click attempts</p></section>`;
  document.documentElement.append(host);
  let running = false, timer = null, count = 0, empty = 0, startURL = '';
  let reloads = 0, generation = 0, nextAt = 0, previous = null;
  const randomDelay = () => (5 + Math.floor(Math.random() * 11)) * 1000;
  const save = () => chrome.runtime.sendMessage({type:'follow:set',state:{running,count,startURL,ids:[...ids],reloads,nextAt,scroll:$('scroll').checked}});
  host.style.display = 'none';
  let seen = new WeakSet();
  const ids = new Set();
  const $ = id => root.getElementById(id);
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
    $('start').disabled = false; $('stop').disabled = true;
    $('status').textContent = message; save().catch(console.error);
  }
  async function tick() {
    const token = generation;
    if (!running) return;
    if (location.href !== startURL) { stop('Page changed: stopped.'); return; }
    if (document.hidden) { $('status').textContent = 'Paused until this tab is visible …'; timer = setTimeout(tick,1000); return; }
    if (document.querySelector('[role="dialog"]')) { stop('Dialog opened: review it and restart if needed.'); return; }
    try {
      const errorNode = [...document.querySelectorAll('[role="alert"],[aria-live="assertive"]')].find(el => {
        return el.getClientRects().length && /hochladen fehlgeschlagen|fehler beim|try again later|versuche es später|we restrict|action blocked|upload failed/i.test(text(el));
      });
      if (errorNode) { stop('Instagram reported an error: stopped. Please review.'); return; }
      if (Date.now() < nextAt) {
        $('status').textContent = 'Next click in ' + Math.ceil((nextAt-Date.now())/1000) + ' s …';
        timer = setTimeout(tick,Math.min(1000,nextAt-Date.now())); return;
      }
      if (previous?.isConnected && /^(Folgen|Follow)$/.test(text(previous))) {
        stop('Follow was not confirmed after the delay. Please check Instagram.'); return;
      }
      previous = null;
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
    running = true; empty = 0; reloads = 0; generation++; startURL = location.href;
    $('start').disabled = true; $('stop').disabled = false;
    nextAt = Math.max(nextAt, Date.now() + randomDelay());
    $('status').textContent = 'Starting after a random delay …';
    try { await save(); if(running) timer = setTimeout(tick,1000); } catch(error) { stop(error.message); }
  };
  $('stop').onclick = () => stop();
  $('close').onclick = () => { stop(); host.style.display = 'none'; };
  document.addEventListener('keydown', event => { if(event.key === 'Escape' && running) stop(); },true);

  window[key] = {show(){host.style.display = '';}};
  chrome.runtime.sendMessage({type:'follow:get'}).then(state => {
    if (!state?.running || state.startURL !== location.href || running) return;
    running = true; count = state.count || 0; startURL = state.startURL; reloads = state.reloads || 0; nextAt = state.nextAt || Date.now() + randomDelay();
    for (const id of state.ids || []) ids.add(id);
    $('scroll').checked = state.scroll !== false;
    host.style.display = ''; $('start').disabled = true; $('stop').disabled = false;
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
