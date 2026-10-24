const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'content.js'), 'utf8');

async function createHarness({ hidden = false, state = null, random = 0, startAt = 100_000, href = 'https://www.instagram.com/explore/people/' } = {}) {
  let now = startAt, timerID = 0, reloads = 0, scrolls = 0;
  const timers = new Map();
  const messages = [];
  let saveHandler = async () => null;
  const nodes = Object.fromEntries(['close', 'scroll', 'start', 'stop', 'status', 'count', 'search', 'keyword', 'limit'].map(id => [id, {}]));
  nodes.scroll.checked = true;
  nodes.keyword.value = ''; nodes.limit.value = '10';
  const root = { getElementById: id => nodes[id], append() {} };
  const element = () => ({ style: {}, append() {}, remove() {}, animate() {} });
  const host = { ...element(), attachShadow: () => root };
  const listeners = {};
  const document = {
    hidden, body: {}, documentElement: { append() {} }, buttons: [], dialog: null, alerts: [], inputs: [], triggers: [], profileHeader: null,
    createElement: element,
    addEventListener(type, fn) { listeners[type] = fn; },
    querySelector(selector) { return selector === 'main header' ? this.profileHeader : this.dialog; },
    querySelectorAll(selector) {
      if (selector === 'input') return this.inputs;
      if (selector === 'a,button,[role="button"]') return this.triggers;
      return selector.startsWith('button') ? this.buttons : this.alerts;
    }
  };
  const location = {
    href, origin: 'https://www.instagram.com',
    reload() { reloads++; },
    assign(url) { this.href = url; }
  };
  class Input {
    get value() { return this.currentValue || ''; }
    set value(value) { this.currentValue = value; }
    getClientRects() { return [{}]; }
    getAttribute(name) { return name === 'placeholder' ? 'Search' : null; }
    dispatchEvent(event) { this.lastEvent = event; }
  }
  const context = {
    document, location, URL, console, HTMLInputElement: Input, Event: class { constructor(type, options) { this.type = type; Object.assign(this, options); } }, innerWidth: 1200, innerHeight: 800,
    window: { scrollBy() { scrolls++; } },
    Date: { now: () => now }, Math: Object.assign(Object.create(Math), { random: () => random }),
    getComputedStyle: node => node.computedStyle || ({ visibility: 'visible', display: 'block' }),
    setTimeout(fn, delay) { const id = ++timerID; timers.set(id, { at: now + delay, fn }); return id; },
    clearTimeout(id) { timers.delete(id); },
    chrome: { runtime: { async sendMessage(message) {
      messages.push(structuredClone(message));
      return message.type === 'follow:get' ? state : saveHandler(message);
    } } }
  };
  // The first element is the shadow host; later elements belong to animations.
  let createdHost = false;
  document.createElement = () => { if (!createdHost) { createdHost = true; return host; } return element(); };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'discovery.js'), 'utf8'), context);
  vm.runInNewContext(source, context);
  await Promise.resolve();
  const nextTimer = () => [...timers].sort((a, b) => a[1].at - b[1].at)[0];
  async function fire(entry, at) {
    const [id, timer] = entry;
    timers.delete(id);
    now = at;
    await timer.fn();
    await Promise.resolve();
  }
  return {
    nodes, document, location, messages, timers, host,
    window: context.window,
    setSaveHandler(fn) { saveHandler = fn; },
    run: source => vm.runInNewContext(source, context),
    get now() { return now; },
    get reloads() { return reloads; },
    get scrolls() { return scrolls; },
    get state() { return messages.filter(m => m.type === 'follow:set').at(-1)?.state; },
    openSearch(results = []) {
      const input = new Input();
      const links = results.map(result => {
        const item = typeof result === 'string' ? { name: result, href: '/' + result + '/' } : result;
        return { innerText: item.name, href: item.href, getClientRects: () => item.hidden ? [] : [{}], closest: () => item.navigation ? {} : null };
      });
      input.parentElement = { querySelector: () => null, querySelectorAll: () => links };
      document.inputs = [input];
      return input;
    },
    async search(keyword = 'camping', limit = 10) {
      nodes.keyword.value = keyword; nodes.limit.value = String(limit);
      await nodes.search.onclick();
    },
    async start() { await nodes.start.onclick(); },
    stop() { nodes.stop.onclick(); },
    escape() { listeners.keydown({ key: 'Escape' }); },
    async advance(ms) {
      const target = now + ms;
      for (let entry; (entry = nextTimer()) && entry[1].at <= target;) await fire(entry, entry[1].at);
      now = target;
    },
    async delayedCallback(ms) {
      // Simulate a callback delivered late by the browser, without intermediate ticks.
      await fire(nextTimer(), now + ms);
    },
    addButton(label = 'Follow', { confirmed = true, profile = null, disabled = false, dialog = false } = {}) {
      const button = {
        innerText: label, disabled, isConnected: true, clicks: 0,
        parentElement: profile ? { querySelector: () => ({ href: `https://www.instagram.com/${profile}/` }) } : null,
        getAttribute: () => null, closest: () => dialog ? {} : null,
        getClientRects: () => [{}], scrollIntoView() {},
        getBoundingClientRect: () => ({ left: 100, top: 100, width: 100 }),
        click() { this.clicks++; if (confirmed) this.innerText = 'Following'; }
      };
      document.buttons.push(button);
      return button;
    }
  };
}
module.exports = { createHarness };
