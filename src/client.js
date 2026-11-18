// Cordis injection names runtime services, not npm packages. The session list
// selects one bounded initial snapshot; live rain text then comes from the DSH
// content that is already rendered in the page.
// The conversation package orders this service in both legacy DSH runtime and
// the Session Controller used by Web and Desktop. Do not load another runtime.
export const inject = ['sessions'];

const STYLE_ID = 'dsh-matrix-skin/styles';
const ROW_SELECTOR = '[data-variant="think"]';
const BODY_SELECTOR = '[class*="thinkBody"]';
const ENVIRONMENT_ID = 'dsh-matrix-environment';
const ACTIVE_CLASS = 'dsh-matrix-skin-active';
const MATRIX_SECTION_LIMIT = 5600;
const MATRIX_LATEST_SECTION_LIMIT = 1200;
const MATRIX_HOT_WINDOW = 5000;
const MATRIX_GLYPH_LIMIT = 32768;
const MATRIX_INSTALLATION_OWNER = Symbol.for('dsh-matrix-skin/installation');
const MATRIX_DOM_SOURCE_SELECTORS = Object.freeze({
  thinking: ROW_SELECTOR,
  assistant: '[data-chat-flow-kind="assistant-step"] [class*="_markdown"]',
  user: [
    '[data-message-bubble]',
    '[data-chat-flow-kind="user"] [class*="_userStack"] > [class*="_bubble"]',
    '[data-chat-flow-kind="steering"] [class*="_userStack"] > [class*="_bubble"]',
    '[data-pending-steering] [class*="_userStack"] > [class*="_bubble"]',
  ].join(', '),
});
const MATRIX_DOM_SOURCE_SELECTOR = Object.values(MATRIX_DOM_SOURCE_SELECTORS).join(', ');
const MATRIX_TEXT_SKIP_TAGS = new Set(['BUTTON', 'INPUT', 'SCRIPT', 'STYLE', 'SVG', 'TEXTAREA']);
const MATRIX_DETACHED_PREFIX = /^(?:\p{Mark}|\u200d|[\u{1f3fb}-\u{1f3ff}])+/u;
export const MATRIX_SOURCE_LIMITS = Object.freeze({
  domCharacters: 1200,
  domTextNodes: 64,
  domVisitedNodes: 512,
  domRootSearchNodes: 512,
  domRootsPerCategory: 2,
  snapshotNodes: 512,
  snapshotQueueEntries: 16,
  snapshotBlocksPerRecord: 32,
  snapshotValuesPerCategory: 8,
  snapshotCodeUnitsPerValue: 4800,
  graphemeLookbehindCodeUnits: 64,
});
const MATRIX_GRAPHEME_SEGMENTER = typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
  ? new Intl.Segmenter('und', { granularity: 'grapheme' })
  : null;
const MATRIX_TRAIL_STYLES = Array.from({ length: 19 }, (_, trail) => (
  Array.from({ length: trail }, (__, offset) => {
    if (offset === 0) return 'rgba(210, 255, 231, .96)';
    const strength = Math.pow(1 - offset / trail, 1.55);
    return `rgba(49, 255, 126, ${Math.max(0, strength * .72)})`;
  })
));

// Bundled from the official DeepSeek Harness README so a brand-new install has
// a real, product-authored stream before the first conversation exists.
export const OFFICIAL_DSH_README_FALLBACK = [
  '# DeepSeek Harness',
  '',
  'English | [中文](README.zh.md)',
  '',
  'DeepSeek Harness (`dsh`) is an open-source agent harness developed by [DeepSeek AI](https://deepseek.com).',
  '',
  'It uses an architecture where **everything is a plugin**, and is powered by [Cordis](https://github.com/cordiverse/cordis), whose design is described in [_A Programming Paradigm for Spatiotemporal Composability_](https://github.com/cordiverse/paper).',
  '',
  '## Developer preview',
  '',
  'DeepSeek Harness is currently in _developer preview_ and is iterating rapidly. **THERE WILL BE COMPATIBILITY-BREAKING CHANGES.**',
  '',
  '## Run',
  '',
  '### Run from `npm`',
  '',
  'Install `Node.js`, then run:',
  '',
  '```sh',
  'npx @deepseek-ai/dsh web',
  '```',
  '',
  'The command starts the Web UI, served at `http://127.0.0.1:3080` by default. See [Web UI guide](docs/user/guide/index.md).',
  '',
  '### Run from source',
  '',
  'To run from a repository checkout:',
  '',
  '```sh',
  'git clone https://github.com/deepseek-ai/deepseek-harness.git',
  'cd deepseek-harness',
  'pnpm install',
  'pnpm run build',
  'pnpm dsh web',
  '```',
  '',
  '## Community and support',
  '',
  '- Feel free to submit feedback or bug reports through [GitHub Discussions](https://github.com/deepseek-ai/deepseek-harness/discussions).',
  '- Add the [`dsh-plugin`](https://github.com/topics/dsh-plugin) topic to your plugin repository for discoverability.',
  '- Join <a href="https://discord.gg/Ycq5dCaS4">DeepSeek Harness Discord community</a>.',
  '',
  '## Contributing',
  '',
  'See [CONTRIBUTING.md](CONTRIBUTING.md).',
  '',
  '## Development',
  '',
  'Start with the [development guide](docs/development.md) and [architecture documentation](docs/architecture.md).',
  '',
  'For agents, follow [AGENTS.md](AGENTS.md).',
  '',
  '## License',
  '',
  '[MIT](LICENSE)',
  '',
  'Third-party dependencies and their licenses are disclosed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).',
].join('\n');

export function normalizeThinkingText(value) {
  return typeof value === 'string' ? value : '';
}

export function normalizeMatrixText(value) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .replace(/[\u202a-\u202e\u2066-\u2069]/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function matrixGraphemes(value) {
  if (!value) return [];
  if (MATRIX_GRAPHEME_SEGMENTER) {
    return [...MATRIX_GRAPHEME_SEGMENTER.segment(value)].map(({ segment }) => segment);
  }
  return Array.from(value);
}

function toWellFormedMatrixText(value) {
  if (typeof value.toWellFormed === 'function') return value.toWellFormed();
  let result = '';
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        result += value[index] + value[index + 1];
        index += 1;
      } else {
        result += '\ufffd';
      }
    } else {
      result += code >= 0xdc00 && code <= 0xdfff ? '\ufffd' : value[index];
    }
  }
  return result;
}

function boundedCodeUnitTail(value, codeUnitLimit, sourceStartsMidText = false) {
  if (typeof value !== 'string' || codeUnitLimit <= 0) return '';
  if (value.length <= codeUnitLimit) return toWellFormedMatrixText(value);
  const desiredStart = value.length - codeUnitLimit;
  const bufferStart = Math.max(
    0,
    desiredStart - MATRIX_SOURCE_LIMITS.graphemeLookbehindCodeUnits,
  );
  const window = value.slice(bufferStart);
  const relativeStart = desiredStart - bufferStart;
  let segmentStart = relativeStart;
  if (MATRIX_GRAPHEME_SEGMENTER) {
    for (const { segment, index } of MATRIX_GRAPHEME_SEGMENTER.segment(window)) {
      if (index + segment.length > relativeStart) {
        segmentStart = index;
        break;
      }
    }
  } else {
    const code = window.charCodeAt(segmentStart);
    const previous = window.charCodeAt(segmentStart - 1);
    if (code >= 0xdc00 && code <= 0xdfff && previous >= 0xd800 && previous <= 0xdbff) {
      segmentStart -= 1;
    }
  }
  const tail = toWellFormedMatrixText(window.slice(segmentStart));
  return sourceStartsMidText || bufferStart > 0 ? tail.replace(MATRIX_DETACHED_PREFIX, '') : tail;
}

function tailMatrixText(value, limit) {
  const graphemes = matrixGraphemes(value);
  return graphemes.length > limit ? graphemes.slice(-limit).join('') : value;
}

function headMatrixText(value, limit) {
  const graphemes = matrixGraphemes(value);
  return graphemes.length > limit ? graphemes.slice(0, limit).join('') : value;
}

function uniqueMatrixText(values) {
  const seen = new Set();
  const normalized = [];
  for (const value of Array.isArray(values) ? values : []) {
    const text = normalizeMatrixText(value);
    if (!text || text === '(tool call only)' || seen.has(text)) continue;
    seen.add(text);
    normalized.push(text);
  }
  return normalized;
}

export function composeMatrixText(sources = {}, fallback = OFFICIAL_DSH_README_FALLBACK) {
  const sections = [
    ['COGNITION', sources.thinking],
    ['REASONING TRACE', sources.reasoning],
    ['ASSISTANT', sources.assistant],
    ['USER', sources.user],
  ];
  const latestFeed = [];
  const recentFeed = [];
  const seen = new Set();
  for (const [label, values] of sections) {
    const entries = uniqueMatrixText(values).filter((text) => {
      if (seen.has(text)) return false;
      seen.add(text);
      return true;
    });
    if (!entries.length) continue;
    const latest = tailMatrixText(entries.at(-1), MATRIX_LATEST_SECTION_LIMIT);
    latestFeed.push(`// ${label} · LATEST\n${latest}`);
    const recent = entries.slice(-8, -1).reverse();
    if (recent.length) {
      const recentText = recent
        .map((text) => tailMatrixText(text, MATRIX_LATEST_SECTION_LIMIT))
        .join('\n\n');
      recentFeed.push(`// ${label} · RECENT\n${headMatrixText(recentText, MATRIX_SECTION_LIMIT)}`);
    }
  }
  if (latestFeed.length) return [...latestFeed, ...recentFeed].join('\n\n');
  if (sources.blank === true) {
    return `// DSH OFFICIAL README · EMPTY SESSION FALLBACK\n${normalizeMatrixText(fallback)}`;
  }
  return '';
}

function boundedSnapshotText(value) {
  if (typeof value !== 'string') return '';
  const window = boundedCodeUnitTail(value, MATRIX_SOURCE_LIMITS.snapshotCodeUnitsPerValue);
  return tailMatrixText(normalizeMatrixText(window), MATRIX_LATEST_SECTION_LIMIT);
}

function boundedBlockText(blocks, predicate, valueLimit = MATRIX_SOURCE_LIMITS.snapshotValuesPerCategory) {
  if (!Array.isArray(blocks) || valueLimit <= 0) return [];
  const values = [];
  const first = Math.max(0, blocks.length - MATRIX_SOURCE_LIMITS.snapshotBlocksPerRecord);
  for (let index = blocks.length - 1; index >= first; index -= 1) {
    const block = blocks[index];
    if (!predicate(block)) continue;
    const text = boundedSnapshotText(block.text);
    if (text) values.unshift(text);
    if (values.length >= valueLimit) break;
  }
  return values;
}

function contentBlockText(blocks, valueLimit) {
  return boundedBlockText(blocks, (block) => block?.type === 'text', valueLimit);
}

function assistantBlockText(blocks, kind, valueLimit) {
  return boundedBlockText(blocks, (block) => block?.kind === kind, valueLimit);
}

function prependEarlierMatrixValues(target, values) {
  const remaining = MATRIX_SOURCE_LIMITS.snapshotValuesPerCategory - target.length;
  if (remaining <= 0 || !values.length) return;
  target.unshift(...(values.length > remaining ? values.slice(-remaining) : values));
}

export function matrixSourcesFromSnapshot(snapshot) {
  const sources = {
    thinking: [],
    reasoning: [],
    assistant: [],
    user: [],
    blank: snapshot?.blank === true,
  };
  if (!snapshot || typeof snapshot !== 'object') return sources;
  const durableSteering = new Set();

  const nodes = Array.isArray(snapshot.nodes) ? snapshot.nodes : [];
  const firstNode = Math.max(0, nodes.length - MATRIX_SOURCE_LIMITS.snapshotNodes);
  for (let index = firstNode; index < nodes.length; index += 1) {
    const node = nodes[index];
    if (node?.kind === 'steering') {
      if (node.messageId !== undefined) durableSteering.add(String(node.messageId));
    }
  }

  if (snapshot.partial) {
    sources.thinking.push(...assistantBlockText(snapshot.partial.blocks, 'reasoning'));
    sources.assistant.push(...assistantBlockText(snapshot.partial.blocks, 'text'));
  }

  const queue = Array.isArray(snapshot.queue) ? snapshot.queue : [];
  const firstQueueEntry = Math.max(0, queue.length - MATRIX_SOURCE_LIMITS.snapshotQueueEntries);
  for (let index = queue.length - 1; index >= firstQueueEntry; index -= 1) {
    const item = queue[index];
    if (item?.placement !== 'steering' && item?.placement !== 'queued') continue;
    if (item.messageId !== undefined && durableSteering.has(String(item.messageId))) continue;
    const remaining = MATRIX_SOURCE_LIMITS.snapshotValuesPerCategory - sources.user.length;
    prependEarlierMatrixValues(sources.user, contentBlockText(item.content, remaining));
    if (sources.user.length >= MATRIX_SOURCE_LIMITS.snapshotValuesPerCategory) break;
  }

  for (let index = nodes.length - 1; index >= firstNode; index -= 1) {
    const node = nodes[index];
    if ((node?.kind === 'user' || node?.kind === 'steering')
      && sources.user.length < MATRIX_SOURCE_LIMITS.snapshotValuesPerCategory) {
      const remaining = MATRIX_SOURCE_LIMITS.snapshotValuesPerCategory - sources.user.length;
      prependEarlierMatrixValues(sources.user, contentBlockText(node.content, remaining));
    } else if (node?.kind === 'assistant') {
      if (sources.reasoning.length < MATRIX_SOURCE_LIMITS.snapshotValuesPerCategory) {
        const remaining = MATRIX_SOURCE_LIMITS.snapshotValuesPerCategory - sources.reasoning.length;
        prependEarlierMatrixValues(
          sources.reasoning,
          assistantBlockText(node.blocks, 'reasoning', remaining),
        );
      }
      if (sources.assistant.length < MATRIX_SOURCE_LIMITS.snapshotValuesPerCategory) {
        const remaining = MATRIX_SOURCE_LIMITS.snapshotValuesPerCategory - sources.assistant.length;
        prependEarlierMatrixValues(
          sources.assistant,
          assistantBlockText(node.blocks, 'text', remaining),
        );
      }
    }
    if (
      sources.user.length >= MATRIX_SOURCE_LIMITS.snapshotValuesPerCategory
      && sources.reasoning.length >= MATRIX_SOURCE_LIMITS.snapshotValuesPerCategory
      && sources.assistant.length >= MATRIX_SOURCE_LIMITS.snapshotValuesPerCategory
    ) break;
  }

  return sources;
}

function previousMatrixNode(root, node, descend) {
  if (descend && node?.lastChild) return node.lastChild;
  let current = node;
  while (current && current !== root) {
    if (current.previousSibling) return current.previousSibling;
    current = current.parentNode;
  }
  return null;
}

function skipMatrixTextSubtree(node) {
  if (node?.nodeType !== 1) return false;
  if (MATRIX_TEXT_SKIP_TAGS.has(node.tagName)) return true;
  if (node.id === ENVIRONMENT_ID) return true;
  return node.getAttribute?.('aria-hidden') === 'true';
}

export function matrixTextWindow(
  root,
  characterLimit = MATRIX_SOURCE_LIMITS.domCharacters,
  nodeLimit = MATRIX_SOURCE_LIMITS.domTextNodes,
  visitedLimit = MATRIX_SOURCE_LIMITS.domVisitedNodes,
) {
  const maxCharacters = Math.max(0, Math.floor(characterLimit));
  const maxNodes = Math.max(0, Math.floor(nodeLimit));
  const maxVisited = Math.max(0, Math.floor(visitedLimit));
  if (!root || !maxCharacters || !maxNodes || !maxVisited) return '';
  const chunks = [];
  let characters = 0;
  let textNodes = 0;
  let visitedNodes = 0;
  let node = root;
  let descend = true;
  while (characters < maxCharacters && textNodes < maxNodes && visitedNodes < maxVisited) {
    node = previousMatrixNode(root, node, descend);
    if (!node) break;
    visitedNodes += 1;
    descend = !skipMatrixTextSubtree(node);
    if (node.nodeType !== 3) continue;
    descend = true;
    textNodes += 1;
    const rawLength = node.length;
    const length = Number.isFinite(rawLength) ? Math.max(0, Math.floor(rawLength)) : 0;
    if (!length || typeof node.substringData !== 'function') continue;
    const count = Math.min(length, maxCharacters - characters);
    const start = length - count;
    const bufferStart = Math.max(
      0,
      start - MATRIX_SOURCE_LIMITS.graphemeLookbehindCodeUnits,
    );
    const text = boundedCodeUnitTail(
      node.substringData(bufferStart, length - bufferStart),
      count,
      bufferStart > 0,
    );
    if (!text) continue;
    chunks.push(text);
    characters += text.length;
  }
  return tailMatrixText(normalizeMatrixText(chunks.reverse().join('\n')), maxCharacters);
}

function matrixSourceRootsFromDom(scope) {
  const entries = Object.entries(MATRIX_DOM_SOURCE_SELECTORS);
  const roots = Object.fromEntries(entries.map(([category]) => [category, []]));
  let node = scope;
  let descend = true;
  let visitedNodes = 0;
  while (visitedNodes < MATRIX_SOURCE_LIMITS.domRootSearchNodes) {
    node = previousMatrixNode(scope, node, descend);
    if (!node) break;
    visitedNodes += 1;
    descend = !skipMatrixTextSubtree(node);
    if (node.nodeType !== 1 || !descend) continue;
    let matched = false;
    for (const [category, selector] of entries) {
      if (!node.matches?.(selector)) continue;
      matched = true;
      if (roots[category].length < MATRIX_SOURCE_LIMITS.domRootsPerCategory) {
        roots[category].unshift(node);
      }
    }
    if (matched) descend = false;
    if (entries.every(([category]) => (
      roots[category].length >= MATRIX_SOURCE_LIMITS.domRootsPerCategory
    ))) break;
  }
  return roots;
}

export function matrixSourcesFromDom(root, blank = false) {
  const sources = { thinking: [], reasoning: [], assistant: [], user: [], blank };
  if (!root) return sources;
  const roots = matrixSourceRootsFromDom(root);
  for (const [category, matches] of Object.entries(roots)) {
    for (const match of matches) {
      const text = matrixTextWindow(match);
      if (text) sources[category].push(text);
    }
  }
  return sources;
}

export function splitMatrixGraphemes(value) {
  const text = normalizeMatrixText(value).replace(/\s/g, ' ');
  return matrixGraphemes(text);
}

export function rebaseMatrixColumns(columns, feedLength, hotWindow = MATRIX_HOT_WINDOW) {
  const length = Number.isFinite(feedLength) ? Math.max(0, Math.floor(feedLength)) : 0;
  const windowLength = Math.min(length, Math.max(1, Math.floor(hotWindow)));
  for (let index = 0; index < columns.length; index += 1) {
    const phase = (index * 0.618033988749895) % 1;
    columns[index].sourceOffset = windowLength ? Math.floor(phase * windowLength) : 0;
  }
  return columns;
}

export function isMatrixTrailOutside(y, trail, fontSize, height) {
  if (![y, trail, fontSize, height].every(Number.isFinite) || trail <= 0 || fontSize <= 0) {
    return true;
  }
  return y < -fontSize || y - (Math.floor(trail) - 1) * fontSize > height + fontSize;
}

function isMatrixSideColumn(x, width) {
  return !(x > width * 0.31 && x < width * 0.69);
}

export function isAtScrollTail(element, threshold = 18) {
  return element.scrollHeight - element.scrollTop - element.clientHeight <= threshold;
}

export function shouldFollowThinkingTail(manualState) {
  return manualState !== 'true';
}

function installStyles() {
  if (document.querySelector(`style[data-plugin-css="${STYLE_ID}"]`)) return;
  const tag = document.createElement('style');
  tag.dataset.plugin = 'dsh-matrix-skin';
  tag.dataset.pluginCss = STYLE_ID;
  tag.textContent = MATRIX_CSS;
  document.head.appendChild(tag);
  return () => tag.remove();
}

// Native DSH supplies this phase only for a blank conversation. Decorations
// belong inside that isolated frame, never above a page, pane, or popup.
const MATRIX_HERO_SELECTOR = '[data-slot="main.conversation"] [data-phase="hero"]';
const MATRIX_OVERLAY_SELECTOR = '[role="dialog"], [role="menu"], [role="listbox"], [data-trigger-menu], [popover]:popover-open';

export function matrixDecorativeRoot(root) {
  const hero = root?.querySelector?.(MATRIX_HERO_SELECTOR);
  if (!hero || root.querySelector(MATRIX_OVERLAY_SELECTOR)) return undefined;
  // DSH removes its placeholder when a draft contains text. Borrow that
  // presentation marker without reading or changing the editor's value.
  const composer = hero.querySelector('[data-composer-card]');
  if (composer && !composer.querySelector('[data-composer-placeholder]')) return undefined;
  const rightbar = root.querySelector('[data-slot="rightbar"]');
  if (rightbar && !rightbar.closest('[data-rightbar-collapsed]')) return undefined;
  return hero;
}

function installEnvironment() {
  if (document.getElementById(ENVIRONMENT_ID)) return;

  const environment = document.createElement('div');
  environment.id = ENVIRONMENT_ID;
  environment.className = 'dsh-matrix-environment';
  environment.dataset.matrixDecorative = 'false';
  environment.hidden = true;
  environment.setAttribute('aria-hidden', 'true');

  const canvas = document.createElement('canvas');
  canvas.className = 'dsh-matrix-rain';
  canvas.setAttribute('aria-hidden', 'true');
  environment.appendChild(canvas);
  document.body.appendChild(environment);
  document.body.classList.add(ACTIVE_CLASS);

  const context = canvas.getContext('2d', { alpha: true });
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const forcedColors = window.matchMedia('(forced-colors: active)');
  let animationFrame = 0;
  let lastFrame = 0;
  let width = 0;
  let height = 0;
  let ratio = 0;
  let fontSize = 16;
  let columns = [];
  let renderColumns = [];
  let feedText = '';
  let feedGlyphs = [];
  let decorative = false;

  const glyphAt = (index) => {
    if (!feedGlyphs.length) return '0';
    const offset = ((index % feedGlyphs.length) + feedGlyphs.length) % feedGlyphs.length;
    return feedGlyphs[offset];
  };
  const updateFeed = (text) => {
    if (text === feedText) return false;
    const nextGlyphs = splitMatrixGraphemes(text);
    feedText = text;
    feedGlyphs = nextGlyphs.length > MATRIX_GLYPH_LIMIT
      ? nextGlyphs.slice(0, MATRIX_GLYPH_LIMIT)
      : nextGlyphs;
    rebaseMatrixColumns(columns, feedGlyphs.length);
    return true;
  };
  const setSources = (sources = {}) => {
    updateFeed(composeMatrixText(sources));
    const hasSessionText = ['thinking', 'reasoning', 'assistant', 'user']
      .some((key) => uniqueMatrixText(sources[key]).length > 0);
    environment.dataset.matrixSource = hasSessionText ? 'session' : sources.blank !== false ? 'readme' : 'idle';
  };
  const setDisplayedSources = (sources = {}) => {
    const text = composeMatrixText({ ...sources, blank: false });
    if (!text) return;
    updateFeed(text);
    environment.dataset.matrixSource = 'session';
  };

  const resize = () => {
    if (!context || !decorative) return;
    const host = environment.parentElement;
    const nextWidth = host?.clientWidth || window.innerWidth;
    const nextHeight = host?.clientHeight || window.innerHeight;
    const nextRatio = Math.min(window.devicePixelRatio || 1, 2);
    const nextFontSize = nextWidth < 640 ? 13 : 16;
    const backingWidth = Math.max(1, Math.floor(nextWidth * nextRatio));
    const backingHeight = Math.max(1, Math.floor(nextHeight * nextRatio));
    if (
      nextWidth === width && nextHeight === height && nextRatio === ratio
      && nextFontSize === fontSize && canvas.width === backingWidth && canvas.height === backingHeight
    ) return;
    width = nextWidth;
    height = nextHeight;
    ratio = nextRatio;
    fontSize = nextFontSize;
    canvas.width = backingWidth;
    canvas.height = backingHeight;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    const count = Math.ceil(width / fontSize);
    columns = Array.from({ length: count }, (_, index) => ({
      x: index * fontSize + fontSize / 2,
      y: Math.random() * height - height,
      speed: 34 + Math.random() * 62,
      trail: 9 + Math.floor(Math.random() * 10),
      sourceOffset: 0,
      sourceStep: 1 + Math.floor(Math.random() * 3),
    }));
    renderColumns = columns.filter((column) => isMatrixSideColumn(column.x, width));
    rebaseMatrixColumns(columns, feedGlyphs.length);
    draw();
  };
  const draw = () => {
    if (!context || !decorative) return;
    context.clearRect(0, 0, width, height);
    if (!feedGlyphs.length) return;
    context.font = `500 ${fontSize}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';

    for (const column of renderColumns) {
      const head = Math.floor(column.y / fontSize);
      if (isMatrixTrailOutside(column.y, column.trail, fontSize, height)) continue;
      for (let offset = 0; offset < column.trail; offset += 1) {
        const y = column.y - offset * fontSize;
        if (y < -fontSize || y > height + fontSize) continue;
        context.fillStyle = MATRIX_TRAIL_STYLES[column.trail][offset];
        const glyphIndex = column.sourceOffset + (head - offset) * column.sourceStep;
        context.fillText(glyphAt(glyphIndex), column.x, y);
      }
    }
  };

  const animate = (time) => {
    if (!decorative || document.hidden || reducedMotion.matches) {
      animationFrame = 0;
      return;
    }
    if (time - lastFrame >= 42) {
      const elapsed = Math.min((time - (lastFrame || time)) / 1000, 0.08);
      lastFrame = time;
      for (const column of columns) {
        column.y += column.speed * elapsed;
        if (column.y - column.trail * fontSize > height) {
          column.y = -Math.random() * height * 0.65;
          column.speed = 34 + Math.random() * 62;
          column.sourceOffset = (column.sourceOffset + column.trail * column.sourceStep + 17)
            % Math.max(1, feedGlyphs.length);
        }
      }
      draw();
    }
    animationFrame = requestAnimationFrame(animate);
  };

  const syncSurface = () => {
    const hero = matrixDecorativeRoot(document);
    const nextDecorative = Boolean(
      hero && context && !document.hidden && !reducedMotion.matches && !forcedColors.matches
      && document.body.hasAttribute('data-ds-dark-theme') && window.innerWidth > 640
    );
    const host = hero ?? document.body;
    if (environment.parentElement !== host) host.appendChild(environment);
    if (environment.dataset.matrixDecorative !== String(nextDecorative)) {
      environment.dataset.matrixDecorative = String(nextDecorative);
    }
    environment.hidden = !nextDecorative;
    if (decorative !== nextDecorative) {
      cancelAnimationFrame(animationFrame);
      animationFrame = 0;
      lastFrame = 0;
      decorative = nextDecorative;
      if (decorative) animationFrame = requestAnimationFrame(animate);
      else context?.clearRect(0, 0, width, height);
    }
    if (decorative) resize();
  };

  const handleVisibility = () => syncSurface();
  const handleMotion = () => syncSurface();
  const handleResize = () => syncSurface();
  window.addEventListener('resize', handleResize, { passive: true });
  document.addEventListener('visibilitychange', handleVisibility);
  reducedMotion.addEventListener?.('change', handleMotion);
  forcedColors.addEventListener?.('change', handleMotion);
  setSources();
  syncSurface();

  return {
    element: environment,
    setSources,
    setDisplayedSources,
    syncSurface,
    cleanup() {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibility);
      reducedMotion.removeEventListener?.('change', handleMotion);
      forcedColors.removeEventListener?.('change', handleMotion);
      environment.remove();
      document.body.classList.remove(ACTIVE_CLASS);
    },
  };
}

export function bindSessionRoster(ctx, onSources) {
  const sessions = ctx?.sessions;
  if (!sessions?.list?.getSnapshot || !sessions?.list?.subscribe || !sessions?.binding) {
    onSources({ blank: false });
    return () => {};
  }

  // Desktop 0.2.2 navigation lives in uiSession; list.current is legacy.
  // Borrow the selected binding without retaining sessions or opening history.
  const uiSession = typeof ctx?.get === 'function' ? ctx.get('uiSession') : ctx?.uiSession;
  const selected = uiSession?.adapter?.current;
  const selection = selected?.getSnapshot && selected?.subscribe ? selected : undefined;
  let currentId;
  let currentSession;
  let currentBlank;
  let hasPublished = false;
  let stopInitialSession = () => {};
  const publishIdle = () => onSources({ blank: false });
  const publishSessionSnapshot = (session) => {
    const snapshot = session.getSnapshot();
    onSources(matrixSourcesFromSnapshot(snapshot));
    const waitingForInitialWindow = snapshot?.openState === 'cold' || snapshot?.openState === 'loading';
    if (!waitingForInitialWindow || typeof session.subscribe !== 'function') return;
    let active = true;
    let unsubscribe;
    const stop = () => {
      if (!active) return;
      active = false;
      unsubscribe?.();
    };
    const handleInitialWindow = () => {
      if (!active || session !== currentSession) return;
      try {
        const nextSnapshot = session.getSnapshot();
        if (nextSnapshot?.openState === 'cold' || nextSnapshot?.openState === 'loading') return;
        onSources(matrixSourcesFromSnapshot(nextSnapshot));
        stop();
      } catch {
        publishIdle();
        stop();
      }
    };
    unsubscribe = session.subscribe(handleInitialWindow);
    stopInitialSession = () => {
      stop();
      stopInitialSession = () => {};
    };
    if (!active) unsubscribe?.();
    else handleInitialWindow();
  };
  const publishSelection = () => {
    let listSnapshot;
    let nextId;
    let nextSession;
    try {
      listSnapshot = sessions.list.getSnapshot();
      nextId = selection
        ? selection.getSnapshot()?.key
        : listSnapshot?.current ?? Object.values(listSnapshot?.byId ?? {})
          .find((entry) => (entry?.retainedBy?.mainView ?? 0) > 0)?.id;
      nextSession = nextId === undefined ? undefined : sessions.binding(nextId)?.session;
    } catch {
      stopInitialSession();
      currentId = undefined;
      currentSession = undefined;
      currentBlank = undefined;
      publishIdle();
      hasPublished = false;
      return;
    }
    const nextBlank = nextId === undefined
      && listSnapshot?.phase === 'ready'
      && Array.isArray(listSnapshot.ids)
      && listSnapshot.ids.length === 0;
    if (
      hasPublished && nextId === currentId && nextSession === currentSession
      && nextBlank === currentBlank
    ) return;
    stopInitialSession();
    currentId = nextId;
    currentSession = nextSession;
    currentBlank = nextBlank;
    if (!currentSession?.getSnapshot) {
      onSources({ blank: nextBlank });
      hasPublished = true;
      return;
    }
    try {
      publishSessionSnapshot(currentSession);
      hasPublished = true;
    } catch {
      publishIdle();
      hasPublished = false;
    }
  };

  const stopList = sessions.list.subscribe(publishSelection);
  const stopSelection = selection?.subscribe(publishSelection);
  // Re-read after subscribing so a synchronous navigation update cannot be lost.
  publishSelection();
  return () => {
    stopSelection?.();
    stopList?.();
    stopInitialSession();
    hasPublished = false;
    currentId = undefined;
    currentSession = undefined;
    currentBlank = undefined;
  };
}

export const bindSessionFeed = bindSessionRoster;

function nodeTouchesMatrixSource(node, includeDescendants = false) {
  const element = node?.nodeType === 1 ? node : node?.parentElement;
  if (!element) return false;
  const containsSource = includeDescendants && Object.values(matrixSourceRootsFromDom(element))
    .some((roots) => roots.length > 0);
  return Boolean(
    element.matches?.(MATRIX_DOM_SOURCE_SELECTOR)
    || element.closest?.(MATRIX_DOM_SOURCE_SELECTOR)
    || containsSource,
  );
}

export function apply(ctx) {
  if (typeof document === 'undefined') return;
  const previousInstallation = document[MATRIX_INSTALLATION_OWNER];
  if (typeof previousInstallation === 'function') {
    previousInstallation();
  } else if (typeof previousInstallation?.dispose === 'function') {
    previousInstallation.dispose();
  } else {
    document.getElementById(ENVIRONMENT_ID)?.remove();
    document.querySelector(`style[data-plugin-css="${STYLE_ID}"]`)?.remove();
    document.body?.classList.remove(ACTIVE_CLASS);
  }
  let disposed = false;
  let cleanupMount = () => {};
  const start = () => {
    if (disposed || !document.body) return;
    const removeStyles = installStyles();
    const environment = installEnvironment();
    const stopSessionRoster = bindSessionRoster(ctx, environment?.setSources ?? (() => {}));
    const runtime = {
      displayedFeedFrame: 0,
      surfaceFrame: 0,
      displayedSourceRoot: document.querySelector?.('[data-conversation-scroll]') ?? document,
    };
    const scheduleDisplayedFeed = () => {
      if (runtime.displayedFeedFrame || !environment?.setDisplayedSources) return;
      runtime.displayedFeedFrame = requestAnimationFrame(() => {
        runtime.displayedFeedFrame = 0;
        if (
          runtime.displayedSourceRoot === document
          || !runtime.displayedSourceRoot.isConnected
        ) {
          runtime.displayedSourceRoot = document.querySelector?.('[data-conversation-scroll]') ?? document;
        }
        environment.setDisplayedSources(matrixSourcesFromDom(runtime.displayedSourceRoot));
      });
    };
    const scheduleSurface = () => {
      if (runtime.surfaceFrame || !environment?.syncSurface) return;
      runtime.surfaceFrame = requestAnimationFrame(() => {
        runtime.surfaceFrame = 0;
        environment.syncSurface();
      });
    };
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        // The optional canvas is the skin's only DOM addition. Its own changes
        // must not trigger another refresh or alter native conversation rows.
        if (environment?.element.contains(mutation.target)) continue;
        const added = [...(mutation.addedNodes ?? [])];
        const removed = [...(mutation.removedNodes ?? [])];
        if (mutation.type === 'childList' && [...added, ...removed].every((node) => node === environment?.element)) continue;
        scheduleSurface();
        let refreshDisplayedFeed = nodeTouchesMatrixSource(mutation.target);
        for (const node of [...added, ...removed]) {
          if (!refreshDisplayedFeed && nodeTouchesMatrixSource(node, true)) refreshDisplayedFeed = true;
        }
        if (refreshDisplayedFeed) scheduleDisplayedFeed();
      }
    });
    observer.observe(document.body, {
      childList: true, subtree: true, characterData: true, attributes: true,
      attributeFilter: ['aria-expanded', 'data-state', 'data-phase', 'role', 'aria-modal', 'hidden', 'data-rightbar-collapsed', 'data-sidebar-collapsed', 'data-ds-dark-theme', 'data-trigger-menu'],
    });
    const activeClassObserver = new MutationObserver(() => {
      if (!document.body.classList.contains(ACTIVE_CLASS)) {
        document.body.classList.add(ACTIVE_CLASS);
      }
    });
    activeClassObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    scheduleDisplayedFeed();
    cleanupMount = () => {
      observer.disconnect();
      activeClassObserver.disconnect();
      cancelAnimationFrame(runtime.surfaceFrame);
      cancelAnimationFrame(runtime.displayedFeedFrame);
      stopSessionRoster();
      environment?.cleanup();
      removeStyles?.();
      cleanupMount = () => {};
    };
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    document.removeEventListener('DOMContentLoaded', start);
    cleanupMount();
    if (document[MATRIX_INSTALLATION_OWNER] === dispose) {
      delete document[MATRIX_INSTALLATION_OWNER];
    }
  };
  document[MATRIX_INSTALLATION_OWNER] = dispose;
  ctx.effect(() => dispose, 'dsh-matrix-skin: cleanup');
  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start, { once: true });
}

const MATRIX_CSS = String.raw`
/* Theme only native semantic colors. DSH owns typography, component geometry,
   syntax highlighting, status colors, document previews, and disclosure state. */
body.dsh-matrix-skin-active {
  --dsh-matrix-accent: #176d3e;
  --dsh-matrix-selection-bg: #176d3e;
  --dsh-matrix-selection-text: #ffffff;
  --dsw-alias-brand-primary: #176d3e;
  --dsw-alias-brand-text: #176d3e;
  --dsw-alias-button-primary-hover: #11532e;
  --dsw-alias-border-selected: #176d3e;
  --dsw-focus-ring-color: var(--dsh-matrix-accent);
  --dsw-focus-ring-width: 2px;
  accent-color: var(--dsh-matrix-accent);
}

/* Dark colors are conditional: choosing Light or System remains functional. */
body.dsh-matrix-skin-active[data-ds-dark-theme] {
  --dsh-matrix-accent: #89d6a5;
  --dsh-matrix-selection-bg: #89d6a5;
  --dsh-matrix-selection-text: #08130c;
  --dsw-alias-bg-base: #080c0a;
  --dsw-alias-bg-layer-1: #101713;
  --dsw-alias-bg-layer-2: #17211b;
  --dsw-alias-bg-layer-3: #202d25;
  --dsw-alias-bg-module-platform: #101713;
  --dsw-alias-bg-overlay: #17211b;
  --dsw-alias-label-primary: #e7efe9;
  --dsw-alias-label-secondary: #bdcbc1;
  --dsw-alias-label-tertiary: #a3b4a8;
  --dsw-alias-label-caption: #a3b4a8;
  --dsw-alias-label-dimmed: #87978d;
  --dsw-alias-label-primary-dimmed: #bdcbc1;
  --dsw-alias-label-primary-foreground: #08130c;
  --dsw-alias-brand-primary: #89d6a5;
  --dsw-alias-brand-text: #89d6a5;
  --dsw-alias-button-primary-hover: #a6e9be;
  --dsw-alias-button-primary-dimmed: #25372b;
  --dsw-alias-border-selected: #89d6a5;
  --dsw-alias-border-l1: #29382e;
  --dsw-alias-border-l2: #384b3e;
  --dsw-alias-border-l3: #526b59;
  --dsw-alias-border-l4: #667f6d;
  --dsw-alias-interactive-bg-hover: rgba(137, 214, 165, .08);
  --dsw-alias-interactive-bg-hover-solid: #202d25;
  --dsw-alias-interactive-bg-hover-accent: rgba(137, 214, 165, .14);
  --dsw-alias-interactive-bg-active: rgba(137, 214, 165, .18);
  --dsw-alias-card-fill: #101713;
  --dsw-alias-card-fill-hover: #17211b;
  --dsw-alias-button-elevated-fill: #202d25;
  --dsw-alias-button-floating-fill: #17211b;
  --dsw-alias-button-floating-hover: #202d25;
  --dsw-specific-input-major: #101713;
  --dsw-specific-selector: #202d25;
  --dsw-specific-sidebar-fill: #0d130f;
  --dsw-specific-sidebar-nav-item-active: #203b2a;
  --dsw-specific-sidebar-nav-item-active-accent: #203b2a;
  --dsw-specific-bubble: #17251c;
  --dsw-specific-tip: #17211b;
  --dsw-menu-surface-fill: #17211b;
  --dsw-specific-menu: #17211b;
  --dsw-alias-menu-group-header-fill: #17211b;
  --dsw-alias-markdown-code-block: #101713;
  --dsw-alias-markdown-code-block-banner: #17211b;
  --dsw-alias-markdown-inline-code: #202d25;
}

/* Keep light mode's native surfaces and semantic colors, with readable hints. */
body.dsh-matrix-skin-active:not([data-ds-dark-theme]) {
  --dsw-alias-label-tertiary: #52665a;
  --dsw-alias-label-caption: #52665a;
  --dsw-alias-label-dimmed: #5c6d62;
}

/* Only the containing chrome gets an accent; no widths, padding, or fonts change. */
body.dsh-matrix-skin-active [data-slot="sidebar"],
body.dsh-matrix-skin-active [data-slot="rightbar"] {
  border-color: var(--dsw-alias-border-l2);
}
body.dsh-matrix-skin-active [data-slot="sidebar"] [role="treeitem"][aria-selected="true"] {
  box-shadow: inset 2px 0 var(--dsh-matrix-accent);
}
body.dsh-matrix-skin-active [data-slot="conversation.session.header"] {
  border-bottom-color: var(--dsw-alias-border-l2);
}

/* The native textarea/backdrop, code tokens, terminal, errors, diffs, approvals,
   and reasoning panel deliberately inherit DSH's own styles without overrides. */
body.dsh-matrix-skin-active :is(button, [role="button"], [role="tab"], [role="treeitem"], input, textarea, select, a):focus-visible {
  outline: 2px solid var(--dsh-matrix-accent);
  outline-offset: 2px;
}
body.dsh-matrix-skin-active ::selection {
  color: var(--dsh-matrix-selection-text);
  background: var(--dsh-matrix-selection-bg);
}

/* JS mounts this only in DSH's isolated empty-session hero. No reading surface,
   dialog, menu, sidebar, or composer can be painted over by decoration. */
.dsh-matrix-environment {
  display: none;
  position: absolute;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  overflow: hidden;
  contain: strict;
}
.dsh-matrix-environment[data-matrix-decorative="true"] {
  display: block;
}
.dsh-matrix-rain {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: .09;
  mask-image: linear-gradient(90deg, #000, transparent 25%, transparent 75%, #000);
  -webkit-mask-image: linear-gradient(90deg, #000, transparent 25%, transparent 75%, #000);
}
body.dsh-matrix-skin-active:not([data-ds-dark-theme]) .dsh-matrix-environment {
  display: none;
}
@media (prefers-reduced-motion: reduce), (forced-colors: active), (max-width: 640px) {
  .dsh-matrix-environment[data-matrix-decorative="true"] { display: none; }
}
@media (forced-colors: active) {
  body.dsh-matrix-skin-active :is(button, [role="button"], [role="tab"], [role="treeitem"], input, textarea, select, a):focus-visible {
    outline-color: Highlight;
  }
}
@media print {
  .dsh-matrix-environment { display: none !important; }
}
`;
