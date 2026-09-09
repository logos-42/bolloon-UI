# Bolloon 安装/下载页 · 设计计划

> 状态: DRAFT · 依赖 `design.md`(bolloon-UI 根目录, 数字展馆 brief) + Bolloon 官方色令牌(`bolloon/src/web/style.css`) · 2026-09-09
>
> **本文件只是"设计计划", 不是 UI 实现。批准前先审方向。**

---

## 一、任务重述

在 `bolloon-UI` 项目中, 为 Bolloon(P2P AI 智能体平台)构建**安装/下载落地页**。

要求:
1. 遵循 `design.md` 的"数字艺术展馆"质量线: 不做 SaaS/模板/落地页套路(无 hero 大按钮区、无三列卡片、无圆角卡片、无渐变 blob、无通用 navbar/footer), 走**不对称、大量留白、编辑式排版、展馆感**。
2. 色系从 Bolloon 品牌 + 书法作品合成(见下)。
3. "动态前端": 自动探测 OS 显示对应安装命令 + 滚动展馆感动效 + live 版本号。

---

## 二、已核实的真实素材(勿臆造)

| 项 | 值 | 来源 |
|---|---|---|
| npm 包 | `@bolloon/bolloon-agent` 当前 v**0.4.20** | `bolloon/package.json` |
| GitHub repo | `logos-42/bolloon` | `bolloon/package.json` |
| macOS/Linux 一键 | `curl -fsSL https://raw.githubusercontent.com/logos-42/bolloon/master/scripts/install.sh \| sh` | `bolloon/README.md`, `scripts/install.sh` |
| Windows 一键 | `iwr -useb https://raw.githubusercontent.com/logos-42/bolloon/master/scripts/install.ps1 \| iex` | `bolloon/README.md` |
| npm 安装 | `npm install -g @bolloon/bolloon-agent` | `bolloon/README.md` |
| 前提 | Node.js ≥ 18 | `bolloon/README.md` |
| 启动 | `bolloon`(CLI) / `bolloon --web`(Web UI) / `bolloon --help` | `bolloon/README.md` |
| LLM key | `OPENAI_API_KEY` / `DEEPSEEK_API_KEY` / `ANTHROPIC_API_KEY`; 可选 `BOLLOON_LLM_PROVIDER` | `bolloon/README.md` |
| 能力 | AI 对话 / P2P 网络(DHT) / 文档处理(DID 签名) / 工具调用 / 自我改进 | `bolloon/README.md` |
| 书法作品 | 8 张 3:4 竖图, 毛笔书法汉字, 落在暖米白纸上 | `bolloon-UI/fig/thumbnail_*.jpg`; 已人工看过: `thumbnail_219`=橘红"风", `thumbnail_950`=品红"家" |

> 注意: `bolloon/src/web/design.md` 是**另一个** design.md, 内容是"工程化 AI 前端生成"Prompt 模板(监控看板, Ant Design Pro, `#d5ff18`)——**与本任务无关**, 勿混用。本设计依据的是 `bolloon-UI` 根目录的展览馆 brief。

---

## 三、色系合成(纸+炭黑为骨, Bolloon lime 为唯一强调)

取 design.md"从作品提取色系(暖纸/象牙/炭黑/米灰) + 偶发强色"原则, 与 Bolloon 令牌合成。满页不用通体白, 用"纸"与"黑"的场景切换制造展馆纵深。

### 色彩令牌(`:root`)

| 用途 | 变量 | 值 | 说明 |
|---|---|---|---|
| 主底(纸) | `--paper` | `#f2efe6` | 暖米白纸, 主背景 |
| 衬底(黑) | `--ink-bg` | `#1a1a18` | Bolloon 官方 `--bg`, 局部深景段 |
| 侧栏/次面 | `--ink-bg-2` | `#222220` | Bolloon 官方 `--bg-sidebar` |
| 主文字(墨) | `--ink` | `#23211c` | 纸上的主文字 |
| 次文字 | `--ink-2` | `#6b675c` | 展签/说明 |
| 弱文字 | `--ink-3` | `#97917f` | 极小标注 |
| **强调(lime)** | `--lime` | `#c4d640` | **Bolloon 品牌色, 全页唯一锐色** |
| 强调 hover | `--lime-hover` | `#d4e650` | |
| 强调深 | `--lime-deep` | `#8a9430` | |
| 强调光 | `--lime-glow` | `rgba(196,214,64,.28)` | |
| 警戒 | `--warn` | `#ce4d4f` | 少量错误提示 |
| 正常 | `--ok` | `#52c41a` | 少量成功提示 |
| 边框/细分隔 | `--hairline` | `rgba(35,33,28,.14)` | 细发丝线, 无阴影 |

**禁用项**: 卡片阴影、渐变 blob、圆角 > 2px、通体纯白、三列等分卡片、紫色/虹彩渐变。

### 字体(展示衬线 + 正文无衬线 + 命令 mono)

| 角色 | 字体 | 备注 |
|---|---|---|
| 展示/标题 | `Noto Serif SC`, `Songti SC`, `Georgia`, serif | 大字、细字重、宽字距——呼应毛笔 |
| 正文/展签 | `Noto Sans SC`, `-apple-system`, sans-serif | 克制 |
| 命令/版本/mono | `JetBrains Mono`, `SF Mono`, monospace | 技术锚点 |

---

## 四、页面结构(被发现的展馆, 非导航模板)

单页纵向展览流, 视口渐次展开, 无显眼导航。

1. **序厅 Intro** — 大留白 + 一件书法作品 off-grid 偏置; 一行导言"P2P AI 智能体, 在你的设备上生长"; 右上角落极小版本号 `v0.4.20`(live, 前端调 `api.github.com/repos/logos-42/bolloon/releases/latest`).
2. **作品墙 Works** — 8 件书法错落/拼贴式排列(非网格); 每件像展品带极小标题+尺寸; Bolloon 能力作为"展签"一一对位(🤖 AI 对话 / 🌐 P2P 网络 / 📄 文档处理 DID 签名 / 🔧 工具调用 / 🔄 自我改进).
3. **安装 Installation** — 核心。自动探测 OS 显示对应命令块; macOS/Linux/Windows 标签切换; `npm` 方式 + 一键脚本并列; `复制` 按钮。技术铭牌感, 非卡片。
4. **启动 Quick Start** — `bolloon` / `bolloon --web` / `bolloon --help`; 附注 Node≥18 + LLM key.
5. **尾声 About** — 克制一段文字 + GitHub + MIT 声明。非通用 footer。

---

## 五、动效与交互(慢、细、有意)

- 滚动 = 穿展馆: 作品淡入 + 蒙版揭示 + 轻微视差, 不弹跳。
- hover: 展签浮现 + 作品微幅缩放/位移(触感、克制)。
- 安装命令块: 进入视口逐字符"写"出; OS 探测用 `navigator.platform`; 无 JS 时 degrade 到三块并排。
- `prefers-reduced-motion` 全降级静态。
- 禁用: 满天粒子、非必要 3D、每元素都动、弹跳。

---

## 六、落地建议(默认 = 推荐)

**纯静态**: `index.html` + `style.css` + `app.js`, 零构建、零依赖, 可直接 GitPage / CF Pages 部署。作品用 `fig/` 现有 8 图。

live 版本: 前端 fetch GitHub latest release API(有 CORS 兜底失败则显示本地常量 `0.4.20`)。

---

## 七、待用户拍板的分叉(默认已取推荐)

1. **色系**: ✅ 纸+炭黑为骨 / Bolloon lime 唯一强调(推荐)。备选: 严格 Bolloon 满版炭黑+lime / 纯纸墨不用 lime。
2. **书法角色**: ✅ 主视觉"展品"与能力一一对位(推荐)。备选: 仅氛围/边饰 / 不用。
3. **技术栈**: ✅ 纯静态(推荐)。备选: React+Vite / 先出设计稿再定。

> 如对默认有异议, 在此文件标注后我再改; 否则下一步按此计划构建 `index.html`。
