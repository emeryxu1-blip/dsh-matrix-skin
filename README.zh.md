# DSH Matrix Skin

[English](README.md) | 中文

> 把 DeepSeek Harness 变成专注、利落的黑色终端控制台。

**DSH Matrix Skin** 为 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) Web 界面带来鲜明的 Matrix 黑客风格，同时保持对话清晰、操作自然。平坦的近黑色界面、克制的霓虹信号、更清晰的 Think 面板，以及实时「神经代码雨」，让每个会话都像正在运行的系统，而不是普通聊天窗口。

代码雨不是循环播放的固定动画：它先读取一次有上限的本地快照，随后低成本复用 DSH 已经渲染的最新用户文本、助手回复、流式输出，以及提供商实际公开的 reasoning，不再在每次更新时扫描完整会话。对于全新的空白 DSH，插件会先使用 DeepSeek Harness 官方 README 作为初始文本源。

## 亮点

- 覆盖 Chat、Trajectory、侧边栏、工具和输入区的完整黑客风界面
- 使用 DSH 已显示文本的有界最新片段驱动 Matrix 代码雨
- 为 DSH 原生 Think 行提供清晰的终端阅读体验
- 支持减少动态效果，reasoning 仍然可选择、可复制、可访问
- 仅在本地处理，不包含遥测，也不会向外上传会话内容

> 插件只能显示模型提供商实际发送给 DSH 的 reasoning，无法恢复隐藏、脱敏或未公开的思维链。

## 环境要求

- DeepSeek Harness `0.1.0-rc.6`，或使用相同 Web client-plugin 合约的兼容版本
- DSH 的 `web` profile

## 安装并启用

```bash
dsh plugin --profile web add -w github:emeryxu1-blip/dsh-matrix-skin
dsh web
```

安装会自动启用皮肤。DSH Web 启动后，打开页面或强制刷新即可。仓库已经包含构建后的客户端文件，安装时不需要额外执行构建脚本。

## 使用

像平时一样使用 DSH 即可，无需配置插件。

1. 使用 `dsh web` 启动 DSH Web。
2. 选择或创建一个会话。
3. 正常聊天；代码雨会自动复用 DSH 已经显示的最新文本。
4. 展开 DSH 原生的 **Think** 行，即可使用终端风格的 reasoning 阅读区域。

如果会话确实是全新且空白的，代码雨会先使用 DSH 官方 README，直到会话中出现对话文本。

## 验证

确认插件已经安装：

```bash
dsh plugin --profile web why dsh-matrix-skin
```

确认插件层已经启用：

```bash
dsh --profile web --dump-config
```

在输出中查找 `dsh-matrix-skin` 层和 `matrix-skin` 条目。在 DSH Web 中打开 **Settings → Plugins → Plugin list**，搜索 `matrix-skin`，确认状态为 **Mounted, Enabled**。

## 暂时停用

把下面的条目追加到 `~/.dsh/profiles/web/cordis.patch.yml` 现有的顶层数组中；如果设置了 `DSH_HOME`，则使用 `$DSH_HOME/profiles/web/cordis.patch.yml`：

```yaml
- id: matrix-skin
  disabled: true
```

不要覆盖 profile patch 文件中的其他内容。重启 `dsh web` 并强制刷新浏览器后，插件列表会显示 `matrix-skin — Disabled`。

## 重新启用

删除上面的 `matrix-skin` 覆盖条目，重启 `dsh web`，然后强制刷新。插件会恢复 bundle 的默认启用状态。

## 更新或卸载

```bash
# 更新
dsh plugin --profile web update -w dsh-matrix-skin

# 卸载
dsh plugin --profile web remove -w dsh-matrix-skin
```

执行任一操作后，请重启 DSH Web 并强制刷新。卸载前请先删除临时的 `matrix-skin` 覆盖条目。

## 本地开发

```bash
git clone https://github.com/emeryxu1-blip/dsh-matrix-skin.git
cd dsh-matrix-skin
npm test
npm run check
npm run build
```

把当前 checkout 安装到 Web profile：

```bash
dsh plugin --profile web add -w "$PWD"
```

## 隐私

选择会话时，插件只读取一次最新记录的有界内存快照；如果初始窗口仍在加载，临时监听会在窗口打开后立即解除。后续代码雨只读取 DSH 最新已渲染元素中有上限的文本尾部（每个元素最多 1,200 个字符、64 个文本节点，每类最多两个元素），不会订阅或反复扫描完整的流式会话历史。派生的代码雨字符缓冲区只保留在内存中。

插件没有网络 client、遥测、持久化存储、凭据访问或模型请求拦截逻辑。

DSH Matrix Skin 是独立的社区插件，并非 DeepSeek 官方产品。

## 许可证

[MIT](LICENSE)
