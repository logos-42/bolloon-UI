---
title: bolloon-UI 当前状态
source: session
created: 2026-09-09
last_confirmed: 2026-09-09
audience: self
stage: draft
tags: [status]
status: current
---

## 最近更新

- (2026-09-09) 制定 Bolloon 安装/下载页设计计划 DRAFT。
- (2026-09-09) 实现并发布安装/下载落地页到 GitHub Pages (logos-42/bolloon-UI)。
- (2026-09-09) 站点扩为多页：产品/安装/文档/Hibs/网关 + 中英切换 + 文档侧边栏 + 网关skills生成器。

## 进行中的实验

- 5 页静态站（index/install/docs/hibs/gateway），炭黑 #1a1a18 + lime #c4d640，编辑式展览排版。
- 顶部导航均布 + 悬浮下拉子菜单；版本号随 npm 包最新版（registry.npmjs.org/@bolloon/bolloon-agent/latest）。
- 文档页：Hermes 风格左侧边栏（16*9 分区）+ 中/EN 语言切换（data-zh/data-en + applyLang + localStorage 记忆）。
- 安装页：栏目标签框（一键脚本/npm/Android），安卓悬浮子栏已移除。
- 网关页 gateway.html（agent 专用）：接入说明 + 端点表（/api/agent 五端点 + manifest_request/payload 帧）+ ** skills 生成器**（粘贴 capabilities → 生成可独立打开的纯 HTML 声明页，含 manifest + 入网/委派协议）。
- fig 按颜色错开：产品=219橙风+950品红家、安装=640黑、文档=157金赭、Hibs=375墨绿。
- 部署：Cloudflare Pages（bolloon project，bolloon.pages.dev + 自定义域 bolloon.cn west 注册局已切 asa/luke.ns.cloudflare.com；注意未完全生效）与 GitHub Pages（logos-42.github.io/bolloon-UI）。缓存破坏 style.css/app.js?v=N 已升 v=6，Cloudflare 已 purge。
- 本地开发：`python3 -m http.server 8897`；验证用 headless Chrome（dump-dom + 截图）。
