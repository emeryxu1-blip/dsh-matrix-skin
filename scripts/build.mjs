import { mkdir, cp, readFile, writeFile } from 'node:fs/promises';
await mkdir('lib', { recursive: true });
await mkdir('styles', { recursive: true });
await cp('src/index.js', 'lib/index.js');
const source = await readFile('src/client.js', 'utf8');
const body = source
  .replace(/^export const /gm, 'const ')
  .replace(/^export function /gm, 'function ');
const client = `window.__ModuleLoader__.load({
  id: 'dsh-matrix-skin',
  factory: (require) => {
    const module = { exports: {} };
    const exports = module.exports;
    ${body}
    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  }
});
`;
await writeFile('lib/client.js', client);
await cp('src/client.js', 'styles/source.js');
await writeFile('styles/matrix.css', '/* CSS is bundled into lib/client.js to match DSH client-plugin loading. */\n');
