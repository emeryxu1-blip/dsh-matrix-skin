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
    this.values = new Set();
  }

  add(...values) {
    for (const value of values) this.values.add(value);
    this.owner.className = [...this.values].join(' ');
  }

  remove(...values) {
    for (const value of values) this.values.delete(value);
    this.owner.className = [...this.values].join(' ');
  }

  contains(value) {
    return this.values.has(value);
  }
}

class FakeElement extends FakeEventTarget {
  constructor(tagName, ownerDocument) {
    super();
    this.tagName = tagName.toUpperCase();
    this.ownerDocument = ownerDocument;
    this.children = [];
    this.parentElement = null;
    this.dataset = {};
    this.attributes = new Map();
    this.className = '';
    this.classList = new FakeClassList(this);
    this.style = {};
    this.textContent = '';
    this.scrollTop = 0;
    this.scrollHeight = 0;
    this.context = this.tagName === 'CANVAS' ? {
      clearCount: 0,
      fillRectCount: 0,
      fillTextCount: 0,
      transformCount: 0,
      compositeOperations: [],
      _globalCompositeOperation: 'source-over',
      get globalCompositeOperation() {
        return this._globalCompositeOperation;
      },
      set globalCompositeOperation(value) {
        this._globalCompositeOperation = value;
        this.compositeOperations.push(value);
      },
      clearRect() { this.clearCount += 1; },
      fillRect() { this.fillRectCount += 1; },
      fillText() { this.fillTextCount += 1; },
      setTransform() { this.transformCount += 1; },
    } : null;
  }

  get id() {
    return this.attributes.get('id') ?? '';
  }

  set id(value) {
    this.attributes.set('id', String(value));
  }

  get isConnected() {
    for (let node = this; node; node = node.parentElement) {
      if (node === this.ownerDocument?.documentElement) return true;
    }
    return false;
  }

  appendChild(child) {
    child.parentElement = this;
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
  }

  setAttribute(name, value) {
    if (name === 'class') this.className = String(value);
    else this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return name === 'class' ? (this.className || null) : (this.attributes.get(name) ?? null);
  }

  removeAttribute(name) {
    if (name === 'class') this.className = '';
    else this.attributes.delete(name);
  }

  matches(selector) {
    if (selector === '[data-variant="think"]') return this.attributes.get('data-variant') === 'think';
    if (selector === '[class*="thinkBody"]') return this.className.includes('thinkBody');
    if (selector.startsWith('style[data-plugin-css=')) {
      return this.tagName === 'STYLE' && this.dataset.pluginCss === 'dsh-matrix-skin/styles';
    }
    return false;
  }

  querySelectorAll(selector) {
    const matches = [];
    for (const child of this.children) {
      if (child.matches(selector)) matches.push(child);
      matches.push(...child.querySelectorAll(selector));
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

  createElement(tag) {
    return new FakeElement(tag, this);
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
      for (const child of node.children) visit(child);
    };
    visit(this.documentElement);
    return elements;
  }
}

class FakeMutationObserver {
  observe() {}
  disconnect() {}
}

function installFakeDom() {
  const original = new Map();
  const set = (name, value) => {
    original.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  };
  const document = new FakeDocument();
  const fakeWindow = new FakeEventTarget();
  Object.assign(fakeWindow, {
    innerWidth: 1280,
    innerHeight: 720,
    devicePixelRatio: 1,
    matchMedia() {
      return new FakeEventTarget();
    },
  });
  fakeWindow.matchMedia = () => Object.assign(new FakeEventTarget(), { matches: false });
  let raf = 0;
  const cancelledFrames = [];
  set('Element', FakeElement);
  set('HTMLElement', FakeElement);
  set('Document', FakeDocument);
  set('MutationObserver', FakeMutationObserver);
  set('document', document);
  set('window', fakeWindow);
  set('requestAnimationFrame', () => ++raf);
  set('cancelAnimationFrame', (frame) => cancelledFrames.push(frame));
  return {
    cancelledFrames,
    document,
    fakeWindow,
    rafCount: () => raf,
    mounted() {
      return {
        environments: document.walk().filter((element) => element.id === 'dsh-matrix-environment').length,
        styles: document.walk().filter((element) => element.tagName === 'STYLE').length,
        active: document.body.classList.contains('dsh-matrix-skin-active'),
      };
    },
    restore() {
      for (const [name, descriptor] of original) {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor);
        else delete globalThis[name];
      }
    },
  };
}

function effectContext() {
  const cleanups = [];
  return {
    ctx: {
      effect(factory) {
        cleanups.push(factory());
      },
    },
    dispose() {
      for (const cleanup of cleanups.splice(0).reverse()) cleanup();
    },
  };
}

test('overlapping cleanup preserves the newest Matrix mount', () => {
  const dom = installFakeDom();
  const first = effectContext();
  const second = effectContext();
  const third = effectContext();
  try {
    apply(first.ctx);
    apply(second.ctx);
    assert.deepEqual(dom.mounted(), { environments: 1, styles: 1, active: true });
    assert.equal(dom.fakeWindow.listenerCount('resize'), 1);
    assert.equal(dom.document.listenerCount('visibilitychange'), 1);
    first.dispose();
    assert.deepEqual(dom.mounted(), { environments: 1, styles: 1, active: true });
    second.dispose();
    assert.deepEqual(dom.mounted(), { environments: 0, styles: 0, active: false });
    assert.equal(dom.fakeWindow.listenerCount('resize'), 0);
    assert.equal(dom.document.listenerCount('visibilitychange'), 0);
    apply(third.ctx);
    assert.deepEqual(dom.mounted(), { environments: 1, styles: 1, active: true });
    third.dispose();
    assert.deepEqual(dom.mounted(), { environments: 0, styles: 0, active: false });
  } finally {
    third.dispose();
    second.dispose();
    first.dispose();
    dom.restore();
  }
});

test('mounting never reads or subscribes to session history', () => {
  const dom = installFakeDom();
  const owner = effectContext();
  let sessionReads = 0;
  Object.defineProperty(owner.ctx, 'sessions', {
    configurable: true,
    get() {
      sessionReads += 1;
      throw new Error('Matrix skin must not access sessions');
    },
  });
  try {
    apply(owner.ctx);
    assert.equal(sessionReads, 0);
    assert.deepEqual(dom.mounted(), { environments: 1, styles: 1, active: true });
  } finally {
    owner.dispose();
    dom.restore();
  }
});

test('a stale cleanup from an older module generation cannot remove the current mount', async () => {
  const dom = installFakeDom();
  const first = effectContext();
  const second = effectContext();
  try {
    const oldGeneration = await import('../src/client.js?generation=old');
    const newGeneration = await import('../src/client.js?generation=new');
    oldGeneration.apply(first.ctx);
    newGeneration.apply(second.ctx);
    assert.deepEqual(dom.mounted(), { environments: 1, styles: 1, active: true });
    first.dispose();
    assert.deepEqual(dom.mounted(), { environments: 1, styles: 1, active: true });
    second.dispose();
    assert.deepEqual(dom.mounted(), { environments: 0, styles: 0, active: false });
  } finally {
    second.dispose();
    first.dispose();
    dom.restore();
  }
});

test('disposing before DOMContentLoaded prevents a delayed Matrix mount', () => {
  const dom = installFakeDom();
  const owner = effectContext();
  const body = dom.document.body;
  body.remove();
  dom.document.body = null;
  try {
    apply(owner.ctx);
    assert.equal(dom.document.listenerCount('DOMContentLoaded'), 1);
    owner.dispose();
    assert.equal(dom.document.listenerCount('DOMContentLoaded'), 0);

    dom.document.body = body;
    dom.document.documentElement.appendChild(body);
    dom.document.dispatchEvent({ type: 'DOMContentLoaded' });
    assert.deepEqual(dom.mounted(), { environments: 0, styles: 0, active: false });
  } finally {
    if (!dom.document.body) dom.document.body = body;
    if (!body.isConnected) dom.document.documentElement.appendChild(body);
    owner.dispose();
    dom.restore();
  }
});

test('Canvas2D restoration reapplies renderer state and resumes the rain', () => {
  const dom = installFakeDom();
  const owner = effectContext();
  try {
    apply(owner.ctx);
    const environment = dom.document.getElementById('dsh-matrix-environment');
    const canvas = environment.children.find((child) => child.tagName === 'CANVAS');
    assert.equal(canvas.listenerCount('contextlost'), 1);
    assert.equal(canvas.listenerCount('contextrestored'), 1);
    assert.ok(canvas.context.fillRectCount > 0);
    assert.ok(canvas.context.fillTextCount > 0);
    assert.deepEqual(canvas.context.compositeOperations.slice(-2), ['destination-out', 'source-over']);
    const transformsBeforeRestore = canvas.context.transformCount;
    const framesBeforeRestore = dom.rafCount();

    canvas.dispatchEvent({ type: 'contextlost' });
    assert.ok(dom.cancelledFrames.length > 0);
    canvas.dispatchEvent({ type: 'contextrestored' });
    assert.ok(canvas.context.transformCount > transformsBeforeRestore);
    assert.ok(dom.rafCount() > framesBeforeRestore);

    owner.dispose();
    assert.equal(canvas.listenerCount('contextlost'), 0);
    assert.equal(canvas.listenerCount('contextrestored'), 0);
  } finally {
    owner.dispose();
    dom.restore();
  }
});
