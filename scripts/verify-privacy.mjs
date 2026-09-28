/**
 * verify-privacy.mjs — 隐私政策页 + 全站页脚合规验收 (零依赖, 自包含 CDP, 真 Chrome)
 *
 * 上架要求: 应用市场表单要填一个「可公开访问的隐私政策链接」, 且工信部要求备案号在页脚可见。
 * 这个脚本证明: 页面真能打开、必填要素真的在页面上、页脚链接每页都有、中英切换真的工作、
 * 站内链接没有断的、页面没有 JS 报错。
 *
 * 用法: node scripts/verify-privacy.mjs                       # 默认 https://bolloon.cn
 *       node scripts/verify-privacy.mjs http://127.0.0.1:8898  # 本地 python3 -m http.server 8898
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const BASE = (process.argv[2] || 'https://bolloon.cn').replace(/\/$/, '');
const PAGES = ['index.html', 'install.html', 'hibs.html', 'gateway.html', 'docs.html'];

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

// 政策必填要素 (华为/工信部口径): 收集类型 · 用途 · 存储期限 · 第三方 SDK · 注销路径 · 权限 · 联系方式
const REQUIRED = [
  ['收集与不收集什么', '二、我们收集与不收集什么'],
  ['存储位置与期限', '保存期限'],
  ['权限与用途', '三、系统权限与用途'],
  ['第三方服务清单', '四、第三方服务清单'],
  ['未成年人', '五、未成年人'],
  ['注销路径', '清除本机数据（注销）'],
  ['处理时限', '7 个工作日'],
  ['联系方式', 'yuanjieliu65@gmail.com'],
  ['生效日期', '生效日期 2026-09-16'],
  ['蓝牙/位置权限说明', 'maxSdkVersion=30'],
  ['让智能体操作手机 (仅直装版 / 默认关闭) 披露', '仅官网直装版本包含'],
  ['无统计 SDK 声明', '不集成任何广告、行为统计或崩溃上报 SDK'],
  ['数据出境', '取决于你的选择'],
  ['备案号公示 (工信部号段)', '浙ICP备2026081254号-1'],  // 2026-09-28 下号: 占位已展开为可见备案号
];

async function main() {
  const chrome = resolveChrome();
  if (!chrome) { console.error('找不到 Chrome'); process.exit(1); }
  const port = 9500 + Math.floor(Math.random() * 200);
  const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bolloon-privacy-verify-'));
  const proc = spawn(chrome, [
    '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${userDir}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu', 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'ignore'] });

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
  const consoleErrors = [];
  ws.onmessage = (ev) => {
    const msg = JSON.parse(typeof ev.data === 'string' ? ev.data : ev.data.toString());
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); return; }
    if (msg.method === 'Log.entryAdded' && msg.params?.entry?.level === 'error') {
      consoleErrors.push(msg.params.entry.text + ' @ ' + (msg.params.entry.url || ''));
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      consoleErrors.push('exception: ' + (msg.params?.exceptionDetails?.text || ''));
    }
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
  await cdp('Log.enable');

  const evalJs = async (code) => {
    const r = await cdp('Runtime.evaluate', { expression: code, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception?.description || ''));
    return r.result.value;
  };

  console.log(`=== bolloon 隐私政策 + 页脚合规验收 (${BASE}) ===\n`);

  // [1] 隐私政策页存在且含全部必填要素
  console.log('[1] privacy.html 必填要素');
  const html = await (await fetch(`${BASE}/privacy.html`)).text();
  check('HTTP 200 且非空', html.length > 5000, `${html.length} B`);
  for (const [label, needle] of REQUIRED) {
    check(`含「${label}」`, html.includes(needle), needle);
  }
  check('含 3 张表格 (数据/权限/第三方)', (html.match(/<table class="doc-table">/g) || []).length >= 3,
    `${(html.match(/<table class="doc-table">/g) || []).length} 张`);
  check('中英双语 (data-en 与 data-zh 数量一致)',
    (html.match(/data-zh=/g) || []).length === (html.match(/data-en=/g) || []).length,
    `zh=${(html.match(/data-zh=/g) || []).length} en=${(html.match(/data-en=/g) || []).length}`);

  // [2] 真浏览器加载: 无 JS 报错 + 中英切换真的工作
  console.log('\n[2] 真 Chrome 加载 privacy.html');
  await cdp('Page.navigate', { url: `${BASE}/privacy.html` });
  await sleep(1500);
  const title = await evalJs(`document.title`);
  check(`标题 = ${title}`, /隐私政策/.test(title), title);
  const zhText = await evalJs(`(document.querySelector('.doc-h2 span')||{}).textContent || ''`);
  // 语言切换: 让**页内自己等** —— 反复点 EN 直到 html lang 变 en **且** h2 正文真换了.
  // 旧写法「门外点一次 → 等 400ms → 读」会假红(点下去时 app.js 可能还没把监听绑上, 真 Chrome 里
  // 4s 后再点就正常), 而那条「正文变英文」的判据还是个坏 XOR —— 没切也照样绿. 现在两端都钉死.
  const probe = await evalJs(`(function(){
    var t0 = Date.now(), zh = (document.querySelector('.doc-h2 span')||{}).textContent || '', clicked = false;
    return new Promise(function(resolve){
      var iv = setInterval(function(){
        var b = document.querySelectorAll('.lang-toggle [data-lang]');
        for (var i=0;i<b.length;i++) if (b[i].getAttribute('data-lang')==='en') { b[i].click(); clicked = true; break; }
        var lang = document.documentElement.lang;
        var h2 = (document.querySelector('.doc-h2 span')||{}).textContent || '';
        if (lang === 'en' && h2 && h2 !== zh) { clearInterval(iv); resolve({ok:true, clicked:clicked, lang:lang, h2:h2, zh:zh, ms:Date.now()-t0}); return; }
        if (Date.now() - t0 > 4000) { clearInterval(iv); resolve({ok:false, clicked:clicked, lang:lang, h2:h2, zh:zh, ms:Date.now()-t0}); }
      }, 250);
    });
  })()`);
  check('切到 EN 后正文真的变英文 (与中文原文不同 + 数字编号)',
    !!probe && probe.ok === true && probe.h2 !== probe.zh && /^\d/.test(probe.h2.trim()),
    JSON.stringify(probe));
  check('html lang 已切换', !!probe && probe.lang === 'en', probe ? `${probe.lang} (页内等 ${probe.ms}ms)` : 'null');
  check('隐私政策页无 JS 报错', consoleErrors.length === 0, consoleErrors.join(' | '));

  // [3] 每页页脚都有隐私政策链接 + 可见备案号(号已下, 占位注释必须已展开)
  console.log('\n[3] 5 页页脚 (隐私政策链接 + 可见备案号)');
  for (const p of PAGES) {
    const raw = await (await fetch(`${BASE}/${p}`)).text();
    const linkOk = /<footer class="foot">[\s\S]*?href="privacy\.html"/.test(raw);
    // 2026-09-28 下号后新契约: 页脚必须**可见**公示备案号(链工信部 + 号段形状), 且占位注释不得残留
    const beianVisible = /href="https:\/\/beian\.miit\.gov\.cn\/"[^>]*>浙ICP备\d+号-\d+</.test(raw);
    const placeholderLeft = raw.includes('备案完成后在页脚公示');
    check(`${p} 页脚含 privacy.html 链接`, linkOk);
    check(`${p} 页脚公示可见备案号 (链工信部 + 号段形状)`, beianVisible,
      beianVisible ? '浙ICP备…号-N' : '未找到可见备案号锚点');
    check(`${p} 不再保留备案号占位注释`, !placeholderLeft,
      placeholderLeft ? '注释仍在(号已下, 占位必须展开)' : '已展开');
  }

  // [4] 站内链接全可达 (断链检查)
  console.log('\n[4] 站内 *.html 链接可达');
  const targets = new Set();
  for (const p of [...PAGES, 'privacy.html', 'skill.html']) {
    const raw = await (await fetch(`${BASE}/${p}`)).text();
    for (const m of raw.matchAll(/href="([^"#:]+\.html)(?:#[^"]*)?"/g)) targets.add(m[1]);
  }
  for (const t of [...targets].sort()) {
    const r = await fetch(`${BASE}/${t}`);
    check(`链接可达 ${t}`, r.ok, `HTTP ${r.status}`);
  }

  console.log(`\n=== 结果: ${passed} passed, ${failed} failed ===`);
  ws.close();
  proc.kill();
  try { fs.rmSync(userDir, { recursive: true, force: true }); } catch { /* noop */ }
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error('验收脚本异常:', e); process.exit(1); });
