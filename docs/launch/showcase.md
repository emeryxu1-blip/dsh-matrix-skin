**Unofficial community project, independently developed and maintained.**

**Session-powered Matrix code rain, with room to read.** Matrix Skin **0.3.1** restores the original rain renderer's motion, color, and intensity across normal DeepSeek Harness use: conversations, typing, navigation, menus, and settings. Content masks keep native text and controls clear.

Project: https://github.com/emeryxu1-blip/dsh-matrix-skin

![Animated Matrix code rain in the real DSH UI with fictional demo content](https://raw.githubusercontent.com/emeryxu1-blip/dsh-matrix-skin/v0.3.1/docs/images/matrix-rain.gif)

## What it does

- Brings back the original renderer's falling characters, trails, glow, motion, color, and intensity, powered by a bounded local text feed from your selected session.
- Keeps the rain running while you type, open menus, navigate, or use settings. Content masks protect text and controls while animation continues around them.
- Preserves native fonts, font-size preferences, layouts, reasoning disclosures, code highlighting, diffs, and warning/error colors.
- Supports dark and native light appearances. Reduced motion and forced colors hide decorative animation; background pages pause it.
- Contains no plugin telemetry, credential access, session-content upload, or model-request interception.

![A readable DSH conversation with Matrix Skin enabled](https://raw.githubusercontent.com/emeryxu1-blip/dsh-matrix-skin/v0.3.1/docs/images/matrix-chat.png)

![Native appearance settings with Matrix Skin enabled](https://raw.githubusercontent.com/emeryxu1-blip/dsh-matrix-skin/v0.3.1/docs/images/matrix-settings.png)

[Watch the 24.5-second code-rain recording](https://github.com/emeryxu1-blip/dsh-matrix-skin/releases/download/v0.3.1/matrix-skin-demo.mp4) · [0.3.1 release](https://github.com/emeryxu1-blip/dsh-matrix-skin/releases/tag/v0.3.1) · [Capture details](https://github.com/emeryxu1-blip/dsh-matrix-skin/blob/v0.3.1/docs/images/capture-provenance.json)

## Install in Desktop

1. Open DeepSeek Harness.
2. Choose **Plugins → Add plugin** and paste `github:emeryxu1-blip/dsh-matrix-skin#v0.3.1`.
3. Install and enable it, then restart if requested. Launch the app normally afterward.

Desktop and Web use separate plugin installations. You can disable or uninstall the skin through Plugins. Web installation is documented in the repository README.

All **40 automated tests** pass. Verified in the installed official **DSH Desktop 0.2.2-rc.3 / macOS** app and the matching Web runtime. The 8-second animated preview and 24.5-second recording show code rain in the actual Web UI, captured in an isolated demo profile with fictional content. Public captures do not depict native desktop-window chrome.

If you try it, please share your DSH version, OS, and any surface where rain, text, or controls need adjustment.

## 中文

**非官方社区项目，由社区成员独立开发和维护。**

**让会话化作 Matrix 代码雨，也留出清楚阅读的空间。** Matrix Skin **0.3.1** 恢复原有代码雨渲染器的动效、颜色与强度，让它在聊天、输入、导航、菜单和设置等日常使用中持续播放。通过内容遮罩保护文字与控件，并保留原生字体、布局、代码高亮和状态颜色。

深色和原生浅色外观中都保留代码雨；系统要求减少动态效果或使用强制颜色时，会隐藏装饰动画，页面进入后台时暂停。

安装：打开桌面应用 → **Plugins → Add plugin** → 粘贴 `github:emeryxu1-blip/dsh-matrix-skin#v0.3.1` → 安装并启用，按提示重启。之后正常打开桌面应用即可，无需终端启动。Desktop 与 Web 各自管理插件安装。

插件不含遥测、凭据访问、会话内容上传或模型请求拦截逻辑。已在 macOS 上安装运行的官方 Desktop **0.2.2-rc.3** 及对应 Web 运行时中验证；公开界面素材来自隔离演示 profile 中的真实 Web 界面，内容均为虚构演示。欢迎反馈 DSH 版本、操作系统，以及代码雨、文字或控件需要调整的位置。

[观看 24.5 秒代码雨实录](https://github.com/emeryxu1-blip/dsh-matrix-skin/releases/download/v0.3.1/matrix-skin-demo.mp4)；页面顶部为同一真实界面的 8 秒动态预览。
