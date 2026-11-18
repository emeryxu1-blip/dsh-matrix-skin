import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInThisContext } from 'node:vm';
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
      if (part === '[data-slot="main.conversation"] [data-phase="hero"]') {
        return this.attributes.get('data-phase') === 'hero'
          && Boolean(this.closest('[data-slot="main.conversation"]'));
      }
      if (part === '[data-slot="main.conversation"]') return this.attributes.get('data-slot') === 'main.conversation';
      if (part === '[data-slot="rightbar"]') return this.attributes.get('data-slot') === 'rightbar';
      if (part === '[data-rightbar-collapsed]') return this.attributes.has('data-rightbar-collapsed');
      if (part === '[role="dialog"]') return this.attributes.get('role') === 'dialog';
      if (part === '[role="menu"]') return this.attributes.get('role') === 'menu';
      if (part === '[role="listbox"]') return this.attributes.get('role') === 'listbox';
      if (part === '[data-trigger-menu]') return this.attributes.has('data-trigger-menu');
      if (part === '[data-composer-card]') return this.attributes.has('data-composer-card');
      if (part === '[data-composer-placeholder]') return this.attributes.has('data-composer-placeholder');
      if (part === '[popover]:popover-open') return this.popoverOpen === true;
      if (part === '[data-variant="think"]') {
        return this.attributes.get('data-variant') === 'think';
      }
      if (part === '[class*="thinkBody"]') return this.className.includes('thinkBody');
      if (part === '[data-conversation-scroll]') {
        return this.attributes.has('data-conversation-scroll');
      }
      if (part.includes('[data-chat-flow-kind="assistant-step"]') && part.includes('[class*="_markdown"]')) {
        return this.className.includes('_markdown') && Boolean(
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
  document.body.setAttribute('data-ds-dark-theme', '');
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

function environmentSource(document) {
  return document.getElementById('dsh-matrix-environment')?.dataset.matrixSource;
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
    assert.deepEqual(dom.listenerSnapshot(), { resize: 1, visibility: 1, motion: 2, observers: 2 });
    assert.equal(firstSessions.list.listenerCount(), 0);
    assert.equal(secondSessions.list.listenerCount(), 1);
    assert.equal(firstSessions.session.subscribeCalls(), 0);
    assert.equal(secondSessions.session.subscribeCalls(), 0);
    assert.equal(environmentSource(dom.document), 'session');
    assert.equal(dom.document.querySelectorAll('.dsh-matrix-hud').length, 0);

    firstOwner.dispose();
    assert.deepEqual(dom.mounted(), { environments: 1, styles: 1, active: true });
    assert.deepEqual(dom.listenerSnapshot(), { resize: 1, visibility: 1, motion: 2, observers: 2 });
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
    assert.equal(environmentSource(dom.document), 'idle');

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

    assert.equal(environmentSource(dom.document), 'session');
    assert.equal(dom.document.querySelectorAll('.dsh-matrix-hud').length, 0);
  } finally {
    owner.dispose();
    dom.restore();
  }
});

test('packaged skin supports Desktop 0.2.2 navigation and CSS modules without changing provider plugins', () => {
  const dom = installFakeDom();
  const list = observable({ ids: ['modern'], byId: { modern: { id: 'modern', retainedBy: { mainView: 1 } } }, phase: 'ready' });
  const selection = observable({ key: 'modern' });
  // DSH 0.1.5 moved conversation nodes out of the public SessionSnapshot.
  const session = observable(Object.freeze({
    sessionId: 'modern', blank: false, openState: 'open',
    queue: Object.freeze([]), pendingSubmissions: Object.freeze([]),
    running: false, removed: false,
  }));
  const owner = effectContext({ list: list.store, binding: () => ({ session: session.store }) });
  owner.ctx.get = (name) => {
    assert.equal(name, 'uiSession');
    return { adapter: { current: selection.store } };
  };
  const context = new Proxy(owner.ctx, {
    get(target, property) {
      assert.ok(property === 'sessions' || property === 'get' || property === 'effect', `unexpected service: ${String(property)}`);
      return target[property];
    },
    set() { assert.fail('a skin must not change provider services'); },
  });
  const providerControls = dom.document.createElement('section');
  providerControls.setAttribute('data-slot', 'conversation.input.model');
  providerControls.className = 'separate-provider-plugin';
  const effort = dom.document.createElement('button');
  effort.textContent = 'Effort: High';
  effort.setAttribute('aria-haspopup', 'menu');
  effort.setAttribute('aria-expanded', 'false');
  const onEffort = () => effort.setAttribute('aria-expanded', 'true');
  effort.addEventListener('click', onEffort);
  providerControls.appendChild(effort);
  const foreignStyles = dom.document.createElement('style');
  foreignStyles.dataset.pluginCss = 'separate-provider-plugin/styles';
  foreignStyles.textContent = '.separate-provider-plugin { color: inherit; }';
  dom.document.head.appendChild(foreignStyles);
  dom.document.body.appendChild(providerControls);

  const scrollport = dom.document.createElement('main');
  scrollport.setAttribute('data-conversation-scroll', '');
  const step = dom.document.createElement('article');
  step.setAttribute('data-chat-flow-kind', 'assistant-step');
  const markdown = dom.document.createElement('div');
  // DSH 0.2.2 emits [hash]_[local], without the legacy trailing underscore.
  markdown.className = 'AbCdEf_markdown';
  markdown.appendChild(dom.document.createTextNode('Current DSH rendered reply'));
  step.appendChild(markdown);
  scrollport.appendChild(step);
  dom.document.body.appendChild(scrollport);

  const originalFetch = globalThis.fetch;
  const forbiddenFetch = () => assert.fail('a skin must not make network requests');
  globalThis.fetch = forbiddenFetch;
  dom.fakeWindow.fetch = forbiddenFetch;
  let packaged;
  dom.fakeWindow.__ModuleLoader__ = {
    load({ id, factory }) {
      assert.equal(id, 'dsh-matrix-skin');
      packaged = factory(() => assert.fail('the skin must not import a provider or legacy runtime'));
    },
  };
  try {
    runInThisContext(readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8'));
    assert.deepEqual(packaged.inject, ['sessions']);
    packaged.apply(context);
    for (const [id, callback] of [...dom.frames]) {
      dom.frames.delete(id);
      callback(100);
    }
    assert.equal(environmentSource(dom.document), 'session');
    assert.equal(session.reads(), 1);
    assert.equal(session.subscribeCalls(), 0);
    assert.equal(selection.listenerCount(), 1);
    assert.equal(globalThis.fetch, forbiddenFetch);
    assert.equal(dom.fakeWindow.fetch, forbiddenFetch);
    assert.equal(providerControls.className, 'separate-provider-plugin');
    assert.equal(providerControls.children[0], effort);
    assert.equal(effort.textContent, 'Effort: High');
    assert.equal(effort.getAttribute('aria-expanded'), 'false');
    effort.dispatchEvent({ type: 'click' });
    assert.equal(effort.getAttribute('aria-expanded'), 'true');
    owner.dispose();
    assert.deepEqual(dom.mounted(), { environments: 0, styles: 0, active: false });
    assert.equal(list.listenerCount(), 0);
    assert.equal(selection.listenerCount(), 0);
    assert.equal(providerControls.isConnected, true);
    assert.equal(foreignStyles.isConnected, true);
    assert.equal(effort.listenerCount('click'), 1);
    assert.equal(effort.getAttribute('aria-expanded'), 'true');
  } finally {
    owner.dispose();
    globalThis.fetch = originalFetch;
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
      active && options?.attributeFilter?.includes('data-phase')
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
    assert.equal(row.classList.contains('dsh-matrix-thinking'), false);
    assert.equal(row.getAttribute('data-matrix-thinking'), null);
    assert.equal(thinkBody.getAttribute('tabindex'), '-1');
    assert.equal(thinkBody.dataset.matrixFollowBound, undefined);

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

test('native reasoning collapse, focus, and scroll state remain untouched', () => {
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
    assert.equal(row.className, 'native-think');
    assert.equal(row.getAttribute('data-matrix-thinking'), null);
    assert.equal(thinkBody.getAttribute('tabindex'), '-1');
    assert.equal(thinkBody.dataset.matrixFollowBound, undefined);
    assert.equal(thinkBody.listenerCount('scroll'), 0);
    assert.equal(thinkBody.scrollTop, 0);
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
    assert.equal(environmentSource(dom.document), 'session');

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

function addHero(dom) {
  const seat = dom.document.createElement('section');
  seat.setAttribute('data-slot', 'main.conversation');
  const hero = dom.document.createElement('div');
  hero.setAttribute('data-phase', 'hero');
  hero.clientWidth = 800;
  hero.clientHeight = 600;
  seat.appendChild(hero);
  dom.document.body.appendChild(seat);
  return hero;
}

function flushFrames(dom, time = 100) {
  for (const [id, callback] of [...dom.frames]) {
    dom.frames.delete(id);
    callback(time);
  }
}

function notifyNativeMutation(target, attributeName = 'data-phase') {
  const observer = FakeMutationObserver.instances.find(({ active, options }) => active && options?.subtree && options?.attributes);
  observer.callback([{ type: 'attributes', target, attributeName, addedNodes: [], removedNodes: [] }]);
}

test('decorative rain stays inside the native empty conversation and pauses on active content or overlays', () => {
  const dom = installFakeDom();
  const owner = effectContext();
  const hero = addHero(dom);
  try {
    apply(owner.ctx);
    const environment = dom.document.getElementById('dsh-matrix-environment');
    assert.equal(environment.parentElement, hero);
    assert.equal(environment.dataset.matrixDecorative, 'true');
    assert.equal(environment.hidden, false);
    assert.equal(environment.children.length, 1);
    assert.equal(environment.children[0].tagName, 'CANVAS');
    flushFrames(dom);
    assert.equal(dom.frames.size, 1, 'only the optional rain animation remains scheduled');

    const menu = dom.document.createElement('div');
    menu.setAttribute('role', 'menu');
    dom.document.body.appendChild(menu);
    notifyNativeMutation(menu, 'role');
    flushFrames(dom, 160);
    assert.equal(environment.hidden, true);
    assert.equal(environment.dataset.matrixDecorative, 'false');
    assert.equal(dom.frames.size, 0, 'opening a native menu stops animation');

    menu.remove();
    notifyNativeMutation(hero);
    flushFrames(dom, 200);
    assert.equal(environment.hidden, false);
    assert.equal(dom.frames.size, 1);

    const dialog = dom.document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dom.document.body.appendChild(dialog);
    notifyNativeMutation(dialog, 'aria-modal');
    flushFrames(dom, 260);
    assert.equal(environment.hidden, true);
    assert.equal(dom.frames.size, 0, 'settings and other modal dialogs stop animation');
    dialog.remove();

    hero.setAttribute('data-phase', 'active');
    notifyNativeMutation(hero);
    flushFrames(dom, 300);
    assert.equal(environment.hidden, true);
    assert.equal(environment.parentElement, dom.document.body);
    assert.equal(dom.frames.size, 0, 'reading an existing conversation has no animation loop');
  } finally {
    owner.dispose();
    dom.restore();
  }
});

test('reduced motion and background visibility fully disable decorative animation', () => {
  const dom = installFakeDom();
  const owner = effectContext();
  addHero(dom);
  try {
    apply(owner.ctx);
    flushFrames(dom);
    const environment = dom.document.getElementById('dsh-matrix-environment');
    const motion = dom.mediaQueries[0];
    motion.matches = true;
    motion.dispatchEvent({ type: 'change' });
    assert.equal(environment.hidden, true);
    assert.equal(environment.dataset.matrixDecorative, 'false');
    assert.equal(dom.frames.size, 0);

    motion.matches = false;
    motion.dispatchEvent({ type: 'change' });
    assert.equal(environment.hidden, false);
    assert.equal(dom.frames.size, 1);
    dom.document.hidden = true;
    dom.document.dispatchEvent({ type: 'visibilitychange' });
    assert.equal(environment.hidden, true);
    assert.equal(dom.frames.size, 0);
    dom.document.hidden = false;
    dom.document.dispatchEvent({ type: 'visibilitychange' });
    assert.equal(environment.hidden, false);
    assert.equal(dom.frames.size, 1);
  } finally {
    owner.dispose();
    dom.restore();
  }
});

test('opening the right sidebar suppresses empty-state decoration', () => {
  const dom = installFakeDom();
  const owner = effectContext();
  const hero = addHero(dom);
  const frame = dom.document.createElement('div');
  frame.setAttribute('data-rightbar-collapsed', 'true');
  const rightbar = dom.document.createElement('div');
  rightbar.setAttribute('data-slot', 'rightbar');
  frame.appendChild(rightbar);
  dom.document.body.appendChild(frame);
  try {
    apply(owner.ctx);
    flushFrames(dom);
    const environment = dom.document.getElementById('dsh-matrix-environment');
    assert.equal(environment.hidden, false);
    frame.removeAttribute('data-rightbar-collapsed');
    notifyNativeMutation(frame, 'data-rightbar-collapsed');
    flushFrames(dom, 200);
    assert.equal(environment.hidden, true);
    assert.equal(dom.frames.size, 0);
    assert.equal(environment.parentElement, dom.document.body);
  } finally {
    owner.dispose();
    dom.restore();
  }
});

test('light theme, narrow viewports, and forced colors keep decoration and its animation disabled', () => {
  const dom = installFakeDom();
  const owner = effectContext();
  addHero(dom);
  try {
    apply(owner.ctx);
    flushFrames(dom);
    const environment = dom.document.getElementById('dsh-matrix-environment');
    dom.document.body.removeAttribute('data-ds-dark-theme');
    notifyNativeMutation(dom.document.body, 'data-ds-dark-theme');
    flushFrames(dom, 200);
    assert.equal(environment.hidden, true);
    assert.equal(dom.frames.size, 0);

    dom.document.body.setAttribute('data-ds-dark-theme', '');
    notifyNativeMutation(dom.document.body, 'data-ds-dark-theme');
    flushFrames(dom, 300);
    assert.equal(environment.hidden, false);
    dom.fakeWindow.innerWidth = 640;
    dom.fakeWindow.dispatchEvent({ type: 'resize' });
    assert.equal(environment.hidden, true);
    assert.equal(dom.frames.size, 0);

    dom.fakeWindow.innerWidth = 1200;
    dom.fakeWindow.dispatchEvent({ type: 'resize' });
    assert.equal(environment.hidden, false);
    const forcedColors = dom.mediaQueries[1];
    forcedColors.matches = true;
    forcedColors.dispatchEvent({ type: 'change' });
    assert.equal(environment.hidden, true);
    assert.equal(dom.frames.size, 0);
  } finally {
    owner.dispose();
    dom.restore();
  }
});

test('native input-trigger menus, listboxes, and nonmodal dialogs stop rain until dismissed', () => {
  const dom = installFakeDom();
  const owner = effectContext();
  const hero = addHero(dom);
  try {
    apply(owner.ctx);
    flushFrames(dom);
    const environment = dom.document.getElementById('dsh-matrix-environment');
    for (const [attribute, value] of [['data-trigger-menu', ''], ['role', 'listbox'], ['role', 'dialog']]) {
      const popup = dom.document.createElement('div');
      popup.setAttribute(attribute, value);
      dom.document.body.appendChild(popup);
      notifyNativeMutation(popup, attribute);
      flushFrames(dom, 200);
      assert.equal(environment.hidden, true, `${attribute}=${value} must suppress decoration`);
      assert.equal(dom.frames.size, 0, 'an open native input popup must stop animation');
      popup.remove();
      notifyNativeMutation(hero);
      flushFrames(dom, 300);
      assert.equal(environment.hidden, false, 'decoration may resume after dismissal');
      assert.equal(dom.frames.size, 1);
    }
  } finally {
    owner.dispose();
    dom.restore();
  }
});

test('typing a draft suppresses decoration using only the native placeholder marker', () => {
  const dom = installFakeDom();
  const owner = effectContext();
  const hero = addHero(dom);
  const composer = dom.document.createElement('section');
  composer.setAttribute('data-composer-card', '');
  const placeholder = dom.document.createElement('div');
  placeholder.setAttribute('data-composer-placeholder', '');
  composer.appendChild(placeholder);
  hero.appendChild(composer);
  try {
    apply(owner.ctx);
    flushFrames(dom);
    const environment = dom.document.getElementById('dsh-matrix-environment');
    assert.equal(environment.hidden, false);
    placeholder.remove();
    notifyNativeMutation(composer);
    flushFrames(dom, 200);
    assert.equal(environment.hidden, true);
    assert.equal(dom.frames.size, 0, 'draft editing has no decorative animation');
    composer.appendChild(placeholder);
    notifyNativeMutation(composer);
    flushFrames(dom, 300);
    assert.equal(environment.hidden, false);
    assert.equal(dom.frames.size, 1);
  } finally {
    owner.dispose();
    dom.restore();
  }
});
