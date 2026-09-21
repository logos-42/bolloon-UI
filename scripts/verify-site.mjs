/**
 * verify-site.mjs — bolloon.cn 站点上线后真浏览器验收 (零依赖, 自包含 CDP)
 *
 * 为什么自包含: 站点仓不装 npm 包, 但它要能自己验自己 —— 只用 node 全局 WebSocket
 * 驱动本机 Chrome (headless=new), 不引任何依赖。
 *
 * 覆盖:
 *   ① 5 页版本徽章 = live npm 版本 (取自 registry, 不再硬编码)
 *   ② 徽章在 JS 失败时显示「—」而不是过期版本 (静态 HTML 内已是占位符)
 *   ③ skill.html 已同步文档 v1.3.0
 *   ④ gateway.html 的粘贴命令 = 本页实际源 + bolloon-gateway-join.md
 *   ⑤ /bolloon-gateway-join.md 线上正文 = v1.3.0 且含 join_global_gateway / publicKey
 *   ⑥ gateway.html 全球网络脉冲 (公开只读接口 /api/public/network/progress):
 *      loading/live/stale/unavailable 四态 (用 CDP Fetch 拦截夹具数据, 不对真实网络下断言)、
 *      中英切换、活动文本走 textContent、失败不阻断其它区域、30s 轮询 + 5s 超时 + 退避常量、
 *      prefers-reduced-motion、390px 纵向堆叠、回退同源 network-pulse.json、无 console 错误
 *   ⑦ index.html 序栏 (hero) 紧凑版脉冲: 同一数据源、同一诚实四态、紧凑度确实优于网关页
 *   ⑧ 多实例隔离: 同一页两个 [data-pulse] 实例各自独立取数/降级 (一个失败另一个仍活)
 *   ⑨ 全站 7 页无重复 id
 *   ⑩ 网关页新顺序: 脉冲区在「加入方式 / 如何加入」之前
 *
 * 脉冲区钩子约定 (见 app.js 末尾多实例模块): 根 = [data-pulse],
 * 区内节点 = data-pulse-scope / data-pulse-time / data-pulse-ago / data-pulse-total="nodes|agents|active|24h"
 *            / data-pulse-caps / data-pulse-feed / data-pulse-notes / data-pulse-hint。
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

let passed = 0, failed = 0;
const check = (name, ok, detail = '') => {
  if (ok) { passed++; console.log(`  ✅ ${name}`); }
  else { failed++; console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`); }
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 脉冲区探针: 只认 data-pulse-* 钩子 (不依赖 id), 网关页与首页序栏通用
const pulseProbe = (rootSel) => `(() => {
  const root = document.querySelector(${JSON.stringify(rootSel)});
  if (!root) return null;
  const q = (s) => root.querySelector(s);
  const t = (s) => { const n = q(s); return n ? n.textContent.trim() : null; };
  const txt = (s) => { const n = q(s); return n ? n.textContent : ''; };
  const visText = Array.from(root.querySelectorAll('.pulse-state-text')).filter((e) => getComputedStyle(e).display !== 'none')[0] || {};
  const hint = q('.pulse-hint');
  const caveat = q('.pulse-caveat');
  return {
    state: root.getAttribute('data-pulse-state'),
    visible: visText.textContent || '',
    nodes: t('[data-pulse-total="nodes"]'),
    agents: t('[data-pulse-total="agents"]'),
    active: t('[data-pulse-total="active"]'),
    h24: t('[data-pulse-total="24h"]'),
    scope: t('[data-pulse-scope]'),
    scopeHidden: !!q('[data-pulse-scope]') && q('[data-pulse-scope]').hasAttribute('hidden'),
    snap: t('[data-pulse-time]'),
    ago: t('[data-pulse-ago]'),
    feed: Array.from(root.querySelectorAll('[data-pulse-feed] li')).map((li) => li.textContent.trim()),
    feedText: Array.from(root.querySelectorAll('[data-pulse-feed] .pulse-feed-text')).map((e) => e.textContent),
    caps: Array.from(root.querySelectorAll('[data-pulse-caps] li')).map((li) => li.textContent.trim()),
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

  const evalJs = async (code) => {
    const r = await cdp('Runtime.evaluate', { expression: code, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception?.description || ''));
    return r.result.value;
  };

  console.log(`=== bolloon.cn 站点真浏览器验收 (${BASE}) ===\n`);

  // live npm 版本 (作为期望值)
  let liveVersion = null;
  try {
    const r = await fetch('https://registry.npmjs.org/@bolloon/bolloon-agent/latest');
    if (r.ok) liveVersion = (await r.json()).version;
  } catch { /* 网络问题, 后面按 DOM 判断 */ }
  console.log(`[0] npm registry latest = ${liveVersion || '(取不到)'}`);

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
    const html = await (await fetch(`${BASE}/${p}`)).text();
    const hard = /id="version">([^<]*)</.exec(html);
    const val = hard ? hard[1].trim() : '(未找到 #version)';
    check(`${p} 占位 = 「${val}」(非过期版本号)`, !/^\d+\.\d+\.\d+$/.test(val), val);
  }

  // ③ skill.html 文档同步
  console.log('\n[3] skill.html 已同步文档 v1.3.0');
  const skillHtml = await (await fetch(`${BASE}/skill.html`)).text();
  check('版本 1.3.0', skillHtml.includes('>1.3.0<') || skillHtml.includes('1.3.0'));
  check('含「0.1 三条执行路径」', skillHtml.includes('0.1 三条执行路径'));
  check('含手机端路径 A′ (本机内核执行)', skillHtml.includes('路径 A′') && skillHtml.includes('bolloon_gateway_join'));
  check('含 join_global_gateway 工具路径', skillHtml.includes('join_global_gateway'));
  check('含 §7 首次接触 TOFU', skillHtml.includes('首次接触 TOFU'));
  check('排错含 publicKey 拒收行', skillHtml.includes('无 publicKey'));
  check('含 §11 M1 任务闭环', skillHtml.includes('11. 用买到的能力完成任务') && skillHtml.includes('bolloon task'));

  // ④ gateway.html 命令
  console.log('\n[4] gateway.html 粘贴命令跟随访问源');
  await cdp('Page.navigate', { url: `${BASE}/gateway.html` });
  await sleep(1500);
  const cmd = String(await evalJs(`(document.getElementById('skill-cmd')||{}).textContent`));
  check(`命令 = "${cmd}"`, cmd.startsWith('read ') && cmd.endsWith('/bolloon-gateway-join.md'), cmd);

  // ⑤ 文档正文
  console.log('\n[5] /bolloon-gateway-join.md 线上正文');
  const doc = await (await fetch(`${BASE}/bolloon-gateway-join.md`)).text();
  check('HTTP 正文含手机端路径 A′', doc.includes('路径 A′'));
  check('HTTP 正文含 version: 1.3.0', doc.includes('version: 1.3.0'));
  check('含 name: bolloon-gateway-join', doc.includes('name: bolloon-gateway-join'));
  check('含 join_global_gateway', doc.includes('join_global_gateway'));
  check('含 publicKey (TOFU 契约)', doc.includes('publicKey'));
  check('含 §7 首次接触 TOFU', doc.includes('首次接触 TOFU'));
  check('含 §11 M1 任务闭环', doc.includes('## 11. 用买到的能力完成任务') && doc.includes('bolloon task'));

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
  on('Fetch.requestPaused', (p) => {
    // 文档请求也命中 pattern (URL 里带着 ?pulse=<夹具地址>), 必须放行, 否则 Page.navigate 不返回
    if (p.resourceType === 'Document' || !shouldIntercept(p)) {
      cdp('Fetch.continueRequest', { requestId: p.requestId }).catch(() => {});
      return;
    }
    // 第二实例的来源: 按 bMode 直接失败或回过期夹具 (不走手工队列)
    if (p.request.url.includes('network-pulse-verify-b')) {
      if (bMode === 'fail') cdp('Fetch.failRequest', { requestId: p.requestId, errorReason: 'ConnectionRefused' }).catch(() => {});
      else fulfillJson(p.requestId, FX_EXPIRED);
      return;
    }
    // 「让第一个实例失败」开关
    if (aFail && p.request.url.includes('network-pulse-verify.json')) {
      cdp('Fetch.failRequest', { requestId: p.requestId, errorReason: 'ConnectionRefused' }).catch(() => {});
      return;
    }
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

  const T0 = Date.now();
  // 活动文本故意带 <b>: 用它证明渲染走 textContent 而不是 innerHTML
  const MARKUP_TEXT = { zh: '节点 <b>42</b> 发布 manifest & 计数', en: 'Node <b>42</b> published a manifest & counters' };
  const FX_LIVE = {
    status: 'live', generated_at: T0 - 3 * 60000, fresh_until: T0 + 60000,
    scope: 'observed', scope_label: { zh: '当前节点观察到', en: 'Observed by this node' },
    totals: { nodes: 7, agents: 12, active_agents: 4, seen_last_24h: 5 },
    capabilities: [{ key: 'code-review', count: 6 }, { key: 'translation', count: 3 }, { key: 'other', count: 2 }],
    recent_activity: [
      { kind: 'manifest_published', at: T0 - 3 * 60000, text: MARKUP_TEXT },
      { kind: 'node_joined', at: T0 - 2 * 3600000, text: { zh: '一个新节点加入', en: 'A node joined' } },
    ],
    notes: ['计数按隐私阈值合并', '观察窗口内的聚合值'],
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

  // ⑥ 全球网络脉冲
  console.log('\n[6] gateway.html 全球网络脉冲 (公开只读接口)');
  const pulseSrc = `${BASE}/network-pulse-verify.json`;
  const errStart = consoleErrors.length;
  shouldIntercept = (p) => p.request.url.includes('network-pulse-verify');   // 只拦取数请求 (文档已放行)
  await cdp('Fetch.enable', { patterns: [{ urlPattern: PULSE_PATTERN, requestStage: 'Request' }] });
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
      hasValueNodes: ['nodes','agents','active','24h'].every(k => !!s.querySelector('[data-pulse-total="' + k + '"]')),
      order: Array.from(document.querySelectorAll('section[id]')).map(x => x.id),
      pulseBeforeJoin: before(s, document.getElementById('skills')) && before(s, document.getElementById('join')),
      idsInside: s.querySelectorAll('[id]').length,
    };
  })()`);
  check('gateway.html 存在 #pulse 网络脉冲区域', !!region, '未找到 #pulse');
  check('脉冲区有 aria-live=polite + role=status', !!region && region.ariaLive && region.role === 'status', JSON.stringify(region && { a: region.ariaLive, r: region.role }));
  check('四种状态文案都在 DOM (loading/live/stale/unavailable)',
    !!region && ['loading', 'live', 'stale', 'unavailable'].every((s) => region.states.includes(s)),
    JSON.stringify(region && region.states));
  check('「不是全网精确总量」可见 (zh)', !!region && region.caveat.includes('不是全网精确总量'), region && region.caveat);
  check('四个大数值节点齐备 (nodes/agents/active/24h)', !!region && region.hasValueNodes);
  check('页面顺序: 序厅 → 脉冲 → 加入方式 → manifest → 端点 → 开发者',
    !!region && JSON.stringify(region.order) === JSON.stringify(['intro', 'pulse', 'skills', 'join', 'manifest', 'endpoints', 'developer']),
    JSON.stringify(region && region.order));
  check('新顺序: 脉冲区在「加入方式 / 如何加入」之前 (人类先看到网络脉冲)',
    !!region && region.pulseBeforeJoin === true, JSON.stringify(region && region.pulseBeforeJoin));
  check('脉冲区内部不再依赖 id (只用 data-pulse-* 钩子, 避免多实例撞 id)',
    !!region && region.idsInside === 0, region && String(region.idsInside));

  const loading = await evalJs(pulseProbe('#pulse'));
  check('首次 loading 状态 + 数值占位「—」',
    loading.state === 'loading' && loading.visible.includes('正在读取快照') && loading.nodes === '—' && loading.api,
    JSON.stringify({ s: loading.state, v: loading.visible, n: loading.nodes, api: loading.api }));
  check('?pulse= 参数被当作接口地址', (await evalJs('window.__bolloonPulse.source()')) === 'endpoint');
  check('请求真的发出 (CDP 拦到 #pulse 的取数)', !!req1, req1 ? '' : '未拦到请求 — 可能没发起');
  // 网关页那份的大数值字号 = 后面判断「首页那份更轻」的基准
  const gwValueFont = parseFloat(String(await evalJs(`getComputedStyle(document.querySelector('#pulse .pulse-stat-value')).fontSize`)));

  if (req1) await fulfillJson(req1.requestId, FX_LIVE);
  await sleep(700);
  const live = await evalJs(pulseProbe('#pulse'));
  check('live: 状态标签 = 实时', live.state === 'live' && live.visible.includes('实时'), JSON.stringify({ s: live.state, v: live.visible }));
  check('live: 四个大数值 = 接口总数 (7/12/4/5)',
    live.nodes === '7' && live.agents === '12' && live.active === '4' && live.h24 === '5',
    JSON.stringify({ n: live.nodes, a: live.agents, ac: live.active, d: live.h24 }));
  check('live: scope=observed → 「当前节点观察到」', live.scope === '当前节点观察到' && !live.scopeHidden, live.scope);
  check('live: 快照时间 + 相对时间 (3 分钟前)',
    /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(live.snap) && /\d+ 分钟前/.test(live.feed[0] || ''),
    JSON.stringify({ snap: live.snap, feed0: live.feed[0] }));
  check('live: 活动流 2 条 + capability 分布 3 项 (含 other)',
    live.feed.length === 2 && live.caps.length === 3 && live.caps[0].includes('code-review') && live.caps.some((c) => c.includes('其它')),
    JSON.stringify({ feed: live.feed.length, caps: live.caps }));
  check('live: 服务端 notes 文字可见', live.notes.includes('隐私阈值'), live.notes);
  check('live: 活动文本 = 服务端原文 (zh)', live.feedText[0] === MARKUP_TEXT.zh, JSON.stringify(live.feedText));
  const textNodes = await evalJs(`(() => {
    const s = document.querySelector('#pulse [data-pulse-feed] .pulse-feed-text');
    return { kids: s.childNodes.length, type: s.childNodes[0] && s.childNodes[0].nodeType, text: s.textContent, html: s.innerHTML, tag: s.children.length };
  })()`);
  check('活动文本只用 textContent (夹具里的 <b> 未被解析)',
    textNodes.kids === 1 && textNodes.type === 3 && textNodes.tag === 0 &&
    textNodes.text === MARKUP_TEXT.zh && textNodes.html.includes('&lt;b&gt;'),
    JSON.stringify(textNodes));
  const appSrc = await (await fetch(`${BASE}/app.js`)).text();
  check('app.js 不写 innerHTML / outerHTML / insertAdjacentHTML',
    !/\.innerHTML\s*(\+?=|\.)/.test(appSrc) && !/\.outerHTML\s*(\+?=)/.test(appSrc) && !appSrc.includes('insertAdjacentHTML') && !appSrc.includes('document.write'),
    '源码里出现 innerHTML 赋值');

  // 中英切换
  await evalJs(`document.querySelector('.lang-toggle [data-lang="en"]').click()`);
  await sleep(300);
  const en = await evalJs(pulseProbe('#pulse'));
  const enTitle = await evalJs(`document.querySelector('#pulse .section-title').textContent.trim()`);
  const enCaveat = await evalJs(`document.querySelector('#pulse .pulse-caveat').textContent.trim()`);
  const enKickers = await evalJs(`Array.from(document.querySelectorAll('#pulse .pulse-sub')).map(e=>e.textContent.trim())`);
  check('EN: 脉冲区标题 = Network pulse', enTitle === 'Network pulse', enTitle);
  check('EN: 状态/scope/活动文案都变英文',
    en.visible.includes('Live') && en.scope === 'Observed by this node' && en.feedText[0] === MARKUP_TEXT.en,
    JSON.stringify({ v: en.visible, s: en.scope, f: en.feedText }));
  check('EN: 相对时间英文 (minutes ago)', /minutes ago/.test(en.feed[0] + en.ago), en.feed[0] + ' ' + en.ago);
  check('EN: 「not an exact global total」可见', enCaveat.includes('not an exact global total'), enCaveat);
  check('EN: 能力/活动小标题英文', JSON.stringify(enKickers) === JSON.stringify(['Capabilities', 'Recent activity']), JSON.stringify(enKickers));
  await evalJs(`document.querySelector('.lang-toggle [data-lang="zh"]').click()`);
  await sleep(250);

  // 相对时间只改文字节点, 不重建列表
  const tickBefore = await evalJs(`(() => { const t = document.querySelector('#pulse [data-pulse-feed] time'); window.__feedTime0 = t; const li = document.querySelector('#pulse [data-pulse-feed] li'); window.__feedLi0 = li; t.setAttribute('data-at', String(Date.now() - 7200000)); window.__bolloonPulse.tick(); return { same: document.querySelector('#pulse [data-pulse-feed] time') === window.__feedTime0, liSame: document.querySelector('#pulse [data-pulse-feed] li') === window.__feedLi0, text: t.textContent, count: document.querySelectorAll('#pulse [data-pulse-feed] li').length }; })()`);
  check('相对时间刷新只改文字节点 (同类节点复用, 不重建列表)',
    tickBefore.same && tickBefore.liSame && /2 小时前/.test(tickBefore.text) && tickBefore.count === 2,
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

  // 手机宽度: 统计纵向堆叠
  await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await sleep(350);
  const mob = await evalJs(`(() => ({ w: window.innerWidth, dir: getComputedStyle(document.querySelector('#pulse .pulse-stats')).flexDirection, cols: getComputedStyle(document.querySelector('#pulse .pulse-grid')).gridTemplateColumns }))()`);
  check('390px: 统计改纵向堆叠', mob.w <= 640 && mob.dir === 'column', JSON.stringify(mob));
  check('390px: 能力/活动两栏各自堆叠', mob.cols.split(' ').length === 1, mob.cols);
  await cdp('Emulation.clearDeviceMetricsOverride');
  await sleep(200);

  // 过期快照 (fresh_until 已过)
  const p2 = nextPaused(7000);
  await evalJs(`(() => { window.__bolloonPulse.refresh(); return 1; })()`);
  const req2 = await p2;
  await fulfillJson(req2.requestId, FX_EXPIRED);
  await sleep(700);
  const stale = await evalJs(pulseProbe('#pulse'));
  check('stale: fresh_until 已过 → 快照已过期', stale.state === 'stale' && stale.visible.includes('快照已过期'), JSON.stringify({ s: stale.state, v: stale.visible }));
  check('stale: scope=verified → 「网络观察快照」', stale.scope === '网络观察快照' && !stale.scopeHidden, stale.scope);
  check('stale: 仍显示快照数字 (9) 且活动为空占位', stale.nodes === '9' && stale.feed.length === 0, JSON.stringify({ n: stale.nodes, f: stale.feed.length }));

  // status=stale 单独一条路径
  const p3 = nextPaused(7000);
  await evalJs(`(() => { window.__bolloonPulse.refresh(); return 1; })()`);
  const req3 = await p3;
  await fulfillJson(req3.requestId, FX_STALE_FLAG);
  await sleep(600);
  const stale2 = await evalJs(pulseProbe('#pulse'));
  check('stale: status="stale" 也被如实标为过期', stale2.state === 'stale' && stale2.visible.includes('快照已过期'), JSON.stringify({ s: stale2.state, v: stale2.visible }));

  // 接口失败 → unavailable, 且不阻断其它区域
  const p4 = nextPaused(7000);
  await evalJs(`(() => { window.__bolloonPulse.refresh(); return 1; })()`);
  const req4 = await p4;
  await cdp('Fetch.failRequest', { requestId: req4.requestId, errorReason: 'ConnectionRefused' });
  await sleep(800);
  const un = await evalJs(pulseProbe('#pulse'));
  check('unavailable: 请求失败 → 公开观察入口尚未接入',
    un.state === 'unavailable' && un.visible.includes('公开观察入口尚未接入') && un.hintShown,
    JSON.stringify({ s: un.state, v: un.visible, h: un.hintShown }));
  check('unavailable: 提示含 ?pulse= 与本机节点示例',
    un.hint.includes('?pulse=') && un.hint.includes('127.0.0.1:54188'), un.hint.slice(0, 120));
  check('unavailable: 数值清空 → 不编造数字', un.nodes === '—' && un.agents === '—' && un.feed.length === 0, JSON.stringify({ n: un.nodes, f: un.feed.length }));
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

  // 轮询与超时常量
  const cfg = await evalJs(`(() => { const p = window.__bolloonPulse; return p ? { poll: p.config.pollMs, timeout: p.config.timeoutMs, backoff: p.config.backoffMs, rel: p.config.relTickMs, feedMax: p.config.feedMax, refresh: typeof p.refresh, tick: typeof p.tick, src: p.source() } : null; })()`);
  check('30 秒轮询 + 5 秒超时 + 退避 30/60/120 上限 120',
    !!cfg && cfg.poll === 30000 && cfg.timeout === 5000 && JSON.stringify(cfg.backoff) === JSON.stringify([30000, 60000, 120000]),
    JSON.stringify(cfg));
  check('轮询/刷新函数存在 (refresh + tick)', !!cfg && cfg.refresh === 'function' && cfg.tick === 'function');
  // 无 ?pulse= → 回退同源 network-pulse.json (站点上通常不存在 → 如实 unavailable, 不阻断其它区域)
  shouldIntercept = (p) => p.request.url.endsWith('/network-pulse.json');
  await cdp('Fetch.enable', { patterns: [{ urlPattern: '*network-pulse.json*', requestStage: 'Request' }] });
  const p5 = nextPaused(9000);
  await cdp('Page.navigate', { url: `${BASE}/gateway.html` });
  let req5 = null;
  try { req5 = await p5; } catch { /* 下面按结果判断 */ }
  check('无 ?pulse= 时回退到同源 network-pulse.json', !!req5 && /\/network-pulse\.json$/.test(req5.request.url), req5 ? req5.request.url : '未拦到请求');
  if (req5) {
    await cdp('Fetch.fulfillRequest', {
      requestId: req5.requestId, responseCode: 404,
      responseHeaders: [{ name: 'Content-Type', value: 'text/plain' }],
      body: Buffer.from('not found', 'utf8').toString('base64'),
    });
  }
  await sleep(700);
  const fb = await evalJs(pulseProbe('#pulse'));
  const fbCmd = await evalJs(`(document.getElementById('skill-cmd')||{}).textContent||''`);
  check('回退拿到 404 → unavailable, 页面其它区域仍正常',
    fb.state === 'unavailable' && fb.visible.includes('公开观察入口尚未接入') && /^read /.test(fbCmd),
    JSON.stringify({ state: fb.state, cmd: fbCmd.slice(0, 40) }));
  await cdp('Fetch.disable');

  // ⑦ 首页序栏紧凑版脉冲 (同一数据源, 同一诚实四态)
  console.log('\n[7] index.html 序栏紧凑版脉冲 (同一接口 + 同一四态)');
  const idxErrStart = consoleErrors.length;
  const IDX_ROOT = '#intro .pulse-compact';
  shouldIntercept = (p) => p.request.url.includes('network-pulse-verify');
  await cdp('Fetch.enable', { patterns: [{ urlPattern: PULSE_PATTERN, requestStage: 'Request' }] });
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
  check('首页紧凑脉冲: 首次 loading + 数值占位「—」',
    !!idxLoading && idxLoading.state === 'loading' && idxLoading.nodes === '—', JSON.stringify(idxLoading && { s: idxLoading.state, n: idxLoading.nodes }));
  const idxInst = await evalJs(`(() => ({ n: window.__bolloonPulses.length, src: window.__bolloonPulses[0].source(), name: window.__bolloonPulses[0].key, feedMax: window.__bolloonPulses[0].config.feedMax }))()`);
  check('首页那份也是独立实例: ?pulse= 生效 + 活动上限 data-pulse-feed-max=1',
    idxInst.n === 1 && idxInst.src === 'endpoint' && idxInst.name === 'hero' && idxInst.feedMax === 1, JSON.stringify(idxInst));
  check('首页紧凑脉冲真的发起取数 (CDP 拦到请求)', !!idxReq, idxReq ? '' : '未拦到请求');

  if (idxReq) await fulfillJson(idxReq.requestId, FX_LIVE);
  await sleep(700);
  const idxLive = await evalJs(pulseProbe(IDX_ROOT));
  check('首页 live: 状态=实时 + 四个数值 = 7/12/4/5',
    idxLive.state === 'live' && idxLive.visible.includes('实时') && idxLive.nodes === '7' && idxLive.agents === '12' && idxLive.active === '4' && idxLive.h24 === '5',
    JSON.stringify({ s: idxLive.state, n: idxLive.nodes, a: idxLive.agents, ac: idxLive.active, d: idxLive.h24 }));
  check('首页 live: scope=observed + 活动流按 feed-max 截断 (只 1 条, 不是 5 条)',
    idxLive.scope === '当前节点观察到' && !idxLive.scopeHidden && idxLive.feed.length === 1 && idxLive.feedText[0] === MARKUP_TEXT.zh,
    JSON.stringify({ s: idxLive.scope, f: idxLive.feed, ft: idxLive.feedText }));
  check('首页 live: caveat 仍在 + 未接入提示隐藏',
    idxLive.caveat.includes('不是全网精确总量') && idxLive.hintShown === false,
    JSON.stringify({ c: idxLive.caveat, h: idxLive.hintShown }));
  check('首页 live: 有指向网关页完整脉冲的链接',
    (await evalJs(`!!document.querySelector('${IDX_ROOT} .pulse-c-more a[href$="gateway.html#pulse"]')`)) === true);
  const idxDensity = await evalJs(`(() => ({ font: parseFloat(getComputedStyle(document.querySelector('${IDX_ROOT} .pulse-c-totals b')).fontSize), h: Math.round(document.querySelector('${IDX_ROOT}').getBoundingClientRect().height), feedStyle: getComputedStyle(document.querySelector('${IDX_ROOT} [data-pulse-feed] li')).display }))()`);
  check(`首页那份确实更轻更密 (数值字号 ${idxDensity.font}px < 网关 ${gwValueFont}px, 整块高 ${idxDensity.h}px < 320px)`,
    idxDensity.font < gwValueFont && idxDensity.h < 320, JSON.stringify({ idxDensity, gwValueFont }));

  // 首页那份也吃中英切换
  await evalJs(`document.querySelector('.lang-toggle [data-lang="en"]').click()`);
  await sleep(300);
  const idxEn = await evalJs(pulseProbe(IDX_ROOT));
  const idxLabels = await evalJs(`Array.from(document.querySelectorAll('${IDX_ROOT} .pulse-c-totals span')).map(e => e.textContent.trim())`);
  check('首页 EN: 状态 Live + scope + 活动文案英文',
    idxEn.visible.includes('Live') && idxEn.scope === 'Observed by this node' && idxEn.feedText[0] === MARKUP_TEXT.en,
    JSON.stringify({ v: idxEn.visible, s: idxEn.scope, f: idxEn.feedText }));
  check('首页 EN: caveat 变「not an exact global total」', idxEn.caveat.includes('not an exact global total'), idxEn.caveat);
  check('首页 EN: 四个数值标签英文 (nodes/agents/active agents/seen in 24h)',
    JSON.stringify(idxLabels) === JSON.stringify(['nodes', 'agents', 'active agents', 'seen in 24h']), JSON.stringify(idxLabels));
  await evalJs(`document.querySelector('.lang-toggle [data-lang="zh"]').click()`);
  await sleep(250);

  // 首页那份: 过期快照 → stale
  const pIdx2 = nextPaused(7000);
  await evalJs(`(() => { window.__bolloonPulses[0].refresh(); return 1; })()`);
  const idxReq2 = await pIdx2;
  await fulfillJson(idxReq2.requestId, FX_EXPIRED);
  await sleep(700);
  const idxStale = await evalJs(pulseProbe(IDX_ROOT));
  check('首页 stale: fresh_until 已过 → 快照已过期 + scope=网络观察快照',
    idxStale.state === 'stale' && idxStale.visible.includes('快照已过期') && idxStale.scope === '网络观察快照',
    JSON.stringify({ s: idxStale.state, v: idxStale.visible, sc: idxStale.scope }));
  check('首页 stale: 仍显示快照数字 (9), 不伪装实时', idxStale.nodes === '9' && idxStale.feed.length === 0, JSON.stringify({ n: idxStale.nodes }));

  // 首页那份: 接口失败 → unavailable, 且不阻断首页其它区域
  const pIdx3 = nextPaused(7000);
  await evalJs(`(() => { window.__bolloonPulses[0].refresh(); return 1; })()`);
  const idxReq3 = await pIdx3;
  await cdp('Fetch.failRequest', { requestId: idxReq3.requestId, errorReason: 'ConnectionRefused' });
  await sleep(800);
  const idxUn = await evalJs(pulseProbe(IDX_ROOT));
  check('首页 unavailable: 请求失败 → 尚未接入 + 数值清空 + ?pulse= 提示',
    idxUn.state === 'unavailable' && idxUn.visible.includes('公开观察入口尚未接入') && idxUn.nodes === '—' &&
    idxUn.hintShown && idxUn.hint.includes('?pulse=') && idxUn.hint.includes('127.0.0.1:54188'),
    JSON.stringify({ s: idxUn.state, n: idxUn.nodes, h: idxUn.hintShown }));
  let idxBadge = '';
  for (let i = 0; i < 10; i++) {
    idxBadge = String(await evalJs(`(document.getElementById('version')||{}).textContent || ''`));
    if (/^\d+\.\d+\.\d+/.test(idxBadge)) break;
    await sleep(400);
  }
  const idxOthers = await evalJs(`(() => ({
    cta: document.querySelectorAll('#intro .intro-cta a').length,
    year: (document.getElementById('year')||{}).textContent || '',
    capNo: Array.from(document.querySelectorAll('#capabilities .cap-no')).map(e => e.textContent).join(','),
  }))()`);
  check('首页那份失败不阻断首页其它区域 (序厅 CTA / 能力区 / 徽章 / 页脚正常)',
    idxOthers.cta === 3 && idxOthers.capNo === '01,02,03' && (!liveVersion || idxBadge === liveVersion) && /^\d{4}$/.test(idxOthers.year),
    JSON.stringify({ ...idxOthers, badge: idxBadge }));
  check('首页那份无 console 错误 / 未捕获异常', consoleErrors.length === idxErrStart, consoleErrors.slice(0, 3).join(' | '));

  // ⑧ 多实例隔离: 同一页两个实例, 一个失败另一个仍活
  console.log('\n[8] 多实例隔离 (同一页两个 [data-pulse], 互不干扰)');
  const isoErrStart = consoleErrors.length;
  await cdp('Fetch.disable');
  bMode = 'fail';
  aFail = false;
  shouldIntercept = (p) => p.request.url.includes('network-pulse-verify');
  await cdp('Fetch.enable', { patterns: [{ urlPattern: PULSE_PATTERN, requestStage: 'Request' }] });
  const pIso = nextPaused(9000);
  await cdp('Page.navigate', { url: `${BASE}/gateway.html?pulse=${encodeURIComponent(pulseSrc)}` });
  let isoReq = null;
  try { isoReq = await pIso; } catch { /* 下面按 DOM 判断 */ }
  if (isoReq) await fulfillJson(isoReq.requestId, FX_LIVE);
  await sleep(700);
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
  await sleep(1000);

  const pairProbe = `(() => {
    const roots = Array.from(document.querySelectorAll('[data-pulse]'));
    const A = roots[0], B = roots[1];
    const pick = (root, key) => { const n = root.querySelector('[data-pulse-total="' + key + '"]'); return n ? n.textContent.trim() : null; };
    const vis = (root) => (Array.from(root.querySelectorAll('.pulse-state-text')).filter(e => getComputedStyle(e).display !== 'none')[0] || {}).textContent || '';
    if (!A || !B) return { missing: true, count: roots.length };
    return {
      count: roots.length,
      a: { state: A.getAttribute('data-pulse-state'), vis: vis(A), nodes: pick(A, 'nodes'), scope: (A.querySelector('[data-pulse-scope]')||{}).textContent },
      b: { state: B.getAttribute('data-pulse-state'), vis: vis(B), nodes: pick(B, 'nodes') },
    };
  })()`;

  const pair1 = await evalJs(pairProbe);
  check('第二实例取数被拒 → 自己 unavailable 且数值不编造',
    !pair1.missing && pair1.b.state === 'unavailable' && pair1.b.vis.includes('公开观察入口尚未接入') && pair1.b.nodes === '—',
    JSON.stringify(pair1));
  check('第一实例不受影响 (仍 live, 数值 7 未变)',
    !pair1.missing && pair1.a.state === 'live' && pair1.a.vis.includes('实时') && pair1.a.nodes === '7',
    JSON.stringify(pair1.a));

  // 反向: 第二实例给以过期快照 → stale 且仍有数字; 第一实例取数被拒 → unavailable
  bMode = 'expired';
  await evalJs(`(() => { window.__bolloonPulses[1].refresh(); return 1; })()`);
  await sleep(800);
  const pair2 = await evalJs(pairProbe);
  check('第二实例换到过期快照 → stale 且数字仍在 (9)',
    !pair2.missing && pair2.b.state === 'stale' && pair2.b.nodes === '9' && pair2.b.vis.includes('快照已过期'),
    JSON.stringify(pair2.b));

  aFail = true;
  await evalJs(`(() => { window.__bolloonPulses[0].refresh(); return 1; })()`);
  await sleep(900);
  const pair3 = await evalJs(`(() => {
    const roots = Array.from(document.querySelectorAll('[data-pulse]'));
    const A = roots[0], B = roots[1];
    const pick = (root, key) => { const n = root.querySelector('[data-pulse-total="' + key + '"]'); return n ? n.textContent.trim() : null; };
    const vis = (root) => (Array.from(root.querySelectorAll('.pulse-state-text')).filter(e => getComputedStyle(e).display !== 'none')[0] || {}).textContent || '';
    return {
      a: { state: A.getAttribute('data-pulse-state'), vis: vis(A), nodes: pick(A, 'nodes'), feed: A.querySelectorAll('[data-pulse-feed] li').length },
      b: { state: B.getAttribute('data-pulse-state'), vis: vis(B), nodes: pick(B, 'nodes'), scope: (B.querySelector('[data-pulse-scope]')||{}).textContent },
      page: { cmd: (document.getElementById('skill-cmd')||{}).textContent || '' },
      api: { first: window.__bolloonPulse === window.__bolloonPulses[0], n: window.__bolloonPulses.length },
    };
  })()`);
  check('第一实例也能独立失败 (A → unavailable, 数值清空, 不编造)',
    pair3.a.state === 'unavailable' && pair3.a.vis.includes('公开观察入口尚未接入') && pair3.a.nodes === '—' && pair3.a.feed === 0,
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
  await cdp('Fetch.disable');
  for (const pg of ALL_PAGES) {
    await cdp('Page.navigate', { url: `${BASE}/${pg}` });
    await sleep(900);
    const dups = await evalJs(`(() => { const m = {}; document.querySelectorAll('[id]').forEach((e) => { m[e.id] = (m[e.id] || 0) + 1; }); return Object.keys(m).filter((k) => m[k] > 1); })()`);
    check(`${pg} 无重复 id`, Array.isArray(dups) && dups.length === 0, JSON.stringify(dups));
  }
  // 脉冲区内部节点一律用 data-pulse-* 钩子 (不靠 id ⇒ 多实例不会撞 id)
  await cdp('Page.navigate', { url: `${BASE}/index.html` });
  await sleep(900);
  const hookCheck = await evalJs(`(() => ({ ids: Array.from(document.querySelectorAll('[data-pulse] [id]')).map(e => e.id), roots: document.querySelectorAll('[data-pulse]').length }))()`);
  check('首页脉冲区内部节点一律用 data-pulse-* 钩子 (无 id, 天然不撞)',
    !!hookCheck && hookCheck.roots >= 1 && hookCheck.ids.length === 0, JSON.stringify(hookCheck));

  // console 错误
  check('整轮访问无 console 错误 / 未捕获异常', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));

  console.log(`\n=== 结果: ${passed} passed, ${failed} failed ===`);
  ws.close();
  proc.kill();
  try { fs.rmSync(userDir, { recursive: true, force: true }); } catch { /* noop */ }
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error('验收脚本异常:', e); process.exit(1); });
