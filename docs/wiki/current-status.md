---
title: bolloon-UI 当前状态
source: session
created: 2026-09-09
last_confirmed: 2026-09-22
audience: self
stage: draft
tags: [status, privacy-policy-page, footer-compliance, icons-store-specs, on-chain-activity, scoped-counts]
status: current
---

## 最近更新

- (2026-09-22) **链上活动区去假标签 + 口径行上线（缓存破坏 v=21）**：① 删掉**现在为假**的文案 —— `gateway.html`/`index.html` 共 4 处 `公开观察入口尚未接入`（unavailable 态标签 + 提示首句）+ index 顶部注释 → 改为真话「快照暂时读不到」/「快照这次没读到 — 本站的数据源是签名快照 network-pulse.json」（入口**早已接入**并在真供给 25 行链上活动）。② 新增**口径行** `[data-pulse-activity-totals]`（网关页表格下方 + 首页序栏）：把「上方 任务/已完成/已验证/签名（24h 脉冲事件口径）」与「链上索引 N 行」的关系、以及这批行属于哪条链（31337 本机隔离开发链 · **不是公网活动**）写在明面上；数据取自快照 `activity_totals`/`chain_id_scope`/`totals_scope`，老快照缺这三块 → 整行隐藏。③ `scripts/verify-site.mjs` 加防复发断言：[6d′] 0 任务与 25 行同屏必须有解释、[6e] 同源**真快照**当场验、[11b] 7 页原始 HTML + 渲染文本 + 导航都不得出现"尚未接入"类虚假文案。④ 真跑：本机 **226/0**、部署 `f035d62f.bolloon.pages.dev`、真域名 bolloon.cn **226/0**（`verify-privacy.mjs` 回归 38/0）；线上 dump-dom 实文本：25 行 + 口径行逐字在、「尚未接入」0 次。**未做**：GitHub Pages 通道（需 push，按约定未 push）。
- (2026-09-19) **Android 0.4.28 发布（品牌迁移后首个 APK）**：`com.hibs.bolloon` 新包名下首个正式签名包 `bolloon-0.4.28.apk`（19,915,587 B / sha256 `d339065a6d6fe397…` / versionCode 28 · versionName 0.4.28 / DN CN=Bolloon），走 **full flavor**（官网直装版，保留无障碍 + Shizuku）。发布三件套：GitHub Release `android-v0.4.28-signed`（asset digest 与本地一致）、同域镜像 `bolloon.cn/dl/bolloon-0.4.28.apk`（200 / Content-Type apk / Length 19,915,587）、`install.html` Android 栏目（直链 + 19.0 MB + 版本 + sha + 校验和/备用下载链接）。CF Pages 部署 `46f89480.bolloon.pages.dev`；iOS 入口未动（仍 `ios-v0.4.24-unsigned`）。
- (2026-09-16) **已上线 bolloon.cn + 线上验收全绿**：CF Pages direct-upload 部署 **`390e5d0e.bolloon.pages.dev`**（上传 17 文件 / 129 去重，2.4 s）。自定义域立刻生效（`privacy.html` 200 / 20,047 B / 标题「隐私政策 — bolloon」；响应头 `max-age=0, must-revalidate` → **不需要 purge**；`style.css?v=15` 是新 URL 天然绕过缓存）。线上真浏览器验收：`verify-privacy.mjs https://bolloon.cn` **38/38**、`verify-site.mjs https://bolloon.cn` **23/23**；APK 同域镜像 200 / 19,193,025 B 未受影响。顺带把 `deploy-pages.py` 的 `EXCLUDE_DIRS` 加了 **`.kilo`**（本地 git worktree 副本 6.1 MB，旧部署一直公开着 `https://bolloon.cn/.kilo/`=200；已停止上传并实测该路径现在回首页兜底）。**仍未做**：GitHub Pages 通道（需 push 才构建，按约定未 push）；zone 缓存 purge（wrangler OAuth token 只到 `zone (read)`，无 Cache Purge 权限 —— 本次实测不需要）。
- (2026-09-16) **隐私政策页 privacy.html（应用市场表单要填的那个链接）**：新增 `privacy.html` + 生成器 `scripts/gen-privacy-page.py`（单一来源、可复跑，避免与 App 内摘要/商店表单三处漂移）：七章 + 三张表（数据清单 / 权限 / 第三方服务），中英双语走站点既有 `data-zh/data-en` 机制；事实逐条对着代码写完（无账号体系 · 无统计/崩溃 SDK · 蓝牙 `neverForLocation` · 位置 `maxSdkVersion=30` · 相机不申请 CAMERA · 无障碍与 Shizuku 仅官网直装版 · 境外服务披露 · 注销即时生效 + 最长 7 个工作日 + 链上不可删）。**5 页页脚统一加「隐私政策」链接 + 备案号占位注释块**（备案完成后把注释块展开即公示，链接 beian.miit.gov.cn）；`style.css` 加政策页样式并全站缓存破坏 **v=14 → v=15**。**新增零依赖验收脚本 `scripts/verify-privacy.mjs`（真 Chrome CDP）本地 38/38**（14 个必填要素 + 3 张表 + 中英双语计数一致 + EN 切换真生效 + 5 页页脚链接与备案锚点 + 站内链接全可达 + 无 JS 报错），站点回归 `verify-site.mjs` **23/23** 无退化。
- (2026-09-16) **商店/备案用图标四件套**（`icons/` 与 bolloon 仓 `src/web/icons/` 双目录镜像）：从品牌 master `icon.png`(1254×1254 满幅无圆角) LANCZOS 下采样出 **`icon-1024x1024.png`**(607.4 KB, md5 `779dd53b8e54f83710cceaa029fa5475`) / **`icon-1024x1024.webp`**(15.9 KB) / **`icon-216x216.png`**(30.6 KB) / **`icon-216x216.webp`**(2.6 KB) —— 对齐商店规格（正方形 · 216 或 1024 · PNG ≤3 MB · WEBP ≤100 KB · 无 alpha 满幅），216 档肉眼复核清晰无锯齿。**顺带发现真实不一致**: `ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png`(1024×1024) 与品牌 master 不同源（sha256 `a3d1d11e…` vs `02098983…`）→ 已在 bolloon 仓重出为同源（见该仓 wiki 2026-09-16）。
- (2026-09-15) **入网 skill 文档 v1.2.1 + iOS 0.4.24 包**（`bolloon-gateway-join.md` / `skill.html` / `install.html`）：① 新增 **§0.1 路径 A′「手机端已内置」**（iOS/Android/PWA 点「一键入网」即由**手机本机内核**真执行：读说明校验 frontmatter → 本机 DID → 服务登记[电脑端可达则真进网络 registry，不可达则如实标注] → P2P 公告[无对端如实标"连上即生效"] → 落盘 `bolloon_gateway_join`），标题改「三条执行路径」；② **§6 被委派语义回写为真执行**——严格能力匹配（无匹配如实回 `delegatedTo:null`，**不**兜底挑 `local.agents[0]`）、被委派端真跑 agent 且 `resultCid` 是真 CID（不再 `mock-<ts>`）、超时即 504 不假成功；③ 安装页 iOS 入口改指向新包 **`ios-v0.4.24-unsigned`**（`Bolloon-unsigned.ipa`，10,090,692 B / 9.6 MB）；④ 缓存破坏 v=13 → **v=14**；⑤ `scripts/verify-site.mjs` 断言同步（1.2.1 + 线上正文须含「路径 A′」）。
- (2026-09-15) **入网 skill 文档 v1.2.0 同步**（`bolloon-gateway-join.md` + `skill.html`）：新增 §0.1 两条执行路径（本机是 bolloon 就调工具 `join_global_gateway`，别再照抄 TS 伪码）、§7 重写为「首次接触 TOFU」（`AddressBroadcast` 自携 `publicKey` 且纳入签名覆盖、did:key 做 DID↔公钥派生一致性检查、公钥不一致拒收不覆盖）、§3 注明 `/api/agent` 启动即挂载、§9 排错 +4 行、§10 补 `gateway-join.json`。**版本徽章去硬编码**：5 页内联 `0.4.20` → 占位 `—`，`app.js` 删 `VERSION_FALLBACK`，只认 live 数据（npm registry → GitHub tag，且只接受形如 `0.4.23` 的值），取不到就保持 `—`。部署 CF Pages `1de7518a.bolloon.pages.dev` 并补回同域 APK 镜像（部署前 `dl/` 是空的，先拉回 0.4.22.3 资产再传）。**新增 `scripts/verify-site.mjs`**（零依赖 CDP 真 Chrome 验收）本地 + 线上均 **21/21**。

- (2026-09-13) 产品页「它能做什么」精简为**三条**（P2P 网络 / 微支付信息 / 技能沉淀与互传，序号顺序重排 **01/02/03**）+ 新增**核心能力滚动展示栏**（两份等宽轨道 `translateX(-50%)` 无缝循环，悬停暂停，`prefers-reduced-motion` 下静止）；静态列表排版保持原样。缓存破坏升 **v=13**；CF Pages 重新部署。安装页/文档页仍为九条。
- (2026-09-13) 内容对齐 npm **0.4.21**：产品/安装/文档三页「它能做什么」5 → 9 条（新增 微支付信息 x402 / 人机问答 / 技能沉淀与互传 / 勿扰时钟），文档页新增 `bolloon setup`·`bolloon model`·`bolloon x402 list` 命令板 + 参考表 5 行，安装页启动区补 setup/model 两板；缓存破坏升 **v=12**；CF Pages 重新部署（direct-upload）。bolloon 手机端新增「一键入网 · 全球智能体网络」点按项（默认 prompt = `read https://bolloon.cn/bolloon-gateway-join.md`）。
- (2026-09-10) 发布 Android APK v0.4.20 → 本仓库 Release 资产 tag `android-v0.4.20`；安装页 Android 栏目改直链 + sha256。
- (2026-09-09) 制定 Bolloon 安装/下载页设计计划 DRAFT。
- (2026-09-09) 实现并发布安装/下载落地页到 GitHub Pages (logos-42/bolloon-UI)。
- (2026-09-09) 站点扩为多页：产品/安装/文档/Hibs/网关 + 中英切换 + 文档侧边栏 + 网关skills生成器。

## 进行中的实验

- 5 页静态站（index/install/docs/hibs/gateway），炭黑 #1a1a18 + lime #c4d640，编辑式展览排版。
- 顶部导航均布 + 悬浮下拉子菜单；版本号随 npm 包最新版（registry.npmjs.org/@bolloon/bolloon-agent/latest）。
- 文档页：Hermes 风格左侧边栏（16*9 分区）+ 中/EN 语言切换（data-zh/data-en + applyLang + localStorage 记忆）。
- 安装页：栏目标签框（一键脚本/npm/Android/iOS），安卓悬浮子栏已移除。Android = **同域镜像直链** `https://bolloon.cn/dl/bolloon-0.4.22.3.apk`（18.30 MiB / sha256 `55aacaa238665131…` / 正式签名 CN=Bolloon / v0.4.22.3 —— 本版新增左上角「索引」(最近历史会话)、右上角刷新改为「搜索」(本机智能体+好友+全局智能体)、设置加「本机数据」行并删重复的「网络与同步」、网络页「触控控制」纠正为「智能体控制 (MCP / Skills)」、修 Service Worker 陈旧缓存(升级后仍跑旧 JS)；上一版新增底部「好友」tab（连接好友/附近设备/扫码 + P2P 连接状态 + 好友列表，网络页不再重复）、左右滑切 tab / 右滑返回上一层 / 点空白关弹窗、API 配置供应商 6→14 且改成芯片式点选；备用链接指向 GitHub Release tag `android-v0.4.22.2-signed`；页面还写明华为侧载风控（判风险/诈骗）时的处理（退纯净模式 / adb install）。同域镜像来自 `dl/`（gitignore，部署时由 `scripts/deploy-pages.py` 一并上传）。iOS = 三方式 + 未签名 ipa 资产。
- 网关页 gateway.html（agent 专用）：接入说明 + 端点表（/api/agent 五端点 + manifest_request/payload 帧）+ ** skills 生成器**（粘贴 capabilities → 生成可独立打开的纯 HTML 声明页，含 manifest + 入网/委派协议）。
- fig 按颜色错开：产品=219橙风+950品红家、安装=640黑、文档=157金赭、Hibs=375墨绿。
- 部署：Cloudflare Pages（bolloon project，bolloon.pages.dev + 自定义域 bolloon.cn，zone id 9be73c239b5159d75f0e8c62d8b5f41a）与 GitHub Pages（logos-42.github.io/bolloon-UI，source=main//，push 即构建）。**关键**：CF 的 bolloon 项目是 direct-upload 型（`source: null`，历史部署均为 ad_hoc），**GitHub push 不会触发 CF 构建** —— 每次改站必须显式部署，再 purge bolloon.cn 缓存。现统一走 `python3 scripts/deploy-pages.py`：它把仓库根镜像到 `build-site/`（排除 .git/.github/build-site/dl 等），再把 `dl/*.apk` 拷进 `build-site/dl/`（单文件硬上限 25 MiB，超限直接拒），然后用 wrangler 部署 —— **APK 因此从不进 git，却与站点同域同 CDN**（`https://bolloon.cn/dl/<file>`）。`build-site/` 与 `dl/` 均已 gitignore。Release 资产（GitHub）作为备用/校验来源保留。缓存破坏 style.css/app.js?v=N 已升 v=13。
- 本地开发：`python3 -m http.server 8897`；验证用 headless Chrome（dump-dom + 截图）。
