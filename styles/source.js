// Cordis injection names runtime services, not npm packages. The session list
// selects one bounded initial snapshot; live rain text then comes from the DSH
// content that is already rendered in the page.
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
  assistant: '[data-chat-flow-kind="assistant-step"] [class*="_markdown_"]',
  user: [
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

function installEnvironment() {
  if (document.getElementById(ENVIRONMENT_ID)) return;

  const environment = document.createElement('div');
  environment.id = ENVIRONMENT_ID;
  environment.className = 'dsh-matrix-environment';
  environment.setAttribute('aria-hidden', 'true');

  const canvas = document.createElement('canvas');
  canvas.className = 'dsh-matrix-rain';
  canvas.setAttribute('aria-hidden', 'true');
  environment.appendChild(canvas);

  const hud = document.createElement('div');
  hud.className = 'dsh-matrix-hud';
  const hudEyebrow = document.createElement('span');
  hudEyebrow.className = 'dsh-matrix-hud__eyebrow';
  hudEyebrow.textContent = 'DSH // NEURAL RAIN';
  const hudSource = document.createElement('strong');
  hudSource.className = 'dsh-matrix-hud__source';
  const hudMetrics = document.createElement('span');
  hudMetrics.className = 'dsh-matrix-hud__metrics';
  const hudStatus = document.createElement('span');
  hudStatus.className = 'dsh-matrix-hud__status';
  hud.append(hudEyebrow, hudSource, hudMetrics, hudStatus);
  environment.appendChild(hud);
  document.body.appendChild(environment);
  document.body.classList.add(ACTIVE_CLASS);

  const context = canvas.getContext('2d', { alpha: true });
  if (!context) {
    environment.remove();
    document.body.classList.remove(ACTIVE_CLASS);
    return;
  }
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let animationFrame = 0;
  let resizeFrame = 0;
  let lastFrame = 0;
  let width = 0;
  let height = 0;
  let ratio = 0;
  let fontSize = 16;
  let columns = [];
  let renderColumns = [];
  let feedText = '';
  let feedGlyphs = [];

  const setHudText = (element, value) => {
    if (element.textContent !== value) element.textContent = value;
  };
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
    if (reducedMotion.matches) draw(performance.now());
    return true;
  };
  const updateHud = (sources) => {
    const sourceCounts = ['thinking', 'reasoning', 'assistant', 'user']
      .map((key) => uniqueMatrixText(sources[key]).length);
    const dynamicCount = sourceCounts.reduce((total, count) => total + count, 0);
    const live = dynamicCount > 0;
    const fallback = !live && sources.blank !== false;
    const sourceCount = live ? sourceCounts.filter(Boolean).length : fallback ? 1 : 0;
    environment.dataset.matrixSource = live ? 'session' : fallback ? 'readme' : 'idle';
    setHudText(hudSource, live ? 'SESSION MEMORY BUS' : fallback ? 'OFFICIAL README FALLBACK' : 'SESSION TEXT PENDING');
    setHudText(hudMetrics, `${feedGlyphs.length.toLocaleString()} GLYPHS · ${sourceCount} SOURCE${sourceCount === 1 ? '' : 'S'}`);
    setHudText(hudStatus, live ? 'LIVE SIGNAL' : fallback ? 'STANDBY SEED' : 'NO TEXT SIGNAL');
  };
  const setSources = (sources = {}) => {
    updateFeed(composeMatrixText(sources));
    updateHud(sources);
  };
  const setDisplayedSources = (sources = {}) => {
    const text = composeMatrixText({ ...sources, blank: false });
    if (!text) return;
    updateFeed(text);
    if (environment.dataset.matrixSource !== 'session') {
      updateHud({ ...sources, blank: false });
    }
  };

  const resize = () => {
    if (!context) return;
    resizeFrame = 0;
    const nextWidth = window.innerWidth;
    const nextHeight = window.innerHeight;
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
    draw(performance.now());
  };
  const scheduleResize = () => {
    if (!resizeFrame) resizeFrame = requestAnimationFrame(resize);
  };

  const draw = (time) => {
    if (!context) return;
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
    if (document.hidden || reducedMotion.matches) {
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
      draw(time);
    }
    animationFrame = requestAnimationFrame(animate);
  };

  const startAnimation = () => {
    cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    lastFrame = 0;
    if (reducedMotion.matches) {
      draw(performance.now());
      return;
    }
    if (!document.hidden) animationFrame = requestAnimationFrame(animate);
  };

  const handleVisibility = () => startAnimation();
  const handleMotion = () => startAnimation();
  window.addEventListener('resize', scheduleResize, { passive: true });
  document.addEventListener('visibilitychange', handleVisibility);
  reducedMotion.addEventListener?.('change', handleMotion);
  setSources();
  resize();
  startAnimation();

  return {
    element: environment,
    setSources,
    setDisplayedSources,
    cleanup() {
      cancelAnimationFrame(animationFrame);
      cancelAnimationFrame(resizeFrame);
      window.removeEventListener('resize', scheduleResize);
      document.removeEventListener('visibilitychange', handleVisibility);
      reducedMotion.removeEventListener?.('change', handleMotion);
      environment.remove();
      document.body.classList.remove(ACTIVE_CLASS);
    },
  };
}

function bindBody(body, runtime) {
  if (!runtime.bodyCleanups.has(body)) {
    body.dataset.matrixFollowBound = 'true';
    const handleScroll = () => {
      const nextManual = isAtScrollTail(body) ? 'false' : 'true';
      if (body.dataset.matrixManual !== nextManual) body.dataset.matrixManual = nextManual;
    };
    body.addEventListener('scroll', handleScroll, { passive: true });
    runtime.bodyCleanups.set(body, () => {
      body.removeEventListener('scroll', handleScroll);
      delete body.dataset.matrixFollowBound;
      delete body.dataset.matrixManual;
    });
  }
  if (!runtime.bodyAttributes.has(body)) {
    runtime.bodyAttributes.set(body, { tabIndex: body.getAttribute('tabindex') });
  }
}

function cleanupBody(body, runtime) {
  runtime.bodyCleanups.get(body)?.();
  runtime.bodyCleanups.delete(body);
  const attributes = runtime.bodyAttributes.get(body);
  if (attributes) restoreAttribute(body, 'tabindex', attributes.tabIndex);
  runtime.bodyAttributes.delete(body);
}

function matchingElements(root, selector) {
  if (!(root instanceof Element)) return [];
  return [...(root.matches(selector) ? [root] : []), ...root.querySelectorAll(selector)];
}

function cleanupRemovedNode(node, runtime) {
  if (!(node instanceof Element) || node.isConnected) return;
  for (const body of matchingElements(node, BODY_SELECTOR)) cleanupBody(body, runtime);
  for (const row of matchingElements(node, ROW_SELECTOR)) {
    runtime.pendingRows.delete(row);
    runtime.rows.delete(row);
    row.classList.remove('dsh-matrix-thinking');
    row.removeAttribute('data-matrix-thinking');
  }
}

function reveal(row, runtime) {
  if (!(row instanceof Element)) return;
  runtime.rows.add(row);
  if (!row.classList.contains('dsh-matrix-thinking')) row.classList.add('dsh-matrix-thinking');
  if (row.getAttribute('data-matrix-thinking') !== 'visible') {
    row.setAttribute('data-matrix-thinking', 'visible');
  }
  const body = row.querySelector(BODY_SELECTOR);
  if (body instanceof HTMLElement) {
    bindBody(body, runtime);
    if (body.getAttribute('tabindex') !== '0') body.setAttribute('tabindex', '0');
    if (shouldFollowThinkingTail(body.dataset.matrixManual)) body.scrollTop = body.scrollHeight;
  }
}

function scheduleReveal(row, runtime) {
  if (!(row instanceof Element)) return;
  runtime.pendingRows.add(row);
  if (runtime.revealFrame) return;
  runtime.revealFrame = requestAnimationFrame(() => {
    runtime.revealFrame = 0;
    const rows = [...runtime.pendingRows];
    runtime.pendingRows.clear();
    for (const pendingRow of rows) reveal(pendingRow, runtime);
  });
}

function scan(root, runtime, deferred = false) {
  if (!(root instanceof Document || root instanceof Element)) return;
  const visit = deferred ? scheduleReveal : reveal;
  if (root instanceof Element && root.matches(ROW_SELECTOR)) visit(root, runtime);
  for (const row of root.querySelectorAll(ROW_SELECTOR)) visit(row, runtime);
}

function restoreAttribute(element, name, value) {
  if (value === null) {
    if (element.hasAttribute(name)) element.removeAttribute(name);
  } else if (element.getAttribute(name) !== value) {
    element.setAttribute(name, value);
  }
}

export function bindSessionRoster(ctx, onSources) {
  const sessions = ctx?.sessions;
  if (!sessions?.list?.getSnapshot || !sessions?.list?.subscribe || !sessions?.binding) {
    onSources({ blank: false });
    return () => {};
  }

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
      nextId = listSnapshot?.current;
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

  publishSelection();
  const stopList = sessions.list.subscribe(publishSelection);
  return () => {
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
      rows: new Set(),
      bodyAttributes: new Map(),
      bodyCleanups: new Map(),
      pendingRows: new Set(),
      revealFrame: 0,
      displayedFeedFrame: 0,
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
    scan(document, runtime);
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        let refreshDisplayedFeed = nodeTouchesMatrixSource(mutation.target);
        for (const node of mutation.addedNodes) {
          const element = node instanceof Element ? node : node.parentElement;
          const owner = element?.closest(ROW_SELECTOR);
          if (owner) scheduleReveal(owner, runtime);
          if (node instanceof Element) scan(node, runtime, true);
          if (!refreshDisplayedFeed && nodeTouchesMatrixSource(node, true)) refreshDisplayedFeed = true;
        }
        for (const node of mutation.removedNodes) {
          if (!refreshDisplayedFeed && nodeTouchesMatrixSource(node, true)) refreshDisplayedFeed = true;
          cleanupRemovedNode(node, runtime);
        }
        if (mutation.type === 'characterData' && mutation.target.parentElement) {
          const row = mutation.target.parentElement.closest(ROW_SELECTOR);
          if (row) scheduleReveal(row, runtime);
        }
        if (mutation.type === 'attributes' && mutation.target instanceof Element) {
          const row = mutation.target.matches(ROW_SELECTOR)
            ? mutation.target
            : mutation.target.closest(ROW_SELECTOR);
          if (
            mutation.attributeName === 'data-matrix-thinking'
            && row && runtime.rows.has(row)
            && row.getAttribute('data-matrix-thinking') !== 'visible'
          ) {
            const body = row.querySelector(BODY_SELECTOR);
            if (body instanceof HTMLElement && runtime.bodyAttributes.has(body)) {
              runtime.bodyAttributes.set(body, { tabIndex: body.getAttribute('tabindex') });
              body.dataset.matrixFollowBound = 'true';
            }
          }
          if (row) scheduleReveal(row, runtime);
        }
        if (refreshDisplayedFeed) scheduleDisplayedFeed();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['aria-expanded', 'data-matrix-thinking', 'data-state'] });
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
      cancelAnimationFrame(runtime.revealFrame);
      cancelAnimationFrame(runtime.displayedFeedFrame);
      runtime.pendingRows.clear();
      for (const body of [...runtime.bodyCleanups.keys()]) cleanupBody(body, runtime);
      for (const row of runtime.rows) {
        row.classList.remove('dsh-matrix-thinking');
        row.removeAttribute('data-matrix-thinking');
      }
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
:root {
  --dsh-matrix-bg: #010302;
  --dsh-matrix-panel: #050806;
  --dsh-matrix-green: #43ff91;
  --dsh-matrix-bright: #caffdf;
  --dsh-matrix-dim: #8fba9f;
  --dsh-matrix-cyan: #72ffe2;
  --dsh-matrix-border: rgba(67, 255, 145, .32);
  --dsh-matrix-danger: #ff657a;
  --dsh-matrix-shadow: rgba(0, 0, 0, .58);
}
body.dsh-matrix-skin-active {
  --dsw-alias-bg-base: #010302;
  --dsw-alias-bg-layer-1: #030504;
  --dsw-alias-bg-layer-2: #050806;
  --dsw-alias-bg-layer-3: #080b09;
  --dsw-alias-bg-module-platform: #050806;
  --dsw-alias-bg-overlay: #0a0d0b;
  --dsw-specific-input-major: #050806;
  --dsw-specific-sidebar-fill: #030504;
  --dsw-specific-sidebar-nav-item-active: rgba(67, 255, 145, .08);
  --dsw-specific-sidebar-nav-item-hover: rgba(67, 255, 145, .045);
  color-scheme: dark;
  background: var(--dsh-matrix-bg) !important;
  accent-color: var(--dsh-matrix-green);
}
body.dsh-matrix-skin-active [data-slot="root"],
body.dsh-matrix-skin-active [data-slot="root"] > * {
  color: #dce8e1;
  background: var(--dsh-matrix-bg) !important;
}
body.dsh-matrix-skin-active :is(button, input, [role="tab"], [role="treeitem"]) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
body.dsh-matrix-skin-active :is(button, [role="button"], [role="tab"], [role="treeitem"]):focus-visible {
  outline: 1px solid var(--dsh-matrix-cyan) !important;
  outline-offset: 2px !important;
  box-shadow: 0 0 0 3px rgba(114, 255, 226, .12), 0 0 18px rgba(67, 255, 145, .16) !important;
}
body.dsh-matrix-skin-active ::selection {
  color: #00190b;
  background: var(--dsh-matrix-green);
  text-shadow: none;
}
body.dsh-matrix-skin-active [data-slot="sidebar"] > * {
  position: relative;
  border-right: 1px solid rgba(67, 255, 145, .2) !important;
  background: #030504 !important;
  box-shadow: 12px 0 36px rgba(0, 0, 0, .24), inset -1px 0 rgba(114, 255, 226, .025);
}
body.dsh-matrix-skin-active [data-slot="sidebar"] > *::after {
  content: "";
  position: absolute;
  z-index: 4;
  pointer-events: none;
  inset: 0 -1px 0 auto;
  width: 2px;
  opacity: .78;
  background: linear-gradient(180deg, transparent, var(--dsh-matrix-green) 22%, rgba(114,255,226,.2) 68%, transparent);
  box-shadow: 0 0 18px rgba(67,255,145,.28);
}
body.dsh-matrix-skin-active [data-slot="sidebar"] button {
  color: rgba(211, 246, 224, .82);
  letter-spacing: .015em;
}
body.dsh-matrix-skin-active [data-slot="sidebar"] button:hover:not(:disabled) {
  color: var(--dsh-matrix-bright);
  background-color: rgba(67, 255, 145, .07) !important;
}
body.dsh-matrix-skin-active [role="treeitem"] {
  position: relative;
  margin-inline: 4px;
  border: 1px solid transparent;
  border-radius: 7px !important;
  transition: color .16s ease, border-color .16s ease, background-color .16s ease, box-shadow .16s ease;
}
body.dsh-matrix-skin-active [role="treeitem"]:hover {
  color: var(--dsh-matrix-bright);
  border-color: rgba(67, 255, 145, .13);
  background: rgba(67, 255, 145, .045) !important;
}
body.dsh-matrix-skin-active [role="treeitem"][aria-selected="true"] {
  color: var(--dsh-matrix-bright) !important;
  border-color: rgba(67, 255, 145, .28) !important;
  background: rgba(67, 255, 145, .075) !important;
  box-shadow: inset 2px 0 var(--dsh-matrix-green), 0 0 18px rgba(39, 255, 122, .045);
}
body.dsh-matrix-skin-active [data-slot="conversation"] > * {
  background: transparent !important;
}
body.dsh-matrix-skin-active [data-conversation-scroll] {
  background-color: var(--dsh-matrix-bg) !important;
}
body.dsh-matrix-skin-active [data-composer-seat] {
  background: linear-gradient(180deg, rgba(1, 3, 2, 0) 0, var(--dsh-matrix-bg) 36px) !important;
}
body.dsh-matrix-skin-active [data-slot="conversation.session.header"] > * {
  position: relative;
  border-bottom: 1px solid rgba(67, 255, 145, .15) !important;
  background: rgba(2, 4, 3, .97) !important;
  box-shadow: 0 10px 28px rgba(0,0,0,.18), inset 0 -1px rgba(114,255,226,.025);
}
body.dsh-matrix-skin-active [data-slot="conversation.session.header"] > *::after {
  content: "";
  position: absolute;
  pointer-events: none;
  inset: auto 0 -1px;
  height: 1px;
  background: linear-gradient(90deg, var(--dsh-matrix-green), rgba(114,255,226,.35) 28%, transparent 58%);
  box-shadow: 0 0 14px rgba(67,255,145,.24);
}
body.dsh-matrix-skin-active [role="tab"] {
  color: rgba(191, 222, 203, .64) !important;
  letter-spacing: .08em;
  text-transform: uppercase;
  transition: color .16s ease, text-shadow .16s ease;
}
body.dsh-matrix-skin-active [role="tab"]:hover,
body.dsh-matrix-skin-active [role="tab"][aria-selected="true"] {
  color: var(--dsh-matrix-green) !important;
  text-shadow: 0 0 12px rgba(67, 255, 145, .44);
}
body.dsh-matrix-skin-active [data-slot="conversation.view"] > * {
  background:
    linear-gradient(90deg, rgba(67,255,145,.015) 0 1px, transparent 1px) 0 0 / 80px 100%,
    linear-gradient(0deg, rgba(67,255,145,.012) 0 1px, transparent 1px) 0 0 / 100% 80px,
    var(--dsh-matrix-bg) !important;
}
body.dsh-matrix-skin-active [data-chat-flow-kind="assistant-step"] [data-slot="conversation.chat.node"] {
  position: relative;
  border-left: 1px solid rgba(67, 255, 145, .15);
  padding-left: 18px;
  background: transparent;
}
body.dsh-matrix-skin-active [data-chat-flow-kind="assistant-step"] [class*="_markdown_"] {
  color: rgba(224, 246, 231, .91);
}
body.dsh-matrix-skin-active [data-chat-flow-kind="assistant-step"] :is(code, pre) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
body.dsh-matrix-skin-active [data-chat-flow-kind="assistant-step"] code {
  color: #9dffc2;
  border-color: rgba(67,255,145,.13);
}
body.dsh-matrix-skin-active [data-chat-flow-kind="assistant-step"] :not(pre) > code {
  background-color: #07100b;
}
body.dsh-matrix-skin-active [data-chat-flow-kind="user"] [class*="_userStack"] > [class*="_bubble"],
body.dsh-matrix-skin-active [data-chat-flow-kind="steering"] [class*="_userStack"] > [class*="_bubble"],
body.dsh-matrix-skin-active [data-pending-steering] [class*="_userStack"] > [class*="_bubble"] {
  color: #eafff2 !important;
  box-sizing: border-box;
  border: 1px solid rgba(114, 255, 226, .26);
  border-radius: 3px 15px 3px 15px !important;
  background: #06100b !important;
  box-shadow: 0 8px 22px rgba(0,0,0,.28), inset 0 1px rgba(207,255,231,.045), 0 0 18px rgba(69,255,170,.04);
  text-shadow: 0 0 10px rgba(114,255,226,.08);
}
body.dsh-matrix-skin-active [data-chat-flow-kind="assistant-step"] [data-variant]:not([data-variant="think"]) {
  border: 1px solid rgba(67,255,145,.11);
  border-radius: 8px;
  background: rgba(4, 7, 5, .92) !important;
  box-shadow: inset 2px 0 rgba(67,255,145,.36);
}
body.dsh-matrix-skin-active [data-chat-flow-kind="assistant-step"] [data-variant="read"],
body.dsh-matrix-skin-active [data-chat-flow-kind="assistant-step"] [data-variant="search"] {
  box-shadow: inset 2px 0 rgba(114,255,226,.56);
}
body.dsh-matrix-skin-active [data-chat-flow-kind="assistant-step"] [data-error="true"] {
  border-color: rgba(255, 101, 122, .24);
  box-shadow: inset 2px 0 var(--dsh-matrix-danger), 0 0 22px rgba(255,62,92,.05);
}
body.dsh-matrix-skin-active [data-slot="conversation.input.dock"] {
  /* Native Todo, Goal, and Queue cards all consume these surface tokens,
     including Queue's pseudo-element border. Keep them scoped to the dock so
     menus and composer takeovers retain their distinct interaction styling. */
  --dsw-specific-tip: #030504;
  --dsw-alias-border-l1: rgba(67,255,145,.2);
}
body.dsh-matrix-skin-active [data-slot="conversation.input.dock"] > :not([data-goal-bar]):not([data-queue-dock]),
body.dsh-matrix-skin-active [data-slot="conversation.input.dock"] > [data-goal-bar] > :first-child,
body.dsh-matrix-skin-active [data-slot="conversation.input.dock"] > [data-queue-dock] > :first-child {
  border-color: rgba(67,255,145,.2) !important;
  background: #030504 !important;
  box-shadow: inset 2px 0 rgba(67,255,145,.42), 0 10px 24px rgba(0,0,0,.28);
}
body.dsh-matrix-skin-active [data-slot="conversation.composer.bar"] [role="status"] {
  box-sizing: border-box;
  border: 1px solid rgba(67,255,145,.2);
  border-radius: 12px;
  background: #030504 !important;
  box-shadow: inset 2px 0 rgba(67,255,145,.42), 0 10px 24px rgba(0,0,0,.28);
}
body.dsh-matrix-skin-active [data-slot="conversation.composer.bar"] [role="status"][class*="_noticeError"] {
  border-color: rgba(255,101,122,.24);
  box-shadow: inset 2px 0 var(--dsh-matrix-danger), 0 10px 24px rgba(0,0,0,.28);
}
body.dsh-matrix-skin-active [data-slot="conversation.composer.bar"] [class*="_card"] {
  position: relative;
  border: 1px solid rgba(67, 255, 145, .3) !important;
  border-radius: 10px !important;
  background: #050806 !important;
  box-shadow: 0 0 0 1px rgba(67,255,145,.025), 0 16px 42px rgba(0,0,0,.42), 0 0 22px rgba(44,255,124,.05), inset 0 1px rgba(215,255,230,.04);
}
body.dsh-matrix-skin-active [data-slot="conversation.composer.bar"] [class*="_card"]::before {
  content: "DSH://SECURE_INPUT_CHANNEL";
  position: absolute;
  pointer-events: none;
  left: 16px;
  top: -10px;
  padding: 2px 7px;
  color: rgba(114,255,226,.8);
  border: 1px solid rgba(67,255,145,.23);
  border-radius: 3px;
  background: #050806;
  font: 600 8px/1.35 ui-monospace, SFMono-Regular, Menlo, monospace;
  letter-spacing: .15em;
  text-shadow: 0 0 9px rgba(114,255,226,.48);
}
body.dsh-matrix-skin-active [data-slot="conversation.composer.bar"] :is(input, [contenteditable="true"]) {
  color: var(--dsh-matrix-bright) !important;
  caret-color: var(--dsh-matrix-green);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
body.dsh-matrix-skin-active [data-slot="conversation.composer.bar"] [data-input-backdrop] {
  color: var(--dsh-matrix-bright) !important;
}
body.dsh-matrix-skin-active [data-slot="conversation.composer.bar"] [data-input-scroll] textarea {
  color: transparent !important;
  caret-color: var(--dsh-matrix-green);
}
body.dsh-matrix-skin-active [data-slot="conversation.composer.bar"] :is(textarea, input)::placeholder {
  color: rgba(170, 211, 185, .68) !important;
}
body.dsh-matrix-skin-active [data-slot="conversation.input.right"] button:last-child:not(:disabled) {
  color: #00190b !important;
  background: linear-gradient(135deg, var(--dsh-matrix-bright), var(--dsh-matrix-green)) !important;
  box-shadow: 0 0 22px rgba(67,255,145,.32);
}
body.dsh-matrix-skin-active [data-slot="details"] > * {
  border-left-color: rgba(67,255,145,.16) !important;
  background: #030504 !important;
  box-shadow: -18px 0 48px rgba(0,0,0,.28);
}
body.dsh-matrix-skin-active [aria-label="Trajectory toolbar"] {
  border-bottom: 1px solid rgba(67,255,145,.13);
  background: #030504;
}
body.dsh-matrix-skin-active tr[data-kind] > :is(td, th) {
  border-bottom-color: rgba(67,255,145,.09) !important;
  background: rgba(2, 4, 3, .9);
}
body.dsh-matrix-skin-active tr[data-kind]:hover > :is(td, th) {
  background: rgba(7, 18, 12, .92) !important;
}
body.dsh-matrix-skin-active tr[data-kind="message"] > :first-child {
  color: var(--dsh-matrix-cyan);
}
body.dsh-matrix-skin-active tr[data-kind="tool"] > :first-child {
  color: var(--dsh-matrix-green);
}
body.dsh-matrix-skin-active * {
  scrollbar-color: rgba(67,255,145,.64) rgba(1,8,5,.56);
  scrollbar-width: thin;
}
body.dsh-matrix-skin-active *::-webkit-scrollbar { width: 8px; height: 8px; }
body.dsh-matrix-skin-active *::-webkit-scrollbar-track { background: rgba(1,8,5,.46); }
body.dsh-matrix-skin-active *::-webkit-scrollbar-thumb {
  border: 2px solid rgba(1,8,5,.7);
  border-radius: 8px;
  background: var(--dsh-matrix-green);
}
.dsh-matrix-environment {
  position: fixed;
  inset: 0;
  z-index: 2147483000;
  pointer-events: none;
  overflow: hidden;
  contain: strict;
  opacity: 1;
}
.dsh-matrix-environment::before {
  content: "";
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(0deg, rgba(84,255,145,.025) 0 1px, transparent 1px 4px);
  -webkit-mask-image: linear-gradient(90deg, #000, transparent 36%, transparent 64%, #000);
  mask-image: linear-gradient(90deg, #000, transparent 36%, transparent 64%, #000);
  mix-blend-mode: screen;
}
.dsh-matrix-environment::after {
  content: none;
}
.dsh-matrix-rain {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: .3;
  filter: drop-shadow(0 0 5px rgba(65,255,137,.72));
  mix-blend-mode: screen;
  -webkit-mask-image: linear-gradient(90deg, transparent 0 11%, #000 14%, rgba(0,0,0,.72) 27%, transparent 33% 69%, rgba(0,0,0,.7) 76%, #000 100%);
  mask-image: linear-gradient(90deg, transparent 0 11%, #000 14%, rgba(0,0,0,.72) 27%, transparent 33% 69%, rgba(0,0,0,.7) 76%, #000 100%);
}
body.dsh-matrix-skin-active:has([aria-label="Trajectory toolbar"]) .dsh-matrix-rain {
  opacity: .08;
}
body.dsh-matrix-skin-active:has([aria-label="Trajectory toolbar"]) .dsh-matrix-hud {
  display: none;
}
.dsh-matrix-hud {
  position: absolute;
  top: 88px;
  right: 18px;
  width: min(224px, calc(100vw - 36px));
  display: grid;
  gap: 5px;
  box-sizing: border-box;
  padding: 10px 12px 11px;
  color: rgba(199,255,220,.78);
  border: 1px solid rgba(67,255,145,.2);
  border-radius: 5px;
  background: rgba(2, 4, 3, .94);
  box-shadow: 0 12px 30px rgba(0,0,0,.38), inset 0 1px rgba(205,255,225,.035), 0 0 18px rgba(67,255,145,.04);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  text-transform: uppercase;
}
.dsh-matrix-hud::before {
  content: "";
  position: absolute;
  inset: 0 auto auto 0;
  width: 38%;
  height: 1px;
  background: var(--dsh-matrix-green);
  box-shadow: 0 0 11px rgba(67,255,145,.68);
}
.dsh-matrix-hud__eyebrow {
  color: rgba(114,255,226,.68);
  font-size: 8px;
  font-weight: 700;
  letter-spacing: .18em;
}
.dsh-matrix-hud__source {
  overflow: hidden;
  color: var(--dsh-matrix-bright);
  font-size: 10px;
  font-weight: 650;
  letter-spacing: .08em;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-shadow: 0 0 11px rgba(67,255,145,.28);
}
.dsh-matrix-hud__metrics {
  color: rgba(152,204,171,.66);
  font-size: 8px;
  letter-spacing: .08em;
}
.dsh-matrix-hud__status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--dsh-matrix-green);
  font-size: 8px;
  font-weight: 700;
  letter-spacing: .14em;
}
.dsh-matrix-hud__status::before {
  content: "";
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
  box-shadow: 0 0 9px currentColor;
  animation: dsh-matrix-hud-blink 1.8s steps(2, end) infinite;
}
.dsh-matrix-environment[data-matrix-source="readme"] .dsh-matrix-hud__status,
.dsh-matrix-environment[data-matrix-source="idle"] .dsh-matrix-hud__status {
  color: rgba(122,203,154,.72);
}
[data-matrix-thinking="visible"] {
  position: relative;
  margin-block: 18px;
  min-height: 116px;
  isolation: isolate;
  color: var(--dsh-matrix-dim);
  border: 1px solid var(--dsh-matrix-border);
  border-radius: 14px;
  background:
    linear-gradient(90deg, var(--dsh-matrix-green) 0 18px, transparent 18px) top left / 42px 1px no-repeat,
    linear-gradient(180deg, var(--dsh-matrix-green) 0 18px, transparent 18px) top left / 1px 42px no-repeat,
    linear-gradient(270deg, var(--dsh-matrix-cyan) 0 18px, transparent 18px) bottom right / 42px 1px no-repeat,
    linear-gradient(0deg, var(--dsh-matrix-cyan) 0 18px, transparent 18px) bottom right / 1px 42px no-repeat,
    #020403;
  box-shadow:
    0 0 0 1px rgba(67,255,145,.055),
    0 14px 40px rgba(0,0,0,.32),
    0 0 34px rgba(38,255,116,.10),
    inset 0 1px rgba(192,255,217,.04);
  overflow: hidden;
  transition: border-color .2s ease, box-shadow .2s ease, transform .2s ease;
}
[data-matrix-thinking="visible"]::before {
  content: "MATRIX://COGNITION_STREAM  ·  ARCHIVED";
  display: block;
  padding: 8px 14px 7px 30px;
  color: rgba(122,203,154,.74);
  border-bottom: 1px solid var(--dsh-matrix-border);
  background:
    radial-gradient(circle at 13px 50%, var(--dsh-matrix-green) 0 2px, rgba(67,255,145,.18) 3px 5px, transparent 6px),
    #030605;
  font: 600 9px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace;
  letter-spacing: .18em;
  white-space: nowrap;
  overflow: hidden;
  text-transform: uppercase;
}
[data-matrix-thinking="visible"][data-state="running"]::before {
  content: "MATRIX://COGNITION_STREAM  ·  LIVE SIGNAL";
  color: var(--dsh-matrix-green);
  text-shadow: 0 0 12px rgba(67,255,145,.7);
  animation: dsh-matrix-status 2.2s ease-in-out infinite;
}
[data-matrix-thinking="visible"]::after {
  content: "";
  position: absolute;
  z-index: 3;
  inset: 31px 0 auto;
  height: 70px;
  pointer-events: none;
  opacity: 0;
  background: linear-gradient(180deg, transparent, rgba(82,255,148,.075), transparent);
  transform: translateY(-100%);
}
[data-matrix-thinking="visible"][data-state="running"]::after {
  opacity: 1;
  animation: dsh-matrix-scan 4.8s linear infinite;
}
[data-matrix-thinking="visible"] :is(button, [role="button"])[aria-expanded] {
  position: relative;
  z-index: 4;
  width: 100%;
  padding: 8px 14px !important;
  border-radius: 0;
  background: #030605;
  transition: background-color .16s ease, color .16s ease;
}
[data-matrix-thinking="visible"] :is(button, [role="button"])[aria-expanded]:hover {
  background: rgba(67,255,145,.085);
}
[data-matrix-thinking="visible"] :is(button, [role="button"])[aria-expanded]:focus-visible {
  outline: 1px solid var(--dsh-matrix-cyan);
  outline-offset: -3px;
}
[data-matrix-thinking="visible"] [class*="thinkBody"] {
  max-height: min(48vh, 560px);
  overflow: auto;
  box-sizing: border-box;
  position: relative;
  z-index: 2;
  margin: 0;
  padding: 16px 20px 18px 28px;
  color: var(--dsh-matrix-green);
  background:
    linear-gradient(90deg, rgba(67,255,145,.07) 0 1px, transparent 1px) 18px 0 / 1px 100% no-repeat,
    repeating-linear-gradient(0deg, rgba(67,255,145,.022) 0 1px, transparent 1px 4px),
    var(--dsh-matrix-bg);
  font: 500 13px/1.72 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  letter-spacing: .012em;
  text-shadow: 0 0 8px rgba(67,255,145,.38);
  white-space: pre-wrap;
  word-break: break-word;
  caret-color: var(--dsh-matrix-bright);
  scrollbar-color: var(--dsh-matrix-green) var(--dsh-matrix-bg);
  scrollbar-width: thin;
  scrollbar-gutter: stable;
  overscroll-behavior: contain;
  outline: none;
}
[data-matrix-thinking="visible"] [class*="thinkBody"]:focus-visible {
  box-shadow: inset 0 0 0 1px rgba(114,255,226,.7);
}
[data-matrix-thinking="visible"] [class*="thinkBody"]::-webkit-scrollbar { width: 8px; height: 8px; }
[data-matrix-thinking="visible"] [class*="thinkBody"]::-webkit-scrollbar-track { background: rgba(0,0,0,.32); }
[data-matrix-thinking="visible"] [class*="thinkBody"]::-webkit-scrollbar-thumb {
  border: 2px solid var(--dsh-matrix-bg);
  border-radius: 8px;
  background: var(--dsh-matrix-green);
  box-shadow: 0 0 8px rgba(67,255,145,.48);
}
[data-matrix-thinking="visible"] [class*="thinkBody"]::before {
  content: ">_ ";
  color: var(--dsh-matrix-cyan);
  text-shadow: 0 0 10px rgba(114,255,226,.8);
}
[data-matrix-thinking="visible"] [class*="summary"],
[data-matrix-thinking="visible"] [class*="title"] {
  color: var(--dsh-matrix-bright);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  text-shadow: 0 0 9px rgba(67,255,145,.38);
}
[data-matrix-thinking="visible"] [class*="summary"] {
  max-width: 100%;
  color: var(--dsh-matrix-dim);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
[data-matrix-thinking="visible"] [class*="chevron"] { color: var(--dsh-matrix-cyan); }
[data-matrix-thinking="visible"] [class*="thinkBody"]::selection,
[data-matrix-thinking="visible"] [class*="thinkBody"] *::selection {
  color: #001d0c;
  background: var(--dsh-matrix-green);
  text-shadow: none;
}
[data-matrix-thinking="visible"][data-state="running"] {
  border-color: rgba(67,255,145,.54);
  box-shadow:
    0 0 0 1px rgba(67,255,145,.08),
    0 14px 44px rgba(0,0,0,.36),
    0 0 42px rgba(38,255,116,.16),
    inset 0 1px rgba(192,255,217,.06);
}
[data-matrix-thinking="visible"][data-state="running"] [class*="thinkBody"] {
  animation: dsh-matrix-pulse 2.2s ease-in-out infinite;
}
@keyframes dsh-matrix-pulse {
  50% { box-shadow: inset 0 0 26px rgba(67,255,145,.075); }
}
@keyframes dsh-matrix-status {
  0%, 100% { opacity: .66; }
  50% { opacity: 1; }
}
@keyframes dsh-matrix-hud-blink {
  0%, 74% { opacity: 1; }
  75%, 100% { opacity: .36; }
}
@keyframes dsh-matrix-scan {
  from { transform: translateY(-100%); }
  to { transform: translateY(520px); }
}
@media (prefers-reduced-motion: reduce) {
  .dsh-matrix-rain { opacity: .22; }
  .dsh-matrix-hud__status::before,
  [data-matrix-thinking="visible"] [class*="thinkBody"],
  [data-matrix-thinking="visible"]::before,
  [data-matrix-thinking="visible"]::after { animation: none !important; }
  [data-matrix-thinking="visible"]::after { display: none; }
}
@media (forced-colors: active) {
  .dsh-matrix-environment { display: none; }
  [data-matrix-thinking="visible"] { border-color: CanvasText; box-shadow: none; }
}
@media (max-width: 640px) {
  .dsh-matrix-hud { display: none; }
  .dsh-matrix-rain {
    opacity: .24;
    -webkit-mask-image: linear-gradient(90deg, #000, transparent 45%, transparent 55%, #000);
    mask-image: linear-gradient(90deg, #000, transparent 45%, transparent 55%, #000);
  }
  [data-matrix-thinking="visible"] { margin-block: 12px; border-radius: 11px; }
  [data-matrix-thinking="visible"]::before { padding-inline: 24px 10px; font-size: 8px; letter-spacing: .12em; }
  [data-matrix-thinking="visible"] [class*="thinkBody"] { max-height: 42vh; padding: 13px 12px 15px 20px; font-size: 13px; }
}
`;
