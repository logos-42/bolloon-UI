# bolloon-UI — Bolloon 安装/下载落地页

Bolloon（帛龙）的官方安装 / 下载落地页。一个本地优先、P2P 协作的 AI 智能体平台。

这是**纯静态站点**：`index.html`（产品）`install.html`（安装）`docs.html`（文档） + `style.css` + `app.js`，零构建、零依赖，可直部署到 GitHub Pages / Cloudflare Pages。设计语言取自 Bolloon 官方色令牌（炭黑 `#1a1a18` + lime `#c4d640`），编辑式展览排版；产品页含八帧书法作品墙。

> 主仓库：[logos-42/bolloon](https://github.com/logos-42/bolloon)

---

## 安装

### macOS / Linux

```bash
# 一键脚本
curl -fsSL https://raw.githubusercontent.com/logos-42/bolloon/master/scripts/install.sh | sh

# 或 npm（需 Node.js ≥ 18）
npm install -g @bolloon/bolloon-agent
```

### Windows

```powershell
# 一键脚本（以管理员身份运行 PowerShell）
iwr -useb https://raw.githubusercontent.com/logos-42/bolloon/master/scripts/install.ps1 | iex

# 或 npm
npm install -g @bolloon/bolloon-agent
```

## 快速启动

```bash
bolloon            # CLI 交互模式（默认）
bolloon --web      # Web UI 模式（浏览器）
bolloon --help     # 查看所有命令
```

首次启动自动配置 LLM（需 `OPENAI_API_KEY` / `DEEPSEEK_API_KEY` / `ANTHROPIC_API_KEY`，可选 `BOLLOON_LLM_PROVIDER`）。

## 本地开发

```bash
python3 -m http.server 8899
# 打开 http://localhost:8899
```

---

## English

The official install / download landing page for **Bolloon** — a local-first, P2P-collaborative AI agent platform.

A pure static site: `index.html` + `style.css` + `app.js`. Zero build, zero deps, deployable directly to GitHub Pages / Cloudflare Pages. Visual language derives from Bolloon's official color tokens (charcoal `#1a1a18` + lime `#c4d640`) with an editorial, exhibition-like layout.

### Install

**macOS / Linux**

```bash
curl -fsSL https://raw.githubusercontent.com/logos-42/bolloon/master/scripts/install.sh | sh
# or npm (Node.js >= 18)
npm install -g @bolloon/bolloon-agent
```

**Windows**

```powershell
# One-liner script (run PowerShell as Administrator)
iwr -useb https://raw.githubusercontent.com/logos-42/bolloon/master/scripts/install.ps1 | iex
# or npm
npm install -g @bolloon/bolloon-agent
```

### Quick Start

```bash
bolloon          # CLI interactive mode
bolloon --web    # Web UI mode
bolloon --help   # All commands
```

Requires Node.js ≥ 18 and an LLM API key.

### Local dev

```bash
python3 -m http.server 8899
# open http://localhost:8899
```

---

## License

[MIT](./LICENSE)

> 主仓库 / Main repo: [logos-42/bolloon](https://github.com/logos-42/bolloon) · 中文文档 / Chinese docs: [bolloon/README.md](https://github.com/logos-42/bolloon/blob/master/README.md)
