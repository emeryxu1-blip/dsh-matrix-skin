# DSH Matrix Skin

English | [中文](README.zh.md)

A neon-green Matrix / hacker skin for the **DeepSeek Harness (DSH) Web UI**. It turns the existing assistant **Think** row into a readable terminal panel, automatically opens it, keeps provider-supplied reasoning text visible while it streams, and adds a lightweight scrolling-code aesthetic.

> **Important boundary:** this plugin displays reasoning text that the model/provider actually sends to DSH. It cannot recover hidden chain-of-thought that a provider omits, redacts, or does not expose. It never invents or transforms the text.

## Features

- Matrix terminal styling scoped to reasoning rows (`data-variant="think"`).
- Automatically opens Think rows so the complete recorded reasoning block is visible.
- Streaming-tail follow while the viewer remains at the bottom; manual scrolling is respected.
- Preserves exact multiline, Unicode, and code-like text as ordinary selectable DOM text.
- Reduced-motion support and a bounded reasoning scrollport for long output.
- No provider credentials, prompts, or session content are sent anywhere by the plugin.

## Install

Requires DSH `0.1.0-rc.6` or a compatible release with the profile-bundle/client-plugin contract.

```bash
dsh plugin --profile web add github:emeryxu1-blip/dsh-matrix-skin
dsh web
```

After installation, refresh the existing DSH Web page. A GitHub install may require pnpm to approve a build script if your pnpm policy asks for it; this package has no native dependencies or required build scripts.

Remove it with:

```bash
dsh plugin --profile web remove dsh-matrix-skin
```

Then restart/refresh DSH Web.

## Development

```bash
git clone https://github.com/emeryxu1-blip/dsh-matrix-skin.git
cd dsh-matrix-skin
npm test
npm run check
npm run build
```

For a local profile install from the checkout:

```bash
dsh plugin --profile web add .
dsh web
```

The client HMR receiver only reloads rebuilt client bundles when DSH's Web watcher (`pnpm run dev:web` in the DeepSeek Harness checkout) is already running. Otherwise run `npm run build`, restart/rebuild the affected Web artifacts as appropriate, and refresh `http://127.0.0.1:3080`.

## Customization

The visual layer is in `src/client.js` (`MATRIX_CSS`). Fork the repository and adjust the CSS variables, terminal height, green/cyan palette, or animation. Keep selectors scoped under `[data-matrix-thinking="visible"]` so other DSH surfaces remain untouched. Users who need compact behavior can remove the plugin; the plugin intentionally defaults to visible reasoning.

## Accessibility and privacy

Reasoning remains text, not a canvas or an unreadable character animation. It can be selected, copied, searched by browser tools, and read by assistive technology. The panel uses `role="log"` and `aria-live="polite"` only for a running stream, and `prefers-reduced-motion: reduce` disables decorative animation. Focus/scroll interaction stops forced tail-follow when the reader moves away from the bottom.

The plugin is a local browser presentation layer. It has no network client, telemetry, credential access, or model-request interception.

## Compatibility and troubleshooting

- **No Matrix styling:** confirm the package is listed in the Web profile's `dsh.profile.bundles`, restart `dsh web`, and hard-refresh the browser.
- **No reasoning panel:** the selected provider may not send a reasoning block. DSH cannot display content that never arrived.
- **Install does not activate:** run `dsh plugin --profile web update dsh-matrix-skin`; inspect the composed profile with DSH's config dump options.
- **Older/newer DSH:** the plugin relies on the stable `data-variant="think"` marker and the `dsh.client` Web roster. If a future DSH release changes that public marker, pin a compatible release or open an issue.

## License

MIT. See [LICENSE](LICENSE).
