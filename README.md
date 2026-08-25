# DSH Matrix Skin

English | [中文](README.zh.md)

> Turn DeepSeek Harness into a focused, black-terminal command deck.

**DSH Matrix Skin** gives the [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) Web UI a sharp Matrix-inspired identity without getting in the way of real work. Flat near-black surfaces, restrained neon signals, clearer Think panels, and live neural rain make every session feel like an active system rather than another generic chat window.

The rain is not a canned loop: it starts from a bounded local snapshot, then cheaply reuses the newest user text, assistant replies, streaming output, and provider-exposed reasoning that DSH has already rendered. It no longer scans the full session on every update. A brand-new empty DSH starts with the official DeepSeek Harness README as its initial signal.

## Highlights

- Full-shell hacker aesthetic for Chat, Trajectory, the sidebar, tools, and composer
- Matrix rain powered by bounded tails of the newest text already displayed by DSH
- Readable terminal treatment for DSH's native Think rows
- Reduced-motion support and selectable, accessible reasoning text
- Local-only processing with no telemetry or session-content upload

> The plugin can display only reasoning that the model provider sends to DSH. It cannot recover hidden, redacted, or unavailable chain-of-thought.

## Requirements

- DeepSeek Harness `0.1.0-rc.6`, or a compatible release using the same Web client-plugin contract
- The `web` DSH profile

## Install and enable

```bash
dsh plugin --profile web add -w github:emeryxu1-blip/dsh-matrix-skin
dsh web
```

Installation enables the skin automatically. Open or hard-refresh the DSH Web UI after it starts. The repository ships its built client artifacts, so installation does not require a post-install build.

## Use

Use DSH normally—no plugin configuration is required.

1. Start DSH Web with `dsh web`.
2. Select or create a session.
3. Chat as usual; the Matrix feed updates from the newest text already displayed in DSH.
4. Expand a native **Think** row to use the terminal-style reasoning viewer.

If the session is truly new and empty, the rain uses the official DSH README until conversation text exists.

## Verify

Confirm the package is installed:

```bash
dsh plugin --profile web why dsh-matrix-skin
```

Confirm its bundle layer is active:

```bash
dsh --profile web --dump-config
```

Look for the `dsh-matrix-skin` layer and its `matrix-skin` entry. In DSH Web, open **Settings → Plugins → Plugin list**, search for `matrix-skin`, and check that it says **Mounted, Enabled**.

## Temporarily disable

Append this entry to the existing top-level array in `~/.dsh/profiles/web/cordis.patch.yml` (or `$DSH_HOME/profiles/web/cordis.patch.yml` when `DSH_HOME` is set):

```yaml
- id: matrix-skin
  disabled: true
```

Do not replace the rest of the profile patch file. Restart `dsh web` and hard-refresh the browser. The plugin inventory will show `matrix-skin — Disabled`.

## Re-enable

Delete the `matrix-skin` override above, restart `dsh web`, and hard-refresh. The bundle's default enabled state returns.

## Update or uninstall

```bash
# Update
dsh plugin --profile web update -w dsh-matrix-skin

# Uninstall
dsh plugin --profile web remove -w dsh-matrix-skin
```

Restart DSH Web and hard-refresh after either command. Remove any temporary `matrix-skin` override before uninstalling.

## Development

```bash
git clone https://github.com/emeryxu1-blip/dsh-matrix-skin.git
cd dsh-matrix-skin
npm test
npm run check
npm run build
```

Install the checkout into your Web profile with:

```bash
dsh plugin --profile web add -w "$PWD"
```

## Privacy

On session selection, the plugin takes one bounded in-memory snapshot of the newest records; if that window is still loading, its temporary listener detaches as soon as the initial window opens. Live rain updates then read only capped text tails from the newest rendered DSH elements (at most 1,200 characters across 64 text nodes per element and two elements per category). It does not subscribe to or rescan the full streaming session history. The derived rain buffer remains in memory only.

The plugin has no network client, telemetry, storage, credential access, or model-request interception.

DSH Matrix Skin is an independent community plugin and is not an official DeepSeek product.

## License

[MIT](LICENSE)
