import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeThinkingText } from '../src/client.js';

test('preserves provider-supplied reasoning verbatim', () => {
  const text = '线路分析\nconst x = "<safe>";\n✓';
  assert.equal(normalizeThinkingText(text), text);
});

test('empty and malformed reasoning safely normalize to empty text', () => {
  assert.equal(normalizeThinkingText(''), '');
  assert.equal(normalizeThinkingText(null), '');
  assert.equal(normalizeThinkingText({ text: 'hidden' }), '');
});
