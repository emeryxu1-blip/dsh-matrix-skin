export const inject = ['@deepseek-ai/dsh-client-runtime', '@deepseek-ai/dsh-client-ui-conversation'];

const STYLE_ID = 'dsh-matrix-skin/styles';
const ROW_SELECTOR = '[data-variant="think"]';

export function normalizeThinkingText(value) {
  return typeof value === 'string' ? value : '';
}

export function isAtScrollTail(element, threshold = 18) {
  return element.scrollHeight - element.scrollTop - element.clientHeight <= threshold;
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

function reveal(row) {
  if (!(row instanceof Element) || row.dataset.matrixUserCollapsed === 'true') return;
  row.classList.add('dsh-matrix-thinking');
  row.setAttribute('data-matrix-thinking', 'visible');
  const control = row.querySelector('button[aria-expanded], [role="button"][aria-expanded]');
  if (control instanceof HTMLElement && !control.dataset.matrixInteractionBound) {
    control.dataset.matrixInteractionBound = 'true';
    control.addEventListener('click', () => {
      if (control.dataset.matrixPluginOpening !== 'true' && control.getAttribute('aria-expanded') === 'true') {
        row.dataset.matrixUserCollapsed = 'true';
      }
    });
  }
  if (control instanceof HTMLElement && control.getAttribute('aria-expanded') === 'false') {
    control.dataset.matrixPluginOpening = 'true';
    control.click();
    queueMicrotask(() => delete control.dataset.matrixPluginOpening);
  }
  const body = row.querySelector('[class*="thinkBody"]');
  if (body instanceof HTMLElement) {
    if (!body.dataset.matrixFollowBound) {
      body.dataset.matrixFollowBound = 'true';
      body.addEventListener('scroll', () => {
        body.dataset.matrixManual = isAtScrollTail(body) ? 'false' : 'true';
      }, { passive: true });
    }
    if (body.dataset.matrixManual !== 'true' && isAtScrollTail(body)) body.scrollTop = body.scrollHeight;
  }
}

function scan(root = document) {
  if (!(root instanceof Document || root instanceof Element)) return;
  for (const row of root.querySelectorAll(ROW_SELECTOR)) reveal(row);
}

export function apply(ctx) {
  if (typeof document === 'undefined') return;
  const start = () => {
    if (!document.body) return;
    const removeStyles = installStyles();
    scan();
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node instanceof Element) {
            if (node.matches(ROW_SELECTOR)) reveal(node);
            scan(node);
          }
        }
        if (mutation.type === 'characterData' && mutation.target.parentElement) {
          const row = mutation.target.parentElement.closest(ROW_SELECTOR);
          if (row) reveal(row);
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['aria-expanded', 'data-state'] });
    ctx.effect(() => () => {
      observer.disconnect();
      removeStyles?.();
    }, 'dsh-matrix-skin: cleanup');
  };
  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start, { once: true });
}

const MATRIX_CSS = String.raw`
:root {
  --dsh-matrix-bg: #020a07;
  --dsh-matrix-panel: #06150e;
  --dsh-matrix-green: #39ff88;
  --dsh-matrix-dim: #79c99a;
  --dsh-matrix-cyan: #66f7d2;
  --dsh-matrix-border: rgba(57, 255, 136, .28);
}
[data-matrix-thinking="visible"] {
  position: relative;
  margin-block: 14px;
  min-height: 100px;
  isolation: isolate;
  color: var(--dsh-matrix-dim);
  border: 1px solid var(--dsh-matrix-border);
  border-radius: 8px;
  background: linear-gradient(135deg, rgba(2, 10, 7, .96), rgba(6, 21, 14, .88));
  box-shadow: 0 0 0 1px rgba(57,255,136,.06), 0 0 24px rgba(57,255,136,.08);
  overflow: hidden;
}
[data-matrix-thinking="visible"]::before {
  content: "MATRIX // THINK STREAM // LIVE";
  display: block;
  padding: 5px 12px;
  color: rgba(57,255,136,.58);
  border-bottom: 1px solid var(--dsh-matrix-border);
  background: rgba(57,255,136,.045);
  font: 10px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace;
  letter-spacing: .14em;
  white-space: nowrap;
  overflow: hidden;
  animation: dsh-matrix-glitch 7s steps(2,end) infinite;
}
[data-matrix-thinking="visible"] [class*="thinkBody"] {
  display: block !important;
  max-height: min(48vh, 560px);
  overflow: auto;
  box-sizing: border-box;
  padding: 12px 16px 14px 22px;
  color: var(--dsh-matrix-green);
  background: repeating-linear-gradient(0deg, rgba(57,255,136,.025) 0 1px, transparent 1px 4px), var(--dsh-matrix-bg);
  font: 13px/1.65 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  text-shadow: 0 0 7px rgba(57,255,136,.42);
  white-space: pre-wrap;
  scrollbar-color: var(--dsh-matrix-green) var(--dsh-matrix-bg);
}
[data-matrix-thinking="visible"] [class*="thinkBody"]::before { content: "> "; color: var(--dsh-matrix-cyan); }
[data-matrix-thinking="visible"] [class*="summary"],
[data-matrix-thinking="visible"] [class*="title"] { color: var(--dsh-matrix-green); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
[data-matrix-thinking="visible"] [class*="summary"] { max-width: 100%; }
[data-matrix-thinking="visible"][data-state="running"] [class*="thinkBody"] { border-left: 2px solid var(--dsh-matrix-green); animation: dsh-matrix-pulse 1.8s ease-in-out infinite; }
@keyframes dsh-matrix-pulse { 50% { box-shadow: inset 0 0 18px rgba(57,255,136,.09); } }
@keyframes dsh-matrix-glitch { 0%, 92%, 100% { opacity: .7; } 94% { opacity: .25; transform: translateX(3px); } }
@media (prefers-reduced-motion: reduce) { [data-matrix-thinking="visible"] [class*="thinkBody"], [data-matrix-thinking="visible"]::before { animation: none; } }
@media (max-width: 640px) { [data-matrix-thinking="visible"] [class*="thinkBody"] { max-height: 42vh; padding-inline: 12px; font-size: 12px; } }
`;
