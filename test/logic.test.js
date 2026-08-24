import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  OFFICIAL_DSH_README_FALLBACK,
  bindSessionFeed,
  composeMatrixText,
  inject,
  isAtScrollTail,
  matrixSourcesFromSnapshot,
  normalizeMatrixText,
  normalizeThinkingText,
  rebaseMatrixColumns,
  shouldFollowThinkingTail,
  splitMatrixGraphemes,
} from '../src/client.js';

test('client requests only the local sessions snapshot service', () => {
  assert.deepEqual(inject, ['sessions']);
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

test('session subscriptions replace cumulative partial text and detach on session switch', () => {
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

  const sessionA = observable({ blank: false, nodes: [], queue: [], partial: null });
  const sessionB = observable({
    blank: false,
    nodes: [{ kind: 'user', content: [{ type: 'text', text: 'new session prompt' }] }],
    queue: [],
    partial: null,
  });
  const list = observable({ current: 'a' });
  const bindings = { a: { session: sessionA.store }, b: { session: sessionB.store } };
  const published = [];
  const stop = bindSessionFeed({
    sessions: {
      list: list.store,
      binding: (id) => bindings[id],
    },
  }, (sources) => published.push(sources));

  sessionA.emit({
    blank: false,
    nodes: [],
    queue: [],
    partial: { blocks: [{ kind: 'reasoning', text: 'thinking one' }] },
  });
  sessionA.emit({
    blank: false,
    nodes: [],
    queue: [],
    partial: { blocks: [
      { kind: 'reasoning', text: 'thinking one plus newest token' },
      { kind: 'text', text: 'reply growing' },
    ] },
  });
  assert.deepEqual(published.at(-1).thinking, ['thinking one plus newest token']);
  assert.deepEqual(published.at(-1).assistant, ['reply growing']);

  list.emit({ current: 'b' });
  assert.equal(sessionA.listenerCount(), 0);
  assert.deepEqual(published.at(-1).user, ['new session prompt']);
  stop();
  assert.equal(sessionB.listenerCount(), 0);
  assert.equal(list.listenerCount(), 0);
});

test('session list failures stay idle instead of impersonating a first-run README fallback', () => {
  const published = [];
  const stop = bindSessionFeed({
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
  const stop = bindSessionFeed({
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
