# Wiki 日志

| 日期 | 事件 | 内容 |
|------|------|------|
| 2026-09-09 | 启动 | 初始化知识系统：建立 wiki、manifest、检查脚本和 repo 级默认规则。 |
| 2026-09-09 | Bolloon 安装/下载页 | 设计计划 DRAFT：读 design.md(数字展馆 brief)+核实 Bolloon 品牌色(style.css)+README 安装命令+package v0.4.20；识别 fig/ 8 图为毛笔书法作品。定稿：纸+炭黑为骨/Bolloon lime 唯一强调色；书法作主视觉展品与能力对位；纯静态 index.html 零构建。计划落 docs/bolloon-install-page-plan.md，未实现 UI。 |
| 2026-09-09 | 安装/下载页发布 | 实现静态落地页 index.html/style.css/app.js(炭黑+lime 编辑式排版、OS 探测、复制按钮、live 版本号)。经本地服务 + headless Chrome(dump-dom+截图)验证渲染/交互。GitHub repo logos-42/bolloon-UI(public, main)，Pages 已启用并构建成功：https://logos-42.github.io/bolloon-UI/ 。注意：git add 曾误裹入全项目，已重建为只含网站文件的干净 commit。 |
| 2026-09-09 | 知识系统初始化 | 用「维基 llm」v2 bootstrap 出 compile-first 知识系统(39 文件)：docs/wiki/（9 页 v2 frontmatter）、manifests/、scripts/（v1+v2 全套校验工具）、平台配置（AGENTS/CLAUDE/.cursorrules/.windsurfrules）、slash 命令、CI workflow；初始化 raw root(bolloon_ui_raw)。修复模板/渲染 4 处缺陷：audience `me`→`self`、runtime-profile 补 v2 必填字段、index/log 与默认规则对齐、渲染器残留哨兵崩溃。校验全绿：wiki_check / wiki_lint --strict=v2 / raw_manifest_check / provenance_check --ci / skill_doctor 均 OK。 |
