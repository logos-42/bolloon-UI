/**
 * verify-site.mjs — bolloon.cn 站点上线后真浏览器验收 (零依赖, 自包含 CDP)
 *
 * 为什么自包含: 站点仓不装 npm 包, 但它要能自己验自己 —— 只用 node 全局 WebSocket
 * 驱动本机 Chrome (headless=new), 不引任何依赖。
 *
 * 覆盖:
 *   ① 5 页版本徽章 = live npm 版本 (取自 registry, 不再硬编码)
 *   ② 徽章在 JS 失败时显示「—」而不是过期版本 (静态 HTML 内已是占位符)
 *   ③ skill.html 已同步文档 v1.3.0 + 站内 skills 索引区 (bolloon-gateway-join / bolloon-network)
 *   ④ gateway.html 的粘贴命令 = 本页实际源 + bolloon-gateway-join.md
 *   ⑤ /bolloon-gateway-join.md 线上正文 = v1.3.0 且含 join_global_gateway / publicKey
 *   ⑤′ /bolloon-network.md 线上正文 = 主仓 skills/bolloon-network/SKILL.md 的原样镜像
 *      (frontmatter 原样: name/version/protocol/paymentModes/hardRules + 正文首尾锚点都在)
 *   ⑥ gateway.html 链上活动 (公开只读接口 /api/public/network/progress 的 confirmed_activity):
 *      页面主体 = 一句短说明 + 小结行 (节点/智能体/任务/已完成/已验证/钱包签名) + 一张表
 *      (列 = 任务|状态|事件|网络|区块|确认数/最终性|时间)。断言: 表头/行渲染逐格逐字、
 *      短写 (40 位地址→0x…头4尾4, 64 位 sha256→sha256:头4…)、state 中英单词、
 *      finality 三档徽标 (data-finality + 三档颜色互不相同)、数据源标注三种取值、
 *      空态「本节点暂未观察到链上任务」与降级态「快照不可用」文案、
 *      loading/live/stale/unavailable 四态 (CDP Fetch 拦夹具, 不对真实网络下断言)、
 *      超时 (请求挂住 6s → 自己放弃)、失败不阻断其它区域、30s 轮询 + 5s 超时 + 退避常量、
 *      textContent 纪律 (带 <b> 的标识不被解析)、中英切换、prefers-reduced-motion、
 *      390px 纵向堆叠 + 表格横向滚动、回退同源 network-pulse.json、无 console 错误
 *   ⑦ index.html 序栏 (hero) 紧凑版: 同一数据源、同一诚实四态、紧凑度确实优于网关页;
 *      活动流缺当前语言退回另一种语言 + 相对时间只改文字节点
 *   ⑧ 多实例隔离: 同一页两个 [data-pulse] 实例各自独立取数/降级 (一个失败另一个仍活)
 *   ⑨ 全站 7 页无重复 id
 *   ⑩ 网关页顺序: 链上活动区在「加入方式 / 如何加入」之前 (序厅已删), 且链上活动与加入方式
 *      同处一行的**左/右两栏** (.gateway-row: 桌面同行 · 加入方式在右, ≤900px 堆叠)
 *   ⑪ 聚合计数「拿不到就不显示」: tasks / tasks_completed / tasks_verified / signatures
 *      缺失 → 小结行整行隐藏, 不编造; 空表要说清 + agent_sites=[] 诚实提示
 *   ⑫ 智能体私有站 (IPNS): agent_sites[] 三种形态归一化 + 空数组诚实提示 + 非法条目不渲染链接
 *   ⑬ IPNS 粘贴框: 真 input + 真按钮, 合法才开新窗口 (真新标签页), 非法就地报错且输入不进 innerHTML
 *   ⑭ 全站资源 ?v=22 一致 (逐页抓原始 HTML)
 *   ⑮ 小结行的钱包签名钩子 (data-pulse-total="signatures") 必列 + 字段缺失整行隐藏
 *   ⑯ 表格枚举容错: 认不出的 kind/state/finality 原样显示 (不猜不吞不报错),
 *      task 与 tx 都空的条目根本不画 (不留空行)
 *   ⑰ 数值与表格行变化在下一轮 30s 轮询内自动反映 (新 agent 加入 → 自己变, 页面不刷新)
 *   ⑱ 旧名清除: 7 页原始 HTML + 渲染后可见文本与导航里都没有「网络脉冲 / Network pulse /
 *      全球网络脉冲」; 「加入网络」**不是**旧名 (2026-09-22 leo 要的首页 CTA 按钮) ——
 *      只允许作为首页那一个 <a class="join-network-cta" href="gateway.html"> 出现,
 *      摘掉该按钮文案后其余位置零命中 (防旧网关序厅 / 旧导航项复发);
 *      页面可见文本无 40 位地址 / 64 位哈希
 *   ⑲ 技能索引版本号逐字断言 (bolloon-network = 1.2.0), 且与线上 .md frontmatter 一致
 *      —— 不再只匹配「1.x.y 形状」(那会漏掉「本机改了、线上没部署」)
 *   ⑳ 公开页数字不许自相矛盾 (2026-09-22 leo 拍板): 小结行「任务/已完成/已验证/签名」= 24h 脉冲事件口径
 *      (真快照里是 0), 链上活动表 N 行 = 链上索引口径 —— 两者同屏时, 表格下方**必须**有一行口径行
 *      (data-pulse-activity-totals) 把行数/不同任务、这批行属于哪条链 (本机 31337 · 不是公网)、
 *      以及两套口径为什么不同讲明白; 老快照缺这三块 → 整行隐藏 (不自己数行数、不编网络名)。
 *   ㉑ 网关页两栏版式 + 首页「加入网络」CTA (2026-09-22 leo 要求, 全部真布局测量):
 *      #pulse / #skills 同父 (.gateway-row) 且文档顺序 pulse → skills;
 *      1440px: 两区同一行 (顶边对齐) 且加入方式在链上活动右侧 (右列左边界 ≥ 左列右边界) +
 *      两栏间距 = 声明的 column-gap; 390px: 加入方式堆叠到链上活动下方 + 同列左右对齐 +
 *      容器/右列/命令块都不超出视口 (两栏隐藏前后整页横向溢出不变 ⇒ 新两栏不贡献溢出);
 *      首页「加入网络」= 真 <a href="gateway.html"> 纯文本节点, 位于「开始安装」右侧同一行
 *      (CTA 顺序 开始安装 → 加入网络 → 阅读文档), 双语文案齐, 切 EN 变 "Join the network";
 *      真 Tab 键能走到它 (在 Tab 序里) 且焦点环是可见的 lime 2px outline; 390px 换行不溢出。
 *   ⑳′ 过期假标签防复发: 7 页原始 HTML + 渲染后可见文本 + 导航里都不许再出现
 *      「尚未接入 / Public observation endpoint not connected」类**现在为假**的文案
 *      (入口早已接入并在供给 25 行数据); unavailable 态必须说真话 (「快照暂时读不到」+ 真原因)。
 *
 * 活动区钩子约定 (见 app.js 末尾多实例模块): 根 = [data-pulse],
 * 区内节点 = data-pulse-scope / data-pulse-time / data-pulse-ago
 *            / data-pulse-total="nodes|agents|active|24h|tasks|tasks_completed|tasks_verified|signatures"
 *            / data-pulse-activity-body / data-pulse-activity-empty / data-pulse-activity-source
 *            / data-pulse-feed / data-pulse-notes / data-pulse-hint
 *            / data-pulse-sites / data-pulse-sites-empty
 *            / data-pulse-ipns-form / data-pulse-ipns-input / data-pulse-ipns-open / data-pulse-ipns-msg
 * 改钩子名必须同步三处: markup · app.js 的 querySelector · 本脚本的探针 (踩过这个坑)。
 * 纯函数入口: window.BOLLOON_IPNS.parse/url (归一化) · window.__bolloonIpns (上次真开过的链接快照)。
 *
 * 用法: node scripts/verify-site.mjs [基址]      # 默认 https://bolloon.cn
 *       node scripts/verify-site.mjs http://127.0.0.1:8897
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const BASE = (process.argv[2] || 'https://bolloon.cn').replace(/\/$/, '');
const PAGES = ['index.html', 'install.html', 'hibs.html', 'gateway.html', 'docs.html'];
const ALL_PAGES = [...PAGES, 'privacy.html', 'skill.html'];

function resolveChrome() {
  const cands = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
    path.join(os.homedir(), 'Applications/Google Chrome.app/Contents/MacOS/Google Chrome'),
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ];
  for (const c of cands) if (fs.existsSync(c)) return c;
  return null;
}

let passed = 0, failed = 0, skipped = 0, fxFailures = 0;

// 显式跳过 (只给「本环境本来就不该跑」的断言用): 必须打印 + 单独计数, 不许默默跳过、不许假装通过。
// 目前全脚本用 0 次 —— 理由: 「靠 CDP Fetch 注入夹具」与站点来源无关 (拦截发生在浏览器网络栈里,
// 对 127.0.0.1 与真域名语义相同), 真域名上从来没有「夹具断言不该跑」这回事, 只有过
// 「拦截没命中 → 夹具没生效」这一种真实故障。故障要明确报出来 (见 fxSelfProof), 不是该跳过的项。
const skip = (name, why) => { skipped++; console.log(`  ⏭️  [显式跳过] ${name} — ${why}`); };

// 当前断言的夹具自证结论 (null = 本节断言不吃夹具)。
// 夹具没生效时, 失败的断言必须归因到「夹具错」, 不能让读者以为页面坏了 —— 这就是本节的唯一目的。
let fxNow = null;
const check = (name, ok, detail = '') => {
  if (ok) { passed++; console.log(`  ✅ ${name}`); return; }
  failed++;
  if (fxNow && fxNow.delivered === false) {
    // 夹具错: 自证没过 (拦截未命中 / 夹具没送达) → 本条失败不代表页面有缺陷
    fxFailures++;
    console.log(`  ❌ [夹具错 · 未生效] ${name} — 夹具没生效(${fxNow.reason}); 本条不是页面缺陷` +
      `${detail ? ` · 现场取值: ${detail}` : ''}`);
    return;
  }
  // 夹具已自证生效 (跑完 fxSelfProof 的三道证, 见输出的「🔒 夹具自证 ✔」行) → 此时失败才真的是页面错
  const tag = fxNow && fxNow.delivered === true ? '[页面错] ' : '';
  console.log(`  ❌ ${tag}${name}${detail ? ` — ${detail}` : ''}`);
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 真域名抓取本机常被本地代理/ClashX 搅成 ETIMEDOUT/ECONNRESET (一次抖动就整轮崩) →
// 所有「抓正文」的请求走这个带重试的包装 (对本地 http.server 也一样的语义)。
const fetchText = async (url, attempts = 4) => {
  let lastErr = null;
  for (let i = 0; i < attempts; i++) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.text();
    } catch (e) {
      lastErr = e;
      if (i < attempts - 1) await sleep(1200 * (i + 1));
    }
  }
  throw lastErr;
};

// 活动区探针: 只认 data-pulse-* 钩子 (不依赖 id), 网关页的链上活动表与首页序栏紧凑份通用
const pulseProbe = (rootSel) => `(() => {
  const root = document.querySelector(${JSON.stringify(rootSel)});
  if (!root) return null;
  const q = (s) => root.querySelector(s);
  const t = (s) => { const n = q(s); return n ? n.textContent.trim() : null; };
  const txt = (s) => { const n = q(s); return n ? n.textContent : ''; };
  const visText = Array.from(root.querySelectorAll('.pulse-state-text')).filter((e) => getComputedStyle(e).display !== 'none')[0] || {};
  const hint = q('.pulse-hint');
  const caveat = q('.pulse-caveat');
  const hid = (k) => { const n = q('[data-pulse-total="' + k + '"]'); return n ? n.parentNode.hasAttribute('hidden') : null; };
  const form = q('[data-pulse-ipns-form]');
  const sitesEmpty = q('[data-pulse-sites-empty]');
  const table = q('[data-pulse-activity]');
  const tbody = q('[data-pulse-activity-body]');
  const trs = tbody ? Array.from(tbody.querySelectorAll('tr')) : [];
  const empty = q('[data-pulse-activity-empty]');
  const c = (tr, sel) => tr.querySelector(sel);
  return {
    state: root.getAttribute('data-pulse-state'),
    visible: visText.textContent || '',
    nodes: t('[data-pulse-total="nodes"]'),
    agents: t('[data-pulse-total="agents"]'),
    active: t('[data-pulse-total="active"]'),
    h24: t('[data-pulse-total="24h"]'),
    tasks: t('[data-pulse-total="tasks"]'),
    tasksDone: t('[data-pulse-total="tasks_completed"]'),
    tasksVerified: t('[data-pulse-total="tasks_verified"]'),
    signatures: t('[data-pulse-total="signatures"]'),
    tasksHidden: { tasks: hid('tasks'), done: hid('tasks_completed'), verified: hid('tasks_verified'), sig: hid('signatures') },
    summary: Array.from(root.querySelectorAll('.pulse-summary li')).map((li) => {
      const b = li.querySelector('b'); const sp = li.querySelector('span');
      return { value: b ? b.textContent.trim() : null, label: sp ? sp.textContent.trim() : null,
        key: b ? b.getAttribute('data-pulse-total') : null, hidden: li.hasAttribute('hidden') };
    }),
    act: table ? {
      headers: Array.from(table.querySelectorAll('thead th')).map((th) => th.textContent.trim()),
      caption: (table.querySelector('caption') || {}).textContent || '',
      rowCount: trs.length,
      blankRows: trs.filter((tr) => !tr.textContent.trim()).length,
      rows: trs.map((tr) => ({
        cells: Array.from(tr.querySelectorAll('td')).map((td) => td.textContent.trim()),
        task: c(tr, '.pulse-td-task code') ? c(tr, '.pulse-td-task code').textContent : null,
        taskKids: c(tr, '.pulse-td-task code') ? c(tr, '.pulse-td-task code').childNodes.length : null,
        taskHtml: c(tr, '.pulse-td-task code') ? c(tr, '.pulse-td-task code').innerHTML : null,
        ref: tr.getAttribute('data-ref'),
        stateKey: c(tr, '.pulse-state-word') ? c(tr, '.pulse-state-word').getAttribute('data-state') : null,
        stateText: c(tr, '.pulse-state-word') ? c(tr, '.pulse-state-word').textContent.trim() : null,
        kindKey: c(tr, '.pulse-kind-word') ? c(tr, '.pulse-kind-word').getAttribute('data-kind') : null,
        kindText: c(tr, '.pulse-kind-word') ? c(tr, '.pulse-kind-word').textContent.trim() : null,
        chain: c(tr, '.pulse-td-net') ? c(tr, '.pulse-td-net').getAttribute('data-chain') : null,
        net: c(tr, '.pulse-td-net') ? c(tr, '.pulse-td-net').textContent.trim() : null,
        block: c(tr, '.pulse-td-block') ? c(tr, '.pulse-td-block').textContent.trim() : null,
        conf: c(tr, '.pulse-conf') ? c(tr, '.pulse-conf').textContent.trim() : null,
        fin: c(tr, '.pulse-fin') ? c(tr, '.pulse-fin').getAttribute('data-finality') : null,
        finText: c(tr, '.pulse-fin') ? c(tr, '.pulse-fin').textContent.trim() : null,
        finClass: c(tr, '.pulse-fin') ? c(tr, '.pulse-fin').className : null,
        time: c(tr, '.pulse-td-time time') ? c(tr, '.pulse-td-time time').textContent.trim() : null,
        timeIso: c(tr, '.pulse-td-time time') ? c(tr, '.pulse-td-time time').getAttribute('datetime') : null,
      })),
      emptyShown: empty ? getComputedStyle(empty).display !== 'none' : null,
      emptyText: empty ? empty.textContent.trim() : null,
      source: txt('[data-pulse-activity-source]').trim(),
      totalsLine: txt('[data-pulse-activity-totals]').trim(),
      totalsLineShown: (function () {
        const n = q('[data-pulse-activity-totals]');
        return n ? getComputedStyle(n).display !== 'none' : null;
      })(),
    } : null,
    // 旧版网关页的三块内容 (8 个数字格 / 能力分布 / 最近活动) 已不该出现在活动区里
    // (不算 .pulse-sub —— 智能体私有站的标题仍在用这个类)
    legacyBlocks: root.querySelectorAll('.pulse-stats, .pulse-stat, .pulse-grid, .pulse-cap-list, [data-pulse-caps], [data-pulse-feed]').length,
    finality: Array.from(root.querySelectorAll('.pulse-fin')).map((e) => ({ key: e.getAttribute('data-finality'), color: getComputedStyle(e).color, cls: e.className })),
    sites: Array.from(root.querySelectorAll('[data-pulse-sites] li')).map((li) => {
      const a = li.querySelector('a');
      return { label: (li.querySelector('.pulse-site-label') || {}).textContent || '',
        href: a ? a.href : null, rel: a ? a.rel : null, target: a ? a.target : null,
        text: a ? a.textContent : null, kids: a ? a.childNodes.length : null };
    }),
    sitesEmptyShown: sitesEmpty ? getComputedStyle(sitesEmpty).display !== 'none' : null,
    sitesEmptyText: sitesEmpty ? sitesEmpty.textContent.trim() : null,
    ipns: form ? { inputTag: form.querySelector('[data-pulse-ipns-input]').tagName,
      inputType: form.querySelector('[data-pulse-ipns-input]').type,
      inputAria: form.querySelector('[data-pulse-ipns-input]').getAttribute('aria-label'),
      btnTag: form.querySelector('[data-pulse-ipns-open]').tagName,
      btnType: form.querySelector('[data-pulse-ipns-open]').type,
      btnAria: form.querySelector('[data-pulse-ipns-open]').getAttribute('aria-label'),
      msgRole: form.querySelector('[data-pulse-ipns-msg]').getAttribute('role'),
      msgLive: form.querySelector('[data-pulse-ipns-msg]').getAttribute('aria-live'),
      msg: form.querySelector('[data-pulse-ipns-msg]').textContent,
      invalids: root.querySelectorAll('[data-pulse-ipns-input][aria-invalid="true"]').length } : null,
    scope: t('[data-pulse-scope]'),
    scopeHidden: !!q('[data-pulse-scope]') && q('[data-pulse-scope]').hasAttribute('hidden'),
    snap: t('[data-pulse-time]'),
    ago: t('[data-pulse-ago]'),
    feed: Array.from(root.querySelectorAll('[data-pulse-feed] li')).map((li) => li.textContent.trim()),
    feedText: Array.from(root.querySelectorAll('[data-pulse-feed] .pulse-feed-text')).map((e) => e.textContent),
    feedBlank: Array.from(root.querySelectorAll('[data-pulse-feed] li'))
      .filter((li) => { const s = li.querySelector('.pulse-feed-text'); return !s || !s.textContent.trim(); }).length,
    feedAt: Array.from(root.querySelectorAll('[data-pulse-feed] time')).map((e) => e.getAttribute('data-at')),
    notes: txt('[data-pulse-notes]').trim(),
    hintShown: hint ? getComputedStyle(hint).display !== 'none' : false,
    hint: hint ? hint.textContent : '',
    caveat: caveat ? caveat.textContent.trim() : '',
    api: !!window.__bolloonPulse,
  };
})()`;

async function main() {
  const chrome = resolveChrome();
  if (!chrome) { console.error('找不到 Chrome'); process.exit(1); }
  const port = 9333 + Math.floor(Math.random() * 200);
  const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bolloon-site-verify-'));
  const proc = spawn(chrome, [
    '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${userDir}`,
    // macOS: headless Chrome 默认会去访问登录钥匙串 (Safe Storage) → 后台/无人值守时
    // 会卡在系统授权弹窗上 (子智能体点不了"允许")。这些开关让 Chrome 用内存钥匙串,
    // 不碰系统钥匙串 —— 验收行为不受影响。
    '--use-mock-keychain', '--password-store=basic', '--no-first-run', '--no-default-browser-check',
    '--no-first-run', '--no-default-browser-check', '--disable-gpu', 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'ignore'] });

  // 等 CDP 就绪
  let wsUrl = null;
  for (let i = 0; i < 60 && !wsUrl; i++) {
    await sleep(300);
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (r.ok) wsUrl = (await r.json()).webSocketDebuggerUrl;
    } catch { /* 还没起来 */ }
  }
  if (!wsUrl) { console.error('Chrome CDP 未就绪'); proc.kill(); process.exit(1); }

  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0;
  const pending = new Map();
  let sessionId = null;
  // 事件通道: Fetch 拦截 (夹具数据) / console 错误 / 异常
  const handlers = new Map();
  const on = (method, fn) => {
    if (!handlers.has(method)) handlers.set(method, new Set());
    handlers.get(method).add(fn);
    return () => handlers.get(method).delete(fn);
  };
  const consoleErrors = [];
  on('Runtime.exceptionThrown', (p) => {
    const d = p.exceptionDetails || {};
    consoleErrors.push('exception: ' + (d.text || '') + ' ' + (d.exception && d.exception.description ? d.exception.description : ''));
  });
  on('Runtime.consoleAPICalled', (p) => {
    if (p.type === 'error' || p.type === 'assert') {
      consoleErrors.push('console.' + p.type + ': ' + (p.args || []).map((a) => (a.value !== undefined ? a.value : a.description || a.type)).join(' '));
    }
  });
  ws.onmessage = (ev) => {
    const msg = JSON.parse(typeof ev.data === 'string' ? ev.data : ev.data.toString());
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); return; }
    if (msg.method && handlers.has(msg.method)) handlers.get(msg.method).forEach((fn) => fn(msg.params, msg));
  };
  const cdp = (method, params = {}, useSession = true) => new Promise((resolve, reject) => {
    const mid = ++id;
    pending.set(mid, (m) => (m.error ? reject(new Error(`${method}: ${m.error.message}`)) : resolve(m.result)));
    ws.send(JSON.stringify({ id: mid, method, params, ...(useSession && sessionId ? { sessionId } : {}) }));
  });

  const { targetId } = await cdp('Target.createTarget', { url: 'about:blank' }, false);
  const att = await cdp('Target.attachToTarget', { targetId, flatten: true }, false);
  sessionId = att.sessionId;
  await cdp('Page.enable');
  await cdp('Runtime.enable');

  // —— 新窗口侦察 (IPNS 粘贴框验收用) ——
  // autoAttach + waitForDebuggerOnStart ⇒ 新标签页在启动前挂起: 验收只统计「真的开了新窗口」,
  // 然后立刻关掉它, 不让验收去访问 ipfs.io。
  const popups = [];
  let popupWatch = false;
  on('Target.attachedToTarget', (p) => { if (popupWatch && p.targetInfo.targetId !== targetId) popups.push(p.targetInfo); });
  const watchPopups = async (on2) => {
    popupWatch = on2;
    try { await cdp('Target.setAutoAttach', on2 ? { autoAttach: true, waitForDebuggerOnStart: true, flatten: true } : { autoAttach: false }, false); } catch { /* 不致命 */ }
  };
  const closePopups = async () => {
    for (const t of popups) { try { await cdp('Target.closeTarget', { targetId: t.targetId }, false); } catch { /* 已关 */ } }
    popups.length = 0;
  };

  const evalJs = async (code) => {
    const r = await cdp('Runtime.evaluate', { expression: code, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception?.description || ''));
    return r.result.value;
  };

  // 等稳定再测量 (2026-09-22 父 agent 定向要求, 治「固定 sleep」会撒谎的毛病):
  // 渲染慢的那一轮 (实测: 老快照档 rows:0 时探针已取值 = 量到中间态) 用固定 sleep 会偶发假失败,
  // 也会把「夹具没生效」误报成「页面不对」。这里轮询同一个探针:
  //   连续两次读数逐字相同 **且** 满足传入的谓词 → 才算稳定, 返回该值;
  //   超时/谓词始终不满足 → 返回最后一次读数 (断言照旧失败, 但报出来的是真实形态, 不是假的绿)。
  const waitStable = async (expr, pred, { tries = 40, interval = 150 } = {}) => {
    let prev, last = null;
    for (let i = 0; i < tries; i++) {
      const v = await evalJs(expr).catch(() => null);
      last = v;
      if (v !== null && pred(v) && JSON.stringify(v) === JSON.stringify(prev)) return v;
      prev = v;
      await sleep(interval);
    }
    return last;
  };
  // 只等一个布尔条件成立 (不比较两次读数); 超时返回 false。
  const waitUntil = async (expr, { tries = 40, interval = 150 } = {}) => {
    for (let i = 0; i < tries; i++) {
      if ((await evalJs(expr).catch(() => false)) === true) return true;
      await sleep(interval);
    }
    return false;
  };

  console.log(`=== bolloon.cn 站点真浏览器验收 (${BASE}) ===\n`);

  // live npm 版本 (作为期望值)
  // 2026-09-22 修 (假红): 原来只在开头取**一次** registry。/latest 在**发布新版本的瞬间**会翻值
  // (CDN 传播窗口), 而页面徽章是页面自己另取一次 ⇒ 两个独立来源短暂不一致 ⇒ 把「刚发布了新版本」
  // 这个**正确动作**判成假红 (实测: 页面 dom=0.4.32 而脚本 live=0.4.31 → 真域名 244/2)。
  // 改为**稳定化取值**: 连续两次读到同一个值才算稳定 (最多 12 次 × 1.5s), 拿到的就是翻值后的最终值。
  const readRegistryVersion = async () => {
    try {
      const r = await fetch('https://registry.npmjs.org/@bolloon/bolloon-agent/latest');
      if (r.ok) return (await r.json()).version;
    } catch { /* 网络问题, 后面按 DOM 判断 */ }
    return null;
  };
  let liveVersion = null;
  {
    let prev = null;
    for (let i = 0; i < 12; i++) {
      const v = await readRegistryVersion();
      liveVersion = v;
      if (v && v === prev) break;         // 连续两次一致 = 已稳定
      prev = v;
      await sleep(1500);
    }
  }
  console.log(`[0] npm registry latest = ${liveVersion || '(取不到)'} (已稳定化: 连续两次一致才采信)`);

  // ① 徽章
  console.log('\n[1] 版本徽章 (5 页)');
  for (const p of PAGES) {
    await cdp('Page.navigate', { url: `${BASE}/${p}` });
    await sleep(1200);
    // 等 JS 把徽章填上 (最多 8s)
    let shown = '';
    for (let i = 0; i < 16; i++) {
      shown = String(await evalJs(`document.getElementById('version') && document.getElementById('version').textContent.trim()`));
      if (/^\d+\.\d+\.\d+/.test(shown)) break;
      await sleep(500);
    }
    check(`${p} 徽章 = ${shown}`, /^\d+\.\d+\.\d+/.test(shown) && (!liveVersion || shown === liveVersion),
      `live=${liveVersion} dom=${shown}`);
  }

  // ② 静态占位 (断网也不谎报): 直接读原始 HTML
  console.log('\n[2] 静态 HTML 不含过期硬编码');
  for (const p of PAGES) {
    const html = await fetchText(`${BASE}/${p}`);
    const hard = /id="version">([^<]*)</.exec(html);
    const val = hard ? hard[1].trim() : '(未找到 #version)';
    check(`${p} 占位 = 「${val}」(非过期版本号)`, !/^\d+\.\d+\.\d+$/.test(val), val);
  }

  // ③ skill.html 文档同步
  console.log('\n[3] skill.html 已同步文档 v1.3.0');
  const skillHtml = await fetchText(`${BASE}/skill.html`);
  check('版本 1.3.0 (逐字)', skillHtml.includes('>1.3.0<'));
  // 版本号必须逐字断言 + 与线上 .md 的 frontmatter 对得上 —— 只匹配「1.x.y 形状」会把
  // 「本机改了、线上没部署」漏过去 (2026-09-22 实测: 线上 skill.html 长期停在 1.0.1)。
  const SKILL_EXPECT = { 'bolloon-gateway-join': '1.3.0', 'bolloon-network': '1.2.0' };
  const mdVersionOf = (md) => {
    const fm = /^---\n([\s\S]*?)\n---/.exec(md);
    if (!fm) return '(无 frontmatter)';
    const v = /^version:\s*(\S+)\s*$/m.exec(fm[1]);
    return v ? v[1] : '(未找到 version)';
  };
  const mdVersions = {};
  for (const slug of Object.keys(SKILL_EXPECT)) mdVersions[slug] = mdVersionOf(await fetchText(`${BASE}/${slug}.md`));
  check('线上 .md frontmatter 的 version 就是期望值 (两份 skill 都逐字对上)',
    Object.keys(SKILL_EXPECT).every((s) => mdVersions[s] === SKILL_EXPECT[s]), JSON.stringify(mdVersions));
  check('含「0.1 三条执行路径」', skillHtml.includes('0.1 三条执行路径'));
  check('含手机端路径 A′ (本机内核执行)', skillHtml.includes('路径 A′') && skillHtml.includes('bolloon_gateway_join'));
  check('含 join_global_gateway 工具路径', skillHtml.includes('join_global_gateway'));
  check('含 §7 首次接触 TOFU', skillHtml.includes('首次接触 TOFU'));
  check('排错含 publicKey 拒收行', skillHtml.includes('无 publicKey'));
  check('含 §11 M1 任务闭环', skillHtml.includes('11. 用买到的能力完成任务') && skillHtml.includes('bolloon task'));

  // ③′ 站内 skills 索引区 —— bolloon-UI 就是 skills 的完整索引
  console.log('\n[3b] skill.html 站内 skills 索引区 (完整索引)');
  check('有索引区 (id=skills-index + [data-skills-index])',
    skillHtml.includes('id="skills-index"') && skillHtml.includes('data-skills-index'));
  check('索引区两份 skill 名称 + 具体 version 都在原始 HTML 里 (bolloon-network = 1.2.0, 不再是「1.x.y 形状」)',
    skillHtml.includes('>bolloon-gateway-join<') && skillHtml.includes('>1.3.0<') &&
    skillHtml.includes('>bolloon-network<') && skillHtml.includes('>1.2.0<'));
  check('每行都有 read 钩子 + 复制按钮 + 直达 .md 链接',
    (skillHtml.match(/data-skill-read="bolloon-gateway-join"/g) || []).length === 1 &&
    (skillHtml.match(/data-skill-read="bolloon-network"/g) || []).length === 1 &&
    (skillHtml.match(/data-copy-skill="/g) || []).length === 2 &&
    skillHtml.includes('href="bolloon-gateway-join.md"') && skillHtml.includes('href="bolloon-network.md"'));
  await cdp('Page.navigate', { url: `${BASE}/skill.html` });
  await sleep(900);
  const idxRows = await evalJs(`(() => Array.from(document.querySelectorAll('[data-skills-index] tbody tr')).map((tr) => ({
    name: tr.cells[0].textContent.trim(), version: tr.cells[1].textContent.trim(),
    read: tr.querySelector('[data-skill-read]').textContent,
    slug: tr.querySelector('[data-skill-read]').getAttribute('data-skill-read'),
    kids: tr.querySelector('[data-skill-read]').childNodes.length,
    direct: tr.cells[4].querySelector('a').getAttribute('href'),
    copy: !!tr.querySelector('[data-copy-skill]') })))()`);
  check('索引区 read 命令按实际访问源生成 (read <BASE>/<name>.md), 文本节点只 1 个',
    Array.isArray(idxRows) && idxRows.length === 2 && idxRows.every((r) => r.read === `read ${BASE}/${r.slug}.md` && r.kids === 1),
    JSON.stringify(idxRows && idxRows.map((r) => r.read)));
  check('索引区名称/version/直达链接/复制按钮逐行都对 (bolloon-network 逐字 = 1.2.0)',
    idxRows.length === 2 &&
    idxRows[0].name === 'bolloon-gateway-join' && idxRows[0].version === '1.3.0' &&
    idxRows[0].direct === 'bolloon-gateway-join.md' && idxRows[0].copy === true &&
    idxRows[1].name === 'bolloon-network' && idxRows[1].version === '1.2.0' &&
    idxRows[1].direct === 'bolloon-network.md' && idxRows[1].copy === true,
    JSON.stringify(idxRows.map((r) => [r.name, r.version, r.direct, r.copy])));
  check('索引区 version 与线上 .md frontmatter 逐字一致 (只改一边必失败)',
    idxRows.every((r) => r.version === mdVersions[r.slug]),
    JSON.stringify({ rows: idxRows.map((r) => [r.slug, r.version]), md: mdVersions }));
  const idxCount = await evalJs(`(document.querySelector('[data-skills-count]')||{}).textContent||''`);
  check('索引区标注「共 2 份 · 索引里列的就是全部」', /共 2 份/.test(idxCount), idxCount);
  await evalJs(`(() => { window.__copyBtn = document.querySelector('[data-copy-skill="bolloon-network"]'); window.__copyBtn.click(); return 1; })()`);
  await sleep(400);   // 剪贴板写入是异步的, 等它 settle 再读按钮文案
  const idxCopy = await evalJs(`window.__copyBtn.textContent`);
  check('索引区复制按钮真的可点 (点击 → 「已复制」)', idxCopy === '已复制', idxCopy);

  // ④ gateway.html 命令
  console.log('\n[4] gateway.html 粘贴命令跟随访问源');
  await cdp('Page.navigate', { url: `${BASE}/gateway.html` });
  await sleep(1500);
  const cmd = String(await evalJs(`(document.getElementById('skill-cmd')||{}).textContent`));
  check(`命令 = "${cmd}"`, cmd.startsWith('read ') && cmd.endsWith('/bolloon-gateway-join.md'), cmd);
  check('网关页 skills 栏仍然只给一条 read 命令, 旁边指向站内 skills 索引',
    (await evalJs(`document.querySelectorAll('#skills .skill-cmd code').length`)) === 1 &&
    (await evalJs(`!!document.querySelector('#skills a[href="skill.html#skills-index"]')`)) === true);

  // ⑤ 文档正文
  console.log('\n[5] /bolloon-gateway-join.md 线上正文');
  const doc = await fetchText(`${BASE}/bolloon-gateway-join.md`);
  check('HTTP 正文含手机端路径 A′', doc.includes('路径 A′'));
  check('HTTP 正文含 version: 1.3.0', doc.includes('version: 1.3.0'));
  check('含 name: bolloon-gateway-join', doc.includes('name: bolloon-gateway-join'));
  check('含 join_global_gateway', doc.includes('join_global_gateway'));
  check('含 publicKey (TOFU 契约)', doc.includes('publicKey'));
  check('含 §7 首次接触 TOFU', doc.includes('首次接触 TOFU'));
  check('含 §11 M1 任务闭环', doc.includes('## 11. 用买到的能力完成任务') && doc.includes('bolloon task'));

  // ⑤′ /bolloon-network.md 线上正文 (bolloon 主仓 skills/bolloon-network/SKILL.md 的原样镜像)
  console.log('\n[5b] /bolloon-network.md 线上正文 (主仓 SKILL.md 镜像)');
  const netDoc = await fetchText(`${BASE}/bolloon-network.md`);
  check('首行就是 frontmatter 起始 (---)，没有前缀空行', netDoc.startsWith('---\n'), JSON.stringify(netDoc.slice(0, 16)));
  check('frontmatter 头三行原样 + version 逐字 = 1.2.0 (不是「1.x.y 形状」匹配)',
    /^---\nname: bolloon-network\nversion: 1\.2\.0\ndescription: /.test(netDoc), JSON.stringify(netDoc.slice(0, 80)));
  check('frontmatter 关键块原样 (status/tier/protocol/capabilities/plannedCapabilities/paymentModes/hardRules)',
    netDoc.includes('\nstatus: active\n') && netDoc.includes('\ntier: capability\n') &&
    netDoc.includes('\nprotocol: bolloon-task/1\n') && netDoc.includes('capabilities:\n  - network.join') &&
    netDoc.includes('plannedCapabilities:') && netDoc.includes('paymentModes:') && netDoc.includes('hardRules:'));
  check('正文首尾都在 (没被截断/没被渲染成 HTML): 标题 + §⑥ 支付规范 + 附: 清单',
    netDoc.includes('# bolloon-network — 外部 Agent 接入 Skill') && netDoc.includes('## ⑥ 支付规范') &&
    netDoc.includes('## 附: 本 Skill 的 `(planned)` 清单'));
  check('正文含真命令 (bolloon task / bolloon setup / 54188), 不是占位摘要',
    netDoc.includes('bolloon task') && netDoc.includes('bolloon setup') && netDoc.includes('54188'));

  // ——— CDP Fetch 拦截: 用夹具数据确定性地驱动脉冲区的四种状态 ———
  // 注意: 文档 URL 里带着 ?pulse=<夹具地址>, 所以 urlPattern 也会命中文档本身 ——
  // 必须把非目标请求 (Document 等) 立刻 continueRequest, 否则 Page.navigate 永远不返回。
  const PULSE_PATTERN = '*network-pulse-verify*';
  const pausedQueue = [];
  const pausedWaiters = [];
  let shouldIntercept = () => false;
  // 多实例隔离用: 第二实例的来源 (直接失败 / 过期夹具) + 「让第一个实例的取数失败」开关
  const B_SRC = `${BASE}/network-pulse-verify-b.json`;
  let bMode = 'fail';
  let aFail = false;
  // 「缺 tasks* + agent_sites 为空」夹具 (第三档) 的开关
  let cMode = 'full';
  // 新事件 kind / 30s 轮询自动更新 夹具 (第四档) 的开关: base → 新 kind 快照; grown → 新 agent 加入后的快照
  let growMode = 'base';

  // ——— 夹具自证的取证通道 (只记账, 不改拦截行为) ———
  // 为什么需要: 靠拦截换夹具的断言, 一旦拦截没命中 (请求被放行去了 CDN / 命中缓存 / 超时),
  // 页面拿到的就是**真快照** —— 那种 DOM 形态与「页面坏了」一模一样, 红的时候分不清谁错。
  // 这里把「拦到什么、回了哪一份、还是压根没拦住」逐条记下来, 断言前的自证 (fxSelfProof)
  // 和失败消息都从这里取证 (请求 URL / 拦截模式 / 是否 CDN 接管)。
  const fxServed = new Map();      // tag → 拦截命中并回了这份夹具的次数 (页面自己的取数请求)
  const fxServedUrls = new Map();  // tag → 最后一次回夹具的请求 URL
  const fxFailed = new Map();      // tag → 我方**故意** failRequest 的次数 (unavailable 档夹具)
  const fxDiag = [];               // 最近 10 条拦截记录 (报错时一起打印)
  let fxFetchOn = false;           // CDP Fetch.enable 是否已发 (拦截链路的前置条件)
  let fxPattern = null;            // 当前拦截模式
  const fxClock = () => new Date().toISOString().slice(11, 19);
  const fxLog = (line) => { fxDiag.push(`${fxClock()} ${line}`); if (fxDiag.length > 10) fxDiag.shift(); };
  const fxHit = (tag, url) => { fxServed.set(tag, (fxServed.get(tag) || 0) + 1); fxServedUrls.set(tag, url); };
  const fxFailHit = (tag, url) => { fxFailed.set(tag, (fxFailed.get(tag) || 0) + 1); fxServedUrls.set(tag, url); };
  const shortUrl = (u) => String(u || '').replace(/^https?:\/\//, '').slice(0, 96);

  on('Fetch.requestPaused', (p) => {
    // 自证探针优先: 不受本节 shouldIntercept 开关影响, 也永不进手工队列。
    // 探针 URL 与夹具同 pattern (network-pulse-verify*) —— 它拿回 marker ⇒ 拦截链路对这类 URL 是活的。
    if (p.request.url.includes('network-pulse-verify-probe')) {
      const m = /[?&]tag=([^&]+)/.exec(p.request.url);
      const tag = m ? decodeURIComponent(m[1]) : 'unknown';
      fxLog(`探针命中 → 回探针夹具 marker=probe:${tag}`);
      fulfillJson(p.requestId, { __verify_fixture: 'probe:' + tag, probe_tag: tag, served_at: Date.now() });
      return;
    }
    // 文档请求也命中 pattern (URL 里带着 ?pulse=<夹具地址>), 必须放行, 否则 Page.navigate 不返回
    if (p.resourceType === 'Document' || !shouldIntercept(p)) {
      if (p.resourceType !== 'Document') fxLog(`放行(未拦) ${shortUrl(p.request.url)}`);
      cdp('Fetch.continueRequest', { requestId: p.requestId }).catch(() => {});
      return;
    }
    // 第二实例的来源: 按 bMode 直接失败或回过期夹具 (不走手工队列)
    if (p.request.url.includes('network-pulse-verify-b')) {
      if (bMode === 'fail') {
        fxFailHit('b-fail', p.request.url);
        fxLog(`B 档 → 我方故意 failRequest (ConnectionRefused) ${shortUrl(p.request.url)}`);
        cdp('Fetch.failRequest', { requestId: p.requestId, errorReason: 'ConnectionRefused' }).catch(() => {});
      } else {
        fxHit('expired-b', p.request.url);
        fxLog(`B 档 → 回过期夹具 (expired-b) ${shortUrl(p.request.url)}`);
        fulfillJson(p.requestId, FX_EXPIRED);
      }
      return;
    }
    // 第三档: cMode='full' → FX_LIVE; 'no-tasks' → FX_NO_TASKS (缺 tasks* 且 agent_sites=[]);
    //        'pulse-zero' → FX_PULSE_ZERO (0 任务 + 25 行, 快照自带口径说明);
    //        'pulse-zero-legacy' → 同形但没有口径三块 (口径行必须整行隐藏)
    if (p.request.url.includes('network-pulse-verify-c')) {
      const tag = cMode === 'full' ? 'live' : cMode === 'no-tasks' ? 'no-tasks'
        : cMode === 'pulse-zero' ? 'pulse-zero' : 'pulse-zero-legacy';
      fxHit(tag, p.request.url);
      fxLog(`C 档 (${cMode}) → 回夹具 ${tag}`);
      fulfillJson(p.requestId,
        cMode === 'full' ? FX_LIVE
          : cMode === 'no-tasks' ? FX_NO_TASKS
            : cMode === 'pulse-zero' ? FX_PULSE_ZERO
              : FX_PULSE_ZERO_LEGACY);
      return;
    }
    // 第四档: 新事件 kind + 数值变化自动反映 —— 每轮请求都按 growMode 自动回夹具 (不走手工队列),
    // 这样 30s 自动轮询拿到的是「新 agent 加入后」的快照, 而验收无需手动触发 refresh。
    if (p.request.url.includes('network-pulse-verify-grow')) {
      const tag = growMode === 'grown' ? 'grown' : 'newkinds';
      fxHit(tag, p.request.url);
      fxLog(`Grow 档 (${growMode}) → 回夹具 ${tag}`);
      fulfillJson(p.requestId, growMode === 'grown' ? FX_GROWN : FX_NEWKINDS);
      return;
    }
    // 「让第一个实例失败」开关
    if (aFail && p.request.url.includes('network-pulse-verify.json')) {
      fxFailHit('a-fail', p.request.url);
      fxLog(`A 档 → 我方故意 failRequest (aFail) ${shortUrl(p.request.url)}`);
      cdp('Fetch.failRequest', { requestId: p.requestId, errorReason: 'ConnectionRefused' }).catch(() => {});
      return;
    }
    fxLog(`进手工队列 (等验收侧 fulfill) ${shortUrl(p.request.url)}`);
    const w = pausedWaiters.shift();
    if (w) w(p); else pausedQueue.push(p);
  });
  const nextPaused = (timeout = 8000) => {
    if (pausedQueue.length) return Promise.resolve(pausedQueue.shift());
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('等待 Fetch.requestPaused 超时')), timeout);
      pausedWaiters.push((p) => { clearTimeout(t); resolve(p); });
    });
  };
  const fulfillJson = (requestId, obj) => cdp('Fetch.fulfillRequest', {
    requestId,
    responseCode: 200,
    responseHeaders: [
      { name: 'Content-Type', value: 'application/json' },
      { name: 'Cache-Control', value: 'no-store' },
    ],
    body: Buffer.from(JSON.stringify(obj), 'utf8').toString('base64'),
  });
  // CDP Fetch 开关的唯一入口 (记账用: 自证要报「拦截模式 / Fetch 是否已开」)
  const fxEnable = async (pattern) => {
    await cdp('Fetch.enable', { patterns: [{ urlPattern: pattern, requestStage: 'Request' }] });
    fxFetchOn = true; fxPattern = pattern;
  };
  const fxDisable = async () => { await cdp('Fetch.disable'); fxFetchOn = false; };

  const T0 = Date.now();
  // 活动文本故意带 <b>: 用它证明渲染走 textContent 而不是 innerHTML
  const MARKUP_TEXT = { zh: '节点 <b>42</b> 发布 manifest & 计数', en: 'Node <b>42</b> published a manifest & counters' };
  const iso = (ms) => new Date(ms).toISOString();
  // —— 链上活动夹具 (confirmed_activity 冻结形状) ——
  // 故意混进 全长 40 位地址 / 全长 64 位 sha256 / 裸 64 位 hex:
  // 页面必须只显示短写 (0x12ab…b5c6 / sha256:cc33…), 全长绝不进可见文本。
  const ACT_LONG_ADDR = '0x12ab34cd56ef7890a1b2c3d4e5f60718293a4b5c6';
  const ACT_LONG_HASH = 'sha256:cc33dd44ee55ff6677889900aabbccddeeff00112233445566778899aabbccdd';
  const ACT_BARE_HASH = 'a1b2c3d4e5f60718293a4b5c6d7e8f90112233445566778899aabbccddeeff00';
  // 任务标识里带 <b>: 证明表格单元格也走 textContent (标签不会被解析)
  const MARKUP_TASK = 'sha256:<b>42</b> probe';
  const ACT_LIVE = [
    { task: 'sha256:1a2b3c4d', kind: 'task_created', state: 'active', chain_id: 84532, block: 47142222,
      tx: 'sha256:9f0e1d2c', confirmations: 12, finality: 'observed', at: iso(T0 - 3 * 60000) },
    { task: ACT_LONG_ADDR, kind: 'task_completed', state: 'released', chain_id: 84532, block: 47142500,
      tx: ACT_LONG_HASH, confirmations: 128, finality: 'finalized', at: iso(T0 - 40 * 60000) },
    { task: 'sha256:aa11bb22', kind: 'task_accepted', state: 'active', chain_id: 84532, block: 47142301,
      tx: ACT_BARE_HASH, confirmations: 42, finality: 'confirmed', at: iso(T0 - 8 * 60000) },
    { task: 'sha256:77aa88bb', kind: 'trade_settled', state: 'refunded', chain_id: 84532, block: 47142610,
      tx: 'sha256:deadbeef', confirmations: 3, finality: 'observed', at: iso(T0 - 20 * 60000) },
    { task: 'sha256:55cc66dd', kind: 'trade_verified', state: 'expired', chain_id: 84532, block: 47142699,
      tx: 'sha256:cafebabe', confirmations: 6, finality: 'confirmed', at: iso(T0 - 15 * 60000) },
    { task: 'sha256:11ee22ff', kind: 'unknown_future_kind_2099', state: 'disputed', chain_id: 84532, block: 47142777,
      tx: 'sha256:0f1e2d3c', confirmations: 0, finality: 'finalized', at: iso(T0 - 5 * 60000) },
    { task: 'sha256:99aa00bb', kind: 'task_created', state: 'unknown', chain_id: 84532, block: 47142800,
      tx: 'sha256:1234abcd', confirmations: 1, finality: 'unknown', at: iso(T0 - 2 * 60000) },
    // task 缺失 → 用 tx 当任务标识 (仍要画一行, 不能空着)
    { kind: 'task_accepted', state: 'active', chain_id: 84532, block: 47142900,
      tx: 'sha256:abcdef12', confirmations: 2, finality: 'observed', at: iso(T0 - 60000) },
    // task 与 tx 都空 → 这一条不该画出来 (宁可少一行, 不留空行)
    { task: '', tx: '', kind: 'task_created', state: 'active', chain_id: 84532, block: 47142901,
      confirmations: 1, finality: 'observed', at: iso(T0 - 30000) },
  ];
  // IPNS 夹具: 三种合法形态 (裸 k51… / ipns://12D3… / /ipns/k51…) + 一条非法 (必须被丢弃, 不渲染链接)
  const CID_1 = 'k51qzi5uqu5dlvj2baxnqndepeb86cbk3ng7n3i46uzyxzyqj2xjonzllnv0v8';
  const CID_2 = '12D3KooWQq7fUuY8gTZ2mNpRx4vBcDeFkLg';
  const CID_3 = 'k51qzi5uqu5dgn2p8v06tw5xrs3lhhh9sfwvbm2baxnqndepeb86cbk3ng';
  const IPNS_OK = [CID_1, 'ipns://' + CID_1, '/ipns/' + CID_1, 'https://ipfs.io/ipns/' + CID_2, 'ipns://' + CID_2, '/ipns/' + CID_3, CID_3];
  const IPNS_BAD = ['', '   ', 'hello', 'ipns://', '/ipns/', 'javascript:alert(1)', 'https://evil.example/x',
    'k51', 'QmTooShort', 'file:///etc/passwd', 'data:text/html,x', CID_1 + '/extra/path'];
  const FX_LIVE = {
    status: 'live', generated_at: T0 - 3 * 60000, fresh_until: T0 + 3600000,
    scope: 'observed', scope_label: { zh: '当前节点观察到', en: 'Observed by this node' },
    totals: { nodes: 7, agents: 12, active_agents: 4, seen_last_24h: 5, tasks: 21, tasks_completed: 13, tasks_verified: 6, signatures: 42 },
    agent_sites: [
      { label: 'leo-node', ipns: CID_1, added_at: T0 - 86400000 },
      { label: 'research', ipns: 'ipns://' + CID_2, added_at: T0 - 3600000 },
      { label: 'mirror', ipns: '/ipns/' + CID_3, added_at: T0 - 60000 },
      { label: 'bogus', ipns: 'javascript:alert(1)', added_at: T0 },       // 非法 → 必须不渲染
    ],
    confirmed_activity_source: 'chain-index',
    confirmed_activity: ACT_LIVE,
    capabilities: [{ key: 'code-review', count: 6 }, { key: 'translation', count: 3 }, { key: 'other', count: 2 }],
    recent_activity: [
      { kind: 'manifest_published', at: T0 - 3 * 60000, text: MARKUP_TEXT },
      { kind: 'node_joined', at: T0 - 2 * 3600000, text: { zh: '一个新节点加入', en: 'A node joined' } },
    ],
    notes: ['计数按隐私阈值合并', '观察窗口内的聚合值'],
  };
  // 缺 tasks* 三个聚合计数 + confirmed_activity 空 + agent_sites 空数组:
  // 证明「拿不到就不显示」「空表要说明白」「空 ≠ 没数据」
  const FX_NO_TASKS = {
    status: 'live', generated_at: T0 - 60000, fresh_until: T0 + 3600000,
    scope: 'verified', scope_label: { zh: '网络观察快照', en: 'Verified network snapshot' },
    totals: { nodes: 2, agents: 3, active_agents: 0, seen_last_24h: 3 },
    confirmed_activity_source: 'none',
    confirmed_activity: [],
    agent_sites: [],
    capabilities: [{ key: 'search', count: 1 }],
    recent_activity: [],
    notes: [],
  };
  // status 仍写 live, 靠 fresh_until 已过来证明「过期即 stale, 不伪装实时」
  const FX_EXPIRED = {
    status: 'live', generated_at: T0 - 3600000, fresh_until: T0 - 60000,
    scope: 'verified', scope_label: { zh: '网络观察快照', en: 'Verified network snapshot' },
    totals: { nodes: 9, agents: 15, active_agents: 0, seen_last_24h: 2 },
    capabilities: [{ key: 'search', count: 4 }],
    recent_activity: [],
    notes: [],
  };
  const FX_STALE_FLAG = {
    status: 'stale', generated_at: T0 - 7200000, fresh_until: T0 + 60000,
    scope: 'observed', scope_label: { zh: '当前节点观察到', en: 'Observed by this node' },
    totals: { nodes: 3, agents: 3, active_agents: 1, seen_last_24h: 1 },
    capabilities: [], recent_activity: [], notes: ['快照已过期'],
  };

  // ——— 链上活动表的容错契约: 认不出的 kind / state / finality 一律原样显示, 空标识不画行 ———
  const EN_ONLY_TEXT = 'EN-only server text (no zh)';
  // 基准轮 3 条: ① 任务标识里带 <b> (证明单元格走 textContent)
  //             ② 枚举全认不出 (kind/state/finality 原样显示, 不猜)
  //             ③ task 与 tx 全空 (必须不画这一行)
  const FX_ACT_ROWS = [
    { task: MARKUP_TASK, kind: 'task_created', state: 'active', chain_id: 84532, block: 47150000,
      tx: 'sha256:11112222', confirmations: 2, finality: 'observed', at: iso(T0 - 30000) },
    { task: 'sha256:abcd1234', kind: 'brand_new_kind_2099b', state: 'settling', chain_id: 1, block: 21000000,
      tx: 'sha256:33334444', confirmations: 9, finality: 'settled-weird', at: iso(T0 - 40000) },
    { task: '', tx: '', kind: 'task_completed', state: 'active', chain_id: 84532, block: 47150001,
      confirmations: 1, finality: 'observed', at: iso(T0 - 50000) },
  ];
  const FX_NEWKINDS = {
    status: 'live', generated_at: T0 - 60000, fresh_until: T0 + 600000,
    scope: 'observed', scope_label: { zh: '当前节点观察到', en: 'Observed by this node' },
    totals: { nodes: 7, agents: 12, active_agents: 4, seen_last_24h: 5, tasks: 21, tasks_completed: 13, tasks_verified: 6, signatures: 3 },
    confirmed_activity_source: 'pulse-events',
    confirmed_activity: FX_ACT_ROWS,
    agent_sites: [],
    capabilities: [{ key: 'code-review', count: 6 }],
    recent_activity: [],
    notes: [],
  };
  // 「公开页数字不许打架」夹具 (2026-09-22 leo 拍板): 复刻真快照那一幕 ——
  // 小结行是 totals.tasks=0 / tasks_completed=0 / signatures=0 (24h 脉冲事件口径),
  // 而 confirmed_activity 有 **25 行** (链上索引口径), 且快照自带 activity_totals (同源计数) +
  // totals_scope.differs_from_activity + chain_id_scope (本机 31337 · 非公网)。
  // 页面必须把这两套口径的关系讲在明面上 ——「0 个任务」与「25 行任务」并存而不解释 = 验收失败。
  const ZERO_TASKS_NOTE = '口径不同, 不是数据丢失: totals.tasks/tasks_completed/tasks_verified/signatures 只数本节点 24h 窗口内的脉冲事件 (本快照 tasks=0 · tasks_completed=0 · tasks_verified=0 · signatures=0); 上表 25 行来自链上索引 (全量, 不是 24h 窗口) —— 同源计数见 activity_totals';
  const ACT_25 = Array.from({ length: 25 }, (_, i) => ({
    // 12 个不同任务 (i % 12) × 三种事件 → 与真快照的 25 行 / 12 任务同形
    task: 'sha256:' + (i % 12 + 16).toString(16).padStart(2, '0').repeat(4),
    kind: i % 3 === 0 ? 'task_created' : (i % 3 === 1 ? 'task_completed' : 'trade_settled'),
    state: i % 3 === 1 ? 'active' : (i % 3 === 2 ? 'released' : 'active'),
    chain_id: 31337, block: 676 - i,
    tx: 'sha256:' + (i + 48).toString(16).padStart(2, '0').repeat(4),
    confirmations: 1 + i,
    finality: i < 4 ? 'confirmed' : 'finalized',
    at: iso(T0 - i * 60000),
  }));
  const FX_PULSE_ZERO = {
    status: 'live', generated_at: T0 - 60000, fresh_until: T0 + 3600000,
    scope: 'verified', scope_label: { zh: '网络观察快照', en: 'Verified network snapshot' },
    totals: { nodes: 3, agents: 4, active_agents: 3, seen_last_24h: 4, tasks: 0, tasks_completed: 0, tasks_verified: 0, signatures: 0 },
    totals_scope: {
      source: 'pulse-events', window_ms: 86400000,
      label: { zh: '只统计本节点 24h 观察窗口内收到的脉冲事件 (本节点自己上报的)', en: 'Only pulse events received by this node within the 24h observation window' },
      differs_from_activity: true,
    },
    confirmed_activity_source: 'chain-index',
    confirmed_activity: ACT_25,
    activity_totals: {
      source: 'chain-index', rows: 25, tasks: 12, tasks_completed: 7, tasks_settled: 6,
      by_finality: { observed: 0, confirmed: 4, finalized: 21 }, gates: { confirmed: 1, finalized: 12 },
    },
    chain_id_scope: {
      chain_ids: [31337], activity_chain_id: 31337,
      activity_chain_label: { zh: '本机隔离开发链', en: 'local isolated dev chain' },
      is_public_network: false, public_network_rows: 0,
      public_network: { chain_id: 84532, label: { zh: 'Base Sepolia 测试网', en: 'Base Sepolia testnet' } },
      note: { zh: 'chain_id 归属: 上表 25 行来自 chainId 31337（本机隔离开发链） · 公网链（Base Sepolia 测试网 84532）0 行 —— 这不是公网活动', en: 'chain_id scope: all 25 rows come from chainId 31337' },
    },
    agent_sites: [],
    capabilities: [{ key: 'other', count: 3 }],
    recent_activity: [],
    notes: ['多签名来源汇总 (2 个签名节点)', 'confirmed_activity 来自链上索引 (chain-index): 25 行 · 12 个不同任务 · finality 分布 observed=0 / confirmed=4 / finalized=21', ZERO_TASKS_NOTE],
  };
  // 老快照 (有 25 行但**没有** activity_totals/totals_scope/chain_id_scope): 口径行必须整行隐藏, 不猜不编
  const FX_PULSE_ZERO_LEGACY = (() => {
    const c = { ...FX_PULSE_ZERO };
    delete c.activity_totals; delete c.totals_scope; delete c.chain_id_scope;
    return c;
  })();
  // 下一轮轮询的快照: 一个新 agent 加入 (计数自己变) + 表里多出一条已验证交易
  const FX_GROWN = {
    status: 'live', generated_at: T0 + 60000, fresh_until: T0 + 900000,
    scope: 'observed', scope_label: { zh: '当前节点观察到', en: 'Observed by this node' },
    totals: { nodes: 8, agents: 13, active_agents: 5, seen_last_24h: 6, tasks: 22, tasks_completed: 14, tasks_verified: 7, signatures: 42 },
    confirmed_activity_source: 'chain-index',
    confirmed_activity: [
      { task: 'sha256:ffeeddcc', kind: 'trade_verified', state: 'released', chain_id: 84532, block: 47150999,
        tx: 'sha256:99887766', confirmations: 64, finality: 'finalized', at: iso(T0 - 5000) },
    ].concat(FX_ACT_ROWS.slice(0, 2)),
    agent_sites: [],
    capabilities: [{ key: 'code-review', count: 6 }],
    recent_activity: [],
    notes: [],
  };
  // 首页活动流仍在用的「只有一种语言」夹具 (语言回落规则: 缺当前语言退回另一种, 仍是服务端原文)
  const FX_EN_ONLY = {
    status: 'live', generated_at: T0 - 30000, fresh_until: T0 + 600000,
    scope: 'observed', scope_label: { zh: '当前节点观察到', en: 'Observed by this node' },
    totals: { nodes: 7, agents: 12, active_agents: 4, seen_last_24h: 5, tasks: 21, tasks_completed: 13, tasks_verified: 6, signatures: 42 },
    confirmed_activity_source: 'chain-index',
    confirmed_activity: [],
    agent_sites: [],
    recent_activity: [{ kind: 'agent_announced_unknown_kind', at: T0 - 20000, text: { en: EN_ONLY_TEXT } }],
    notes: [],
  };

  // ═══════════════ 夹具自证: 让这一节的门**不会撒谎** ═══════════════
  // 病灶 (2026-09-22 实测): 靠 CDP Fetch 拦快照请求换夹具的断言, 一旦拦截没命中
  // (请求被放行到线上 / 命中 CDN 缓存 / 页面太慢还没渲染), 页面拿到的是**真快照** ——
  // 那时 DOM 的形态与「页面坏了」长得一模一样 (rows:0 / [] ), 红的时候分不清谁错。
  // 处方: 每次注夹具后、断言之前, 先过三道证, 拿不到就在断言前明确失败并给出可操作信息:
  //   ① 送达证 (拦截器侧): 页面自己的取数请求被拦住, 且我们回给它的就是带 marker 的这份夹具
  //   ② 链路证 (页面侧): 在页面里 fetch 一个同 pattern 的探针 URL, 必须拿回带 marker 的 JSON
  //                       —— 拿不到 = 拦截链路整体没生效 → 报「夹具未生效(拦截未命中)」
  //   ③ 消费证 (DOM 侧): DOM 里出现只有这份夹具才有的标记 (夹具 notes 里的 __vfy:<tag>)
  //                       —— 拿不到 = 页面没消费夹具 → 报「页面错 · 夹具已送达但页面没渲染」
  // 断言只加不减: 自证没过时, 该组原有的每条断言照旧计入 failed, 但报的是「夹具错 · 未生效」
  // (见 check()), 读者一眼知道这不是页面缺陷。三道证都过 → 失败才是真页面错。
  const FX_MARK_FIELD = '__verify_fixture';
  // 夹具标记的文本形态: 结尾的 :__ 是**边界符** —— 没有它, tag 'pulse-zero' 会命中
  // 'pulse-zero-legacy' 的标记 (前缀包含), 自证就成了自欺。
  const fxNoteText = (tag) => `__vfy:${tag}:__`;
  const fxMark = (fx, tag) => {
    fx[FX_MARK_FIELD] = tag;
    // 标记同时写进 notes: notes 是页面**真会渲染**的字段 (网关页/克隆实例都有),
    // 于是「DOM 里出现 __vfy:<tag>:__」= 页面确实拿了这份夹具, 且整轮渲染已跑完 (redraw 一次画完)。
    fx.notes = (fx.notes || []).filter((n) => !/^__vfy:/.test(n)).concat([fxNoteText(tag)]);
    return fx;
  };
  fxMark(FX_LIVE, 'live');
  fxMark(FX_NO_TASKS, 'no-tasks');
  fxMark(FX_EXPIRED, 'expired');
  fxMark(FX_STALE_FLAG, 'stale-flag');
  fxMark(FX_NEWKINDS, 'newkinds');
  fxMark(FX_GROWN, 'grown');
  fxMark(FX_EN_ONLY, 'en-only');
  fxMark(FX_PULSE_ZERO, 'pulse-zero');
  fxMark(FX_PULSE_ZERO_LEGACY, 'pulse-zero-legacy');   // 覆盖继承来的 __vfy:pulse-zero

  const fxNotesHas = (tag) => (v) => !!(v && typeof v.notes === 'string' && v.notes.includes(fxNoteText(tag)));
  // 首页紧凑版没有 notes 元素 → 用「只有夹具才有的形态」当消费证 (夹具值是脚本自己定的, 真快照撞不出来)
  const fxFeedHas = (text) => (v) => !!(v && Array.isArray(v.feedText) && v.feedText.some((t) => t === text));
  const fxVals = (obj) => (v) => !!(v && Object.keys(obj).every((k) => v[k] === obj[k]));

  const fxProbeUrl = (tag) => `${BASE}/network-pulse-verify-probe.network-pulse.json?tag=${encodeURIComponent(tag)}&n=${Math.random().toString(36).slice(2)}`;
  // 探针 URL 特意同时含 'network-pulse-verify'(夹具 pattern) 与 'network-pulse.json'(回退档 pattern),
  // 这样在任何一节里它都会被拦到 —— 「链路证不适用」这种情况不存在。
  // ② 链路证: 在**页面里** fetch 探针 URL (与夹具同 pattern)。拿回 marker ⇒ 这类 URL 的拦截是活的;
  //    拿回 200 text/html / 404 ⇒ 请求根本没被拦到, 被线上 (Pages 的 SPA 兜底 / CDN 缓存 / 404) 接管了。
  const fxProbe = async (tag) => {
    const url = fxProbeUrl(tag);
    const r = await evalJs(`(async () => {
      try {
        const ctl = typeof AbortController === 'function' ? new AbortController() : null;
        const to = ctl ? setTimeout(function () { ctl.abort(); }, 5000) : null;
        const res = await fetch(${JSON.stringify(url)}, { cache: 'no-store', signal: ctl ? ctl.signal : undefined });
        if (to) clearTimeout(to);
        const body = await res.text();
        let j = null; try { j = JSON.parse(body); } catch (e) { j = null; }
        return { ok: true, status: res.status, ctype: res.headers.get('content-type') || '',
                 redirected: res.redirected, finalUrl: res.url, len: body.length,
                 marker: j ? j[${JSON.stringify(FX_MARK_FIELD)}] : null, head: body.slice(0, 44) };
      } catch (e) { return { ok: false, err: String((e && e.name) || '') + ' ' + String((e && e.message) || e) }; }
    })()`).catch((e) => ({ ok: false, err: 'eval 失败: ' + e.message }));
    return { url, ...(r || { ok: false, err: '无返回值' }) };
  };
  const fxProbeDesc = (p) => {
    if (!p) return '探针没跑起来';
    if (p.ok === false) return `✘ 探针异常 (${p.err})`;
    const looks = p.marker === 'probe:__tag__' ? '' : (p.marker ? `marker=${p.marker}` : `marker=无 (head=${JSON.stringify(p.head)})`);
    return `✘ HTTP ${p.status} · ${p.ctype || '(无 content-type)'}${p.redirected ? ` · 被重定向到 ${p.finalUrl}` : ''} · ${looks}`;
  };

  // —— 断言前的自证: 等「消费证」出现 (页面渲染是异步的, 固定 sleep 会量到中间态 —— 这是老毛病的根) ——
  const fxSelfProof = async (tag, { servedKey = tag, domSignal, rootSel = '#pulse', probeExpr = null, timeoutMs = 20000, what = '', mode = 'fulfill', quietOk = false } = {}) => {
    const t0 = Date.now();
    const probe = await fxProbe(tag);
    const probeOk = probe && probe.ok === true && probe.marker === `probe:${tag}`;
    const signal = domSignal || fxNotesHas(tag);
    let dom = null, consumed = false;
    while (Date.now() - t0 < timeoutMs) {
      dom = await evalJs(probeExpr || pulseProbe(rootSel)).catch(() => null);
      if (dom && signal(dom)) { consumed = true; break; }
      await sleep(200);
    }
    const waited = ((Date.now() - t0) / 1000).toFixed(1);
    const served = fxServed.get(servedKey) || 0;
    const failedN = fxFailed.get(servedKey) || 0;
    const injected = mode === 'fail' ? failedN : served;      // 「我方真的把这份夹具给了页面」的证据
    // 送达 = ① 消费证已出现, 或 ② 我方确实把这份夹具回过/把请求打失败过 (fxServed / fxFailed 计数)。
    // 注意**不把探针通过**算作送达: 探针只证明「拦截链路是活的」, 不证明「这个夹具到了这个页面」。
    const delivered = consumed || injected > 0;
    let reason = '';
    if (!consumed && !delivered) {
      if (!fxFetchOn) reason = 'CDP Fetch 没启用 (拦截根本没开)';
      else if (!probeOk) reason = '拦截未命中';
      else reason = '页面没对本节的夹具 URL 发起请求 (取数走了别的来源)';
    }
    const url = fxServedUrls.get(servedKey) || probe.url;
    const v = { tag, delivered, consumed, reason, probe, probeOk, served, failedN, mode, waited, url, dom, what };
    // —— 自证结果一律打印出来 (绿也要看见它验了什么; 红要给到能直接定位的信息) ——
    const head = `[${tag}${what ? ' · ' + what : ''}]`;
    // 「消费证」到底是哪一种: 默认是夹具 notes 里的标记; 传了 domSignal 的 (失败档 / 首页紧凑版) 是自定义形态。
    const proofKind = domSignal ? '自定义消费证' : `DOM 标记 ${fxNoteText(tag)}`;
    const domNow = dom ? `state=${dom.state} rows=${dom.act ? dom.act.rowCount : 'n/a'} notes=${JSON.stringify(String(dom.notes).slice(0, 40))}` : '(探针读不到 DOM)';
    const servedText = mode === 'fail' ? `我方故意 failRequest ${failedN} 次` : `回夹具 ${served} 次`;
    if (consumed) {
      if (!quietOk) {
        console.log(`  🔒 夹具自证 ${head} ✔ ${servedText} · 链路证 ${probeOk ? `marker=probe:${tag}` : `探针未过(${fxProbeDesc(probe)})`}` +
          ` · 消费证 ${proofKind} 已满足 (等了 ${waited}s)`);
      }
    } else if (delivered) {
      console.log(`  🔒 夹具自证 ${head} ⚠️ **夹具已送达但页面没消费** (${servedText} · 链路证 ${probeOk ? '✔' : fxProbeDesc(probe)})`);
      console.log(`       请求 URL  : ${url}`);
      console.log(`       消费证    : ✘ ${proofKind} 未出现 (等了 ${waited}s) · 现况 ${domNow}`);
      console.log(`       结论      : 夹具确实到了页面却没渲染出来 → 下面这组失败按「页面错」计`);
    } else {
      console.log(`  🔒 夹具自证 ${head} ✘ **夹具未生效(${reason})**`);
      console.log(`       请求 URL  : ${url}`);
      console.log(`       拦截模式  : ${fxPattern || '(无)'} · Fetch.enable ${fxFetchOn ? '已发' : '**没发**'} · requestStage=Request`);
      console.log(`       送达证    : ${mode === 'fail' ? `我方故意 failRequest ${failedN} 次` : `页面取数请求被回夹具 ${served} 次`}`);
      console.log(`       链路证    : ${probeOk ? `✔ marker=probe:${tag}` : fxProbeDesc(probe)}`);
      console.log(`       消费证    : ✘ ${proofKind} 未出现 (等了 ${waited}s) · 现况 ${domNow}`);
      if (fxDiag.length) console.log(`       最近拦截  : ${fxDiag.join(' ; ')}`);
      console.log(`       结论      : 本节断言按「夹具错 · 未生效」计入失败 —— 它们不代表页面有缺陷`);
    }
    fxNow = v;
    return v;
  };
  // 手工 fulfill / failRequest 的记账包装 (自证要的「送达证」对这类请求同样成立)
  const fxServe = (paused, obj, tag) => { if (paused) fxHit(tag, paused.request.url); return fulfillJson(paused.requestId, obj); };
  const fxFailServe = (paused, tag) => { if (paused) fxFailHit(tag, paused.request.url); return cdp('Fetch.failRequest', { requestId: paused.requestId, errorReason: 'ConnectionRefused' }); };
  // 只读自证结论的轻量包装: 给「没等到请求被拦」这类前置条件用 (不带探针, 不改变本次口径)
  const fxPre = (tag, ok, why) => {
    const v = { tag, delivered: !!ok, consumed: !!ok, reason: ok ? '' : why, pre: true };
    if (!ok) {
      console.log(`  🔒 夹具自证 [${tag}] ✘ **夹具未生效(${why})**`);
      console.log(`       拦截模式  : ${fxPattern || '(无)'} · Fetch.enable ${fxFetchOn ? '已发' : '**没发**'}`);
      if (fxDiag.length) console.log(`       最近拦截  : ${fxDiag.join(' ; ')}`);
      console.log(`       结论      : 本节断言按「夹具错 · 未生效」计入失败 —— 它们不代表页面有缺陷`);
    }
    fxNow = v;
    return v;
  };
  const fxOff = () => { fxNow = null; };

  // ⑥ 链上活动 (网关页主体 = 一句短说明 + 小结行 + 一张表)
  console.log('\n[6] gateway.html 链上活动 (公开只读接口 / confirmed_activity)');
  const pulseSrc = `${BASE}/network-pulse-verify.json`;
  const errStart = consoleErrors.length;
  shouldIntercept = (p) => p.request.url.includes('network-pulse-verify');   // 只拦取数请求 (文档已放行)
  await fxEnable(PULSE_PATTERN);
  await cdp('Page.navigate', { url: `${BASE}/gateway.html?pulse=${encodeURIComponent(pulseSrc)}` });
  let req1 = null;
  try { req1 = await nextPaused(9000); } catch { /* 下面按 DOM 判断 */ }
  await sleep(400);

  const region = await evalJs(`(() => {
    const s = document.getElementById('pulse');
    if (!s) return null;
    const before = (a, b) => !!(a && b && (a.compareDocumentPosition(b) & 4));
    return {
      state: s.getAttribute('data-pulse-state'),
      ariaLive: !!s.querySelector('[aria-live="polite"]'),
      role: (s.querySelector('[role="status"]') || {}).getAttribute ? s.querySelector('[role="status"]').getAttribute('role') : null,
      caveat: (s.querySelector('.pulse-caveat') || {}).textContent || '',
      states: Array.from(s.querySelectorAll('.pulse-state-text')).map(e => e.getAttribute('data-state')),
      summaryKeys: Array.from(s.querySelectorAll('.pulse-summary [data-pulse-total]')).map(e => e.getAttribute('data-pulse-total')),
      order: Array.from(document.querySelectorAll('section[id]')).map(x => x.id),
      pulseFirst: before(s, document.getElementById('skills')) && before(s, document.getElementById('join')),
      idsInside: s.querySelectorAll('[id]').length,
      legacy: s.querySelectorAll('.pulse-stats, .pulse-stat, .pulse-grid, .pulse-cap-list, [data-pulse-caps], [data-pulse-feed]').length,
      h1: (document.querySelector('h1') || {}).textContent || '',
      headers: Array.from(s.querySelectorAll('.pulse-table thead th')).map((th) => th.textContent.trim()),
      hasTable: !!s.querySelector('[data-pulse-activity]'),
      hasBody: !!s.querySelector('[data-pulse-activity-body]'),
      hasEmpty: !!s.querySelector('[data-pulse-activity-empty]'),
      hasSource: !!s.querySelector('[data-pulse-activity-source]'),
      caption: (s.querySelector('.pulse-table caption') || {}).textContent || '',
    };
  })()`);
  check('gateway.html 存在 #pulse 链上活动区 (根 = [data-pulse])', !!region, '未找到 #pulse');
  check('活动区有 aria-live=polite + role=status', !!region && region.ariaLive && region.role === 'status', JSON.stringify(region && { a: region.ariaLive, r: region.role }));
  check('四种状态文案都在 DOM (loading/live/stale/unavailable)',
    !!region && ['loading', 'live', 'stale', 'unavailable'].every((s) => region.states.includes(s)),
    JSON.stringify(region && region.states));
  check('「不是全网精确总量」可见 (zh)', !!region && region.caveat.includes('不是全网精确总量'), region && region.caveat);
  check('活动表四个钩子齐 (table / tbody / 空态 / 数据源标注)',
    !!region && region.hasTable && region.hasBody && region.hasEmpty && region.hasSource,
    JSON.stringify(region && { t: region.hasTable, b: region.hasBody, e: region.hasEmpty, s: region.hasSource }));
  check('表头 7 列 = 任务|状态|事件|网络|区块|确认数 / 最终性|时间',
    !!region && JSON.stringify(region.headers) === JSON.stringify(['任务', '状态', '事件', '网络', '区块', '确认数 / 最终性', '时间']),
    JSON.stringify(region && region.headers));
  check('小结行钩子 = nodes/agents/tasks/tasks_completed/tasks_verified/signatures (不再有 active/24h)',
    !!region && JSON.stringify(region.summaryKeys) === JSON.stringify(['nodes', 'agents', 'tasks', 'tasks_completed', 'tasks_verified', 'signatures']),
    JSON.stringify(region && region.summaryKeys));
  check('旧三块 (8 个数字格 / 能力分布 / 最近活动) 在网关页活动区里已不存在',
    !!region && region.legacy === 0, String(region && region.legacy));
  check('网关页已去掉「加入网络」序厅 (页面里没有大字 h1 占屏)',
    !!region && !/加入网络/.test(region.h1), JSON.stringify(region && region.h1));
  check('页面顺序: 链上活动 → 加入方式 → 如何加入 → manifest → 端点 → 开发者',
    !!region && JSON.stringify(region.order) === JSON.stringify(['pulse', 'skills', 'join', 'manifest', 'endpoints', 'developer']),
    JSON.stringify(region && region.order));
  check('链上活动区在「加入方式 / 如何加入」之前 (仪表盘入口先给数据)',
    !!region && region.pulseFirst === true, JSON.stringify(region && region.pulseFirst));
  check('活动区内部不再依赖 id (只用 data-pulse-* 钩子, 避免多实例撞 id)',
    !!region && region.idsInside === 0, region && String(region.idsInside));

  // 首次 loading 这批断言吃「请求被拦住挂着」这个前置 (拦不住 = 页面可能已拿到真快照) →
  // 先自证, 拿不到就在断言前明确报「夹具未生效」, 不把取不到算成页面缺陷。
  fxPre('live', !!req1, '初始取数请求 9s 内没被 CDP Fetch 拦住 (页面可能已拿到真快照)');
  const loading = await evalJs(pulseProbe('#pulse'));
  check('首次 loading 状态 + 数值占位「—」',
    loading.state === 'loading' && loading.visible.includes('正在读取快照') && loading.nodes === '—' && loading.api,
    JSON.stringify({ s: loading.state, v: loading.visible, n: loading.nodes, api: loading.api }));
  check('?pulse= 参数被当作接口地址', (await evalJs('window.__bolloonPulse.source()')) === 'endpoint');
  check('请求真的发出 (CDP 拦到 #pulse 的取数)', !!req1, req1 ? '' : '未拦到请求 — 可能没发起');
  // 活动区小结数字的字号 = 后面判断「首页那份更轻」的基准
  const gwValueFont = parseFloat(String(await evalJs(`getComputedStyle(document.querySelector('#pulse .pulse-summary b')).fontSize`)));

  if (req1) await fxServe(req1, FX_LIVE, 'live');
  // 断言前先自证夹具生效 (送达证 + 链路证 + 消费证), 并**等**页面把夹具渲染出来 ——
  // 固定 sleep 在线上会量到中间态 (rows:0 的假红), 那是本节历史上唯一的不稳定来源。
  await fxSelfProof('live', { what: '网关页 FX_LIVE' });
  const live = await evalJs(pulseProbe('#pulse'));
  const LV = live.act;
  const has = (k, v) => LV.rows.some((r) => r[k] === v);
  check('live: 状态标签 = 实时', live.state === 'live' && live.visible.includes('实时'), JSON.stringify({ s: live.state, v: live.visible }));
  check('live: 小结行 6 个计数 = 接口原值 (节点 7 / 智能体 12 / 任务 21 / 已完成 13 / 已验证 6 / 钱包签名 42)',
    live.nodes === '7' && live.agents === '12' && live.tasks === '21' && live.tasksDone === '13' &&
    live.tasksVerified === '6' && live.signatures === '42' &&
    live.tasksHidden.tasks === false && live.tasksHidden.done === false && live.tasksHidden.verified === false && live.tasksHidden.sig === false,
    JSON.stringify({ n: live.nodes, a: live.agents, t: live.tasks, d: live.tasksDone, v: live.tasksVerified, s: live.signatures, h: live.tasksHidden }));
  check('live: 小结行标签 = 节点 / 智能体 / 任务 / 已完成 / 已验证 / 钱包签名',
    JSON.stringify(live.summary.map((r) => r.label)) === JSON.stringify(['节点', '智能体', '任务', '已完成', '已验证', '钱包签名']),
    JSON.stringify(live.summary.map((r) => r.label)));
  check('live: 9 条夹具画成 8 行 (task 与 tx 都空的那条不画), 没有空白行',
    LV.rowCount === 8 && LV.blankRows === 0, JSON.stringify({ rows: LV.rowCount, blank: LV.blankRows }));
  check('live: 每行 7 格 (表头 7 列的列数一致)',
    LV.rows.every((r) => r.cells.length === 7), JSON.stringify(LV.rows.map((r) => r.cells.length)));
  check('live: 任务列短写 —— sha256:1a2b3c4d 显示成「sha256:1a2b…」(逐字)',
    has('task', 'sha256:1a2b…'), JSON.stringify(LV.rows.map((r) => r.task)));
  check('live: 40 位地址短写成 0x 头 4…尾 4, 全长不进页面文本',
    !has('task', ACT_LONG_ADDR) && !has('task', ACT_LONG_HASH) && LV.rows.some((r) => /^0x[0-9a-f]{4}…[0-9a-f]{4}$/.test(r.task || '')),
    JSON.stringify(LV.rows.map((r) => r.task)));
  check('live: task 缺失的条目退到 tx 当任务标识 (该行 data-ref=tx), 不留空任务格',
    LV.rows.some((r) => r.ref === 'tx' && /^sha256:/.test(r.task || '')), JSON.stringify(LV.rows.map((r) => [r.ref, r.task])));
  const LV_BLOCKS = ['47142900', '47142800', '47142222', '47142777', '47142301', '47142699', '47142610', '47142500'];
  check('live: 表格按快照时间从新到旧 (实测区块顺序与夹具的 at 顺序一致)',
    JSON.stringify(LV.rows.map((r) => r.block)) === JSON.stringify(LV_BLOCKS),
    JSON.stringify(LV.rows.map((r) => r.block)));
  check('live: 状态列 = 中/英单词里的中文词 (活跃 / 已释放 / 已退款 / 已过期 / 争议中 / 未知)',
    ['活跃', '已释放', '已退款', '已过期', '争议中', '未知'].every((w) => LV.rows.some((r) => r.stateText === w)) &&
    LV.rows.every((r) => r.stateKey && r.stateKey.length > 0),
    JSON.stringify([...new Set(LV.rows.map((r) => r.stateText))]));
  check('live: 事件列 = 中文事件词 (任务创建 / 任务接下 / 任务完成 / 交易结算 / 交易验真)',
    ['任务创建', '任务接下', '任务完成', '交易结算', '交易验真'].every((w) => LV.rows.some((r) => r.kindText === w)),
    JSON.stringify([...new Set(LV.rows.map((r) => r.kindText))]));
  check('live: 认不出的 kind 原样显示 (不猜、不吞、不报错)',
    has('kindText', 'unknown_future_kind_2099') && has('kindKey', 'unknown_future_kind_2099'),
    JSON.stringify([...new Set(LV.rows.map((r) => r.kindText))]));
  check('live: 网络列 = 快照 chain_id (84532), 区块列 = 快照 block (逐行都在)',
    LV.rows.every((r) => r.chain === '84532' && /^47\d{6}$/.test(r.block || '')),
    JSON.stringify(LV.rows.map((r) => [r.chain, r.block])));
  check('live: 确认数/最终性同格 (确认数原文 + 三档文案 已观察/已确认/已最终确定)',
    LV.rows.some((r) => r.conf === '128' && r.finText === '已最终确定') &&
    LV.rows.some((r) => r.finText === '已确认') && LV.rows.some((r) => r.finText === '已观察'),
    JSON.stringify(LV.rows.map((r) => [r.conf, r.finText])));
  check('live: finality 三档各有 data-finality 且三档颜色互不相同 (徽标真的分档上色)',
    ['observed', 'confirmed', 'finalized'].every((k) => live.finality.some((f) => f.key === k)) &&
    new Set(['observed', 'confirmed', 'finalized'].map((k) => (live.finality.find((f) => f.key === k) || {}).color)).size === 3,
    JSON.stringify(live.finality.slice(0, 8)));
  check('live: 认不出的 finality → 原值照原样 + 虚线「其他」徽标 is-other (不假装是三档之一)',
    has('fin', 'unknown') && LV.rows.some((r) => r.fin === 'unknown' && /is-other/.test(r.finClass || '') && r.finText === 'unknown'),
    JSON.stringify(LV.rows.map((r) => [r.fin, r.finText, r.finClass])));
  check('live: 时间列 = <time datetime=ISO> + 本地绝对时间 (YYYY-MM-DD HH:MM:SS)',
    LV.rows.every((r) => /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(r.timeIso || '') && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(r.time || '')),
    JSON.stringify(LV.rows.slice(0, 2).map((r) => [r.timeIso, r.time])));
  check('live: 数据源标注 = 「链上数据源：链上索引」(confirmed_activity_source = chain-index)',
    LV.source === '链上数据源：链上索引', LV.source);
  check('live: 有行时不显示空态文案', LV.emptyShown === false, JSON.stringify({ shown: LV.emptyShown, text: LV.emptyText }));
  const longScan = await evalJs(`(() => {
    const t = document.body.innerText;
    return { addr: /\\b0x[0-9a-fA-F]{40}\\b/.test(t), hash: /\\b[0-9a-fA-F]{64}\\b/.test(t) };
  })()`);
  check('live: 页面可见文本里没有 40 位地址 / 64 位哈希 (夹具给了全长, 页面只显示短写)',
    longScan.addr === false && longScan.hash === false, JSON.stringify(longScan));
  check('live: agent_sites 三种 ipns 形态都归一化成 https://ipfs.io/ipns/<cid> (非法条目被丢弃)',
    live.sites.length === 3 && live.sites.map((s) => s.href).join('|') ===
      [`https://ipfs.io/ipns/${CID_1}`, `https://ipfs.io/ipns/${CID_2}`, `https://ipfs.io/ipns/${CID_3}`].join('|') &&
      live.sites.map((s) => s.label).join('|') === 'leo-node|research|mirror',
    JSON.stringify(live.sites));
  check('live: 站点链接 = rel=noopener noreferrer + target=_blank + 链接文本是裸 cid (只 1 个文本节点)',
    live.sites.length === 3 && live.sites.every((s) => s.rel === 'noopener noreferrer' && s.target === '_blank' &&
      s.kids === 1 && s.text === s.href.replace('https://ipfs.io/ipns/', '')),
    JSON.stringify(live.sites));
  check('live: 活动区内没有任何 javascript: 链接 (非法 ipns 没被渲染)',
    (await evalJs(`Array.from(document.querySelectorAll('#pulse a')).every((a) => !/^javascript:/i.test(a.getAttribute('href') || ''))`)) === true);
  check('live: scope=observed → 「当前节点观察到」', live.scope === '当前节点观察到' && !live.scopeHidden, live.scope);
  check('live: 快照时间 + 相对时间都在 (快照时间 YYYY-MM-DD HH:MM:SS)',
    /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(live.snap || '') && /\d+ (分钟前|小时前|刚刚)/.test(live.ago || ''),
    JSON.stringify({ snap: live.snap, ago: live.ago }));
  check('live: 服务端 notes 文字可见', live.notes.includes('隐私阈值'), live.notes);
  check('live: 表格每一格的任务标识都只 1 个文本节点 (textContent 造节点, 不拼 HTML)',
    LV.rows.every((r) => r.taskKids === 1), JSON.stringify(LV.rows.map((r) => r.taskKids)));
  const appSrc = await fetchText(`${BASE}/app.js`);
  check('app.js 不写 innerHTML / outerHTML / insertAdjacentHTML',
    !/\.innerHTML\s*(\+?=|\.)/.test(appSrc) && !/\.outerHTML\s*(\+?=)/.test(appSrc) && !appSrc.includes('insertAdjacentHTML') && !appSrc.includes('document.write'),
    '源码里出现 innerHTML 赋值');
  const gwHtml = await fetchText(`${BASE}/gateway.html`);
  check('网关页静态 HTML 就有小结行签名钩子 (data-pulse-total="signatures" 恰好 1 处 + 双语标签, JS 挂了也读得到)',
    (gwHtml.match(/data-pulse-total="signatures"/g) || []).length === 1 &&
    /data-zh="钱包签名" data-en="wallet signatures"/.test(gwHtml),
    JSON.stringify({ n: (gwHtml.match(/data-pulse-total="signatures"/g) || []).length }));
  check('网关页静态 HTML 就有表格钩子 (table 自身的 data-pulse-activity + -body/-empty/-source 各 1 处)',
    gwHtml.includes('data-pulse-activity>') &&
    (gwHtml.match(/data-pulse-activity-body/g) || []).length === 1 &&
    (gwHtml.match(/data-pulse-activity-empty/g) || []).length === 1 &&
    (gwHtml.match(/data-pulse-activity-source/g) || []).length === 1);
  check('app.js 真的绑定 signatures 钩子 (取数赋值 + 加载/失败时清空)',
    /data-pulse-total="signatures"/.test(appSrc) && (appSrc.match(/setOptCount\(el\.signatures/g) || []).length === 2);
  check('app.js 真的绑定表格三个钩子 (data-pulse-activity-body / -empty / -source)',
    appSrc.includes('[data-pulse-activity-body]') && appSrc.includes('[data-pulse-activity-empty]') && appSrc.includes('[data-pulse-activity-source]'));
  check('app.js 从不按活动 kind 分支渲染 (无 item.kind 比较 / 无 switch) — 未知 kind 不可能报错',
    !/\bitem\.kind\b/.test(appSrc) && !/\bit\.kind\b/.test(appSrc) && !/\bswitch\s*\(/.test(appSrc),
    'app.js 里出现按活动 kind 分支');

  // 中英切换: 表头 / 状态词 / 事件词 / finality / 小结标签 / 数据源标注 都要跟着变
  await evalJs(`document.querySelector('.lang-toggle [data-lang="en"]').click()`);
  await sleep(300);
  const en = await evalJs(pulseProbe('#pulse'));
  const enTitle = await evalJs(`document.querySelector('#pulse .section-title').textContent.trim()`);
  const enCaveat = await evalJs(`document.querySelector('#pulse .pulse-caveat').textContent.trim()`);
  const enSubs = await evalJs(`Array.from(document.querySelectorAll('#pulse .pulse-sub')).map(e=>e.textContent.trim())`);
  check('EN: 活动区标题 = On-chain activity', enTitle === 'On-chain activity', enTitle);
  check('EN: 状态/scope 都变英文 (Live + Observed by this node)',
    en.visible.includes('Live') && en.scope === 'Observed by this node',
    JSON.stringify({ v: en.visible, s: en.scope }));
  check('EN: 表头 7 列英文 = Task|State|Event|Network|Block|Confirmations / finality|Time',
    JSON.stringify(en.act.headers) === JSON.stringify(['Task', 'State', 'Event', 'Network', 'Block', 'Confirmations / finality', 'Time']),
    JSON.stringify(en.act.headers));
  check('EN: 状态列英文单词 (active/released/refunded/expired/disputed/unknown) + 事件列英文词',
    ['active', 'released', 'refunded', 'expired', 'disputed', 'unknown'].every((w) => en.act.rows.some((r) => r.stateText === w)) &&
    ['task created', 'task accepted', 'task completed', 'trade settled', 'trade verified'].every((w) => en.act.rows.some((r) => r.kindText === w)),
    JSON.stringify([...new Set(en.act.rows.map((r) => r.stateText))]));
  check('EN: finality 徽标英文 (observed / confirmed / finalized) + 认不出的仍原样',
    ['observed', 'confirmed', 'finalized'].every((w) => en.act.rows.some((r) => r.finText === w)) &&
    en.act.rows.some((r) => r.finText === 'unknown'),
    JSON.stringify([...new Set(en.act.rows.map((r) => r.finText))]));
  check('EN: 短写不受语言影响 (sha256:1a2b… 仍在)',
    en.act.rows.some((r) => r.task === 'sha256:1a2b…'), JSON.stringify(en.act.rows.map((r) => r.task)));
  const enSummary = await evalJs(`Array.from(document.querySelectorAll('#pulse .pulse-summary span')).map(e=>e.textContent.trim())`);
  check('EN: 小结行标签英文 = nodes/agents/tasks/completed/verified/wallet signatures',
    JSON.stringify(enSummary) === JSON.stringify(['nodes', 'agents', 'tasks', 'completed', 'verified', 'wallet signatures']),
    JSON.stringify(enSummary));
  check('EN: 数据源标注英文 (On-chain data source: chain index)',
    en.act.source === 'On-chain data source: chain index', en.act.source);
  check('EN: 空态文案英文 (未显示但有英文原文)',
    /not observed any on-chain task/.test(en.act.emptyText || '') || en.act.emptyShown === false, en.act.emptyText);
  check('EN: 「not an exact global total」可见', enCaveat.includes('not an exact global total'), enCaveat);
  check('EN: 智能体私有站小标题英文',
    JSON.stringify(enSubs) === JSON.stringify(['Agent private sites']), JSON.stringify(enSubs));
  check('EN: 相对时间英文 (minutes ago / hours ago / just now)',
    /minutes ago|hours ago|just now/.test(String(en.ago)), String(en.ago));
  const enIpns = await evalJs(`(() => {
    const f = document.querySelector('#pulse [data-pulse-ipns-form]');
    const i = f.querySelector('[data-pulse-ipns-input]');
    i.value = 'nope'; f.requestSubmit();
    const out = { ph: i.getAttribute('placeholder'), aria: i.getAttribute('aria-label'),
      btnAria: f.querySelector('[data-pulse-ipns-open]').getAttribute('aria-label'),
      btnText: f.querySelector('[data-pulse-ipns-open]').textContent,
      msg: f.querySelector('[data-pulse-ipns-msg]').textContent,
      hint: document.querySelector('#pulse .pulse-ipns-hint').textContent,
      sitesEmpty: document.querySelector('#pulse [data-pulse-sites-empty]').textContent,
      siteAria: (document.querySelector('#pulse [data-pulse-sites] a') || {}).getAttribute ? document.querySelector('#pulse [data-pulse-sites] a').getAttribute('aria-label') : '' };
    i.value = ''; return out;
  })()`);
  check('EN: 粘贴框 placeholder/aria-label/按钮/报错/提示 全英文 (含站点链接 aria)',
    /IPNS address or name/.test(enIpns.aria) && /ipns:\/\//.test(enIpns.ph) && /new window/.test(enIpns.btnAria) &&
    enIpns.btnText === 'Open' && /Not a valid IPNS address/.test(enIpns.msg) &&
    /no network request/.test(enIpns.hint) && /has not published/.test(enIpns.sitesEmpty) &&
    /in a new window/.test(enIpns.siteAria), JSON.stringify(enIpns));
  await evalJs(`document.querySelector('.lang-toggle [data-lang="zh"]').click()`);
  await sleep(250);
  const zhBack = await evalJs(pulseProbe('#pulse'));
  check('切回中文: 状态/事件/finality 词复原 (原始值只存一份, 渲染时才取语言)',
    zhBack.act.rows.some((r) => r.stateText === '活跃') && zhBack.act.rows.some((r) => r.kindText === '任务创建') &&
    zhBack.act.rows.some((r) => r.finText === '已最终确定') && zhBack.act.source === '链上数据源：链上索引',
    JSON.stringify([...new Set(zhBack.act.rows.map((r) => r.stateText))]));

  // 相对时间刷新: 只改文字节点, 表格行不重建 (行是「新数据来了才重画」)
  const tickBefore = await evalJs(`(() => {
    const ago = document.querySelector('#pulse [data-pulse-ago]');
    const tr = document.querySelector('#pulse [data-pulse-activity-body] tr');
    window.__ago0 = ago; window.__tr0 = tr;
    window.__bolloonPulse.tick();
    return {
      sameAgo: document.querySelector('#pulse [data-pulse-ago]') === window.__ago0,
      sameRow: document.querySelector('#pulse [data-pulse-activity-body] tr') === window.__tr0,
      rows: document.querySelectorAll('#pulse [data-pulse-activity-body] tr').length,
      ago: ago.textContent,
    };
  })()`);
  check('相对时间刷新 (tick) 只改文字节点: 表格行与节点复用, 不重建',
    tickBefore.sameAgo === true && tickBefore.sameRow === true && tickBefore.rows === 8 && /前|刚刚/.test(tickBefore.ago),
    JSON.stringify(tickBefore));

  // prefers-reduced-motion (live 状态下先确认动画存在, 再确认 reduce 时关掉)
  const animOn = await evalJs(`getComputedStyle(document.querySelector('#pulse .pulse-dot')).animationName`);
  await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await sleep(250);
  const rm = await evalJs(`(() => ({ matched: window.matchMedia('(prefers-reduced-motion: reduce)').matches, anim: getComputedStyle(document.querySelector('#pulse .pulse-dot')).animationName, api: window.__bolloonPulse.reducedMotion(), state: document.getElementById('pulse').getAttribute('data-pulse-state') }))()`);
  check('prefers-reduced-motion: 脉冲点动画关闭 (默认有动画 pulse-dot)',
    animOn === 'pulse-dot' && rm.matched === true && rm.anim === 'none' && rm.api === true && rm.state === 'live',
    JSON.stringify({ animOn, rm }));
  await cdp('Emulation.setEmulatedMedia', { features: [] });

  // 手机宽度: 小结行纵向堆叠 + 表格在容器里横向滚动 (且表格不贡献页面横向溢出)
  // 注: 390px 下页面本身有 ~155px 横向溢出, 但那是顶栏 (nav-menu / mast-meta) 的老问题,
  //     与活动表无关 —— 这里用「把表格藏起来前后, 页面溢出不变」把责任划清。
  await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await sleep(350);
  const mob = await evalJs(`(() => {
    const de = document.documentElement;
    const sum = document.querySelector('#pulse .pulse-summary');
    const wrap = document.querySelector('#pulse .pulse-table-wrap');
    const overAll = de.scrollWidth - de.clientWidth;
    const prev = wrap.style.display;
    wrap.style.display = 'none';
    const overNoTable = de.scrollWidth - de.clientWidth;
    wrap.style.display = prev;
    return {
      w: window.innerWidth,
      dir: getComputedStyle(sum).flexDirection,
      wrapOverflow: getComputedStyle(wrap).overflowX,
      wrapClient: wrap.clientWidth,
      wrapScroll: wrap.scrollWidth,
      overAll: overAll,
      overNoTable: overNoTable,
    };
  })()`);
  check('390px: 小结行改纵向堆叠 (值左 · 标签右)', mob.w <= 640 && mob.dir === 'column', JSON.stringify(mob));
  check('390px: 活动表在容器里横向滚动 (容器 overflow-x:auto + 表格比容器宽), 表格不贡献页面横向溢出',
    mob.wrapOverflow === 'auto' && mob.wrapScroll > mob.wrapClient && mob.overAll === mob.overNoTable,
    JSON.stringify(mob));
  const mobIpns = await evalJs(`(() => {
    const de = document.documentElement;
    const f = document.querySelector('#pulse [data-pulse-ipns-form]');
    const row = f.querySelector('.pulse-ipns-row');
    const btn = f.querySelector('[data-pulse-ipns-open]');
    const input = f.querySelector('[data-pulse-ipns-input]');
    const sites = document.querySelector('#pulse .pulse-sites');
    const list = document.querySelector('#pulse [data-pulse-sites] li');
    return { rowDir: getComputedStyle(row).flexDirection, btnW: Math.round(btn.getBoundingClientRect().width),
      formW: Math.round(f.getBoundingClientRect().width), inputW: Math.round(input.getBoundingClientRect().width),
      sitesW: Math.round(sites.getBoundingClientRect().width), clientW: de.clientWidth,
      liDir: list ? getComputedStyle(list).flexDirection : null,
      linkWrap: list ? list.querySelector('a').getBoundingClientRect().right <= de.clientWidth + 1 : null };
  })()`);
  check('390px: IPNS 粘贴框与站点列表改纵向堆叠, 宽度不超出视口 (不横向溢出)',
    mobIpns.rowDir === 'column' && mobIpns.liDir === 'column' && mobIpns.linkWrap === true &&
    mobIpns.btnW <= mobIpns.formW && mobIpns.formW <= mobIpns.clientW && mobIpns.inputW <= mobIpns.formW,
    JSON.stringify(mobIpns));
  await cdp('Emulation.clearDeviceMetricsOverride');
  await sleep(200);

  // 过期快照 (fresh_until 已过)
  const p2 = nextPaused(7000);
  await evalJs(`(() => { window.__bolloonPulse.refresh(); return 1; })()`);
  let req2 = null;
  try { req2 = await p2; } catch { /* 没拦到 → 下面自证会明确报「夹具未生效」, 不把取不到算成页面错 */ }
  fxPre('expired', !!req2, 'refresh() 的取数请求 7s 内没被 CDP Fetch 拦住');
  if (req2) await fxServe(req2, FX_EXPIRED, 'expired');
  await fxSelfProof('expired', { what: 'FX_EXPIRED (fresh_until 已过)' });
  const stale = await evalJs(pulseProbe('#pulse'));
  check('stale: fresh_until 已过 → 快照已过期', stale.state === 'stale' && stale.visible.includes('快照已过期'), JSON.stringify({ s: stale.state, v: stale.visible }));
  check('stale: scope=verified → 「网络观察快照」', stale.scope === '网络观察快照' && !stale.scopeHidden, stale.scope);
  check('stale: 仍显示快照数字 (9); 该快照没有 confirmed_activity → 0 行 + 明说「本节点暂未观察到链上任务」(不是一片空白)',
    stale.nodes === '9' && stale.act.rowCount === 0 && stale.act.emptyShown === true && /暂未观察到链上任务/.test(stale.act.emptyText),
    JSON.stringify({ n: stale.nodes, rows: stale.act.rowCount, shown: stale.act.emptyShown, text: stale.act.emptyText }));

  // status=stale 单独一条路径
  const p3 = nextPaused(7000);
  await evalJs(`(() => { window.__bolloonPulse.refresh(); return 1; })()`);
  let req3 = null;
  try { req3 = await p3; } catch { /* 同上: 交给自证判「夹具未生效」 */ }
  fxPre('stale-flag', !!req3, 'refresh() 的取数请求 7s 内没被 CDP Fetch 拦住');
  if (req3) await fxServe(req3, FX_STALE_FLAG, 'stale-flag');
  await fxSelfProof('stale-flag', { what: 'FX_STALE_FLAG (status=stale)' });
  const stale2 = await evalJs(pulseProbe('#pulse'));
  check('stale: status="stale" 也被如实标为过期', stale2.state === 'stale' && stale2.visible.includes('快照已过期'), JSON.stringify({ s: stale2.state, v: stale2.visible }));

  // 接口失败 → unavailable, 且不阻断其它区域 (这条夹具 = 「我方把请求打失败」, 所以送达证记在 fxFailed)
  const p4 = nextPaused(7000);
  await evalJs(`(() => { window.__bolloonPulse.refresh(); return 1; })()`);
  let req4 = null;
  try { req4 = await p4; } catch { /* 同上 */ }
  fxPre('a-fail', !!req4, 'refresh() 的取数请求 7s 内没被 CDP Fetch 拦住 (无法注入失败)');
  if (req4) await fxFailServe(req4, 'a-fail');
  await fxSelfProof('a-fail', { mode: 'fail', domSignal: (v) => !!v && v.state === 'unavailable', what: '取数失败夹具 (unavailable)' });
  const un = await evalJs(pulseProbe('#pulse'));
  check('unavailable: 请求失败 → 快照暂时读不到',
    un.state === 'unavailable' && un.visible.includes('快照暂时读不到') && un.hintShown,
    JSON.stringify({ s: un.state, v: un.visible, h: un.hintShown }));
  check('unavailable: 提示含 ?pulse= 与本机节点示例',
    un.hint.includes('?pulse=') && un.hint.includes('127.0.0.1:54188'), un.hint.slice(0, 120));
  check('unavailable: 数值清空 + 表格 0 行 + 空态说「快照不可用」+ 数据源标注也说读不到快照 (两种空法不混)',
    un.nodes === '—' && un.agents === '—' && un.act.rowCount === 0 && un.act.emptyShown === true &&
    /快照不可用/.test(un.act.emptyText) && /未读到快照/.test(un.act.source),
    JSON.stringify({ n: un.nodes, rows: un.act.rowCount, empty: un.act.emptyText, src: un.act.source }));
  check('unavailable: 快照不可用时不会编造任何行 (0 行, 且没有空白行)', un.act.rowCount === 0 && un.act.blankRows === 0);
  const others = await evalJs(`(() => ({
    badge: (document.getElementById('version')||{}).textContent || '',
    cmd: (document.getElementById('skill-cmd')||{}).textContent || '',
    year: (document.getElementById('year')||{}).textContent || '',
    footer: document.querySelectorAll('.foot a').length,
    pulseState: document.getElementById('pulse').getAttribute('data-pulse-state'),
  }))()`);
  check('接口失败不阻断页面其它区域 (命令/徽章/页脚仍正常)',
    /^read /.test(others.cmd) && others.cmd.endsWith('/bolloon-gateway-join.md') &&
    (!liveVersion || others.badge === liveVersion) && /^\d{4}$/.test(others.year) && others.footer >= 1,
    JSON.stringify(others));
  check('失败后 backoff 生效 (failCount ≥ 1)', (await evalJs('window.__bolloonPulse.failCount()')) >= 1);

  // 超时 (5s AbortController): 把请求挂住不放, 模块必须自己放弃 → unavailable, 不卡在 loading
  // 这里的「夹具」= 我方把请求挂住不放。所以自证 = 请求确实被我方拦住了 (reqTimeout 到手);
  // 拿不到就明确报「夹具未生效」, 不把「没挂住」当成页面没超时。
  const pTimeout = nextPaused(7000);
  await evalJs(`(() => { window.__bolloonPulse.refresh(); return 1; })()`);
  let reqTimeout = null;
  try { reqTimeout = await pTimeout; } catch { /* 没拦到就按 DOM 判断 */ }
  fxPre('timeout-hang', !!reqTimeout, '取数请求 7s 内没被拦住 (请求没挂住, 本轮超时断言不成立)');
  await sleep(6000);                       // 单次请求超时 = 5s
  const to = await evalJs(pulseProbe('#pulse'));
  check('超时: 请求挂住 6s → 模块自己放弃 (unavailable), 不永久停在 loading',
    to.state === 'unavailable' && to.visible.includes('快照暂时读不到') && to.act.rowCount === 0,
    JSON.stringify({ s: to.state, v: to.visible }));
  if (reqTimeout) { try { await fxServe(reqTimeout, FX_LIVE, 'live'); } catch { /* 已 abort, 拦截 id 失效是正常的 */ } }
  await sleep(200);
  fxOff();   // 下面这组 (配置常量) 不吃夹具

  // 轮询与超时常量
  const cfg = await evalJs(`(() => { const p = window.__bolloonPulse; return p ? { poll: p.config.pollMs, timeout: p.config.timeoutMs, backoff: p.config.backoffMs, rel: p.config.relTickMs, feedMax: p.config.feedMax, activityMax: p.config.activityMax, capsMax: p.config.capsMax, refresh: typeof p.refresh, tick: typeof p.tick, src: p.source() } : null; })()`);
  check('30 秒轮询 + 5 秒超时 + 退避 30/60/120 上限 120',
    !!cfg && cfg.poll === 30000 && cfg.timeout === 5000 && JSON.stringify(cfg.backoff) === JSON.stringify([30000, 60000, 120000]),
    JSON.stringify(cfg));
  check('轮询/刷新函数存在 (refresh + tick) + 表格行上限 activityMax, 旧 capsMax 已移除',
    !!cfg && cfg.refresh === 'function' && cfg.tick === 'function' && cfg.activityMax === 60 && cfg.capsMax === undefined,
    JSON.stringify(cfg));
  // 无 ?pulse= → 回退同源 network-pulse.json (站点上通常不存在 → 如实 unavailable, 不阻断其它区域)
  shouldIntercept = (p) => p.request.url.endsWith('/network-pulse.json');
  await fxEnable('*network-pulse.json*');
  const p5 = nextPaused(9000);
  await cdp('Page.navigate', { url: `${BASE}/gateway.html` });
  let req5 = null;
  try { req5 = await p5; } catch { /* 下面按结果判断 */ }
  fxPre('fallback-404', !!req5, '无 ?pulse= 时的同源快照请求 9s 内没被 CDP Fetch 拦住 (无法注入 404)');
  check('无 ?pulse= 时回退到同源 network-pulse.json', !!req5 && /\/network-pulse\.json$/.test(req5.request.url), req5 ? req5.request.url : '未拦到请求');
  if (req5) {
    fxFailHit('fallback-404', req5.request.url);   // 送达证: 这个 404 是**我方**注入的
    await cdp('Fetch.fulfillRequest', {
      requestId: req5.requestId, responseCode: 404,
      responseHeaders: [{ name: 'Content-Type', value: 'text/plain' }],
      body: Buffer.from('not found', 'utf8').toString('base64'),
    });
  }
  await fxSelfProof('fallback-404', { mode: 'fail', domSignal: (v) => !!v && v.state === 'unavailable', what: '回退快照 404 夹具' });
  const fb = await evalJs(pulseProbe('#pulse'));
  const fbCmd = await evalJs(`(document.getElementById('skill-cmd')||{}).textContent||''`);
  check('回退拿到 404 → unavailable, 页面其它区域仍正常',
    fb.state === 'unavailable' && fb.visible.includes('快照暂时读不到') && /^read /.test(fbCmd),
    JSON.stringify({ state: fb.state, cmd: fbCmd.slice(0, 40) }));
  await fxDisable();
  fxOff();

  // ⑥‴′ 同源**真快照** (无 ?pulse=, 不对真实网络下断言之外的猜测): 线上真数据必须真渲染,
  //       且「0 个任务 + N 行任务」这类同屏数字必须自带口径解释 —— 这是本页对线上的最终交付断言。
  //       注: 这一段**故意不注夹具** (要验的就是线上真快照), 所以它不参与夹具自证。
  console.log('\n[6e] 同源真快照 (无 ?pulse=) → 真行数 + 口径行 + 链归属');
  const realRaw = await fetchText(`${BASE}/network-pulse.json`);
  let realObj = null;
  try { realObj = JSON.parse(realRaw); } catch { realObj = null; }
  check('同源 network-pulse.json 可读且形状齐 (confirmed_activity + activity_totals + chain_id_scope + totals_scope)',
    !!realObj && Array.isArray(realObj.confirmed_activity) && !!realObj.activity_totals &&
    !!realObj.chain_id_scope && !!realObj.totals_scope,
    realObj ? `rows=${(realObj.confirmed_activity || []).length}` : '读不到 / 不是 JSON');
  await cdp('Page.navigate', { url: `${BASE}/gateway.html` });
  // 真快照是真网络请求 (CDN 更慢) → 等「真渲染出 N 行」再断言, 不用固定 sleep 量中间态
  const real = await waitStable(pulseProbe('#pulse'), (v) => v && v.act && v.act.rowCount === (realObj ? Math.min(realObj.confirmed_activity.length, 60) : -1), { tries: 80, interval: 150 });
  const expRows = realObj ? Math.min(realObj.confirmed_activity.length, 60) : -1;   // 前端表格上限 60
  check('真快照真渲染: 表格行数 = min(快照行数, 60)',
    real.state === 'live' && expRows > 0 && real.act.rowCount === expRows,
    JSON.stringify({ s: real.state, rows: real.act.rowCount, exp: expRows }));
  check('真快照: 数据源 = 链上索引', real.act.source === '链上数据源：链上索引', real.act.source);
  // 链归属措辞 (2026-09-22 修): 真链数据上线后 8453 用的是「Base 主网」措辞,
  // 旧正则只认「本机隔离开发链|公网」→ 把真数据判成假红。改为**按链的性质分开要求**(更严):
  //   公网链 (is_public_network=true) → 必须点明 公网/主网/测试网
  //   本机链                         → 必须点明 本机隔离开发链
  const cidScope = realObj.chain_id_scope || {};
  const cidStr = String(cidScope.activity_chain_id);
  const chainIsPublic = cidScope.is_public_network === true;
  const chainWordingOk = chainIsPublic
    ? /公网|主网|测试网/.test(real.act.totalsLine)
    : /本机隔离开发链/.test(real.act.totalsLine);
  check('真快照的口径行: 行数与实际一致 + 写明这批行属于哪条链 (不留给读者猜)',
    real.act.totalsLineShown === true && real.act.totalsLine.includes(expRows + ' 行') &&
    real.act.totalsLine.includes(cidStr) && chainWordingOk,
    JSON.stringify({ line: real.act.totalsLine, cid: cidStr, isPublic: chainIsPublic }));
  check('★ 真数据反矛盾: 小结行是 0 而表里有行时, 口径行必须把两套口径讲明白 (线上真快照当场验)',
    !(real.act.rowCount > 0 && real.tasks === '0' && !(real.act.totalsLineShown === true && /24h|24 小时/.test(real.act.totalsLine))),
    JSON.stringify({ rows: real.act.rowCount, tasks: real.tasks, line: real.act.totalsLine }));

  // ⑥′ 聚合计数缺失 + 空表 + agent_sites 为空: 「拿不到就不显示」「空表要说清」「空 ≠ 没数据」
  console.log('\n[6b] 任务计数缺失 + 空表 + 智能体私有站为空 (拿不到就不显示)');
  const cErrStart = consoleErrors.length;
  cMode = 'no-tasks';
  shouldIntercept = (p) => p.request.url.includes('network-pulse-verify');
  await fxEnable(PULSE_PATTERN);
  await cdp('Page.navigate', { url: `${BASE}/gateway.html?pulse=${encodeURIComponent(`${BASE}/network-pulse-verify-c.json`)}` });
  // 断言前自证 (送达证 C 档 auto-fulfill + 链路证 + 消费证 __vfy:no-tasks), 并等页面渲染完
  await fxSelfProof('no-tasks', { what: 'FX_NO_TASKS (缺 tasks* / 空表 / sites=[])' });
  const noT = await evalJs(pulseProbe('#pulse'));
  check('缺 tasks* 三个字段 → 小结行整行隐藏, 且不拿 0 或数字冒充',
    noT.state === 'live' && noT.tasksHidden.tasks === true && noT.tasksHidden.done === true && noT.tasksHidden.verified === true &&
    noT.tasks === '—' && noT.tasksDone === '—' && noT.tasksVerified === '—',
    JSON.stringify({ s: noT.state, h: noT.tasksHidden, v: [noT.tasks, noT.tasksDone, noT.tasksVerified] }));
  check('缺字段时节点/智能体照常显示 (2/3) — 只有拿不到的才不显示 (真 0 照常显示 0)',
    noT.nodes === '2' && noT.agents === '3' && noT.summary.filter((r) => r.hidden).length === 4,
    JSON.stringify({ n: noT.nodes, a: noT.agents, rows: noT.summary.map((r) => [r.key, r.hidden]) }));
  check('confirmed_activity=[] → 0 行 + 明说「本节点暂未观察到链上任务」(不是空白表格)',
    noT.act.rowCount === 0 && noT.act.emptyShown === true && noT.act.emptyText === '本节点暂未观察到链上任务。',
    JSON.stringify({ rows: noT.act.rowCount, shown: noT.act.emptyShown, text: noT.act.emptyText }));
  check('confirmed_activity_source=none → 表格下方如实标注「本节点未接入链上数据源」',
    noT.act.source === '链上数据源：本节点未接入链上数据源', noT.act.source);
  check('agent_sites=[] → 0 条链接 + 诚实空提示 (没发布 ≠ 没数据)',
    noT.sites.length === 0 && noT.sitesEmptyShown === true && /暂未发布智能体私有站/.test(noT.sitesEmptyText),
    JSON.stringify({ n: noT.sites.length, shown: noT.sitesEmptyShown, text: noT.sitesEmptyText }));
  check('缺 signatures 字段 → 小结行里的签名项整行隐藏 (不拿 0 冒充, 也不显示假 0)',
    noT.tasksHidden.sig === true && noT.signatures === '—',
    JSON.stringify({ hidden: noT.tasksHidden.sig, v: noT.signatures }));
  check('缺字段这一轮无 console 错误 / 未捕获异常', consoleErrors.length === cErrStart, consoleErrors.slice(0, 3).join(' | '));

  // ⑥‴ 「0 个任务」与「25 行任务」同屏 —— 页面必须有口径行解释 (2026-09-22 leo 拍板: 不许自相矛盾的展示)
  console.log('\n[6d′] 0 个任务 与 25 行任务 同屏 → 必须有口径行解释 (不许自相矛盾)');
  const zErrStart = consoleErrors.length;
  cMode = 'pulse-zero';
  shouldIntercept = (p) => p.request.url.includes('network-pulse-verify');
  await fxEnable(PULSE_PATTERN);
  const zUrl = `${BASE}/gateway.html?pulse=${encodeURIComponent(`${BASE}/network-pulse-verify-c.json`)}`;
  await cdp('Page.navigate', { url: zUrl });
  // 断言前自证 + 等「消费证」出现 (夹具 notes 里的 __vfy:pulse-zero 出现 = 整轮渲染跑完):
  // 既治固定 sleep 量到中间态, 也让「夹具没生效」与「页面错」分得开。
  await fxSelfProof('pulse-zero', { what: 'FX_PULSE_ZERO (0 任务 + 25 行 + 口径三块)' });
  // 等「状态到 live 且表格真画满 25 行」再断言 —— 固定 sleep 会量到中间态 (实测 rows:0 的假失败)
  const pz = await waitStable(pulseProbe('#pulse'), (v) => v && v.state === 'live' && v.act.rowCount === 25);
  check('25 行真画出来 (与快照 activity_totals.rows 一致)', pz.state === 'live' && pz.act.rowCount === 25,
    JSON.stringify({ s: pz.state, rows: pz.act.rowCount }));
  check('小结行如实显示 0 (24h 脉冲事件口径) —— 不为了"好看"改数字',
    pz.tasks === '0' && pz.tasksDone === '0' && pz.tasksVerified === '0' && pz.signatures === '0',
    JSON.stringify({ t: pz.tasks, d: pz.tasksDone, v: pz.tasksVerified, sig: pz.signatures }));
  check('★ 口径行必在: 行数/不同任务 + 两套口径差异 (数字取自快照同源计数)',
    pz.act.totalsLineShown === true && pz.act.totalsLine.includes('25 行') && pz.act.totalsLine.includes('12 个不同任务') &&
    pz.act.totalsLine.includes('脉冲事件') && pz.act.totalsLine.includes('链上索引') && pz.act.totalsLine.includes('不是数据丢了'),
    pz.act.totalsLine);
  check('★ 口径行写明链归属 (本机隔离开发链 31337 · 不是公网活动) —— 不许读者误读成真网活动',
    pz.act.totalsLine.includes('31337') && pz.act.totalsLine.includes('本机隔离开发链') && pz.act.totalsLine.includes('不是公网活动'),
    pz.act.totalsLine);
  check('★ 反矛盾总断言: 「0 个任务」与「N 行任务」并存时, 页面上必须有解释 (口径行提到 24h 口径)',
    !(pz.act.rowCount > 0 && pz.tasks === '0' && !(pz.act.totalsLineShown === true && /24h|24 小时/.test(pz.act.totalsLine))),
    JSON.stringify({ rows: pz.act.rowCount, tasks: pz.tasks, line: pz.act.totalsLine }));
  check('数据源行仍如实标注 (链上索引)', pz.act.source === '链上数据源：链上索引', pz.act.source);
  check('口径行这一轮无 console 错误 / 未捕获异常', consoleErrors.length === zErrStart, consoleErrors.slice(0, 3).join(' | '));

  // 老快照 (有 25 行但缺 activity_totals/totals_scope/chain_id_scope) → 口径行整行隐藏, 不自己数行数、不编网络名
  cMode = 'pulse-zero-legacy';
  await cdp('Page.navigate', { url: zUrl });
  // 同一档换了夹具但 URL 相同 —— 必须等「这一份」的消费证 (__vfy:pulse-zero-legacy) 出现,
  // 否则会读到上一轮夹具的中间态 (这才是它以前会「时绿时红」的根因)
  await fxSelfProof('pulse-zero-legacy', { what: 'FX_PULSE_ZERO_LEGACY (缺口径三块)' });
  const pzL = await waitStable(pulseProbe('#pulse'), (v) => v && v.state === 'live' && v.act.rowCount === 25);
  check('老快照 (缺口径三块) → 口径行整行隐藏 (不自己数行数/不编网络名), 行照旧画 25 行',
    pzL.state === 'live' && pzL.act.rowCount === 25 && pzL.act.totalsLineShown === false && pzL.act.totalsLine === '',
    JSON.stringify({ rows: pzL.act.rowCount, shown: pzL.act.totalsLineShown, line: pzL.act.totalsLine }));
  cMode = 'full';

  // ⑥″ IPNS 粘贴框: 真 input + 真按钮, 严格校验, 合法才开新窗口, 本页不发任何网络请求
  // (这节的断言只看控件行为, 不吃夹具数据 → 关掉夹具归因, 免得误标)
  fxOff();
  console.log('\n[6c] IPNS 粘贴框 (归一化 → 新窗口 / 非法就地报错)');
  const ipnsBox = await evalJs(pulseProbe('#pulse'));
  check('粘贴框 = 真 input + 真 type=submit 按钮 (回车可提交) + aria-label 齐全',
    !!ipnsBox.ipns && ipnsBox.ipns.inputTag === 'INPUT' && ipnsBox.ipns.inputType === 'text' &&
    ipnsBox.ipns.btnTag === 'BUTTON' && ipnsBox.ipns.btnType === 'submit' &&
    !!ipnsBox.ipns.inputAria && !!ipnsBox.ipns.btnAria,
    JSON.stringify(ipnsBox.ipns));
  check('粘贴框状态区 role=status + aria-live=polite', ipnsBox.ipns.msgRole === 'status' && ipnsBox.ipns.msgLive === 'polite',
    JSON.stringify(ipnsBox.ipns && { r: ipnsBox.ipns.msgRole, l: ipnsBox.ipns.msgLive }));
  const truth = await evalJs(`(() => {
    const P = window.__bolloonIpns;
    const good = ${JSON.stringify(IPNS_OK)};
    const bad = ${JSON.stringify(IPNS_BAD)};
    return { good: good.map((v) => [v, P.parse(v), P.url(v)]), bad: bad.map((v) => [v, P.parse(v), P.url(v)]) };
  })()`);
  check(`归一化: ${IPNS_OK.length} 种合法写法 (裸 k51… / ipns://… / /ipns/… / 网关 URL) 都得到同一 cid 与网关 URL`,
    truth.good.every((r) => !!r[1] && r[2] === 'https://ipfs.io/ipns/' + r[1]),
    JSON.stringify(truth.good.filter((r) => !(r[1] && r[2] === 'https://ipfs.io/ipns/' + r[1]))));
  check(`归一化: ${IPNS_BAD.length} 种非法输入全部拒绝 (含 javascript: / file: / data: / 空 / 带路径)`,
    truth.bad.every((r) => r[1] === null && r[2] === null),
    JSON.stringify(truth.bad.filter((r) => r[1] !== null)));
  // 输入内容绝不进 innerHTML: 塞一个 <img onerror> 进去, 只应看到被转义的文本
  const xss = await evalJs(`(() => {
    const f = document.querySelector('#pulse [data-pulse-ipns-form]');
    const i = f.querySelector('[data-pulse-ipns-input]');
    const m = f.querySelector('[data-pulse-ipns-msg]');
    i.value = '<img src=x onerror="window.__xss=1">';
    f.requestSubmit();
    return { msg: m.textContent, cls: m.className, html: m.innerHTML, imgs: f.querySelectorAll('img').length,
      rawMarkup: m.innerHTML.indexOf('<') !== -1, xss: !!window.__xss,
      kids: m.childNodes.length, nodeType: m.childNodes[0] && m.childNodes[0].nodeType,
      invalid: i.getAttribute('aria-invalid'), opened: window.__bolloonIpns.lastOpened() };
  })()`);
  check('非法输入 → 就地报错 (不是静默), 且输入内容绝不进 innerHTML (无标签节点 / 无 XSS)',
    /不是合法的 IPNS 地址/.test(xss.msg) && xss.msg.indexOf('<img') === -1 && xss.imgs === 0 &&
    xss.rawMarkup === false && xss.xss === false &&
    xss.kids === 1 && xss.nodeType === 3 && xss.invalid === 'true' && xss.opened === '',
    JSON.stringify(xss));

  // 真窗口: 合法 → 真的开一个新标签页; 非法 → 一个都不开 (新标签页在启动前挂起, 不会去访问 ipfs.io)
  await watchPopups(true);
  const ipnsInput = async (v) => evalJs(`(() => { const i = document.querySelector('#pulse [data-pulse-ipns-input]'); i.value = ${JSON.stringify(v)}; i.focus(); return i.value; })()`);
  const pressEnter = async () => {
    await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13, text: '\r' });
    await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
    await sleep(900);
  };
  const clickOpen = async () => {
    const b = await evalJs(`(() => { const el = document.querySelector('#pulse [data-pulse-ipns-open]'); el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; })()`);
    await cdp('Input.dispatchMouseEvent', { type: 'mousePressed', x: b.x, y: b.y, button: 'left', clickCount: 1 });
    await cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', x: b.x, y: b.y, button: 'left', clickCount: 1 });
    await sleep(900);
  };
  await closePopups();
  await ipnsInput('javascript:alert(1)');
  await pressEnter();
  check('非法输入 + 真回车 → 一个新窗口都不开', popups.length === 0, `popups=${popups.length}`);
  await closePopups();
  await ipnsInput(CID_1);
  await pressEnter();
  const kbOpen = await evalJs(`JSON.stringify({ cid: window.__bolloonIpns.lastCid(), opened: window.__bolloonIpns.lastOpened(), link: window.__bolloonIpns.lastLink() })`);
  check(`合法裸 k51 + 真回车 → 真的开一个新标签页 (${popups.length} 个 page 目标)`,
    popups.length === 1 && popups[0].type === 'page', `popups=${JSON.stringify(popups.map((p) => p.type))}`);
  check('开新窗口走的是新建 <a rel="noopener noreferrer" target="_blank"> (href = 网关 URL)',
    JSON.parse(kbOpen).opened === `https://ipfs.io/ipns/${CID_1}` &&
    JSON.parse(kbOpen).link.href === `https://ipfs.io/ipns/${CID_1}` &&
    JSON.parse(kbOpen).link.rel === 'noopener noreferrer' && JSON.parse(kbOpen).link.target === '_blank',
    kbOpen);
  await closePopups();
  await ipnsInput('/ipns/' + CID_3);
  await clickOpen();
  const clickOpen2 = await evalJs(`JSON.stringify({ cid: window.__bolloonIpns.lastCid(), opened: window.__bolloonIpns.lastOpened(), msg: document.querySelector('#pulse [data-pulse-ipns-msg]').textContent })`);
  check(`合法 /ipns/… + 真鼠标点「打开」→ 也真的开一个新标签页 (${popups.length} 个), cid 归一化对了`,
    popups.length === 1 && JSON.parse(clickOpen2).cid === CID_3 && JSON.parse(clickOpen2).opened === `https://ipfs.io/ipns/${CID_3}`,
    clickOpen2);
  await closePopups();
  await watchPopups(false);
  check('粘贴框这几轮无 console 错误 / 未捕获异常', consoleErrors.length === cErrStart, consoleErrors.slice(0, 3).join(' | '));
  cMode = 'full';

  // ⑥‴ 表格容错 (认不出的枚举原样显示 / 空标识不画行) + 数值变化在下一轮 30s 轮询内自动反映
  console.log('\n[6d] 表格枚举容错 (textContent) + 数值变化自动反映 (30s 轮询)');
  const kErrStart = consoleErrors.length;
  growMode = 'base';
  shouldIntercept = (p) => p.request.url.includes('network-pulse-verify');
  await fxEnable(PULSE_PATTERN);
  const growSrc = `${BASE}/network-pulse-verify-grow.json`;
  await cdp('Page.navigate', { url: `${BASE}/gateway.html?pulse=${encodeURIComponent(growSrc)}` });
  // ★ 这里原来是一句 `await sleep(1600)` —— 线上冷启动 (308 跳转 + CDN + app.js) 常 >2.5s,
  //   于是量到「页面还在 loading」的中间态: rows:0 / 空数组, 与「页面坏了」长得一模一样。
  //   现在改成先自证夹具生效 (等消费证 __vfy:newkinds:__ 出现 = 整轮渲染跑完) 再断言。
  await fxSelfProof('newkinds', { what: 'FX_NEWKINDS (未知枚举 3 条)' });
  const nk = await evalJs(pulseProbe('#pulse'));
  check('容错: 3 条夹具画成 2 行 (task 与 tx 都空的那条不画), 没有空白行',
    nk.act.rowCount === 2 && nk.act.blankRows === 0, JSON.stringify({ rows: nk.act.rowCount, blank: nk.act.blankRows }));
  check('容错: 未知 kind / 未知 state / 未知 finality 全部原样显示 (不猜、不吞、不报错)',
    nk.act.rows.some((r) => r.kindText === 'brand_new_kind_2099b' && r.stateText === 'settling' && r.finText === 'settled-weird'),
    JSON.stringify(nk.act.rows.map((r) => [r.kindText, r.stateText, r.finText])));
  check('容错: 认不出的 finality 徽标 = 虚线 is-other (不假装是三档之一)',
    nk.act.rows.some((r) => r.fin === 'settled-weird' && /is-other/.test(r.finClass || '')),
    JSON.stringify(nk.act.rows.map((r) => [r.fin, r.finClass])));
  check('容错: 任务标识里的 <b> 只当文字 (单元格只 1 个文本节点 + 标签被转义, 没走 innerHTML)',
    nk.act.rows.some((r) => r.task === MARKUP_TASK && r.taskKids === 1 && /&lt;b&gt;/.test(r.taskHtml || '')),
    JSON.stringify(nk.act.rows.map((r) => [r.task, r.taskKids, r.taskHtml])));
  check('容错: 数据源标注随快照变 (pulse-events → 「链上数据源：脉冲事件」)',
    nk.act.source === '链上数据源：脉冲事件', nk.act.source);
  check('容错这一轮无 console 错误 / 未捕获异常 (未知枚举不报错)', consoleErrors.length === kErrStart, consoleErrors.slice(0, 3).join(' | '));

  await evalJs(`document.querySelector('.lang-toggle [data-lang="en"]').click()`);
  await sleep(350);
  const nkEn = await evalJs(pulseProbe('#pulse'));
  check('容错: 切 EN 后已知 kind 出英文词, 未知 kind/state/finality 仍原样 (语言在渲染时才取)',
    nkEn.act.rows.some((r) => r.kindText === 'task created') &&
    nkEn.act.rows.some((r) => r.kindText === 'brand_new_kind_2099b' && r.stateText === 'settling' && r.finText === 'settled-weird'),
    JSON.stringify(nkEn.act.rows.map((r) => [r.kindText, r.stateText, r.finText])));
  await evalJs(`document.querySelector('.lang-toggle [data-lang="zh"]').click()`);
  await sleep(300);
  const nkZh = await evalJs(pulseProbe('#pulse'));
  check('容错: 切回中文复原 (原始枚举只存一份, 不是被覆盖过的文本)',
    nkZh.act.rows.some((r) => r.kindText === '任务创建') && nkZh.act.rows.some((r) => r.finText === 'settled-weird'),
    JSON.stringify(nkZh.act.rows.map((r) => [r.kindText, r.finText])));

  // —— 数值变化: 只改「下游夹具」+ 只读 DOM, 不调 refresh() / 不导航 / 不刷新页面 ——
  const growBefore = await evalJs(`(() => ({
    mark: (window.__growMark = 'no-reload'),
    nodes: (document.querySelector('#pulse [data-pulse-total="nodes"]') || {}).textContent,
    agents: (document.querySelector('#pulse [data-pulse-total="agents"]') || {}).textContent,
    sig: (document.querySelector('#pulse [data-pulse-total="signatures"]') || {}).textContent,
    rows: document.querySelectorAll('#pulse [data-pulse-activity-body] tr').length,
    source: (document.querySelector('[data-pulse-activity-source]') || {}).textContent,
    state: document.getElementById('pulse').getAttribute('data-pulse-state'),
  }))()`);
  growMode = 'grown';                      // 下一轮轮询将拿到「一个新 agent 加入 + 多一条交易」的快照
  const growT0 = Date.now();
  let growAfter = null;
  for (let i = 0; i < 100; i++) {          // 最多 ~50s (自动轮询间隔 30s + 余量)
    await sleep(500);
    growAfter = await evalJs(`(() => ({
      nodes: (document.querySelector('#pulse [data-pulse-total="nodes"]') || {}).textContent,
      agents: (document.querySelector('#pulse [data-pulse-total="agents"]') || {}).textContent,
      sig: (document.querySelector('#pulse [data-pulse-total="signatures"]') || {}).textContent,
      rows: document.querySelectorAll('#pulse [data-pulse-activity-body] tr').length,
      source: (document.querySelector('[data-pulse-activity-source]') || {}).textContent,
      firstKind: (document.querySelector('#pulse .pulse-kind-word') || {}).textContent,
      tasks: (document.querySelector('#pulse [data-pulse-total="tasks"]') || {}).textContent,
      mark: window.__growMark,
      state: document.getElementById('pulse').getAttribute('data-pulse-state'),
      blank: Array.from(document.querySelectorAll('#pulse [data-pulse-activity-body] tr')).filter((tr) => !tr.textContent.trim()).length,
    }))()`);
    if (growAfter && growAfter.nodes === '8' && growAfter.sig === '42' && growAfter.rows === 3) break;
  }
  // 断言前自证「第二轮夹具 (grown) 真的生效」: 只认 __vfy:grown:__ 这个消费证;
  // 拿不到就报「夹具未生效(拦截未命中)」(比如轮询那一次请求没被拦住), 而不是把「数字没变」算成页面错。
  await fxSelfProof('grown', { what: 'FX_GROWN (30s 轮询那一轮)', timeoutMs: 2000 });
  const growWaited = ((Date.now() - growT0) / 1000).toFixed(1);
  check(`数值与表格行在下一轮 30s 轮询内自动出现 (实测等了 ${growWaited}s; 未刷新页面 / 未手动 refresh / 未导航)`,
    !!growAfter && growBefore.nodes === '7' && growBefore.rows === 2 && growAfter.nodes === '8' &&
    growAfter.rows === 3 && growAfter.state === 'live' && Number(growWaited) < 40,
    JSON.stringify({ before: [growBefore.nodes, growBefore.rows], after: [growAfter && growAfter.nodes, growAfter && growAfter.rows], waited: growWaited }));
  check('新 agent 加入 → 智能体/任务/签名计数自己变 (12→13, 21→22, 3→42)',
    !!growAfter && growAfter.agents === '13' && growAfter.tasks === '22' && growAfter.sig === '42',
    JSON.stringify(growAfter));
  check('新增的链上活动那行也跟着出现 (事件 = 交易验真), 且没有空白行',
    !!growAfter && growAfter.firstKind === '交易验真' && growAfter.blank === 0,
    JSON.stringify({ first: growAfter && growAfter.firstKind, blank: growAfter && growAfter.blank }));
  check('数据源标注也跟着快照自己变 (pulse-events → chain index)',
    !!growAfter && /链上索引/.test(growAfter.source || ''), String(growAfter && growAfter.source));
  check('页面从未重新加载 (标记变量存活 ⇒ 数字是自己变的, 不是刷新带出来的)',
    !!growAfter && growAfter.mark === 'no-reload', JSON.stringify({ mark: growAfter && growAfter.mark }));
  check('自动轮询那一轮也无 console 错误 / 未捕获异常', consoleErrors.length === kErrStart, consoleErrors.slice(0, 3).join(' | '));

  // ⑦ 首页序栏紧凑版脉冲 (同一数据源, 同一诚实四态)
  console.log('\n[7] index.html 序栏紧凑版脉冲 (同一接口 + 同一四态)');
  const idxErrStart = consoleErrors.length;
  const IDX_ROOT = '#intro .pulse-compact';
  shouldIntercept = (p) => p.request.url.includes('network-pulse-verify');
  await fxEnable(PULSE_PATTERN);
  const pIdx = nextPaused(9000);
  await cdp('Page.navigate', { url: `${BASE}/index.html?pulse=${encodeURIComponent(pulseSrc)}` });
  let idxReq = null;
  try { idxReq = await pIdx; } catch { /* 下面按 DOM 判断 */ }
  await sleep(400);

  const idxLoading = await evalJs(pulseProbe(IDX_ROOT));
  check('index.html 序栏 (hero) 内存在紧凑脉冲区 [data-pulse]', !!idxLoading, '未找到 #intro .pulse-compact');
  const idxA11y = await evalJs(`(() => { const r = document.querySelector('${IDX_ROOT}'); const st = r && r.querySelector('[role="status"]'); return r ? { states: Array.from(r.querySelectorAll('.pulse-state-text')).map(e => e.getAttribute('data-state')), role: st ? st.getAttribute('role') : null, live: st ? st.getAttribute('aria-live') : null } : null; })()`);
  check('首页紧凑脉冲: 四态文案齐 + role=status + aria-live=polite',
    !!idxA11y && ['loading', 'live', 'stale', 'unavailable'].every((s) => idxA11y.states.includes(s)) && idxA11y.role === 'status' && idxA11y.live === 'polite',
    JSON.stringify(idxA11y));
  check('首页紧凑脉冲: 同一句 caveat「不是全网精确总量」',
    !!idxLoading && idxLoading.caveat.includes('不是全网精确总量'), idxLoading && idxLoading.caveat);
  // 首次 loading / 「拦到请求」这两条吃「请求被拦住挂着」的前置 → 先自证, 拿不到就明确报夹具未生效
  fxPre('live', !!idxReq, '首页取数请求 9s 内没被 CDP Fetch 拦住 (页面可能已拿到真快照)');
  check('首页紧凑脉冲: 首次 loading + 数值占位「—」',
    !!idxLoading && idxLoading.state === 'loading' && idxLoading.nodes === '—', JSON.stringify(idxLoading && { s: idxLoading.state, n: idxLoading.nodes }));
  const idxInst = await evalJs(`(() => ({ n: window.__bolloonPulses.length, src: window.__bolloonPulses[0].source(), name: window.__bolloonPulses[0].key, feedMax: window.__bolloonPulses[0].config.feedMax }))()`);
  check('首页那份也是独立实例: ?pulse= 生效 + 活动上限 data-pulse-feed-max=1',
    idxInst.n === 1 && idxInst.src === 'endpoint' && idxInst.name === 'hero' && idxInst.feedMax === 1, JSON.stringify(idxInst));
  check('首页紧凑脉冲真的发起取数 (CDP 拦到请求)', !!idxReq, idxReq ? '' : '未拦到请求');

  if (idxReq) await fxServe(idxReq, FX_LIVE, 'live');
  // 首页紧凑版**没有** notes 元素 → 消费证改用「只有夹具才有的活动流原文」(MARKUP_TEXT 由脚本给定,
  // 真快照撞不出来)。无论如何, 断言前必须先看到消费证 / 或拿到送达证。
  await fxSelfProof('live', { rootSel: IDX_ROOT, domSignal: fxFeedHas(MARKUP_TEXT.zh), what: '首页 FX_LIVE' });
  const idxLive = await evalJs(pulseProbe(IDX_ROOT));
  check('首页 live: 状态=实时 + 四个数值 = 7/12/4/5',
    idxLive.state === 'live' && idxLive.visible.includes('实时') && idxLive.nodes === '7' && idxLive.agents === '12' && idxLive.active === '4' && idxLive.h24 === '5',
    JSON.stringify({ s: idxLive.state, n: idxLive.nodes, a: idxLive.agents, ac: idxLive.active, d: idxLive.h24 }));
  check('首页 live: 只加两行 —— 任务 21 / 已完成 13 (第三行「已验真任务」刻意不放首页)',
    idxLive.tasks === '21' && idxLive.tasksDone === '13' && idxLive.tasksVerified === null &&
    idxLive.tasksHidden.tasks === false && idxLive.tasksHidden.done === false,
    JSON.stringify({ t: idxLive.tasks, d: idxLive.tasksDone, v: idxLive.tasksVerified, h: idxLive.tasksHidden }));
  const idxTotLabels = await evalJs(`Array.from(document.querySelectorAll('${IDX_ROOT} .pulse-c-totals span')).map(e=>e.textContent.trim())`);
  check('首页 live: 六行标签 = 节点 / agents / 活跃 agent / 24 小时内出现 / 任务 / 已完成',
    JSON.stringify(idxTotLabels) === JSON.stringify(['节点', 'agents', '活跃 agent', '24 小时内出现', '任务', '已完成']), JSON.stringify(idxTotLabels));
  check('首页 live: scope=observed + 活动流按 feed-max 截断 (只 1 条, 不是 5 条)',
    idxLive.scope === '当前节点观察到' && !idxLive.scopeHidden && idxLive.feed.length === 1 && idxLive.feedText[0] === MARKUP_TEXT.zh,
    JSON.stringify({ s: idxLive.scope, f: idxLive.feed, ft: idxLive.feedText }));
  check('首页 live: caveat 仍在 + 未接入提示隐藏',
    idxLive.caveat.includes('不是全网精确总量') && idxLive.hintShown === false,
    JSON.stringify({ c: idxLive.caveat, h: idxLive.hintShown }));
  check('首页 live: 有指向网关页完整脉冲的链接',
    (await evalJs(`!!document.querySelector('${IDX_ROOT} .pulse-c-more a[href$="gateway.html#pulse"]')`)) === true);
  const idxDensity = await evalJs(`(() => ({ font: parseFloat(getComputedStyle(document.querySelector('${IDX_ROOT} .pulse-c-totals b')).fontSize), h: Math.round(document.querySelector('${IDX_ROOT}').getBoundingClientRect().height), rows: document.querySelectorAll('${IDX_ROOT} .pulse-c-totals li').length, feedStyle: getComputedStyle(document.querySelector('${IDX_ROOT} [data-pulse-feed] li')).display }))()`);
  check(`首页那份确实更轻更密 (数值字号 ${idxDensity.font}px < 网关 ${gwValueFont}px, 加了两行后整块高 ${idxDensity.h}px < 320px, 共 ${idxDensity.rows} 行数值)`,
    idxDensity.font < gwValueFont && idxDensity.h < 320 && idxDensity.rows === 6, JSON.stringify({ idxDensity, gwValueFont }));
  // 首页刻意不列签名行: 实测 1440px 下 6 项正好 1 行 (容器 620px), 第 7 项必然换行 →
  // 「一眼扫过」的紧凑契约会被破坏。这条断言同时守住「布局没变宽之前别往首页加第 7 行」。
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 2, mobile: false });
  await sleep(300);
  const idxTot = await evalJs(`(() => { const r = document.querySelector('${IDX_ROOT}'); const list = r.querySelector('.pulse-c-totals');
    const tops = Array.from(list.children).map((li) => Math.round(li.getBoundingClientRect().top));
    return { sigRows: r.querySelectorAll('[data-pulse-total="signatures"]').length, rows: list.children.length, lines: new Set(tops).size, listW: Math.round(list.getBoundingClientRect().width), listH: Math.round(list.getBoundingClientRect().height) }; })()`);
  check(`首页紧凑版刻意不列签名行, 且 6 项仍是 1 行 (1440px 实测 ${idxTot.lines} 行 / ${idxTot.listH}px 高; 第 7 项会换行) — 明细由网关页全量区承接`,
    idxTot.sigRows === 0 && idxTot.rows === 6 && idxTot.lines === 1, JSON.stringify(idxTot));
  await cdp('Emulation.clearDeviceMetricsOverride');
  await sleep(200);

  // 首页那份也吃中英切换
  await evalJs(`document.querySelector('.lang-toggle [data-lang="en"]').click()`);
  await sleep(300);
  const idxEn = await evalJs(pulseProbe(IDX_ROOT));
  const idxLabels = await evalJs(`Array.from(document.querySelectorAll('${IDX_ROOT} .pulse-c-totals span')).map(e => e.textContent.trim())`);
  check('首页 EN: 状态 Live + scope + 活动文案英文',
    idxEn.visible.includes('Live') && idxEn.scope === 'Observed by this node' && idxEn.feedText[0] === MARKUP_TEXT.en,
    JSON.stringify({ v: idxEn.visible, s: idxEn.scope, f: idxEn.feedText }));
  check('首页 EN: caveat 变「not an exact global total」', idxEn.caveat.includes('not an exact global total'), idxEn.caveat);
  check('首页 EN: 六个数值标签英文 (nodes/agents/active agents/seen in 24h/tasks/completed)',
    JSON.stringify(idxLabels) === JSON.stringify(['nodes', 'agents', 'active agents', 'seen in 24h', 'tasks', 'completed']), JSON.stringify(idxLabels));
  await evalJs(`document.querySelector('.lang-toggle [data-lang="zh"]').click()`);
  await sleep(250);

  // 活动流的语言回落 (缺当前语言退回另一种, 仍是服务端原文) + 相对时间刷新只改文字节点
  const pIdxEnOnly = nextPaused(7000);
  await evalJs(`(() => { window.__bolloonPulses[0].refresh(); return 1; })()`);
  let idxEnOnlyReq = null;
  try { idxEnOnlyReq = await pIdxEnOnly; } catch { /* 交给自证判「夹具未生效」 */ }
  fxPre('en-only', !!idxEnOnlyReq, '首页 refresh() 的取数请求 7s 内没被拦住');
  if (idxEnOnlyReq) await fxServe(idxEnOnlyReq, FX_EN_ONLY, 'en-only');
  // 消费证: 活动流里出现只有这份夹具才有的英文原文 (EN_ONLY_TEXT 由脚本给定)
  await fxSelfProof('en-only', { rootSel: IDX_ROOT, domSignal: fxFeedHas(EN_ONLY_TEXT), what: '首页 FX_EN_ONLY (只有 en 文案)' });
  const idxEnOnly = await evalJs(pulseProbe(IDX_ROOT));
  check('首页活动流: 只有 en 文案的条目在中文界面下退回 en (服务端原文, 不留空白行)',
    idxEnOnly.feedText.length === 1 && idxEnOnly.feedText[0] === EN_ONLY_TEXT && idxEnOnly.feedBlank === 0,
    JSON.stringify({ f: idxEnOnly.feedText, blank: idxEnOnly.feedBlank }));
  const idxTick = await evalJs(`(() => {
    const t = document.querySelector('${IDX_ROOT} [data-pulse-feed] time');
    window.__idxTick0 = t;
    const li = document.querySelector('${IDX_ROOT} [data-pulse-feed] li');
    window.__idxLi0 = li;
    t.setAttribute('data-at', String(Date.now() - 7200000));
    window.__bolloonPulses[0].tick();
    return { same: document.querySelector('${IDX_ROOT} [data-pulse-feed] time') === window.__idxTick0,
      liSame: document.querySelector('${IDX_ROOT} [data-pulse-feed] li') === window.__idxLi0,
      text: t.textContent, count: document.querySelectorAll('${IDX_ROOT} [data-pulse-feed] li').length };
  })()`);
  check('首页活动流: 相对时间刷新只改文字节点 (同类节点复用, 不重建列表)',
    idxTick.same && idxTick.liSame && /2 小时前/.test(idxTick.text) && idxTick.count === 1,
    JSON.stringify(idxTick));

  // 首页那份: 过期快照 → stale
  const pIdx2 = nextPaused(7000);
  await evalJs(`(() => { window.__bolloonPulses[0].refresh(); return 1; })()`);
  let idxReq2 = null;
  try { idxReq2 = await pIdx2; } catch { /* 交给自证判「夹具未生效」 */ }
  fxPre('expired', !!idxReq2, '首页 refresh() 的取数请求 7s 内没被拦住');
  if (idxReq2) await fxServe(idxReq2, FX_EXPIRED, 'expired');
  // 紧凑版没有 notes → 消费证 = 「只有夹具才有的形态」: 9 个节点 / 15 个 agent / 24h 2 / 活跃 0 + verified scope。
  // 这四个值同时从真快照里凑出来的概率可忽略; 就算真凑上, 后面断言也会照旧如实报错 (不放过)。
  await fxSelfProof('expired', { rootSel: IDX_ROOT, domSignal: fxVals({ nodes: '9', agents: '15', h24: '2', active: '0', scope: '网络观察快照' }), what: '首页 FX_EXPIRED' });
  const idxStale = await evalJs(pulseProbe(IDX_ROOT));
  check('首页 stale: fresh_until 已过 → 快照已过期 + scope=网络观察快照',
    idxStale.state === 'stale' && idxStale.visible.includes('快照已过期') && idxStale.scope === '网络观察快照',
    JSON.stringify({ s: idxStale.state, v: idxStale.visible, sc: idxStale.scope }));
  check('首页 stale: 仍显示快照数字 (9), 不伪装实时', idxStale.nodes === '9' && idxStale.feed.length === 0, JSON.stringify({ n: idxStale.nodes }));

  // 首页那份: 接口失败 → unavailable, 且不阻断首页其它区域
  const pIdx3 = nextPaused(7000);
  await evalJs(`(() => { window.__bolloonPulses[0].refresh(); return 1; })()`);
  let idxReq3 = null;
  try { idxReq3 = await pIdx3; } catch { /* 交给自证判「夹具未生效」 */ }
  fxPre('idx-fail', !!idxReq3, '首页 refresh() 的取数请求 7s 内没被拦住 (无法注入失败)');
  if (idxReq3) await fxFailServe(idxReq3, 'idx-fail');
  await fxSelfProof('idx-fail', { mode: 'fail', rootSel: IDX_ROOT, domSignal: (v) => !!v && v.state === 'unavailable', what: '首页取数失败夹具' });
  const idxUn = await evalJs(pulseProbe(IDX_ROOT));
  check('首页 unavailable: 请求失败 → 快照暂时读不到 + 数值清空 + ?pulse= 提示',
    idxUn.state === 'unavailable' && idxUn.visible.includes('快照暂时读不到') && idxUn.nodes === '—' &&
    idxUn.hintShown && idxUn.hint.includes('?pulse=') && idxUn.hint.includes('127.0.0.1:54188'),
    JSON.stringify({ s: idxUn.state, n: idxUn.nodes, h: idxUn.hintShown }));
  let idxBadge = '';
  for (let i = 0; i < 10; i++) {
    idxBadge = String(await evalJs(`(document.getElementById('version')||{}).textContent || ''`));
    if (/^\d+\.\d+\.\d+/.test(idxBadge)) break;
    await sleep(400);
  }
  const idxOthers = await evalJs(`(() => ({
    ctas: Array.from(document.querySelectorAll('#intro .intro-cta a')).map((a) => a.getAttribute('href')),
    year: (document.getElementById('year')||{}).textContent || '',
    capNo: Array.from(document.querySelectorAll('#capabilities .cap-no')).map(e => e.textContent).join(','),
  }))()`);
  // 序厅 CTA 行现在有 3 个按钮 (开始安装 / 加入网络 → gateway.html / 阅读文档) ——
  // 断言写成**逐项 href**, 而不是「个数 == 2」这种魔数: 这块要证明的是
  // 「首页那份取数失败后, 序厅 CTA 行依旧完整渲染」, 不是「按钮永远只有两个」。
  check('首页那份失败不阻断首页其它区域 (序厅 CTA 行 3 个按钮逐项仍在 / 能力区 / 徽章 / 页脚正常)',
    JSON.stringify(idxOthers.ctas) === JSON.stringify(['install.html', 'gateway.html', 'docs.html']) &&
    idxOthers.capNo === '01,02,03' && (!liveVersion || idxBadge === liveVersion) && /^\d{4}$/.test(idxOthers.year),
    JSON.stringify({ ...idxOthers, badge: idxBadge }));
  check('首页那份无 console 错误 / 未捕获异常', consoleErrors.length === idxErrStart, consoleErrors.slice(0, 3).join(' | '));

  // ⑧ 多实例隔离: 同一页两个实例, 一个失败另一个仍活
  console.log('\n[8] 多实例隔离 (同一页两个 [data-pulse], 互不干扰)');
  const isoErrStart = consoleErrors.length;
  await fxDisable();
  bMode = 'fail';
  aFail = false;
  shouldIntercept = (p) => p.request.url.includes('network-pulse-verify');
  await fxEnable(PULSE_PATTERN);
  const pIso = nextPaused(9000);
  await cdp('Page.navigate', { url: `${BASE}/gateway.html?pulse=${encodeURIComponent(pulseSrc)}` });
  let isoReq = null;
  try { isoReq = await pIso; } catch { /* 下面按 DOM 判断 */ }
  fxPre('live', !!isoReq, '多实例: 第一实例的取数请求 9s 内没被拦住');
  if (isoReq) await fxServe(isoReq, FX_LIVE, 'live');
  await fxSelfProof('live', { what: '多实例: 第一实例 FX_LIVE' });
  let isoBadge = '';
  for (let i = 0; i < 10; i++) {
    isoBadge = String(await evalJs(`(document.getElementById('version')||{}).textContent || ''`));
    if (/^\d+\.\d+\.\d+/.test(isoBadge)) break;
    await sleep(400);
  }
  const beforeInject = await evalJs(pulseProbe('#pulse'));
  check('隔离前: 第一实例 live (数值 7) 且页面上只有 1 个实例',
    beforeInject.state === 'live' && beforeInject.nodes === '7' && (await evalJs('window.__bolloonPulses.length')) === 1,
    JSON.stringify({ s: beforeInject.state, n: beforeInject.nodes }));

  const inject = await evalJs(`(() => {
    const orig = document.getElementById('pulse');
    const node = orig.cloneNode(true);
    node.removeAttribute('id');
    node.removeAttribute('data-pulse-bound');
    node.setAttribute('data-pulse-name', 'clone');
    node.setAttribute('data-pulse-src', ${JSON.stringify(B_SRC)});
    node.setAttribute('data-pulse-feed-max', '1');
    Array.from(node.querySelectorAll('[id]')).forEach((e) => e.removeAttribute('id'));
    document.body.appendChild(node);
    const inst = window.__bolloonPulse.attach(node);
    return { n: window.__bolloonPulses.length, attached: !!inst, scriptAttach: typeof window.__bolloonPulseAttach, id: node.id };
  })()`);
  check('运行时可再挂一个实例 (attach 新根 → 共 2 个独立实例)',
    inject.n === 2 && inject.attached === true && inject.id === '', JSON.stringify(inject));

  const pairProbe = `(() => {
    const roots = Array.from(document.querySelectorAll('[data-pulse]'));
    const A = roots[0], B = roots[1];
    const pick = (root, key) => { const n = root.querySelector('[data-pulse-total="' + key + '"]'); return n ? n.textContent.trim() : null; };
    const vis = (root) => (Array.from(root.querySelectorAll('.pulse-state-text')).filter(e => getComputedStyle(e).display !== 'none')[0] || {}).textContent || '';
    const notes = (root) => { const n = root.querySelector('[data-pulse-notes]'); return n ? n.textContent : ''; };
    if (!A || !B) return { missing: true, count: roots.length };
    return {
      count: roots.length,
      a: { state: A.getAttribute('data-pulse-state'), vis: vis(A), nodes: pick(A, 'nodes'), scope: (A.querySelector('[data-pulse-scope]')||{}).textContent, notes: notes(A) },
      b: { state: B.getAttribute('data-pulse-state'), vis: vis(B), nodes: pick(B, 'nodes'), notes: notes(B) },
    };
  })()`;
  // 第二实例的消费证: 它自己是 #pulse 的克隆 → 也有 [data-pulse-notes], 标记同样能落到它身上
  const pairSignal = (tag) => (v) => !v.missing && String(v.b.notes || '').includes(fxNoteText(tag));

  // 断言前自证: A 那份 FX_LIVE 真的到了页面 (quiet), B 那份「我方把请求打失败」也真的注入成功
  const gA = await fxSelfProof('live', { quietOk: true, what: '多实例: A 仍持 FX_LIVE' });
  const gB = await fxSelfProof('b-fail', { mode: 'fail', probeExpr: pairProbe, quietOk: true,
    domSignal: (v) => !v.missing && v.b.state === 'unavailable', what: '多实例: B 取数被拒' });
  fxNow = { ...gB, delivered: gA.delivered && gB.delivered, reason: gB.delivered ? gA.reason : gB.reason };
  if (fxNow.delivered) console.log('  🔒 夹具自证 [多实例] ✔ A = FX_LIVE 已送达 · B = 取数被拒夹具已注入 (我方 failRequest)');

  const pair1 = await evalJs(pairProbe);
  check('第二实例取数被拒 → 自己 unavailable 且数值不编造',
    !pair1.missing && pair1.b.state === 'unavailable' && pair1.b.vis.includes('快照暂时读不到') && pair1.b.nodes === '—',
    JSON.stringify(pair1));
  check('第一实例不受影响 (仍 live, 数值 7 未变)',
    !pair1.missing && pair1.a.state === 'live' && pair1.a.vis.includes('实时') && pair1.a.nodes === '7',
    JSON.stringify(pair1.a));

  // 反向: 第二实例给以过期快照 → stale 且仍有数字; 第一实例取数被拒 → unavailable
  bMode = 'expired';
  await evalJs(`(() => { window.__bolloonPulses[1].refresh(); return 1; })()`);
  // 断言前自证: B 的过期夹具真的到了它身上 (送达证记在 'expired-b', 消费证 = B 的 notes 里出现该夹具标记)
  await fxSelfProof('expired', { servedKey: 'expired-b', probeExpr: pairProbe, quietOk: true,
    domSignal: pairSignal('expired'), what: 'B 换到过期快照' });
  const pair2 = await evalJs(pairProbe);
  check('第二实例换到过期快照 → stale 且数字仍在 (9)',
    !pair2.missing && pair2.b.state === 'stale' && pair2.b.nodes === '9' && pair2.b.vis.includes('快照已过期'),
    JSON.stringify(pair2.b));

  aFail = true;
  await evalJs(`(() => { window.__bolloonPulses[0].refresh(); return 1; })()`);
  // A 的取数被拒 (我方 failRequest) + B 仍持过期夹具: 两侧都先自证, 任一没生效就明确报夹具错
  const gA3 = await fxSelfProof('a-fail', { mode: 'fail', domSignal: (v) => !!v && v.state === 'unavailable',
    what: 'A 取数被拒 (aFail)' });
  const gB3 = await fxSelfProof('expired', { servedKey: 'expired-b', probeExpr: pairProbe, quietOk: true, timeoutMs: 2000,
    domSignal: pairSignal('expired'), what: 'B 仍持过期快照' });
  fxNow = { ...gA3, delivered: gA3.delivered && gB3.delivered, reason: gA3.delivered ? gB3.reason : gA3.reason };
  const pair3 = await evalJs(`(() => {
    const roots = Array.from(document.querySelectorAll('[data-pulse]'));
    const A = roots[0], B = roots[1];
    const pick = (root, key) => { const n = root.querySelector('[data-pulse-total="' + key + '"]'); return n ? n.textContent.trim() : null; };
    const vis = (root) => (Array.from(root.querySelectorAll('.pulse-state-text')).filter(e => getComputedStyle(e).display !== 'none')[0] || {}).textContent || '';
    return {
      a: { state: A.getAttribute('data-pulse-state'), vis: vis(A), nodes: pick(A, 'nodes'), rows: A.querySelectorAll('[data-pulse-activity-body] tr').length },
      b: { state: B.getAttribute('data-pulse-state'), vis: vis(B), nodes: pick(B, 'nodes'), scope: (B.querySelector('[data-pulse-scope]')||{}).textContent },
      page: { cmd: (document.getElementById('skill-cmd')||{}).textContent || '' },
      api: { first: window.__bolloonPulse === window.__bolloonPulses[0], n: window.__bolloonPulses.length },
    };
  })()`);
  check('第一实例也能独立失败 (A → unavailable, 数值清空, 表格 0 行, 不编造)',
    pair3.a.state === 'unavailable' && pair3.a.vis.includes('快照暂时读不到') && pair3.a.nodes === '—' && pair3.a.rows === 0,
    JSON.stringify(pair3.a));
  check('第二实例完全不受第一份失败影响 (仍 stale + 数字 9 + 自己的 scope)',
    pair3.b.state === 'stale' && pair3.b.nodes === '9' && pair3.b.scope === '网络观察快照',
    JSON.stringify(pair3.b));
  check('两份实例互不干扰: 页面其它区域 (命令/徽章) 仍正常 + __bolloonPulse = 第一实例',
    /^read /.test(pair3.page.cmd) && (!liveVersion || isoBadge === liveVersion) && pair3.api.first === true && pair3.api.n === 2,
    JSON.stringify({ cmd: pair3.page.cmd.slice(0, 30), badge: isoBadge, api: pair3.api }));
  aFail = false;
  check('多实例这一轮无 console 错误 / 未捕获异常', consoleErrors.length === isoErrStart, consoleErrors.slice(0, 3).join(' | '));

  // ⑨ 全站无重复 id
  console.log('\n[9] 全站无重复 id (7 页, JS 跑完后实算)');
  await fxDisable();
  fxOff();
  for (const pg of ALL_PAGES) {
    await cdp('Page.navigate', { url: `${BASE}/${pg}` });
    // 固定 sleep 的隐患在「缺失类」断言上更危险: 文档没加载完时 [id] 为空 ⇒ 不可能有重复 id ⇒ **假绿**。
    // 先等到文档就绪且有内容再判; 超时也照原断言判红 (只加等待, 不改判据)。
    await waitUntil(`document.readyState === 'complete' && document.querySelectorAll('[id]').length > 0`, { tries: 60, interval: 200 });
    const dups = await evalJs(`(() => { const m = {}; document.querySelectorAll('[id]').forEach((e) => { m[e.id] = (m[e.id] || 0) + 1; }); return Object.keys(m).filter((k) => m[k] > 1); })()`);
    check(`${pg} 无重复 id`, Array.isArray(dups) && dups.length === 0, JSON.stringify(dups));
  }
  // 脉冲区内部节点一律用 data-pulse-* 钩子 (不靠 id ⇒ 多实例不会撞 id)
  await cdp('Page.navigate', { url: `${BASE}/index.html` });
  // 固定 sleep 会量到「文档还没画完」的中间态 (线上 CDN 更慢 → roots:0 的假红, 2026-09-22 实测)。
  // 先等到「文档就绪 且 脉冲根节点已出现」再取证; 超时也照原断言判红 (不改判据, 只加等待)。
  await waitUntil(`document.readyState === 'complete' && document.querySelectorAll('[data-pulse]').length >= 1`, { tries: 60, interval: 200 });
  const hookCheck = await evalJs(`(() => ({ ids: Array.from(document.querySelectorAll('[data-pulse] [id]')).map(e => e.id), roots: document.querySelectorAll('[data-pulse]').length }))()`);
  check('首页脉冲区内部节点一律用 data-pulse-* 钩子 (无 id, 天然不撞)',
    !!hookCheck && hookCheck.roots >= 1 && hookCheck.ids.length === 0, JSON.stringify(hookCheck));

  // ⑪ 全站资源版本 ?v=22 一致 (逐页抓原始 HTML —— 只看一页会被漏改骗过)
  console.log('\n[10] 全站资源 ?v=22 一致 (7 页原始 HTML)');
  const vStale = [], vMissing = [];
  for (const pg of ALL_PAGES) {
    const html = await fetchText(`${BASE}/${pg}`);
    const vs = (html.match(/\?v=\d+/g) || []).filter((v) => v !== '?v=22');
    if (vs.length) vStale.push(`${pg}:${vs.join(',')}`);
    if (pg !== 'skill.html' && (!/style\.css\?v=22/.test(html) || !/app\.js\?v=22/.test(html))) vMissing.push(pg);
  }
  check('7 页都没有 ?v=22 之外的版本号 (逐页 grep 一致, 无旧版残留)', vStale.length === 0, JSON.stringify(vStale));
  check('6 个带外链资源的页 = style.css?v=22 + app.js?v=22 (skill.html 自包含, 无外链)',
    vMissing.length === 0, JSON.stringify(vMissing));

  // ⑫ 命名与可见文本审计 (2026-09-22 语义收窄):
  //     ① 停用名「网络脉冲 / Network pulse / 全球网络脉冲」全站零出现 (改名不可回退);
  //     ② 「加入网络」**不再是停用名** —— leo 明确要求首页 CTA 行加一个指向网关页
  //        (gateway.html) 的「加入网络」按钮。这条断言本来要防的是**旧网关序厅 / 旧导航项**
  //        (那个已被删除的 `加入网络` 大字 h1 与导航项), 不是防这个按钮。
  //        所以拆开: 「加入网络」只允许作为首页那一个 <a class="join-network-cta" href="gateway.html">
  //        出现 —— 原始 HTML 里先把这个标签整体挖掉再看剩下有没有; 渲染后可见文本里先摘掉它的
  //        中/英标签再扫。摘掉后仍命中 = 页面别处还藏着一个「加入网络」(旧序厅复发) → 失败。
  //     ③ 页面里也不该有 40 位地址 / 64 位哈希 (长标识一律短写)。
  console.log('\n[11] 旧名清除 + 页面可见文本不含长地址/长哈希');
  const DEAD_NAMES = ['网络脉冲', 'Network pulse', '全球网络脉冲'];
  const JOIN_NAMES = ['加入网络', 'Join the network'];
  const nameHits = [], hashHits = [], joinRawHits = [];
  for (const pg of ALL_PAGES) {
    const html = await fetchText(`${BASE}/${pg}`);
    const hits = DEAD_NAMES.filter((w) => html.includes(w));
    if (hits.length) nameHits.push(`${pg}:${hits.join('|')}`);
    const stripped = html.replace(/<a[^>]*join-network-cta[^>]*>[\s\S]*?<\/a>/g, '');
    const jHits = JOIN_NAMES.filter((w) => stripped.includes(w));
    if (jHits.length) joinRawHits.push(`${pg}:${jHits.join('|')}`);
    if (/\b0x[0-9a-fA-F]{40}\b/.test(html) || /\b[0-9a-fA-F]{64}\b/.test(html)) hashHits.push(pg);
  }
  check('7 页原始 HTML (含 meta description) 都没有旧名 网络脉冲 / Network pulse / 全球网络脉冲',
    nameHits.length === 0, JSON.stringify(nameHits));
  check('「加入网络」在 7 页原始 HTML 里只出现在首页那个 CTA 按钮标签内 (其余 6 页 / 其余位置零出现)',
    joinRawHits.length === 0, JSON.stringify(joinRawHits));
  check('7 页原始 HTML 都没有 40 位地址 / 64 位哈希', hashHits.length === 0, JSON.stringify(hashHits));
  for (const pg of ['gateway.html', 'index.html']) {
    await cdp('Page.navigate', { url: `${BASE}/${pg}` });
    await sleep(900);
    const audit = await evalJs(`(() => {
      const deads = ${JSON.stringify(DEAD_NAMES)};
      const joins = ${JSON.stringify(JOIN_NAMES)};
      const raw = document.body.innerText;
      const nav = Array.from(document.querySelectorAll('.mast-links a')).map((a) => a.textContent.trim()).join(' | ');
      // 首页 CTA 上那个「加入网络」按钮的文案不算旧名 —— 先把它从文本里摘掉再扫。
      // 摘掉后仍命中「加入网络」= 页面别处还藏着一个 (旧序厅复发) → 失败。
      const cta = document.querySelector('a.join-network-cta');
      const text = cta ? raw.split(cta.textContent.trim()).join('') : raw;
      return {
        nav: nav,
        hits: deads.filter((w) => raw.indexOf(w) !== -1),
        joinHits: joins.filter((w) => text.indexOf(w) !== -1),
        navHits: deads.concat(joins).filter((w) => nav.indexOf(w) !== -1),
        h1: Array.from(document.querySelectorAll('h1')).map((e) => e.textContent.trim()),
        titles: Array.from(document.querySelectorAll('.section-title')).map((e) => e.textContent.trim()),
        gatewayNav: Array.from(document.querySelectorAll('.mast-links .nav-menu a')).map((a) => a.textContent.trim()),
        longAddr: /\\b0x[0-9a-fA-F]{40}\\b/.test(raw),
        longHash: /\\b[0-9a-fA-F]{64}\\b/.test(raw),
      };
    })()`);
    check(`${pg} 渲染后: 可见文本 + 导航(含下拉) 都没有旧名 (导航项: ${String(audit.nav).slice(0, 90)})`,
      audit.hits.length === 0 && audit.navHits.length === 0, JSON.stringify({ hits: audit.hits, navHits: audit.navHits, nav: audit.nav }));
    check(`${pg} 渲染后: 「加入网络」只作为首页 CTA 按钮出现 (摘掉按钮文案后零命中)`,
      audit.joinHits.length === 0, JSON.stringify(audit.joinHits));
    check(`${pg} 渲染后: 可见文本没有 40 位地址 / 64 位哈希`,
      audit.longAddr === false && audit.longHash === false, JSON.stringify({ a: audit.longAddr, h: audit.longHash }));
    if (pg === 'gateway.html') {
      check('网关页导航里确实有「链上活动」项 (是改名, 不是删掉)',
        audit.gatewayNav.includes('链上活动'), JSON.stringify(audit.gatewayNav));
      check('网关页 h1 / 各区标题都不再是「加入网络」序厅 (页面以链上活动为主体)',
        audit.h1.every((t) => !/加入网络/.test(t)) && audit.titles.every((t) => !/加入网络/.test(t)),
        JSON.stringify({ h1: audit.h1, titles: audit.titles }));
    }
    if (pg === 'index.html') {
      check('首页导航里确实有「链上活动」项 (指向网关页 #pulse)',
        audit.gatewayNav.includes('链上活动'), JSON.stringify(audit.gatewayNav));
    }
  }

  // ⑲′ 过期假标签防复发 (2026-09-22): 页面与导航里**不得**再出现与事实相反的"尚未接入"类文案 ——
  //     公开观察入口早已接入 (线上真在供给 25 行链上活动), 说"尚未接入"就是假话。
  //     扫真站点 7 页: 原始 HTML (含注释/导航) + 渲染后可见文本 + 导航 + unavailable 态文案。
  console.log('\n[11b] 过期假标签防复发 (页面 + 导航都不许出现"尚未接入"类虚假文案)');
  const FALSE_LABELS = ['尚未接入', '还没接入', '尚未打通', 'Public observation endpoint not connected', 'observation endpoint not connected'];
  const falseRaw = [];
  for (const pg of ALL_PAGES) {
    const html = await fetchText(`${BASE}/${pg}`);
    const hits = FALSE_LABELS.filter((w) => html.includes(w));
    if (hits.length) falseRaw.push(`${pg}:${hits.join('|')}`);
  }
  check('7 页原始 HTML (含注释 / 导航 / 静态文案) 都没有"尚未接入"类虚假文案', falseRaw.length === 0, JSON.stringify(falseRaw));
  for (const pg of ['gateway.html', 'index.html']) {
    await cdp('Page.navigate', { url: `${BASE}/${pg}` });
    await sleep(900);
    const f = await evalJs(`(() => {
      const labels = ${JSON.stringify(FALSE_LABELS)};
      const text = document.body.innerText;
      const nav = Array.from(document.querySelectorAll('.mast-links a')).map((a) => a.textContent.trim()).join(' | ');
      const un = document.querySelector('.pulse-state-text[data-state="unavailable"]');
      const hint = document.querySelector('[data-pulse-hint]');
      return {
        hits: labels.filter((w) => text.indexOf(w) !== -1),
        navHits: labels.filter((w) => nav.indexOf(w) !== -1),
        unavailableText: un ? un.textContent.trim() : null,
        hintText: hint ? hint.textContent : '',
      };
    })()`);
    check(`${pg} 渲染后: 可见文本与导航都没有"尚未接入"类虚假文案`,
      f.hits.length === 0 && f.navHits.length === 0, JSON.stringify({ hits: f.hits, navHits: f.navHits }));
    check(`${pg} unavailable 态文案是真话 (快照暂时读不到), 不是"入口还没接"`,
      f.unavailableText === '快照暂时读不到', String(f.unavailableText));
    check(`${pg} unavailable 提示说的是真原因 (签名快照取数失败), 且仍给 ?pulse= 出路`,
      f.hintText.includes('快照这次没读到') && f.hintText.includes('network-pulse.json') && f.hintText.includes('?pulse='),
      f.hintText.slice(0, 120));
  }

  // ⑬ 网关页两栏版式 + 首页「加入网络」CTA (2026-09-22 leo 要求):
  //    ① gateway.html: 「加入方式」(#skills) 必须在「链上活动」(#pulse) **右侧**,
  //       桌面下两者同一行 (链上活动 | 加入方式), 窄屏 (390px) 堆叠且不溢出;
  //    ② index.html: hero CTA 行新增「加入网络」按钮, 位置在「开始安装」**右侧**,
  //       指向 gateway.html, 双语, 真 <a> + 键盘 Tab 可达 + 焦点环可见。
  //    全部用真布局测量 (getBoundingClientRect + 真 Tab 键), 不看 CSS 声明猜。
  console.log('\n[12] 网关页两栏 (链上活动 左 · 加入方式 右) + 首页「加入网络」按钮');
  await cdp('Page.navigate', { url: `${BASE}/gateway.html` });
  // 等第一轮取数落地 (state 不再是 loading) 且布局两次读数一致再测量 —— 不用固定 sleep
  const duo = await waitStable(`(() => {
    const p = document.getElementById('pulse'), s = document.getElementById('skills');
    if (!p || !s) return null;
    const row = p.parentElement;
    const kick = (el) => { const k = el.querySelector('.section-head .kicker'); return k ? k.textContent.trim() : null; };
    return {
      sameParent: row === s.parentElement,
      rowClass: row.className,
      rowIsDiv: row.tagName === 'DIV',
      pulseBeforeSkills: !!(p.compareDocumentPosition(s) & 4),
      ids: Array.from(document.querySelectorAll('section[id]')).map((x) => x.id),
      pulseKicker: kick(p), skillsKicker: kick(s),
      pulseTitle: p.querySelector('.section-title').textContent.trim(),
      skillsTitle: s.querySelector('.section-title').textContent.trim(),
      pulseState: p.getAttribute('data-pulse-state'),
    };
  })()`, (v) => v && v.sameParent === true && v.pulseBeforeSkills === true && v.pulseState !== 'loading');
  check('gateway.html: #pulse 与 #skills 是同一个容器 (.gateway-row) 的两个子项 (两栏版式的地基)',
    !!duo && duo.sameParent && duo.rowIsDiv && /gateway-row/.test(duo.rowClass), JSON.stringify(duo && { same: duo.sameParent, cls: duo.rowClass }));
  check('gateway.html: 文档顺序仍是 pulse → skills (锚点 / 导航下拉 / 分节顺序都不变)',
    !!duo && duo.pulseBeforeSkills === true &&
    JSON.stringify(duo.ids) === JSON.stringify(['pulse', 'skills', 'join', 'manifest', 'endpoints', 'developer']),
    JSON.stringify(duo && duo.ids));
  check('gateway.html: 编号语义自洽 (左 01 链上活动 · 右 02 加入方式, 左→右即阅读顺序)',
    !!duo && /01/.test(duo.pulseKicker || '') && /02/.test(duo.skillsKicker || '') &&
    duo.pulseTitle === '链上活动' && duo.skillsTitle === '加入方式',
    JSON.stringify(duo && [duo.pulseKicker, duo.pulseTitle, duo.skillsKicker, duo.skillsTitle]));

  // 桌面 1440: 两区同一行, 加入方式在右 (真测量, 等稳定)
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  const desk = await waitStable(`(() => {
    const box = (el) => { const b = el.getBoundingClientRect(); return { l: Math.round(b.left), r: Math.round(b.right), t: Math.round(b.top), b: Math.round(b.bottom), w: Math.round(b.width) }; };
    const p = document.getElementById('pulse'), s = document.getElementById('skills');
    const row = p.parentElement;
    const pr = box(p), sr = box(s), rr = box(row), cs = getComputedStyle(row);
    return { vw: window.innerWidth, pr, sr, rr, display: cs.display, cols: cs.gridTemplateColumns.split(' ').length,
      gap: Math.round(parseFloat(cs.columnGap)), sameRow: Math.abs(pr.t - sr.t) <= 8,
      rightOfPulse: sr.l >= pr.r, rowInViewport: rr.r <= window.innerWidth + 1,
      pulseState: p.getAttribute('data-pulse-state') };
  })()`, (v) => v && v.display === 'grid' && v.cols === 2 && v.sameRow === true && v.rightOfPulse === true && v.pulseState !== 'loading');
  check(`1440px: 链上活动与加入方式同一行且加入方式在右侧 (链上活动 x ${desk.pr.l}→${desk.pr.r} · 加入方式 x ${desk.sr.l}→${desk.sr.r} · 顶 y ${desk.pr.t}/${desk.sr.t} · 列宽 ${desk.pr.w}/${desk.sr.w}px)`,
    desk.display === 'grid' && desk.cols === 2 && desk.sameRow === true && desk.rightOfPulse === true && desk.rowInViewport === true,
    JSON.stringify(desk));
  check('1440px: 两栏之间确有一段横向间隔 (不是靠负 margin 叠出来的假并排)',
    Math.abs(desk.sr.l - desk.pr.r - desk.gap) <= 1 && desk.gap >= 20, JSON.stringify({ gapDeclared: desk.gap, measured: desk.sr.l - desk.pr.r }));

  // 窄屏 390: 堆叠 (加入方式落到链上活动下方) + 不贡献横向溢出
  await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  const narrow = await waitStable(`(() => {
    const box = (el) => { const b = el.getBoundingClientRect(); return { l: Math.round(b.left), r: Math.round(b.right), t: Math.round(b.top), b: Math.round(b.bottom), w: Math.round(b.width) }; };
    const p = document.getElementById('pulse'), s = document.getElementById('skills');
    const row = p.parentElement;
    const pr = box(p), sr = box(s), rr = box(row);
    const de = document.documentElement;
    const overAll = de.scrollWidth - de.clientWidth;
    const prev = row.style.display; row.style.display = 'none';
    const overNoRow = de.scrollWidth - de.clientWidth;
    row.style.display = prev;
    const cmd = document.querySelector('#skills .skill-cmd');
    const cmdBox = cmd ? box(cmd) : null;
    return { vw: window.innerWidth, pr, sr, rr, cols: getComputedStyle(row).gridTemplateColumns,
      stacked: sr.t >= pr.b, sameLeft: Math.abs(sr.l - pr.l) <= 1 && Math.abs(sr.r - pr.r) <= 1,
      rowInViewport: rr.r <= window.innerWidth + 1 && sr.r <= window.innerWidth + 1,
      overAll, overNoRow, cmdBox,
      cmdOverflow: cmd ? cmd.scrollWidth - cmd.clientWidth : null,
      pulseState: p.getAttribute('data-pulse-state') };
  })()`, (v) => v && v.stacked === true && v.cols.split(' ').length === 1 && v.sameLeft === true && v.pulseState !== 'loading');
  check(`390px: 加入方式堆叠到链上活动下方 (链上活动 y ${narrow.pr.t}→${narrow.pr.b} · 加入方式 y ${narrow.sr.t}→${narrow.sr.b})`,
    narrow.stacked === true && narrow.cols.split(' ').length === 1 && narrow.sameLeft === true, JSON.stringify(narrow));
  check(`390px: 两栏容器与右列都不超出视口 (容器 x→${narrow.rr.r} · 右列 x→${narrow.sr.r} · 视口 ${narrow.vw}px), 命令块不横向溢出 (${narrow.cmdOverflow}px)`,
    narrow.rowInViewport === true && narrow.cmdOverflow === 0, JSON.stringify({ rr: narrow.rr, sr: narrow.sr, cmd: narrow.cmdBox, over: narrow.cmdOverflow }));
  check(`390px: 两栏自身不贡献页面横向溢出 (整页溢出 隐藏容器前 ${narrow.overAll}px / 后 ${narrow.overNoRow}px —— 老底噪在顶栏, 与新两栏无关)`,
    narrow.overAll === narrow.overNoRow, JSON.stringify({ overAll: narrow.overAll, overNoRow: narrow.overNoRow }));
  await cdp('Emulation.clearDeviceMetricsOverride');
  await sleep(200);

  // 首页 CTA: 「加入网络」按钮在「开始安装」右侧、指向网关页、双语、键盘可达
  await cdp('Page.navigate', { url: `${BASE}/index.html` });
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  const cta = await waitStable(`(() => {
    const box = (el) => { const b = el.getBoundingClientRect(); return { l: Math.round(b.left), r: Math.round(b.right), t: Math.round(b.top), w: Math.round(b.width) }; };
    const row = document.querySelector('.intro-cta');
    const join = document.querySelector('a.join-network-cta');
    if (!row || !join) return { row: !!row, join: !!join };
    const install = Array.from(row.querySelectorAll('a')).filter((a) => /开始安装/.test(a.textContent))[0];
    const jr = box(join), ir = install ? box(install) : null;
    return { tag: join.tagName, href: join.getAttribute('href'), text: join.textContent.trim(),
      zh: join.getAttribute('data-zh'), en: join.getAttribute('data-en'), kids: join.childNodes.length,
      order: Array.from(row.querySelectorAll('a')).map((a) => a.textContent.trim()),
      jr, ir, rightOfInstall: !!ir && jr.l >= ir.r - 1, sameRowAsInstall: !!ir && Math.abs(jr.t - ir.t) <= 8,
      tabIndex: join.tabIndex, isAnchor: join.tagName === 'A',
      inViewport: box(row).r <= window.innerWidth + 1,
      hasArrowKid: !!join.querySelector('span, em, i, b') };
  })()`, (v) => v && v.isAnchor === true && v.rightOfInstall === true && v.sameRowAsInstall === true && v.kids === 1);
  check('首页 hero CTA 行里有「加入网络」按钮 (真 <a>, href=gateway.html, 纯文本节点)',
    cta.isAnchor === true && cta.href === 'gateway.html' && cta.kids === 1 && cta.text === '加入网络' && cta.hasArrowKid === false,
    JSON.stringify({ tag: cta.tag, href: cta.href, text: cta.text, kids: cta.kids }));
  check(`首页: 「加入网络」在「开始安装」右侧且同一行 (开始安装 x→${cta.ir && cta.ir.r} · 加入网络 x ${cta.jr && cta.jr.l}→${cta.jr && cta.jr.r} · 顶 y ${cta.ir && cta.ir.t}/${cta.jr && cta.jr.t})`,
    cta.rightOfInstall === true && cta.sameRowAsInstall === true,
    JSON.stringify({ order: cta.order, ir: cta.ir, jr: cta.jr }));
  check('首页 CTA 顺序 = 开始安装 → 加入网络 → 阅读文档 (加入网络插在安装右侧, 文档仍在最后)',
    JSON.stringify(cta.order) === JSON.stringify(['开始安装 →', '加入网络', '阅读文档']), JSON.stringify(cta.order));
  check('首页「加入网络」双语属性齐 (data-zh/data-en), 切 EN 后文字真的变英文且不丢结构',
    cta.zh === '加入网络' && cta.en === 'Join the network' && cta.href === 'gateway.html', JSON.stringify({ zh: cta.zh, en: cta.en }));

  // 真键盘: 按 Tab 直到焦点落到「加入网络」—— 证明它在 Tab 序里 (不是只能鼠标点), 且焦点环可见
  await cdp('Page.bringToFront').catch(() => {});
  await waitUntil(`document.readyState === 'complete' && !!document.querySelector('a.join-network-cta')`);
  await evalJs(`(() => { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); return 1; })()`);
  let tabbed = null, tabSteps = 0;
  for (let i = 0; i < 40 && !tabbed; i++) {
    await cdp('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 });
    await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 });
    await sleep(70);
    tabSteps = i + 1;
    tabbed = await evalJs(`(() => { const a = document.activeElement; return a && a.classList && a.classList.contains('join-network-cta') ? a.textContent.trim() : null; })()`);
  }
  const focusRing = await evalJs(`(() => { const a = document.activeElement; const cs = getComputedStyle(a); return { cls: a.className, text: a.textContent.trim(), style: cs.outlineStyle, width: cs.outlineWidth, color: cs.outlineColor, offset: cs.outlineOffset }; })()`);
  check(`首页「加入网络」在真实 Tab 序里 (第 ${tabSteps} 次 Tab 到达, 焦点落在 ${JSON.stringify(focusRing.text)})`,
    tabbed === '加入网络', JSON.stringify({ tabbed, tabSteps }));
  check(`首页「加入网络」键盘焦点环可见 (outline ${focusRing.style} ${focusRing.width} ${focusRing.color})`,
    focusRing.style === 'solid' && focusRing.width === '2px' && /196,\s*214,\s*64/.test(focusRing.color), JSON.stringify(focusRing));

  const ctaEn = await evalJs(`(() => { document.querySelector('.lang-toggle [data-lang="en"]').click(); const j = document.querySelector('a.join-network-cta'); return { text: j.textContent.trim(), kids: j.childNodes.length, href: j.getAttribute('href') }; })()`);
  check('首页「加入网络」切 EN 后 = Join the network (仍是同一个 gateway.html 链接)',
    ctaEn.text === 'Join the network' && ctaEn.kids === 1 && ctaEn.href === 'gateway.html', JSON.stringify(ctaEn));
  await evalJs(`document.querySelector('.lang-toggle [data-lang="zh"]').click()`);
  await sleep(250);

  // 390px: 三个按钮换行且不溢出 (CTA 行 flex-wrap)
  await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  const ctaMob = await waitStable(`(() => {
    const box = (el) => { const b = el.getBoundingClientRect(); return { l: Math.round(b.left), r: Math.round(b.right), t: Math.round(b.top) }; };
    const row = document.querySelector('.intro-cta');
    const de = document.documentElement;
    const overAll = de.scrollWidth - de.clientWidth;
    const prev = row.style.display; row.style.display = 'none';
    const overNoRow = de.scrollWidth - de.clientWidth;
    row.style.display = prev;
    const items = Array.from(row.querySelectorAll('a')).map((a) => Object.assign({ text: a.textContent.trim() }, box(a)));
    return { vw: window.innerWidth, wrap: getComputedStyle(row).flexWrap, rr: box(row), items,
      rowInViewport: box(row).r <= window.innerWidth + 1 && items.every((i) => i.r <= window.innerWidth + 1),
      overAll, overNoRow };
  })()`, (v) => v && v.wrap === 'wrap' && v.rowInViewport === true && v.items.length === 3);
  check(`390px: CTA 行换成多行且三个按钮都在视口内 (flex-wrap: ${ctaMob.wrap}; ${ctaMob.items.map((i) => `${i.text} x→${i.r}`).join(' · ')})`,
    ctaMob.wrap === 'wrap' && ctaMob.rowInViewport === true, JSON.stringify(ctaMob));
  check(`390px: CTA 行本身不贡献横向溢出 (整页溢出 隐藏 CTA 行前 ${ctaMob.overAll}px / 后 ${ctaMob.overNoRow}px)`,
    ctaMob.overAll === ctaMob.overNoRow, JSON.stringify({ a: ctaMob.overAll, b: ctaMob.overNoRow }));
  await cdp('Emulation.clearDeviceMetricsOverride');
  await sleep(200);

  // console 错误
  check('整轮访问无 console 错误 / 未捕获异常', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));

  console.log(`\n=== 结果: ${passed} passed, ${failed} failed, ${skipped} skipped ===`);
  console.log(`=== 其中「夹具错 · 未生效」(拦截没命中, 不代表页面有缺陷): ${fxFailures} 条 ===`);
  console.log(`=== 夹具自证纪律: 本节所有吃夹具的断言都在断言前跑过「送达证 + 链路证 + 消费证」; 显式跳过 ${skipped} 条 ===`);
  ws.close();
  proc.kill();
  try { fs.rmSync(userDir, { recursive: true, force: true }); } catch { /* noop */ }
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error('验收脚本异常:', e); process.exit(1); });
