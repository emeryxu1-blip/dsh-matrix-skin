# DSH Matrix Skin

[English](README.md) | 中文

这是一个面向 **DeepSeek Harness（DSH）Web 界面**的霓虹绿 Matrix / 黑客风皮肤插件。它会把现有的助手 **Think（思考）** 行变成可读的终端面板，自动展开面板，在模型输出过程中持续显示 DSH 实际收到的 reasoning 文本，并加入轻量的代码滚动视觉效果。

> **重要边界：** 本插件只能显示模型/提供商实际发送给 DSH 的 reasoning 文本。对于提供商没有发送、主动省略、脱敏或不公开的隐藏思维链，插件无法恢复；插件不会编造或改写文本。

## 功能

- 只针对 reasoning 行（`data-variant="think"`）应用 Matrix 终端样式。
- 自动展开 Think 行，让已记录的完整 reasoning 块默认可见。
- 当读者仍停留在底部时跟随流式尾部；用户手动滚动后尊重阅读位置。
- 保留原始多行、Unicode 和类似代码的内容，仍然是可选择的普通文本。
- 支持减少动态效果设置，并为超长输出提供有上限的滚动区域。
- 插件不会向外发送提供商密钥、提示词或会话内容。

## 安装

需要 DSH `0.1.0-rc.6`，或兼容 profile bundle / client plugin 合约的版本。

```bash
dsh plugin --profile web add github:emeryxu1-blip/dsh-matrix-skin
dsh web
```

安装后刷新现有的 DSH Web 页面。如果 GitHub 安装时 pnpm 根据安全策略要求批准构建脚本，请按 pnpm 提示操作；本包没有原生依赖，也不需要构建脚本。

卸载：

```bash
dsh plugin --profile web remove dsh-matrix-skin
```

然后重启或刷新 DSH Web。

## 本地开发

```bash
git clone https://github.com/emeryxu1-blip/dsh-matrix-skin.git
cd dsh-matrix-skin
npm test
npm run check
npm run build
```

从当前 checkout 安装到本地 Web profile：

```bash
dsh plugin --profile web add .
dsh web
```

只有在 DeepSeek Harness checkout 中已经运行 Web watcher（`pnpm run dev:web`）并且它确实重建 client bundle 时，DSH 的 client HMR receiver 才会自动加载修改。否则请执行 `npm run build`，按需重建受影响的 Web 构件，然后刷新 `http://127.0.0.1:3080`。

## 自定义

视觉样式位于 `src/client.js` 的 `MATRIX_CSS` 中。你可以 fork 仓库并修改 CSS 变量、终端高度、绿/青配色或动画。请保持选择器位于 `[data-matrix-thinking="visible"]` 之下，避免影响其他 DSH surface。若想恢复紧凑的默认 Think 展示，可移除本插件；本插件默认选择显示完整 reasoning。

## 无障碍与隐私

Reasoning 仍然是文本，而不是 canvas，也不会用不可读的随机字符替换原文。用户可以选择、复制，浏览器工具可以搜索，辅助技术也能读取。面板使用 `role="log"`；只有流式输出期间使用 `aria-live="polite"`。`prefers-reduced-motion: reduce` 会关闭装饰性动画。当读者离开底部后，焦点/滚动交互会停止强制跟随尾部。

本插件是本地浏览器展示层，没有网络 client、遥测、凭据访问或模型请求拦截逻辑。

## 兼容性与排障

- **没有 Matrix 样式：** 确认包已经出现在 Web profile 的 `dsh.profile.bundles` 中，重启 `dsh web` 并强制刷新浏览器。
- **没有 reasoning 面板：** 当前 provider 可能没有发送 reasoning block；DSH 无法显示从未到达的内容。
- **安装后没有激活：** 执行 `dsh plugin --profile web update dsh-matrix-skin`，并使用 DSH 的 config dump 选项检查组合后的 profile。
- **DSH 版本过旧或过新：** 本插件依赖稳定的 `data-variant="think"` 标记和 `dsh.client` Web roster。若未来版本改变该公共标记，请固定兼容版本或提交 issue。

## 许可证

MIT，详见 [LICENSE](LICENSE)。
