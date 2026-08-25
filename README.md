# DSH Matrix Skin

English | [中文](README.zh.md)

> Turn DeepSeek Harness into a focused, black-terminal command deck.

**DSH Matrix Skin** gives the [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) Web UI a sharp Matrix-inspired identity without getting in the way of real work. Flat near-black surfaces, restrained neon signals, clearer Think panels, and live neural rain make every session feel like an active system rather than another generic chat window.

The rain stays intentionally lightweight: it starts from a small built-in local glyph pool, then uses live DOM text activity to cheaply seed and nudge its visual variation. It does not scan, copy, retain, or subscribe to DSH session history.

## Highlights

- Full-shell hacker aesthetic for Chat, Trajectory, the sidebar, tools, and composer
- Lightweight Matrix rain from a small built-in local glyph pool, seeded and nudged by live DOM text activity
- Readable terminal treatment for DSH's native Think rows
- Reduced-motion support and selectable, accessible reasoning text
- No session-history scanning, copying, retention, or subscription—and no telemetry or content upload

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
3. Chat as usual; live text activity already rendered on the page lightly varies the Matrix rain.
4. Expand a native **Think** row to use the terminal-style reasoning viewer.

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

The rain starts from a small built-in local glyph pool and reacts cheaply to live DOM text activity to seed or nudge visual variation. It does not scan, copy, retain, or subscribe to DSH session history. The plugin has no network client, telemetry, persistent storage, credential access, or model-request interception.

DSH Matrix Skin is an independent community plugin and is not an official DeepSeek product.

## License

[MIT](LICENSE)
