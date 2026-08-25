import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  MATRIX_GLYPHS,
  MATRIX_RENDER_LIMITS,
  inject,
  isAtScrollTail,
  isMatrixSideColumn,
  matrixActivitySeed,
  matrixCharacterDataSeed,
  matrixCanvasScale,
  normalizeThinkingText,
  shouldFollowThinkingTail,
} from '../src/client.js';

const clientSource = readFileSync(new URL('../src/client.js', import.meta.url), 'utf8');
const matrixCss = clientSource.match(/const MATRIX_CSS = String\.raw`([\s\S]*?)`;\s*$/)?.[1] ?? '';

test('client mounts without requesting session history', () => {
  assert.deepEqual(inject, []);
});

test('composer paints draft text once through the backdrop layer', () => {
  assert.doesNotMatch(matrixCss, /:is\(button, input, textarea,/);
  assert.doesNotMatch(matrixCss, /:is\(textarea, input, \[contenteditable="true"\]\)/);
  assert.match(
    matrixCss,
    /\[data-input-backdrop\]\s*\{[^}]*color:\s*var\(--dsh-matrix-bright\)\s*!important;/s,
  );
  assert.match(
    matrixCss,
    /\[data-input-scroll\] textarea\s*\{[^}]*color:\s*transparent\s*!important;[^}]*caret-color:\s*var\(--dsh-matrix-green\);/s,
  );
  const textareaRules = [...matrixCss.matchAll(/([^{}]*textarea[^{}]*)\{([^{}]*)\}/g)]
    .filter(([, selector]) => !selector.includes('::placeholder'));
  assert.ok(textareaRules.length > 0);
  for (const [, selector, declarations] of textareaRules) {
    assert.doesNotMatch(declarations, /font-family\s*:/, `${selector.trim()} must preserve native layer metrics`);
    const colors = [...declarations.matchAll(/(?:^|;)\s*color:\s*([^;]+)/g)];
    assert.ok(
      colors.every(([, value]) => value.trim().startsWith('transparent')),
      `${selector.trim()} must not paint textarea text`,
    );
  }
});

test('code blocks do not paint a redundant backdrop behind their text', () => {
  assert.doesNotMatch(
    matrixCss,
    /\[data-chat-flow-kind="assistant-step"\]\s+code\s*\{[^}]*background(?:-color)?\s*:/s,
  );
  assert.match(
    matrixCss,
    /\[data-chat-flow-kind="assistant-step"\]\s+:not\(pre\)\s*>\s*code\s*\{[^}]*background-color:\s*#07100b;/s,
  );
});

test('sent and pending prompts decorate only the native bubble', () => {
  const cssRules = [...matrixCss.matchAll(/([^{}]+)\{([^{}]*)\}/g)];
  const [, surfaceSelectors = '', surfaceDeclarations = ''] = cssRules.find(([, selectors]) => (
    selectors.includes('[class*="_userStack"] > [class*="_bubble"]')
  )) ?? [];
  assert.deepEqual(surfaceSelectors.split(',').map((selector) => selector.trim()), [
    'body.dsh-matrix-skin-active [data-chat-flow-kind="user"] [class*="_userStack"] > [class*="_bubble"]',
    'body.dsh-matrix-skin-active [data-chat-flow-kind="steering"] [class*="_userStack"] > [class*="_bubble"]',
    'body.dsh-matrix-skin-active [data-pending-steering] [class*="_userStack"] > [class*="_bubble"]',
  ]);
  assert.match(surfaceDeclarations, /border:\s*1px solid rgba\(114,\s*255,\s*226,\s*\.26\);/);
  assert.match(surfaceDeclarations, /background:\s*#06100b\s*!important;/);
  assert.match(surfaceDeclarations, /border-radius:\s*3px 15px 3px 15px\s*!important;/);

  for (const [rule, selectors, declarations] of cssRules) {
    const targetsBareStack = selectors.split(',').some((selector) => (
      /\[class\*="_userStack"\]\s*$/.test(selector.trim())
    ));
    if (targetsBareStack) {
      assert.doesNotMatch(
        declarations,
        /(?:^|;)\s*(?:border(?:-[\w-]+)?|background(?:-[\w-]+)?|box-shadow)\s*:/,
        `${rule.trim()} must remain a layout-only wrapper`,
      );
    }
  }
});

test('full-screen Matrix layers avoid compositor-heavy filters, blending, and masks', () => {
  const cssRules = [...matrixCss.matchAll(/([^{}]+)\{([^{}]*)\}/g)];
  const fullScreenRules = cssRules.filter(([, selectors]) => selectors.split(',').some((selector) => (
    /\.dsh-matrix-(?:environment(?:::(?:before|after))?|rain)\s*$/.test(selector.trim())
  )));
  assert.ok(fullScreenRules.length > 0);
  for (const [rule, , declarations] of fullScreenRules) {
    assert.doesNotMatch(
      declarations,
      /(?:^|;)\s*(?:filter|mix-blend-mode|(?:-webkit-)?mask(?:-image)?)\s*:/i,
      `${rule.trim()} must stay on a cheap compositing path`,
    );
  }
});

test('thinking bodies do not animate a continuously changing shadow', () => {
  const thinkBodyRules = [...matrixCss.matchAll(/([^{}]*\[class\*="thinkBody"\][^{}]*)\{([^{}]*)\}/g)];
  for (const [, selector, declarations] of thinkBodyRules) {
    for (const [, animation] of declarations.matchAll(/(?:^|;)\s*animation:\s*([^;]+)/g)) {
      assert.match(animation.trim(), /^none(?:\s*!important)?$/, `${selector.trim()} must not animate`);
    }
  }
  assert.doesNotMatch(matrixCss, /@keyframes\s+dsh-matrix-pulse\b/);
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

test('built-in glyph pool and activity seed are deterministic, small, and bounded', () => {
  assert.ok(MATRIX_GLYPHS.length >= 16 && MATRIX_GLYPHS.length <= 128);
  assert.match(MATRIX_GLYPHS, /^[\x20-\x7e]+$/);
  assert.equal(new Set(MATRIX_GLYPHS).size, MATRIX_GLYPHS.length);

  const z = 'Z'.charCodeAt(0);
  const seed = matrixActivitySeed(4096, z);
  assert.equal(matrixActivitySeed(4096, z), seed);
  assert.notEqual(matrixActivitySeed(4096, 'Y'.charCodeAt(0)), seed);
  assert.notEqual(matrixActivitySeed(4095, z), seed);
  assert.equal(matrixActivitySeed(0, z), 0);
  assert.equal(matrixActivitySeed(Number.NaN, z), 0);
  assert.ok(Number.isInteger(seed) && seed >= 0 && seed <= 0xffff_ffff);
});

test('DOM activity reads only one trailing code unit, never the full text value', () => {
  const reads = [];
  const characterData = {
    length: 1_000_000,
    substringData(offset, count) {
      reads.push([offset, count]);
      return 'Z';
    },
    get data() {
      throw new Error('full CharacterData.data must not be read');
    },
  };

  assert.equal(matrixCharacterDataSeed(characterData), matrixActivitySeed(1_000_000, 90));
  assert.deepEqual(reads, [[999_999, 1]]);
});

test('side-column predicate excludes the central reading lane before rendering', () => {
  const width = 1000;
  assert.equal(isMatrixSideColumn(width * MATRIX_RENDER_LIMITS.centerStart, width), true);
  assert.equal(isMatrixSideColumn(width * 0.5, width), false);
  assert.equal(isMatrixSideColumn(width * MATRIX_RENDER_LIMITS.centerEnd, width), true);
  assert.equal(isMatrixSideColumn(Number.NaN, width), false);
});

test('canvas backing scale caps DPR, dimensions, and total pixels', () => {
  assert.ok(Object.isFrozen(MATRIX_RENDER_LIMITS));
  assert.ok(MATRIX_RENDER_LIMITS.framesPerSecond <= 20);
  assert.equal(matrixCanvasScale(1280, 720, 4), MATRIX_RENDER_LIMITS.maxDevicePixelRatio);

  const width = 3200;
  const height = 1800;
  const ratio = matrixCanvasScale(width, height, 4);
  const backingWidth = Math.floor(width * ratio);
  const backingHeight = Math.floor(height * ratio);
  assert.ok(ratio <= MATRIX_RENDER_LIMITS.maxDevicePixelRatio);
  assert.ok(backingWidth <= MATRIX_RENDER_LIMITS.dimensionLimit);
  assert.ok(backingHeight <= MATRIX_RENDER_LIMITS.dimensionLimit);
  assert.ok(backingWidth * backingHeight <= MATRIX_RENDER_LIMITS.pixelLimit);
  assert.equal(matrixCanvasScale(800, 600, Number.NaN), 1);
});
