# DSH Matrix Skin

English | [中文](README.zh.md)

> Turn DeepSeek Harness into a focused, black-terminal command deck.

**DSH Matrix Skin** gives the [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) Desktop and Web UI a sharp Matrix-inspired identity without getting in the way of real work. Flat near-black surfaces, restrained neon signals, clearer Think panels, and live neural rain make every session feel like an active system rather than another generic chat window.

The rain is not a canned loop: it starts from a bounded local snapshot, then cheaply reuses the newest user text, assistant replies, streaming output, and provider-exposed reasoning that DSH has already rendered. It no longer scans the full session on every update. A brand-new empty DSH starts with the official DeepSeek Harness README as its initial signal.

## Highlights

- Full-shell hacker aesthetic for Chat, Trajectory, the sidebar, tools, and composer
- Matrix rain powered by bounded tails of the newest text already displayed by DSH
- Readable terminal treatment for DSH's native Think rows
- Reduced-motion support and selectable, accessible reasoning text
- Local-only processing with no telemetry or session-content upload

> The plugin can display only reasoning that the model provider sends to DSH. It cannot recover hidden, redacted, or unavailable chain-of-thought.

## Requirements

- DeepSeek Harness Desktop `0.2.2-rc.3` or the matching Web runtime
- The `desktop` profile for the official app, or `web` for browser use

Version `0.2.0` supports the Desktop Session Controller and its separate navigation store, the current CSS-module class format, and native message-bubble markers. The legacy `0.1.0-rc.6`, `0.1.1-rc.2`, and `0.1.5-rc.1` Web contracts remain supported. It borrows the selected session without retaining it or opening history, and never installs an obsolete client runtime.

## Provider and plugin independence

Matrix Skin changes presentation only. Model/provider dropdowns, Effort choices, defaults, request parameters, authentication, and retries remain owned by DSH and any separately installed provider plugin. Using the official DeepSeek API keeps DSH's native options; this skin contains no company endpoints, network checks, model catalogs, or gateway setup.

A separate gateway/retry plugin can be enabled, disabled, or removed independently. Matrix uses only the read-only session feed and its own `dsh-matrix-*` DOM markers, style element, and cleanup owner; it does not replace another plugin's controls or patch provider services.

## Install and enable

### Official Desktop app

1. Open **DeepSeek Harness** from Applications.
2. Choose **Plugins → Add plugin** and enter `github:emeryxu1-blip/dsh-matrix-skin`.
3. Install and enable the bundle, then restart the app if requested.

You can launch the app normally afterward; no Terminal command is needed. Desktop and Web share conversation data and settings, but keep plugin installations separate. Installing in `web` does not enable the skin in `desktop`.

For command-line installation, first launch Desktop once, fully quit it, and use the command supplied by Desktop's **Manage dsh Command…** menu:

```bash
dsh plugin --profile desktop add github:emeryxu1-blip/dsh-matrix-skin
```

Reopen Desktop from Applications. Use the Desktop-supplied command, since npm-installed DSH cannot modify the managed Desktop profile.

### Web profile

```bash
dsh plugin --profile web add -w github:emeryxu1-blip/dsh-matrix-skin
dsh web
```

Installation enables the skin automatically. Open or hard-refresh the DSH Web UI after it starts. The repository ships its built client artifacts, so installation does not require a post-install build.

## Use

Use DSH normally—no plugin configuration is required.

1. Open the Desktop app, or start DSH Web with `dsh web`.
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

Look for the `dsh-matrix-skin` layer and its `matrix-skin` entry. In current DSH, open **Plugins → Installed plugins** and confirm the bundle is enabled. **Settings → Built-in plugins** shows runtime inventory. For Desktop CLI checks, fully quit the app and substitute `--profile desktop` using the Desktop-supplied command; reopen the app afterward.

## Temporarily disable

In Desktop, open **Plugins**, find **dsh-matrix-skin**, and turn it off. Restart if requested. Turn it on there to re-enable it. The file-edit instructions below are for the Web profile.

Append this entry to the existing top-level array in `~/.dsh/profiles/web/cordis.patch.yml` (or `$DSH_HOME/profiles/web/cordis.patch.yml` when `DSH_HOME` is set):

```yaml
- id: matrix-skin
  disabled: true
```

Do not replace the rest of the profile patch file. Restart `dsh web` and hard-refresh the browser. The plugin inventory will show `matrix-skin — Disabled`.

## Re-enable

Delete the `matrix-skin` override above, restart `dsh web`, and hard-refresh. The bundle's default enabled state returns.

## Update or uninstall

In Desktop, manage the bundle through **Plugins**. Use **Add plugin** with its GitHub source again when installing a new GitHub revision; use the bundle's uninstall action to remove it. Restart if requested. The commands below manage the Web installation.

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
