import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  OFFICIAL_DSH_README_FALLBACK,
  MATRIX_SOURCE_LIMITS,
  bindSessionRoster,
  composeMatrixText,
  inject,
  isAtScrollTail,
  isMatrixTrailOutside,
  matrixSourcesFromDom,
  matrixSourcesFromSnapshot,
  matrixTextWindow,
  normalizeMatrixText,
  normalizeThinkingText,
  rebaseMatrixColumns,
  shouldFollowThinkingTail,
  splitMatrixGraphemes,
} from '../src/client.js';

const clientSource = readFileSync(new URL('../src/client.js', import.meta.url), 'utf8');
const matrixCss = clientSource.match(/const MATRIX_CSS = String\.raw`([\s\S]*?)`;\s*$/)?.[1] ?? '';

test('client requests only the local sessions snapshot service', () => {
  assert.deepEqual(inject, ['sessions']);
});

const cssRules = [...matrixCss.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .map(([, selectors, body]) => ({
    selectors: selectors.trim(),
    declarations: Object.fromEntries([...body.matchAll(/([\w-]+)\s*:\s*([^;{}]+);/g)]
      .map(([, property, value]) => [property, value.trim()])),
  }));

function ruleFor(selector) {
  const rule = cssRules.find((entry) => entry.selectors === selector);
  assert.ok(rule, `Missing CSS rule: ${selector}`);
  return rule.declarations;
}

function themeTokens(dark) {
  const generic = ruleFor('body.dsh-matrix-skin-active');
  const theme = ruleFor(dark
    ? 'body.dsh-matrix-skin-active[data-ds-dark-theme]'
    : 'body.dsh-matrix-skin-active:not([data-ds-dark-theme])');
  return { ...generic, ...theme };
}

function resolveToken(value, tokens) {
  for (let depth = 0; depth < 8 && value?.startsWith('var('); depth += 1) {
    value = tokens[value.match(/^var\((--[\w-]+)\)$/)?.[1]];
  }
  assert.match(value ?? '', /^#[\da-f]{6}$/i, 'Contrast checks require a resolved solid RGB color');
  return value;
}

function luminance(hex) {
  const channels = hex.slice(1).match(/../g).map((channel) => parseInt(channel, 16) / 255)
    .map((value) => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
}

function contrast(foreground, background) {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + .05) / (values[1] + .05);
}

function mediaBlock(condition) {
  const match = [...matrixCss.matchAll(/@media([^{}]+)\{/g)]
    .find((entry) => entry[1].includes(condition));
  assert.ok(match, `Missing media condition: ${condition}`);
  const start = match.index + match[0].length;
  let depth = 1;
  let end = start;
  while (end < matrixCss.length && depth) {
    if (matrixCss[end] === '{') depth += 1;
    if (matrixCss[end] === '}') depth -= 1;
    end += 1;
  }
  assert.equal(depth, 0, 'Media block must be balanced');
  return matrixCss.slice(start, end - 1);
}

test('dark surfaces stay conditional and native light surfaces remain available', () => {
  const light = themeTokens(false);
  assert.ok(themeTokens(true)['--dsw-alias-bg-base']);
  for (const [name] of Object.entries(light)) {
    assert.doesNotMatch(name, /^--dsw-alias-bg-/, 'Light mode must keep native surface colors');
  }
  assert.doesNotMatch(matrixCss, /color-scheme\s*:\s*dark/);
  assert.doesNotMatch(matrixCss, /background(?:-color)?\s*:[^;]*!important/);
  assert.ok(contrast(resolveToken(light['--dsh-matrix-accent'], light), '#ffffff') >= 4.5);
});

test('declared dark text tiers maintain readable contrast on every solid theme layer', () => {
  const tokens = themeTokens(true);
  const surfaces = ['base', 'layer-1', 'layer-2', 'layer-3'];
  const labels = ['primary', 'secondary', 'tertiary', 'caption', 'dimmed'];
  for (const surface of surfaces) {
    const background = resolveToken(tokens[`--dsw-alias-bg-${surface}`], tokens);
    for (const label of labels) {
      const foreground = resolveToken(tokens[`--dsw-alias-label-${label}`], tokens);
      assert.ok(contrast(foreground, background) >= 4.5,
        `${label} text must reach 4.5:1 on ${surface}`);
    }
  }
});

test('focus and selected text stay visible in both appearances', () => {
  const focus = cssRules.find((entry) => entry.selectors.includes(':focus-visible')
    && entry.declarations.outline);
  assert.ok(focus);
  assert.match(focus.declarations.outline, /^2px solid var\(--dsh-matrix-accent\)$/);
  for (const control of ['button', 'input', 'textarea', 'select', 'a']) {
    assert.ok(focus.selectors.includes(control), `${control} must receive keyboard focus styling`);
  }
  const selection = ruleFor('body.dsh-matrix-skin-active ::selection');
  for (const dark of [false, true]) {
    const tokens = themeTokens(dark);
    const foreground = resolveToken(selection.color, tokens);
    const background = resolveToken(selection.background, tokens);
    assert.ok(contrast(foreground, background) >= 4.5, 'Selected text must remain readable');
    const accent = resolveToken(tokens['--dsh-matrix-accent'], tokens);
    const surface = dark ? resolveToken(tokens['--dsw-alias-bg-layer-3'], tokens) : '#ffffff';
    assert.ok(contrast(accent, surface) >= 3, 'Focus outline must remain distinct from its surface');
  }
});

test('native typography, layout, reasoning disclosure, and composer text layers remain untouched', () => {
  const geometryOrTypography = /^(?:font(?:-[\w-]+)?|line-height|letter-spacing|text-transform|white-space|word-break|padding(?:-[\w-]+)?|margin(?:-[\w-]+)?|(?:min-|max-)?(?:width|height)|position|overflow(?:-[\w-]+)?)$/;
  for (const { selectors, declarations } of cssRules) {
    if (!selectors.includes('body.dsh-matrix-skin-active')) continue;
    if (selectors.includes('.dsh-matrix-environment')) continue;
    for (const property of Object.keys(declarations)) {
      assert.doesNotMatch(property, geometryOrTypography,
        `${selectors} must preserve native ${property}`);
    }
    if (/textarea|data-input-backdrop|data-input-scroll/.test(selectors)) {
      assert.ok(Object.keys(declarations).every((property) => property.startsWith('outline')),
        'Native textarea/backdrop painting must not be overridden');
    }
  }
  assert.doesNotMatch(matrixCss, /data-matrix-thinking|thinkBody|data-disclosure-header/);
  assert.doesNotMatch(matrixCss, /scrollbar-(?:width|color)\s*:/);
});

test('syntax, terminal, diff, warning, and error semantics retain their native styles', () => {
  for (const { declarations } of cssRules) {
    for (const property of Object.keys(declarations)) {
      assert.doesNotMatch(property,
        /^--(?:shiki-|terminal-|dsw-alias-(?:code-diff-|state-(?:error|warn|success|done)-))/);
    }
  }
  assert.doesNotMatch(matrixCss, /(?:\[data-variant|\[data-error|\.xterm|\[class\*=["'](?:_markdown|_card))/);
  for (const { selectors } of cssRules) {
    assert.doesNotMatch(selectors, /\b(?:pre|code)(?=\s|:|,|$)/);
  }
});

test('decorative rain cannot overlay working surfaces or add synthetic UI labels', () => {
  const environment = ruleFor('.dsh-matrix-environment');
  assert.equal(environment.display, 'none');
  assert.equal(environment.position, 'absolute');
  assert.equal(environment['z-index'], '-1');
  assert.equal(environment['pointer-events'], 'none');
  assert.equal(ruleFor('.dsh-matrix-environment[data-matrix-decorative="true"]').display, 'block');
  const rain = ruleFor('.dsh-matrix-rain');
  assert.ok(Number(rain.opacity) <= .1, 'Rain must stay quieter than reading content');
  assert.doesNotMatch(matrixCss, /text-shadow\s*:|drop-shadow\(|mix-blend-mode\s*:|content\s*:/);
  assert.doesNotMatch(matrixCss, /dsh-matrix-hud|SECURE_INPUT_CHANNEL|COGNITION_STREAM/);
});

test('motion, forced-color, compact-screen, and print preferences hide decorative rain', () => {
  for (const condition of ['prefers-reduced-motion: reduce', 'forced-colors: active', 'max-width: 640px', 'print']) {
    assert.match(mediaBlock(condition), /\.dsh-matrix-environment[^{}]*\{[^}]*display:\s*none/,
      `${condition} must suppress decorative rain`);
  }
  assert.match(mediaBlock('forced-colors: active'), /display:\s*none/);
  assert.match(matrixCss, /@media\s*\(forced-colors: active\)\s*\{[\s\S]*?outline-color:\s*Highlight;/);
});

test('preserves provider-supplied reasoning verbatim', () => {
  const text = '线路分析\nconst x = "<safe>";\n✓';
  assert.equal(normalizeThinkingText(text), text);
});

test('empty and malformed reasoning safely normalize to empty text', () => {
  assert.equal(normalizeThinkingText(''), '');
  assert.equal(normalizeThinkingText(null), '');
  assert.equal(normalizeThinkingText({ text: 'hidden' }), '');
});

test('tail detection tolerates small layout rounding gaps', () => {
  const scrollport = { scrollHeight: 500, scrollTop: 281, clientHeight: 200 };
  assert.equal(isAtScrollTail(scrollport), false);
  scrollport.scrollTop = 282;
  assert.equal(isAtScrollTail(scrollport), true);
});

test('stream following is controlled by explicit reader intent, not post-growth geometry', () => {
  assert.equal(shouldFollowThinkingTail(undefined), true);
  assert.equal(shouldFollowThinkingTail('false'), true);
  assert.equal(shouldFollowThinkingTail('true'), false);
});

test('matrix corpus includes newest finalized, partial, queued, and steering text without duplication', () => {
  const sources = matrixSourcesFromSnapshot({
    blank: false,
    nodes: [
      { kind: 'user', content: [{ type: 'text', text: 'inspect the harness' }] },
      { kind: 'steering', messageId: 'steer-1', content: [{ type: 'text', text: 'make it greener' }] },
      { kind: 'assistant', blocks: [
        { kind: 'reasoning', text: 'trace the renderer' },
        { kind: 'text', text: 'renderer mapped' },
      ] },
    ],
    partial: { blocks: [
      { kind: 'reasoning', text: 'live cognition' },
      { kind: 'text', text: 'streaming reply' },
    ] },
    queue: [
      { placement: 'steering', messageId: 'steer-1', content: [{ type: 'text', text: 'duplicate' }] },
      { placement: 'steering', messageId: 'steer-2', content: [{ type: 'text', text: 'increase signal' }] },
      { placement: 'queued', messageId: 'queued-1', content: [{ type: 'text', text: 'not admitted yet' }] },
    ],
  });

  assert.deepEqual(sources, {
    thinking: ['live cognition'],
    reasoning: ['trace the renderer'],
    assistant: ['renderer mapped', 'streaming reply'],
    user: ['inspect the harness', 'make it greener', 'increase signal', 'not admitted yet'],
    blank: false,
  });
  const feed = composeMatrixText(sources);
  assert.match(feed, /\/\/ COGNITION · LATEST\nlive cognition/);
  assert.match(feed, /\/\/ REASONING TRACE · LATEST\ntrace the renderer/);
  assert.match(feed, /\/\/ ASSISTANT · LATEST\nstreaming reply/);
  assert.match(feed, /\/\/ ASSISTANT · RECENT\nrenderer mapped/);
  assert.match(feed, /\/\/ USER · LATEST\nnot admitted yet/);
  assert.doesNotMatch(feed, /OFFICIAL README/);
});

test('only authoritative blank sessions use the exact bundled official DeepSeek Harness README', () => {
  const feed = composeMatrixText({ blank: true });
  assert.match(feed, /DSH OFFICIAL README · EMPTY SESSION FALLBACK/);
  assert.match(feed, /DeepSeek Harness \(`dsh`\) is an open-source agent harness/);
  assert.match(OFFICIAL_DSH_README_FALLBACK, /npx @deepseek-ai\/dsh web/);
  assert.equal(
    createHash('sha256').update(OFFICIAL_DSH_README_FALLBACK).digest('hex'),
    '22e50d089b7f45a53a913443ce76af6b6f1ef31958c26c558c7822c3d238c03f',
  );
  assert.equal(composeMatrixText(matrixSourcesFromSnapshot({ blank: false, nodes: [], queue: [] })), '');
  assert.equal(composeMatrixText({}), '');
});

test('newest channel entries lead the corpus and column cursors rebase into the fresh window', () => {
  const feed = composeMatrixText({
    blank: false,
    assistant: ['older reply', 'newest reply'],
    user: ['older prompt', 'newest prompt'],
  });
  assert.ok(feed.indexOf('newest reply') < feed.indexOf('older reply'));
  assert.ok(feed.indexOf('newest prompt') < feed.indexOf('older prompt'));

  const columns = Array.from({ length: 24 }, () => ({ sourceOffset: 99999 }));
  rebaseMatrixColumns(columns, 20_000);
  assert.ok(columns.every(({ sourceOffset }) => sourceOffset >= 0 && sourceOffset < 5000));
  assert.ok(new Set(columns.map(({ sourceOffset }) => sourceOffset)).size > 20);
  rebaseMatrixColumns(columns, 0);
  assert.ok(columns.every(({ sourceOffset }) => sourceOffset === 0));
});

test('session roster takes one bounded snapshot per selection without subscribing to its stream', () => {
  const observable = (initial) => {
    let value = initial;
    const listeners = new Set();
    return {
      store: {
        getSnapshot: () => value,
        subscribe: (listener) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
      },
      emit(next) {
        value = next;
        for (const listener of [...listeners]) listener();
      },
      listenerCount: () => listeners.size,
    };
  };

  const sessionStore = (snapshot) => {
    let reads = 0;
    return {
      store: {
        getSnapshot: () => {
          reads += 1;
          return snapshot;
        },
        get subscribe() {
          throw new Error('the current session stream must not be subscribed');
        },
      },
      reads: () => reads,
    };
  };
  const sessionA = sessionStore({ blank: false, nodes: [], queue: [], partial: null });
  const sessionB = sessionStore({
    blank: false,
    nodes: [{ kind: 'user', content: [{ type: 'text', text: 'new session prompt' }] }],
    queue: [],
    partial: null,
  });
  const list = observable({ current: 'a' });
  const bindings = { a: { session: sessionA.store }, b: { session: sessionB.store } };
  const published = [];
  const stop = bindSessionRoster({
    sessions: {
      list: list.store,
      binding: (id) => bindings[id],
    },
  }, (sources) => published.push(sources));

  assert.equal(sessionA.reads(), 1);
  list.emit({ current: 'a', phase: 'ready' });
  assert.equal(sessionA.reads(), 1);

  list.emit({ current: 'b' });
  assert.equal(sessionB.reads(), 1);
  assert.deepEqual(published.at(-1).user, ['new session prompt']);
  stop();
  assert.equal(list.listenerCount(), 0);
});

test('session roster observes only initial window loading and detaches as soon as it opens', () => {
  let snapshot = { blank: false, openState: 'loading', nodes: [], queue: [], partial: null };
  const listeners = new Set();
  const session = {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  const published = [];
  const stop = bindSessionRoster({
    sessions: {
      list: {
        getSnapshot: () => ({ current: 'a' }),
        subscribe: () => () => {},
      },
      binding: () => ({ session }),
    },
  }, (sources) => published.push(sources));

  assert.equal(listeners.size, 1);
  snapshot = {
    blank: false,
    openState: 'open',
    nodes: [{ kind: 'user', content: [{ type: 'text', text: 'loaded prompt' }] }],
    queue: [],
    partial: null,
  };
  for (const listener of [...listeners]) listener();
  assert.equal(listeners.size, 0);
  assert.deepEqual(published.at(-1).user, ['loaded prompt']);

  const publicationCount = published.length;
  snapshot = { ...snapshot, partial: { blocks: [{ kind: 'reasoning', text: 'stream update' }] } };
  for (const listener of [...listeners]) listener();
  assert.equal(published.length, publicationCount);
  stop();
});

test('session list failures stay idle instead of impersonating a first-run README fallback', () => {
  const published = [];
  const stop = bindSessionRoster({
    sessions: {
      list: {
        getSnapshot: () => { throw new Error('list unavailable'); },
        subscribe: () => () => {},
      },
      binding: () => undefined,
    },
  }, (sources) => published.push(sources));

  assert.deepEqual(published, [{ blank: false }]);
  assert.equal(composeMatrixText(published.at(-1)), '');
  stop();
});

test('session list failures detach a temporary initial-window listener', () => {
  let listUnavailable = false;
  const listListeners = new Set();
  let sessionSnapshot = {
    blank: false,
    openState: 'loading',
    nodes: [],
    queue: [],
    partial: null,
  };
  const sessionListeners = new Set();
  let staleSessionListener;
  const published = [];
  const stop = bindSessionRoster({
    sessions: {
      list: {
        getSnapshot() {
          if (listUnavailable) throw new Error('list unavailable');
          return { current: 'a' };
        },
        subscribe(listener) {
          listListeners.add(listener);
          return () => listListeners.delete(listener);
        },
      },
      binding: () => ({
        session: {
          getSnapshot: () => sessionSnapshot,
          subscribe(listener) {
            staleSessionListener = listener;
            sessionListeners.add(listener);
            return () => sessionListeners.delete(listener);
          },
        },
      }),
    },
  }, (sources) => published.push(sources));

  assert.equal(sessionListeners.size, 1);
  listUnavailable = true;
  for (const listener of [...listListeners]) listener();
  assert.equal(sessionListeners.size, 0);
  assert.deepEqual(published.at(-1), { blank: false });

  const publicationCount = published.length;
  sessionSnapshot = {
    ...sessionSnapshot,
    openState: 'open',
    nodes: [{ kind: 'user', content: [{ type: 'text', text: 'stale prompt' }] }],
  };
  staleSessionListener();
  assert.equal(published.length, publicationCount);
  stop();
});

test('README fallback requires a ready empty roster, while loading and unselected rosters stay idle', () => {
  const observable = (initial) => {
    let value = initial;
    const listeners = new Set();
    return {
      store: {
        getSnapshot: () => value,
        subscribe: (listener) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
      },
      emit(next) {
        value = next;
        for (const listener of [...listeners]) listener();
      },
    };
  };
  const list = observable({ current: undefined, ids: [], phase: 'pending' });
  const published = [];
  const stop = bindSessionRoster({
    sessions: {
      list: list.store,
      binding: () => undefined,
    },
  }, (sources) => published.push(sources));

  assert.deepEqual(published.at(-1), { blank: false });
  list.emit({ current: undefined, ids: ['existing'], phase: 'ready' });
  assert.deepEqual(published.at(-1), { blank: false });
  list.emit({ current: undefined, ids: [], phase: 'ready' });
  assert.deepEqual(published.at(-1), { blank: true });
  assert.match(composeMatrixText(published.at(-1)), /DSH OFFICIAL README/);
  stop();
});

test('matrix normalization removes controls while grapheme splitting preserves compound characters', () => {
  assert.equal(normalizeMatrixText('alpha\r\n\u202ebeta\u0000'), 'alpha\nbeta');
  const graphemes = splitMatrixGraphemes('A👩‍💻é');
  assert.deepEqual(graphemes, ['A', '👩‍💻', 'é']);
});

test('snapshot extraction never reaches old records and caps every retained category', () => {
  const nodes = Array.from({ length: 600 }, (_, index) => ({
    kind: index >= 570 ? 'assistant' : 'tool',
    blocks: [
      { kind: 'reasoning', text: `reasoning ${index}` },
      { kind: 'text', text: `answer ${index}` },
    ],
  }));
  Object.defineProperty(nodes[0], 'kind', {
    get() {
      throw new Error('records outside the bounded tail must not be read');
    },
  });
  const queue = Array.from({ length: 30 }, (_, index) => ({
    placement: 'queued',
    messageId: `queue-${index}`,
    content: [{ type: 'text', text: `queued ${index}` }],
  }));
  Object.defineProperty(queue[0], 'placement', {
    get() {
      throw new Error('queue entries outside the bounded tail must not be read');
    },
  });

  const sources = matrixSourcesFromSnapshot({
    blank: false,
    nodes,
    queue,
    partial: { blocks: [{ kind: 'reasoning', text: 'live bounded reasoning' }] },
  });
  assert.ok(sources.reasoning.length <= MATRIX_SOURCE_LIMITS.snapshotValuesPerCategory);
  assert.ok(sources.assistant.length <= MATRIX_SOURCE_LIMITS.snapshotValuesPerCategory);
  assert.ok(sources.user.length <= MATRIX_SOURCE_LIMITS.snapshotValuesPerCategory);
  assert.deepEqual(sources.thinking, ['live bounded reasoning']);
  assert.deepEqual(sources.user, Array.from({ length: 8 }, (_, index) => `queued ${index + 22}`));
  assert.equal(sources.assistant.at(-1), 'answer 599');
});

test('displayed-text windows read only a bounded tail and skip UI-control subtrees', () => {
  const element = (tagName = 'DIV') => ({
    nodeType: 1,
    tagName,
    id: '',
    lastChild: null,
    previousSibling: null,
    parentNode: null,
    getAttribute: () => null,
  });
  const calls = [];
  const text = (label, value, reportedLength = value.length) => ({
    nodeType: 3,
    length: reportedLength,
    lastChild: null,
    previousSibling: null,
    parentNode: null,
    substringData(offset, count) {
      calls.push([label, offset, count]);
      return value.slice(-count);
    },
    get data() {
      throw new Error('CharacterData.data must not be read');
    },
    get nodeValue() {
      throw new Error('CharacterData.nodeValue must not be read');
    },
  });
  const link = (parent, children) => {
    parent.lastChild = children.at(-1) ?? null;
    children.forEach((child, index) => {
      child.parentNode = parent;
      child.previousSibling = children[index - 1] ?? null;
    });
  };

  const root = element();
  const older = text('older', 'XYZ', 1_000_000);
  const button = element('BUTTON');
  const hidden = text('hidden', 'must never be read');
  const newer = text('newer', 'live');
  link(button, [hidden]);
  link(root, [older, button, newer]);

  assert.equal(matrixTextWindow(root, 7, 2), 'YZ\nlive');
  assert.deepEqual(calls, [
    ['newer', 0, 4],
    ['older', 999_933, 67],
  ]);

  const simpleRoot = (value, category) => {
    const container = element();
    container.matches = (selector) => {
      if (category === 'thinking') return selector.includes('[data-variant="think"]');
      if (category === 'assistant') return selector.includes('_markdown');
      if (category === 'user') return selector.includes('_userStack');
      return false;
    };
    link(container, [text(value, value)]);
    return container;
  };
  const thinking = simpleRoot('rendered reasoning', 'thinking');
  const assistant = simpleRoot('rendered reply', 'assistant');
  const user = simpleRoot('rendered prompt', 'user');
  const domRoot = element();
  link(domRoot, [thinking, assistant, user]);
  const domSources = matrixSourcesFromDom(domRoot);
  assert.deepEqual(domSources, {
    thinking: ['rendered reasoning'],
    reasoning: [],
    assistant: ['rendered reply'],
    user: ['rendered prompt'],
    blank: false,
  });
});

test('bounded text tails preserve graphemes and cap every visited DOM node', () => {
  const element = (tagName = 'DIV') => ({
    nodeType: 1,
    tagName,
    id: '',
    lastChild: null,
    previousSibling: null,
    parentNode: null,
    getAttribute: () => null,
  });
  const text = (value) => ({
    nodeType: 3,
    length: value.length,
    lastChild: null,
    previousSibling: null,
    parentNode: null,
    substringData(offset, count) {
      return value.slice(offset, offset + count);
    },
  });
  const link = (parent, children) => {
    parent.lastChild = children.at(-1) ?? null;
    children.forEach((child, index) => {
      child.parentNode = parent;
      child.previousSibling = children[index - 1] ?? null;
    });
  };

  for (const [value, limit, expected] of [
    ['A😀', 1, '😀'],
    ['Ae\u0301', 1, 'e\u0301'],
    ['A👩‍💻', 2, '👩‍💻'],
  ]) {
    const root = element();
    link(root, [text(value)]);
    assert.equal(matrixTextWindow(root, limit, 1), expected);
  }

  const boundary = matrixSourcesFromSnapshot({
    blank: false,
    nodes: [{
      kind: 'user',
      content: [{ type: 'text', text: `${'👩‍💻'.repeat(960)}x` }],
    }],
    queue: [],
    partial: null,
  }).user[0];
  assert.ok(boundary.startsWith('👩‍💻'));

  const detachedSnapshot = matrixSourcesFromSnapshot({
    blank: false,
    nodes: [{
      kind: 'user',
      content: [{ type: 'text', text: `${'x'.repeat(100)}A${'\u0301'.repeat(6_000)}` }],
    }],
    queue: [],
    partial: null,
  });
  assert.deepEqual(detachedSnapshot.user, []);

  const detachedDomRoot = element();
  link(detachedDomRoot, [text(`${'x'.repeat(100)}A${'\u0301'.repeat(1_000)}`)]);
  assert.equal(matrixTextWindow(detachedDomRoot, 100, 1), '');

  let emptyLengthReads = 0;
  const newestEmpty = {
    ...text(''),
    get length() {
      emptyLengthReads += 1;
      return 0;
    },
  };
  const poisonedOlderText = {
    ...text('poison'),
    get length() {
      throw new Error('text-node limit must include empty nodes');
    },
  };
  const emptyRoot = element();
  link(emptyRoot, [poisonedOlderText, newestEmpty]);
  assert.equal(matrixTextWindow(emptyRoot, 10, 1), '');
  assert.equal(emptyLengthReads, 1);

  const traversalRoot = element();
  const poisonedOlderElement = element();
  Object.defineProperty(poisonedOlderElement, 'getAttribute', {
    get() {
      throw new Error('visited-node limit must include non-text elements');
    },
  });
  link(traversalRoot, [poisonedOlderElement, element(), element()]);
  assert.equal(matrixTextWindow(traversalRoot, 10, 1, 2), '');

  const rootSearch = element();
  const candidates = Array.from({ length: MATRIX_SOURCE_LIMITS.domRootSearchNodes + 1 }, () => (
    element()
  ));
  Object.defineProperty(candidates[0], 'matches', {
    get() {
      throw new Error('root search must stop at its total-node budget');
    },
  });
  link(rootSearch, candidates);
  assert.deepEqual(matrixSourcesFromDom(rootSearch), {
    thinking: [],
    reasoning: [],
    assistant: [],
    user: [],
    blank: false,
  });
});

test('whole-trail culling rejects exactly the columns the original renderer left empty', () => {
  const height = 720;
  const fontSize = 16;
  const positions = [-900, -17, -16, -15, 0, 719, 720, 736, 900];
  for (let y = -800; y <= 900; y += 13.25) positions.push(y);
  for (let trail = 9; trail <= 18; trail += 1) {
    for (const y of positions) {
      const original = Array.from({ length: trail }, (_, offset) => offset)
        .filter((offset) => {
          const glyphY = y - offset * fontSize;
          return glyphY >= -fontSize && glyphY <= height + fontSize;
        });
      assert.equal(isMatrixTrailOutside(y, trail, fontSize, height), original.length === 0);
    }
  }
});

test('Desktop navigation switches the borrowed snapshot independently of catalog updates', () => {
  const observable = (initial) => {
    let snapshot = initial;
    const listeners = new Set();
    return {
      store: {
        getSnapshot: () => snapshot,
        subscribe: (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
      },
      emit(value) { snapshot = value; for (const listener of listeners) listener(); },
      count: () => listeners.size,
    };
  };
  // Current DSH has no list.current. The selected renderer binding is authoritative,
  // even while the old session's mainView count is still present in the catalog.
  const list = observable({ ids: ['a', 'b'], phase: 'ready', byId: {
    a: { id: 'a', retainedBy: { mainView: 1 } }, b: { id: 'b', retainedBy: {} },
  } });
  const selection = observable({ key: 'a' });
  const reads = [];
  const sessions = {
    list: list.store,
    binding(id) {
      return { session: {
        getSnapshot() { reads.push(id); return { blank: id === 'b', openState: 'open' }; },
        get subscribe() { assert.fail('a visual skin must not follow the streaming Session store'); },
      } };
    },
    retain() { assert.fail('a skin must not retain sessions or open their histories'); },
  };
  const sources = [];
  const stop = bindSessionRoster({ sessions, uiSession: { adapter: { current: selection.store } } },
    (value) => sources.push(value));
  assert.deepEqual(reads, ['a']);
  selection.emit({ key: 'b' });
  assert.deepEqual(reads, ['a', 'b']);
  assert.equal(sources.at(-1).blank, true);
  selection.emit({ key: undefined });
  assert.deepEqual(sources.at(-1), { blank: false });
  assert.deepEqual(reads, ['a', 'b']);
  stop();
  assert.equal(list.count(), 0);
  assert.equal(selection.count(), 0);
});

test('current catalog mainView ownership is a read-only fallback when no renderer selection source exists', () => {
  let listener;
  let snapshot = { ids: ['background', 'visible'], phase: 'ready', byId: {
    background: { id: 'background', retainedBy: { tool: 1 } },
    visible: { id: 'visible', retainedBy: { mainView: 1 } },
  } };
  const reads = [];
  const sources = [];
  const stop = bindSessionRoster({ sessions: {
    list: { getSnapshot: () => snapshot, subscribe: (value) => { listener = value; return () => { listener = undefined; }; } },
    binding(id) { reads.push(id); return { session: { getSnapshot: () => ({ blank: true, openState: 'open' }) } }; },
  } }, (value) => sources.push(value));
  assert.deepEqual(reads, ['visible']);
  assert.equal(sources.at(-1).blank, true);
  snapshot = { ...snapshot, byId: { background: snapshot.byId.background } };
  listener();
  assert.deepEqual(sources.at(-1), { blank: false });
  stop();
  assert.equal(listener, undefined);
});
