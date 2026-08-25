window.__ModuleLoader__.load({
  id: 'dsh-matrix-skin',
  factory: (require) => {
    const module = { exports: {} };
    const exports = module.exports;
    const inject = [];

const STYLE_ID = 'dsh-matrix-skin/styles';
const ROW_SELECTOR = '[data-variant="think"]';
const BODY_SELECTOR = '[class*="thinkBody"]';
const TRAJECTORY_SELECTOR = '[aria-label="Trajectory toolbar"]';
const ENVIRONMENT_ID = 'dsh-matrix-environment';
const ACTIVE_CLASS = 'dsh-matrix-skin-active';
const INSTALLATION_KEY = Symbol.for('dsh-matrix-skin/installation');
const MATRIX_GLYPHS = '01{}[]()<>=+-*/\\|:;.,#@$%&ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const MATRIX_RENDER_LIMITS = Object.freeze({
  maxDevicePixelRatio: 1,
  pixelLimit: 2_500_000,
  dimensionLimit: 2560,
  framesPerSecond: 15,
  centerStart: 0.31,
  centerEnd: 0.69,
});
const MATRIX_FRAME_INTERVAL = 1000 / MATRIX_RENDER_LIMITS.framesPerSecond;

function normalizeThinkingText(value) {
  return typeof value === 'string' ? value : '';
}

function matrixActivitySeed(length, trailingCodeUnit = 0) {
  if (!Number.isFinite(length)) return 0;
  const size = Math.max(0, Math.floor(length));
  if (!size) return 0;
  const tail = Number.isFinite(trailingCodeUnit)
    ? Math.floor(trailingCodeUnit) & 0xffff
    : 0;
  return (Math.imul(size, 0x9e3779b1) ^ tail) >>> 0;
}

function matrixCharacterDataSeed(node) {
  const length = Number.isFinite(node?.length) ? Math.max(0, Math.floor(node.length)) : 0;
  if (!length || typeof node.substringData !== 'function') return 0;
  const trailing = node.substringData(length - 1, 1).charCodeAt(0);
  return matrixActivitySeed(length, trailing);
}

function isMatrixSideColumn(x, width) {
  if (!Number.isFinite(x)) return false;
  const safeWidth = Number.isFinite(width) ? Math.max(1, width) : 1;
  return x <= safeWidth * MATRIX_RENDER_LIMITS.centerStart
    || x >= safeWidth * MATRIX_RENDER_LIMITS.centerEnd;
}

function matrixCanvasScale(
  width,
  height,
  devicePixelRatio,
  pixelLimit = MATRIX_RENDER_LIMITS.pixelLimit,
  dimensionLimit = MATRIX_RENDER_LIMITS.dimensionLimit,
) {
  const cssWidth = Number.isFinite(width) ? Math.max(1, width) : 1;
  const cssHeight = Number.isFinite(height) ? Math.max(1, height) : 1;
  const requested = Number.isFinite(devicePixelRatio)
    ? Math.max(0.01, Math.min(devicePixelRatio, MATRIX_RENDER_LIMITS.maxDevicePixelRatio))
    : 1;
  const safePixelLimit = Number.isFinite(pixelLimit)
    ? Math.max(1, pixelLimit)
    : MATRIX_RENDER_LIMITS.pixelLimit;
  const safeDimensionLimit = Number.isFinite(dimensionLimit)
    ? Math.max(1, dimensionLimit)
    : MATRIX_RENDER_LIMITS.dimensionLimit;
  return Math.min(
    requested,
    Math.sqrt(safePixelLimit / (cssWidth * cssHeight)),
    safeDimensionLimit / cssWidth,
    safeDimensionLimit / cssHeight,
  );
}

function isAtScrollTail(element, threshold = 18) {
  return element.scrollHeight - element.scrollTop - element.clientHeight <= threshold;
}

function shouldFollowThinkingTail(manualState) {
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

function installEnvironment(initialTrajectoryVisible = false) {
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
  hudSource.textContent = 'LOCAL GLYPH CORE';
  const hudMetrics = document.createElement('span');
  hudMetrics.className = 'dsh-matrix-hud__metrics';
  const hudStatus = document.createElement('span');
  hudStatus.className = 'dsh-matrix-hud__status';
  hudStatus.textContent = 'AMBIENT SIGNAL';
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
  let staticFrame = 0;
  let lastFrame = 0;
  let width = 0;
  let height = 0;
  let ratio = 0;
  let fontSize = 16;
  let columns = [];
  let sequenceOffset = 0;
  let trajectoryVisible = Boolean(initialTrajectoryVisible);
  let suspended;
  let contextLost = false;

  const isContextUnavailable = () => (
    contextLost || context.isContextLost?.() === true
  );

  const setHudText = (element, value) => {
    if (element.textContent !== value) element.textContent = value;
  };
  const glyphAt = (index) => {
    const offset = ((index % MATRIX_GLYPHS.length) + MATRIX_GLYPHS.length) % MATRIX_GLYPHS.length;
    return MATRIX_GLYPHS.charAt(offset);
  };

  const draw = () => {
    if (suspended || isContextUnavailable() || width < 1 || height < 1) return;
    context.globalCompositeOperation = 'destination-out';
    context.fillStyle = 'rgba(0, 0, 0, .2)';
    context.fillRect(0, 0, width, height);
    context.globalCompositeOperation = 'source-over';
    context.font = `500 ${fontSize}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = 'rgba(98, 255, 151, .82)';

    for (const column of columns) {
      if (column.y < -fontSize || column.y > height + fontSize) continue;
      const head = Math.floor(column.y / fontSize);
      const glyphIndex = column.sourceOffset + head * column.sourceStep + sequenceOffset;
      context.fillText(glyphAt(glyphIndex), column.x, column.y);
    }
  };

  const animate = (time) => {
    if (suspended || reducedMotion.matches || isContextUnavailable()) {
      animationFrame = 0;
      return;
    }
    if (!lastFrame || time - lastFrame >= MATRIX_FRAME_INTERVAL) {
      const elapsed = lastFrame
        ? Math.min((time - lastFrame) / 1000, 0.1)
        : MATRIX_FRAME_INTERVAL / 1000;
      lastFrame = time;
      for (const column of columns) {
        column.y += column.speed * elapsed;
        if (column.y > height + fontSize) {
          column.y = -fontSize - ((column.sourceOffset * 17 + sequenceOffset) % Math.max(1, height * 0.45));
          column.sourceOffset = (column.sourceOffset + sequenceOffset + 17) % MATRIX_GLYPHS.length;
        }
      }
      draw();
    }
    animationFrame = requestAnimationFrame(animate);
  };

  const stopAnimation = () => {
    cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    lastFrame = 0;
  };
  const startAnimation = () => {
    stopAnimation();
    if (suspended || isContextUnavailable()) return;
    if (reducedMotion.matches) {
      draw();
      return;
    }
    animationFrame = requestAnimationFrame(animate);
  };

  const syncSuspended = () => {
    const next = document.hidden || trajectoryVisible;
    if (environment.dataset.suspended !== String(next)) {
      environment.dataset.suspended = String(next);
    }
    if (next === suspended) return;
    suspended = next;
    if (suspended) stopAnimation();
    else startAnimation();
  };
  const setTrajectoryVisible = (value) => {
    const next = Boolean(value);
    if (next === trajectoryVisible) return;
    trajectoryVisible = next;
    syncSuspended();
  };

  const resize = (force = false) => {
    resizeFrame = 0;
    if (isContextUnavailable()) return;
    const nextWidth = Math.max(1, window.innerWidth);
    const nextHeight = Math.max(1, window.innerHeight);
    const nextRatio = matrixCanvasScale(nextWidth, nextHeight, window.devicePixelRatio || 1);
    const nextFontSize = nextWidth < 640 ? 13 : 16;
    const backingWidth = Math.max(1, Math.floor(nextWidth * nextRatio));
    const backingHeight = Math.max(1, Math.floor(nextHeight * nextRatio));
    if (
      !force
      && nextWidth === width
      && nextHeight === height
      && nextRatio === ratio
      && backingWidth === canvas.width
      && backingHeight === canvas.height
    ) return;

    width = nextWidth;
    height = nextHeight;
    ratio = nextRatio;
    fontSize = nextFontSize;
    canvas.width = backingWidth;
    canvas.height = backingHeight;
    const cssWidth = `${width}px`;
    const cssHeight = `${height}px`;
    if (canvas.style.width !== cssWidth) canvas.style.width = cssWidth;
    if (canvas.style.height !== cssHeight) canvas.style.height = cssHeight;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);

    columns = [];
    const count = Math.ceil(width / fontSize);
    for (let index = 0; index < count; index += 1) {
      const x = index * fontSize + fontSize / 2;
      if (!isMatrixSideColumn(x, width)) continue;
      const phase = ((Math.imul(index + 1, 0x9e3779b1) >>> 0) / 0x1_0000_0000);
      columns.push({
        x,
        y: phase * height - height,
        speed: 38 + (index * 29) % 52,
        sourceOffset: (index * 7 + sequenceOffset) % MATRIX_GLYPHS.length,
        sourceStep: 1 + index % 3,
      });
    }
    setHudText(hudMetrics, `${columns.length} COLUMNS · ${MATRIX_RENDER_LIMITS.framesPerSecond} FPS`);
    draw();
  };
  const scheduleResize = () => {
    if (!resizeFrame) resizeFrame = requestAnimationFrame(() => resize());
  };
  const nudge = (seed) => {
    if (!Number.isFinite(seed)) return;
    sequenceOffset = (sequenceOffset + 1 + (Math.floor(seed) >>> 0)) % MATRIX_GLYPHS.length;
    if (reducedMotion.matches && !suspended && !staticFrame) {
      staticFrame = requestAnimationFrame(() => {
        staticFrame = 0;
        draw();
      });
    }
  };

  const handleVisibility = () => {
    syncSuspended();
    if (!document.hidden) scheduleResize();
  };
  const handleMotion = () => startAnimation();
  const handleContextLost = () => {
    // Canvas2D loss can follow GPU-memory pressure in a long-lived Chrome tab.
    // Unlike WebGL, cancelling this event prevents the automatic restoration,
    // so let the event proceed and pause until contextrestored is delivered.
    contextLost = true;
    stopAnimation();
  };
  const handleContextRestored = () => {
    contextLost = false;
    // Context loss resets the drawing transform and all other drawing state.
    // Rebuild the DPR-sized bitmap and redraw before resuming animation.
    resize(true);
    startAnimation();
  };
  window.addEventListener('resize', scheduleResize, { passive: true });
  document.addEventListener('visibilitychange', handleVisibility);
  reducedMotion.addEventListener?.('change', handleMotion);
  canvas.addEventListener('contextlost', handleContextLost);
  canvas.addEventListener('contextrestored', handleContextRestored);
  resize();
  syncSuspended();

  return {
    element: environment,
    nudge,
    setTrajectoryVisible,
    cleanup() {
      stopAnimation();
      cancelAnimationFrame(resizeFrame);
      cancelAnimationFrame(staticFrame);
      window.removeEventListener('resize', scheduleResize);
      document.removeEventListener('visibilitychange', handleVisibility);
      reducedMotion.removeEventListener?.('change', handleMotion);
      canvas.removeEventListener('contextlost', handleContextLost);
      canvas.removeEventListener('contextrestored', handleContextRestored);
      environment.remove();
      document.body.classList.remove(ACTIVE_CLASS);
    },
  };
}

function bindBody(body, runtime) {
  if (!runtime.bodyCleanups.has(body)) {
    if (body.dataset.matrixFollowBound !== 'true') body.dataset.matrixFollowBound = 'true';
    let scrollFrame = 0;
    const handleScroll = () => {
      if (scrollFrame) return;
      scrollFrame = requestAnimationFrame(() => {
        scrollFrame = 0;
        const next = isAtScrollTail(body) ? 'false' : 'true';
        if (body.dataset.matrixManual !== next) body.dataset.matrixManual = next;
      });
    };
    body.addEventListener('scroll', handleScroll, { passive: true });
    runtime.bodyCleanups.set(body, () => {
      cancelAnimationFrame(scrollFrame);
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
    if (row.classList.contains('dsh-matrix-thinking')) row.classList.remove('dsh-matrix-thinking');
    if (row.hasAttribute('data-matrix-thinking')) row.removeAttribute('data-matrix-thinking');
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
    if (shouldFollowThinkingTail(body.dataset.matrixManual) && !isAtScrollTail(body)) {
      body.scrollTop = body.scrollHeight;
    }
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

function findTrajectoryToolbar(root) {
  if (!(root instanceof Element)) return;
  if (root.matches(TRAJECTORY_SELECTOR)) return root;
  return root.querySelector(TRAJECTORY_SELECTOR) ?? undefined;
}

function mountInstallation() {
  const previous = document[INSTALLATION_KEY];
  previous?.dispose?.();

  // Reclaim orphaned artifacts left by older builds that predate the
  // document-scoped owner. A fresh generation must always own live handles.
  document.querySelector(`style[data-plugin-css="${STYLE_ID}"]`)?.remove();
  document.getElementById(ENVIRONMENT_ID)?.remove();
  document.body.classList.remove(ACTIVE_CLASS);

  const removeStyles = installStyles();
  let trajectoryToolbar = document.querySelector(TRAJECTORY_SELECTOR) ?? undefined;
  const environment = installEnvironment(Boolean(trajectoryToolbar));
  const runtime = {
    rows: new Set(),
    bodyAttributes: new Map(),
    bodyCleanups: new Map(),
    pendingRows: new Set(),
    revealFrame: 0,
  };
  scan(document, runtime);
  const observer = new MutationObserver((mutations) => {
    let activity = 0;
    let activityEvents = 0;
    let trajectoryChanged = false;
    const collectActivity = (node) => {
      const seed = matrixCharacterDataSeed(node);
      if (!seed) return;
      activityEvents += 1;
      activity = (activity + seed + Math.imul(activityEvents, 0x85ebca6b)) >>> 0;
    };

    for (const mutation of mutations) {
      if (
        environment?.element
        && (mutation.target === environment.element || environment.element.contains(mutation.target))
      ) continue;

      if (mutation.type === 'characterData') collectActivity(mutation.target);
      for (const node of mutation.addedNodes) {
        if (node.nodeType === 3) collectActivity(node);
        const element = node instanceof Element ? node : node.parentElement;
        const owner = element?.closest(ROW_SELECTOR);
        if (owner) scheduleReveal(owner, runtime);
        if (node instanceof Element) {
          scan(node, runtime, true);
          const toolbar = findTrajectoryToolbar(node);
          if (toolbar && toolbar !== trajectoryToolbar) {
            trajectoryToolbar = toolbar;
            trajectoryChanged = true;
          }
        }
      }
      for (const node of mutation.removedNodes) {
        if (node.nodeType === 3) collectActivity(node);
        if (
          trajectoryToolbar
          && (node === trajectoryToolbar || (node instanceof Element && node.contains(trajectoryToolbar)))
        ) {
          trajectoryToolbar = undefined;
          trajectoryChanged = true;
        }
        cleanupRemovedNode(node, runtime);
      }
      if (mutation.type === 'characterData' && mutation.target.parentElement) {
        const row = mutation.target.parentElement.closest(ROW_SELECTOR);
        if (row) scheduleReveal(row, runtime);
      }
      if (mutation.type === 'attributes' && mutation.target instanceof Element) {
        if (mutation.attributeName === 'aria-label') {
          if (mutation.target.matches(TRAJECTORY_SELECTOR)) {
            if (trajectoryToolbar !== mutation.target) {
              trajectoryToolbar = mutation.target;
              trajectoryChanged = true;
            }
          } else if (trajectoryToolbar === mutation.target) {
            trajectoryToolbar = undefined;
            trajectoryChanged = true;
          }
        }
        const row = mutation.target.matches(ROW_SELECTOR)
          ? mutation.target
          : mutation.target.closest(ROW_SELECTOR);
        if (row) scheduleReveal(row, runtime);
      }
    }
    if (trajectoryChanged) {
      if (!trajectoryToolbar?.isConnected) {
        trajectoryToolbar = document.querySelector(TRAJECTORY_SELECTOR) ?? undefined;
      }
      environment?.setTrajectoryVisible(Boolean(trajectoryToolbar));
    }
    if (activityEvents) environment?.nudge(activity);
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['aria-expanded', 'data-state', 'aria-label'],
  });

  let disposed = false;
  const installation = {
    dispose() {
      if (disposed) return;
      disposed = true;
      observer.disconnect();
      cancelAnimationFrame(runtime.revealFrame);
      runtime.pendingRows.clear();
      for (const body of [...runtime.bodyCleanups.keys()]) cleanupBody(body, runtime);
      for (const row of runtime.rows) {
        if (row.classList.contains('dsh-matrix-thinking')) row.classList.remove('dsh-matrix-thinking');
        if (row.hasAttribute('data-matrix-thinking')) row.removeAttribute('data-matrix-thinking');
      }
      environment?.cleanup();
      removeStyles?.();
      if (document[INSTALLATION_KEY] === installation) delete document[INSTALLATION_KEY];
    },
  };
  document[INSTALLATION_KEY] = installation;
  return installation;
}

function apply(ctx) {
  if (typeof document === 'undefined') return;
  ctx.effect(() => {
    let installation;
    const start = () => {
      if (!document.body || installation) return;
      installation = mountInstallation();
    };
    if (document.body) start();
    else document.addEventListener('DOMContentLoaded', start, { once: true });
    return () => {
      document.removeEventListener('DOMContentLoaded', start);
      installation?.dispose();
    };
  }, 'dsh-matrix-skin: cleanup');
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
body.dsh-matrix-skin-active [data-slot="conversation.input.dock"] > * {
  border-color: rgba(67,255,145,.2) !important;
  background: #030504 !important;
  box-shadow: inset 2px 0 rgba(67,255,145,.42), 0 10px 24px rgba(0,0,0,.28);
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
}
.dsh-matrix-environment[data-suspended="true"] .dsh-matrix-rain,
.dsh-matrix-environment[data-suspended="true"] .dsh-matrix-hud {
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
  }
  [data-matrix-thinking="visible"] { margin-block: 12px; border-radius: 11px; }
  [data-matrix-thinking="visible"]::before { padding-inline: 24px 10px; font-size: 8px; letter-spacing: .12em; }
  [data-matrix-thinking="visible"] [class*="thinkBody"] { max-height: 42vh; padding: 13px 12px 15px 20px; font-size: 13px; }
}
`;

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  }
});
