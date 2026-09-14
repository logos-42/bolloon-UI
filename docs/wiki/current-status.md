---
title: bolloon-UI 当前状态
source: session
created: 2026-09-09
last_confirmed: 2026-09-13
audience: self
stage: draft
tags: [status]
status: current
---

## 最近更新

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
- 安装页：栏目标签框（一键脚本/npm/Android/iOS），安卓悬浮子栏已移除。Android = **同域镜像直链** `https://bolloon.cn/dl/bolloon-0.4.22.apk`（18.29 MiB / sha256 `0c138377…` / 正式签名 CN=Bolloon / v0.4.22，含手机端一键入网、微信息 x402），备用链接指向 GitHub Release tag `android-v0.4.22-signed`；同域镜像来自 `dl/`（gitignore，部署时由 `scripts/deploy-pages.py` 一并上传）。旧 `android-v0.4.20-signed` / debug 版 `android-v0.4.20`（CN=Android Debug）保留但已不在页面上；签名不兼容的包不可互相覆盖。iOS = 三方式 + 未签名 ipa 资产。
- 网关页 gateway.html（agent 专用）：接入说明 + 端点表（/api/agent 五端点 + manifest_request/payload 帧）+ ** skills 生成器**（粘贴 capabilities → 生成可独立打开的纯 HTML 声明页，含 manifest + 入网/委派协议）。
- fig 按颜色错开：产品=219橙风+950品红家、安装=640黑、文档=157金赭、Hibs=375墨绿。
- 部署：Cloudflare Pages（bolloon project，bolloon.pages.dev + 自定义域 bolloon.cn，zone id 9be73c239b5159d75f0e8c62d8b5f41a）与 GitHub Pages（logos-42.github.io/bolloon-UI，source=main//，push 即构建）。**关键**：CF 的 bolloon 项目是 direct-upload 型（`source: null`，历史部署均为 ad_hoc），**GitHub push 不会触发 CF 构建** —— 每次改站必须显式部署，再 purge bolloon.cn 缓存。现统一走 `python3 scripts/deploy-pages.py`：它把仓库根镜像到 `build-site/`（排除 .git/.github/build-site/dl 等），再把 `dl/*.apk` 拷进 `build-site/dl/`（单文件硬上限 25 MiB，超限直接拒），然后用 wrangler 部署 —— **APK 因此从不进 git，却与站点同域同 CDN**（`https://bolloon.cn/dl/<file>`）。`build-site/` 与 `dl/` 均已 gitignore。Release 资产（GitHub）作为备用/校验来源保留。缓存破坏 style.css/app.js?v=N 已升 v=13。
- 本地开发：`python3 -m http.server 8897`；验证用 headless Chrome（dump-dom + 截图）。
