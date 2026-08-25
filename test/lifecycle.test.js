import test from 'node:test';
import assert from 'node:assert/strict';
import { apply } from '../src/client.js';

class FakeEventTarget {
  constructor() {
    this.listeners = new Map();
  }

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
  }

  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener);
  }

  dispatchEvent(event) {
    for (const listener of [...(this.listeners.get(event.type) ?? [])]) listener(event);
  }

  listenerCount(type) {
    return this.listeners.get(type)?.size ?? 0;
  }
}

class FakeClassList {
  constructor(owner) {
    this.owner = owner;
  }

  add(...values) {
    for (const value of values) this.owner.classTokens.add(value);
  }

  remove(...values) {
    for (const value of values) this.owner.classTokens.delete(value);
  }

  contains(value) {
    return this.owner.classTokens.has(value);
  }

  toString() {
    return [...this.owner.classTokens].join(' ');
  }
}

class FakeText {
  constructor(value, ownerDocument) {
    this.nodeType = 3;
    this.value = String(value);
    this.ownerDocument = ownerDocument;
    this.parentElement = null;
    this.parentNode = null;
  }

  get length() {
    return this.value.length;
  }

  get lastChild() {
    return null;
  }

  get previousSibling() {
    if (!this.parentElement) return null;
    const index = this.parentElement.children.indexOf(this);
    return index > 0 ? this.parentElement.children[index - 1] : null;
  }

  substringData(offset, count) {
    return this.value.slice(offset, offset + count);
  }

  remove() {
    if (!this.parentElement) return;
    this.parentElement.children = this.parentElement.children.filter((child) => child !== this);
    this.parentElement = null;
    this.parentNode = null;
  }
}

class FakeElement extends FakeEventTarget {
  constructor(tagName, ownerDocument) {
    super();
    this.nodeType = 1;
    this.tagName = tagName.toUpperCase();
    this.ownerDocument = ownerDocument;
    this.children = [];
    this.parentElement = null;
    this.parentNode = null;
    this.dataset = {};
    this.attributes = new Map();
    this.classTokens = new Set();
    this.classList = new FakeClassList(this);
    this.style = {};
    this.textContent = '';
    this.scrollTop = 0;
    this.scrollHeight = 0;
    this.clientHeight = 0;
    this.width = 0;
    this.height = 0;
    this.context = this.tagName === 'CANVAS' ? {
      clearRect() {},
      fillText() {},
      setTransform() {},
    } : null;
  }

  get id() {
    return this.attributes.get('id') ?? '';
  }

  set id(value) {
    this.attributes.set('id', String(value));
  }

  get className() {
    return [...this.classTokens].join(' ');
  }

  set className(value) {
    this.classTokens = new Set(String(value).split(/\s+/).filter(Boolean));
  }

  get isConnected() {
    for (let node = this; node; node = node.parentNode) {
      if (node === this.ownerDocument?.documentElement) return true;
    }
    return false;
  }

  get firstChild() {
    return this.children[0] ?? null;
  }

  get lastChild() {
    return this.children.at(-1) ?? null;
  }

  get previousSibling() {
    if (!this.parentElement) return null;
    const index = this.parentElement.children.indexOf(this);
    return index > 0 ? this.parentElement.children[index - 1] : null;
  }

  appendChild(child) {
    child.remove?.();
    child.parentElement = this;
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  append(...children) {
    for (const child of children) this.appendChild(child);
  }

  remove() {
    if (!this.parentElement) return;
    this.parentElement.children = this.parentElement.children.filter((child) => child !== this);
    this.parentElement = null;
    this.parentNode = null;
  }

  contains(candidate) {
    for (let node = candidate; node; node = node.parentNode) {
      if (node === this) return true;
    }
    return false;
  }

  setAttribute(name, value) {
    if (name === 'class') this.className = value;
    else if (name === 'id') this.id = value;
    else this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    if (name === 'class') return this.className || null;
    if (name === 'id') return this.id || null;
    return this.attributes.get(name) ?? null;
  }

  hasAttribute(name) {
    if (name === 'class') return this.classTokens.size > 0;
    if (name === 'id') return Boolean(this.id);
    return this.attributes.has(name);
  }

  removeAttribute(name) {
    if (name === 'class') this.classTokens.clear();
    else this.attributes.delete(name);
  }

  matches(selector) {
    const selectors = selector.split(',').map((part) => part.trim());
    return selectors.some((part) => {
      if (part === '[data-variant="think"]') {
        return this.attributes.get('data-variant') === 'think';
      }
      if (part === '[class*="thinkBody"]') return this.className.includes('thinkBody');
      if (part === '[data-conversation-scroll]') {
        return this.attributes.has('data-conversation-scroll');
      }
      if (part.includes('[data-chat-flow-kind="assistant-step"]') && part.includes('[class*="_markdown_"]')) {
        return this.className.includes('_markdown_') && Boolean(
          this.closest('[data-chat-flow-kind="assistant-step"]'),
        );
      }
      if (part === '[data-chat-flow-kind="assistant-step"]') {
        return this.attributes.get('data-chat-flow-kind') === 'assistant-step';
      }
      if (part.startsWith('style[data-plugin-css=')) {
        return this.tagName === 'STYLE' && this.dataset.pluginCss === 'dsh-matrix-skin/styles';
      }
      if (part.startsWith('.')) return this.classList.contains(part.slice(1));
      return false;
    });
  }

  querySelectorAll(selector) {
    const matches = [];
    for (const child of this.children) {
      if (child.matches?.(selector)) matches.push(child);
      matches.push(...(child.querySelectorAll?.(selector) ?? []));
    }
    return matches;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  closest(selector) {
    for (let node = this; node; node = node.parentElement) {
      if (node.matches(selector)) return node;
    }
    return null;
  }

  getContext() {
    return this.context;
  }
}

class FakeDocument extends FakeEventTarget {
  constructor() {
    super();
    this.documentElement = new FakeElement('html', this);
    this.head = this.documentElement.appendChild(new FakeElement('head', this));
    this.body = this.documentElement.appendChild(new FakeElement('body', this));
    this.hidden = false;
  }

  createElement(tagName) {
    return new FakeElement(tagName, this);
  }

  createTextNode(value) {
    return new FakeText(value, this);
  }

  querySelector(selector) {
    return this.documentElement.querySelector(selector);
  }

  querySelectorAll(selector) {
    return this.documentElement.querySelectorAll(selector);
  }

  getElementById(id) {
    return this.walk().find((element) => element.id === id) ?? null;
  }

  walk() {
    const elements = [];
    const visit = (node) => {
      elements.push(node);
      for (const child of node.children ?? []) visit(child);
    };
    visit(this.documentElement);
    return elements;
  }
}

class FakeMutationObserver {
  static instances = [];

  constructor(callback) {
    this.callback = callback;
    this.active = false;
    FakeMutationObserver.instances.push(this);
  }

  observe(target, options) {
    this.active = true;
    this.target = target;
    this.options = options;
  }

  disconnect() {
    this.active = false;
  }
}

function observable(initial) {
  let snapshot = initial;
  let reads = 0;
  let subscribeCalls = 0;
  const listeners = new Set();
  return {
    store: {
      getSnapshot() {
        reads += 1;
        return snapshot;
      },
      subscribe(listener) {
        subscribeCalls += 1;
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
    emit(next) {
      snapshot = next;
      for (const listener of [...listeners]) listener();
    },
    listenerCount: () => listeners.size,
    reads: () => reads,
    subscribeCalls: () => subscribeCalls,
  };
}

function sessionSnapshot(text) {
  return {
    blank: false,
    nodes: [{ kind: 'user', content: [{ type: 'text', text }] }],
    partial: null,
    queue: [],
  };
}

function sessionStore(text) {
  let reads = 0;
  let subscribeCalls = 0;
  return {
    store: {
      getSnapshot() {
        reads += 1;
        return sessionSnapshot(text);
      },
      subscribe() {
        subscribeCalls += 1;
        return () => {};
      },
    },
    reads: () => reads,
    subscribeCalls: () => subscribeCalls,
  };
}

function sessionsFixture(id, text) {
  const list = observable({ current: id, ids: [id], phase: 'ready' });
  const session = sessionStore(text);
  return {
    list,
    session,
    service: {
      list: list.store,
      binding: (requestedId) => requestedId === id ? { session: session.store } : undefined,
    },
  };
}

function effectContext(sessions) {
  const cleanups = [];
  return {
    ctx: {
      sessions,
      effect(factory) {
        const cleanup = factory();
        if (typeof cleanup === 'function') cleanups.push(cleanup);
      },
    },
    dispose() {
      for (const cleanup of cleanups.splice(0).reverse()) cleanup();
    },
  };
}

function installFakeDom() {
  const originals = new Map();
  const setGlobal = (name, value) => {
    originals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  };
  const document = new FakeDocument();
  document.body.className = 'host-shell';
  const fakeWindow = new FakeEventTarget();
  const mediaQueries = [];
  Object.assign(fakeWindow, {
    innerWidth: 1280,
    innerHeight: 720,
    devicePixelRatio: 1,
    matchMedia() {
      const media = Object.assign(new FakeEventTarget(), { matches: false });
      mediaQueries.push(media);
      return media;
    },
  });
  let nextFrame = 0;
  const frames = new Map();
  const requestAnimationFrame = (callback) => {
    const id = ++nextFrame;
    frames.set(id, callback);
    return id;
  };
  const cancelAnimationFrame = (id) => frames.delete(id);

  FakeMutationObserver.instances = [];
  setGlobal('Element', FakeElement);
  setGlobal('HTMLElement', FakeElement);
  setGlobal('Document', FakeDocument);
  setGlobal('MutationObserver', FakeMutationObserver);
  setGlobal('document', document);
  setGlobal('window', fakeWindow);
  setGlobal('requestAnimationFrame', requestAnimationFrame);
  setGlobal('cancelAnimationFrame', cancelAnimationFrame);

  const pluginStyles = () => document.walk().filter((element) => (
    element.tagName === 'STYLE' && element.dataset.pluginCss === 'dsh-matrix-skin/styles'
  ));
  const environments = () => document.walk().filter((element) => (
    element.id === 'dsh-matrix-environment'
  ));
  return {
    document,
    fakeWindow,
    frames,
    mediaQueries,
    activeObservers: () => FakeMutationObserver.instances.filter(({ active }) => active).length,
    mounted() {
      return {
        environments: environments().length,
        styles: pluginStyles().length,
        active: document.body?.classList.contains('dsh-matrix-skin-active') ?? false,
      };
    },
    listenerSnapshot() {
      return {
        resize: fakeWindow.listenerCount('resize'),
        visibility: document.listenerCount('visibilitychange'),
        motion: mediaQueries.reduce((total, media) => total + media.listenerCount('change'), 0),
        observers: FakeMutationObserver.instances.filter(({ active }) => active).length,
      };
    },
    restore() {
      for (const [name, descriptor] of originals) {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor);
        else delete globalThis[name];
      }
    },
  };
}

function hudSnapshot(document) {
  const environment = document.getElementById('dsh-matrix-environment');
  const hud = environment?.children.find((child) => child.classList.contains('dsh-matrix-hud'));
  const [eyebrow, source, metrics, status] = hud?.children ?? [];
  return {
    matrixSource: environment?.dataset.matrixSource,
    eyebrow: eyebrow?.textContent,
    source: source?.textContent,
    metrics: metrics?.textContent,
    status: status?.textContent,
  };
}

test('overlapping apply generations keep exactly one session-powered mount', async () => {
  const dom = installFakeDom();
  const firstSessions = sessionsFixture('first', 'first generation prompt');
  const secondSessions = sessionsFixture('second', 'second generation prompt');
  const firstOwner = effectContext(firstSessions.service);
  const secondOwner = effectContext(secondSessions.service);
  try {
    const firstGeneration = await import('../src/client.js?lifecycle-generation=first');
    const secondGeneration = await import('../src/client.js?lifecycle-generation=second');
    firstGeneration.apply(firstOwner.ctx);
    secondGeneration.apply(secondOwner.ctx);

    assert.deepEqual(dom.mounted(), { environments: 1, styles: 1, active: true });
    assert.deepEqual(dom.listenerSnapshot(), { resize: 1, visibility: 1, motion: 1, observers: 2 });
    assert.equal(firstSessions.list.listenerCount(), 0);
    assert.equal(secondSessions.list.listenerCount(), 1);
    assert.equal(firstSessions.session.subscribeCalls(), 0);
    assert.equal(secondSessions.session.subscribeCalls(), 0);
    assert.deepEqual(hudSnapshot(dom.document), {
      matrixSource: 'session',
      eyebrow: 'DSH // NEURAL RAIN',
      source: 'SESSION MEMORY BUS',
      metrics: '41 GLYPHS · 1 SOURCE',
      status: 'LIVE SIGNAL',
    });

    firstOwner.dispose();
    assert.deepEqual(dom.mounted(), { environments: 1, styles: 1, active: true });
    assert.deepEqual(dom.listenerSnapshot(), { resize: 1, visibility: 1, motion: 1, observers: 2 });
    assert.equal(secondSessions.list.listenerCount(), 1);

    secondOwner.dispose();
    assert.deepEqual(dom.mounted(), { environments: 0, styles: 0, active: false });
    assert.deepEqual(dom.listenerSnapshot(), { resize: 0, visibility: 0, motion: 0, observers: 0 });
    assert.equal(secondSessions.list.listenerCount(), 0);
  } finally {
    secondOwner.dispose();
    firstOwner.dispose();
    dom.restore();
  }
});

test('apply disposes object-shaped installation owners from earlier generations', () => {
  const dom = installFakeDom();
  const sessions = sessionsFixture('object-owner', 'object owner prompt');
  const owner = effectContext(sessions.service);
  let previousDisposeCalls = 0;
  dom.document[Symbol.for('dsh-matrix-skin/installation')] = {
    dispose() {
      previousDisposeCalls += 1;
    },
  };
  try {
    apply(owner.ctx);
    assert.equal(previousDisposeCalls, 1);
    assert.deepEqual(dom.mounted(), { environments: 1, styles: 1, active: true });
  } finally {
    owner.dispose();
    dom.restore();
  }
});

test('displayed rain adopts a conversation scrollport mounted after plugin startup', () => {
  const dom = installFakeDom();
  const list = observable({ current: undefined, ids: ['existing'], phase: 'ready' });
  const owner = effectContext({
    list: list.store,
    binding: () => undefined,
  });
  const flushCurrentFrames = (time) => {
    for (const [frameId, callback] of [...dom.frames]) {
      dom.frames.delete(frameId);
      callback(time);
    }
  };
  try {
    apply(owner.ctx);
    flushCurrentFrames(100);
    assert.equal(hudSnapshot(dom.document).matrixSource, 'idle');

    const scrollport = dom.document.createElement('main');
    scrollport.setAttribute('data-conversation-scroll', '');
    const assistantStep = dom.document.createElement('article');
    assistantStep.setAttribute('data-chat-flow-kind', 'assistant-step');
    const markdown = dom.document.createElement('div');
    markdown.className = '_markdown_rendered';
    markdown.appendChild(dom.document.createTextNode('reply rendered after startup'));
    assistantStep.appendChild(markdown);
    scrollport.appendChild(assistantStep);
    dom.document.body.appendChild(scrollport);

    const contentObserver = FakeMutationObserver.instances.find(({ active, options }) => (
      active && options?.childList && options?.subtree
    ));
    contentObserver.callback([{
      type: 'childList',
      target: dom.document.body,
      addedNodes: [scrollport],
      removedNodes: [],
    }]);
    flushCurrentFrames(150);

    assert.deepEqual(hudSnapshot(dom.document), {
      matrixSource: 'session',
      eyebrow: 'DSH // NEURAL RAIN',
      source: 'SESSION MEMORY BUS',
      metrics: '50 GLYPHS · 1 SOURCE',
      status: 'LIVE SIGNAL',
    });
  } finally {
    owner.dispose();
    dom.restore();
  }
});

test('a new generation reclaims owner-less legacy artifacts without losing its active class', () => {
  const dom = installFakeDom();
  const legacyStyle = dom.document.createElement('style');
  legacyStyle.dataset.pluginCss = 'dsh-matrix-skin/styles';
  dom.document.head.appendChild(legacyStyle);
  const legacyEnvironment = dom.document.createElement('div');
  legacyEnvironment.id = 'dsh-matrix-environment';
  dom.document.body.appendChild(legacyEnvironment);
  dom.document.body.classList.add('dsh-matrix-skin-active');
  const row = dom.document.createElement('section');
  row.className = 'native-think dsh-matrix-thinking';
  row.setAttribute('data-variant', 'think');
  row.setAttribute('data-matrix-thinking', 'visible');
  const thinkBody = dom.document.createElement('div');
  thinkBody.className = 'native-thinkBody';
  thinkBody.setAttribute('tabindex', '0');
  thinkBody.dataset.matrixFollowBound = 'true';
  row.appendChild(thinkBody);
  dom.document.body.appendChild(row);
  const legacyCleanup = () => {
    legacyEnvironment.remove();
    legacyStyle.remove();
    dom.document.body.classList.remove('dsh-matrix-skin-active');
    row.classList.remove('dsh-matrix-thinking');
    row.removeAttribute('data-matrix-thinking');
    thinkBody.setAttribute('tabindex', '-1');
    delete thinkBody.dataset.matrixFollowBound;
  };
  const sessions = sessionsFixture('legacy-upgrade', 'upgraded prompt');
  const owner = effectContext(sessions.service);
  try {
    apply(owner.ctx);
    const activeEnvironment = dom.document.getElementById('dsh-matrix-environment');
    const activeStyle = dom.document.querySelector('style[data-plugin-css="dsh-matrix-skin/styles"]');
    assert.notEqual(activeEnvironment, legacyEnvironment);
    assert.notEqual(activeStyle, legacyStyle);
    assert.deepEqual(dom.mounted(), { environments: 1, styles: 1, active: true });

    legacyCleanup();
    assert.deepEqual(dom.mounted(), { environments: 1, styles: 1, active: false });
    assert.equal(row.getAttribute('data-matrix-thinking'), null);
    assert.equal(thinkBody.getAttribute('tabindex'), '-1');
    const classObserver = FakeMutationObserver.instances.find(({ active, options }) => (
      active && options?.attributeFilter?.length === 1 && options.attributeFilter[0] === 'class'
    ));
    classObserver.callback([{
      type: 'attributes',
      target: dom.document.body,
      attributeName: 'class',
      addedNodes: [],
      removedNodes: [],
    }]);
    const contentObserver = FakeMutationObserver.instances.find(({ active, options }) => (
      active && options?.attributeFilter?.includes('data-matrix-thinking')
    ));
    contentObserver.callback([{
      type: 'attributes',
      target: row,
      attributeName: 'data-matrix-thinking',
      addedNodes: [],
      removedNodes: [],
    }]);
    for (const [frameId, callback] of [...dom.frames]) {
      dom.frames.delete(frameId);
      callback(100);
    }
    assert.deepEqual(dom.mounted(), { environments: 1, styles: 1, active: true });
    assert.equal(row.classList.contains('dsh-matrix-thinking'), true);
    assert.equal(row.getAttribute('data-matrix-thinking'), 'visible');
    assert.equal(thinkBody.getAttribute('tabindex'), '0');
    assert.equal(thinkBody.dataset.matrixFollowBound, 'true');

    owner.dispose();
    assert.deepEqual(dom.mounted(), { environments: 0, styles: 0, active: false });
    assert.equal(row.classList.contains('dsh-matrix-thinking'), false);
    assert.equal(row.getAttribute('data-matrix-thinking'), null);
    assert.equal(thinkBody.getAttribute('tabindex'), '-1');
  } finally {
    owner.dispose();
    dom.restore();
  }
});

test('disposing while waiting for DOMContentLoaded prevents a delayed mount', () => {
  const dom = installFakeDom();
  const sessions = sessionsFixture('waiting', 'waiting prompt');
  const owner = effectContext(sessions.service);
  const body = dom.document.body;
  body.remove();
  dom.document.body = null;
  try {
    apply(owner.ctx);
    assert.equal(dom.document.listenerCount('DOMContentLoaded'), 1);
    assert.deepEqual(dom.mounted(), { environments: 0, styles: 0, active: false });
    assert.equal(sessions.list.listenerCount(), 0);

    owner.dispose();
    assert.equal(dom.document.listenerCount('DOMContentLoaded'), 0);

    dom.document.body = body;
    dom.document.documentElement.appendChild(body);
    dom.document.dispatchEvent({ type: 'DOMContentLoaded' });
    assert.deepEqual(dom.mounted(), { environments: 0, styles: 0, active: false });
    assert.equal(sessions.list.listenerCount(), 0);
  } finally {
    if (!dom.document.body) dom.document.body = body;
    if (!body.isConnected) dom.document.documentElement.appendChild(body);
    owner.dispose();
    dom.restore();
  }
});

test('final cleanup restores host body, styles, and Think state', () => {
  const dom = installFakeDom();
  const hostStyle = dom.document.createElement('style');
  hostStyle.dataset.pluginCss = 'host/styles';
  dom.document.head.appendChild(hostStyle);
  const row = dom.document.createElement('section');
  row.className = 'native-think';
  row.setAttribute('data-variant', 'think');
  const thinkBody = dom.document.createElement('div');
  thinkBody.className = 'native-thinkBody';
  thinkBody.setAttribute('tabindex', '-1');
  thinkBody.scrollHeight = 640;
  thinkBody.clientHeight = 160;
  row.appendChild(thinkBody);
  dom.document.body.appendChild(row);
  const sessions = sessionsFixture('cleanup', 'cleanup prompt');
  const owner = effectContext(sessions.service);
  try {
    apply(owner.ctx);
    assert.equal(dom.document.body.className, 'host-shell dsh-matrix-skin-active');
    assert.equal(row.className, 'native-think dsh-matrix-thinking');
    assert.equal(row.getAttribute('data-matrix-thinking'), 'visible');
    assert.equal(thinkBody.getAttribute('tabindex'), '0');
    assert.equal(thinkBody.dataset.matrixFollowBound, 'true');
    assert.equal(thinkBody.listenerCount('scroll'), 1);
    assert.equal(dom.document.walk().filter(({ tagName }) => tagName === 'STYLE').length, 2);

    owner.dispose();
    assert.equal(dom.document.body.className, 'host-shell');
    assert.equal(row.className, 'native-think');
    assert.equal(row.getAttribute('data-variant'), 'think');
    assert.equal(row.getAttribute('data-matrix-thinking'), null);
    assert.equal(thinkBody.className, 'native-thinkBody');
    assert.equal(thinkBody.getAttribute('tabindex'), '-1');
    assert.equal(thinkBody.dataset.matrixFollowBound, undefined);
    assert.equal(thinkBody.dataset.matrixManual, undefined);
    assert.equal(thinkBody.listenerCount('scroll'), 0);
    assert.equal(hostStyle.isConnected, true);
    assert.equal(dom.document.walk().filter(({ tagName }) => tagName === 'STYLE').length, 1);
    assert.deepEqual(dom.mounted(), { environments: 0, styles: 0, active: false });
    assert.deepEqual(dom.listenerSnapshot(), { resize: 0, visibility: 0, motion: 0, observers: 0 });
    assert.equal(sessions.list.listenerCount(), 0);
    assert.equal(dom.frames.size, 0);
  } finally {
    owner.dispose();
    dom.restore();
  }
});

test('session roster reads the selection once without subscribing to its session', () => {
  const dom = installFakeDom();
  const firstSession = sessionStore('selected prompt');
  const secondSession = sessionStore('new selection');
  const list = observable({ current: 'selected', ids: ['selected', 'next'], phase: 'ready' });
  const service = {
    list: list.store,
    binding(id) {
      if (id === 'selected') return { session: firstSession.store };
      if (id === 'next') return { session: secondSession.store };
      return undefined;
    },
  };
  const owner = effectContext(service);
  try {
    apply(owner.ctx);
    assert.equal(list.listenerCount(), 1);
    assert.equal(firstSession.reads(), 1);
    assert.equal(firstSession.subscribeCalls(), 0);
    assert.equal(secondSession.reads(), 0);
    assert.equal(secondSession.subscribeCalls(), 0);
    assert.equal(hudSnapshot(dom.document).source, 'SESSION MEMORY BUS');

    list.emit({ current: 'selected', ids: ['selected', 'next'], phase: 'ready' });
    assert.equal(firstSession.reads(), 1);
    assert.equal(firstSession.subscribeCalls(), 0);

    list.emit({ current: 'next', ids: ['selected', 'next'], phase: 'ready' });
    assert.equal(firstSession.reads(), 1);
    assert.equal(secondSession.reads(), 1);
    assert.equal(secondSession.subscribeCalls(), 0);

    owner.dispose();
    assert.equal(list.listenerCount(), 0);
  } finally {
    owner.dispose();
    dom.restore();
  }
});
