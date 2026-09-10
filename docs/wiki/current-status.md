---
title: bolloon-UI 当前状态
source: session
created: 2026-09-09
last_confirmed: 2026-09-10
audience: self
stage: draft
tags: [status]
status: current
---

## 最近更新

- (2026-09-10) 发布 Android APK v0.4.20 → 本仓库 Release 资产 tag `android-v0.4.20`；安装页 Android 栏目改直链 + sha256。
- (2026-09-09) 制定 Bolloon 安装/下载页设计计划 DRAFT。
- (2026-09-09) 实现并发布安装/下载落地页到 GitHub Pages (logos-42/bolloon-UI)。
- (2026-09-09) 站点扩为多页：产品/安装/文档/Hibs/网关 + 中英切换 + 文档侧边栏 + 网关skills生成器。

## 进行中的实验

- 5 页静态站（index/install/docs/hibs/gateway），炭黑 #1a1a18 + lime #c4d640，编辑式展览排版。
- 顶部导航均布 + 悬浮下拉子菜单；版本号随 npm 包最新版（registry.npmjs.org/@bolloon/bolloon-agent/latest）。
- 文档页：Hermes 风格左侧边栏（16*9 分区）+ 中/EN 语言切换（data-zh/data-en + applyLang + localStorage 记忆）。
- 安装页：栏目标签框（一键脚本/npm/Android/iOS），安卓悬浮子栏已移除。Android = 本仓库 Release 直链；**当前指向正式签名版** tag `android-v0.4.20-signed`（bolloon-0.4.20.apk / 17.88 MiB / sha256 `3b5ad96d…` / CN=Bolloon），旧 debug 版 tag `android-v0.4.20`（CN=Android Debug / 20.06 MiB / sha256 `7985e675…`）保留但已不在页面上；两版签名不兼容，不可互相覆盖。iOS = 三方式 + 未签名 ipa 资产。
- 网关页 gateway.html（agent 专用）：接入说明 + 端点表（/api/agent 五端点 + manifest_request/payload 帧）+ ** skills 生成器**（粘贴 capabilities → 生成可独立打开的纯 HTML 声明页，含 manifest + 入网/委派协议）。
- fig 按颜色错开：产品=219橙风+950品红家、安装=640黑、文档=157金赭、Hibs=375墨绿。
- 部署：Cloudflare Pages（bolloon project，bolloon.pages.dev + 自定义域 bolloon.cn，zone id 9be73c239b5159d75f0e8c62d8b5f41a；west 注册局已切 asa/luke.ns.cloudflare.com 且 bolloon.cn 现返回 200）与 GitHub Pages（logos-42.github.io/bolloon-UI，source=main//，push 即构建）。**关键**：CF 的 bolloon 项目是 direct-upload 型（`source: null`，历史部署均为 ad_hoc），**GitHub push 不会触发 CF 构建** —— 每次改站必须显式 `wrangler pages deploy . --project-name=bolloon --branch=main`（上传仓库根，故 README/docs/scripts 也在公网可访问），再 purge bolloon.cn 缓存。Release 资产（APK/IPA）不随站部署，也不需要 purge（走 github.com 域）。缓存破坏 style.css/app.js?v=N 已升 v=10。
- 本地开发：`python3 -m http.server 8897`；验证用 headless Chrome（dump-dom + 截图）。
