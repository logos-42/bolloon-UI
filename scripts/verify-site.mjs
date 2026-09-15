/**
 * verify-site.mjs — bolloon.cn 站点上线后真浏览器验收 (零依赖, 自包含 CDP)
 *
 * 为什么自包含: 站点仓不装 npm 包, 但它要能自己验自己 —— 只用 node 全局 WebSocket
 * 驱动本机 Chrome (headless=new), 不引任何依赖。
 *
 * 覆盖:
 *   ① 5 页版本徽章 = live npm 版本 (取自 registry, 不再硬编码)
 *   ② 徽章在 JS 失败时显示「—」而不是过期版本 (静态 HTML 内已是占位符)
 *   ③ skill.html 已同步文档 v1.2.1 (三条执行路径 / 路径 A′ 手机端 / §7 首次接触 TOFU / 排错新行)
 *   ④ gateway.html 的粘贴命令 = 本页实际源 + bolloon-gateway-join.md
 *   ⑤ /bolloon-gateway-join.md 线上正文 = v1.2.1 且含 join_global_gateway / publicKey
 *
 * 用法: node scripts/verify-site.mjs [基址]      # 默认 https://bolloon.cn
 *       node scripts/verify-site.mjs http://127.0.0.1:8898
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
  ws.onmessage = (ev) => {
    const msg = JSON.parse(typeof ev.data === 'string' ? ev.data : ev.data.toString());
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
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
  console.log('\n[3] skill.html 已同步文档 v1.2.1');
  const skillHtml = await (await fetch(`${BASE}/skill.html`)).text();
  check('版本 1.2.1', skillHtml.includes('>1.2.1<') || skillHtml.includes('1.2.1'));
  check('含「0.1 三条执行路径」', skillHtml.includes('0.1 三条执行路径'));
  check('含手机端路径 A′ (本机内核执行)', skillHtml.includes('路径 A′') && skillHtml.includes('bolloon_gateway_join'));
  check('含 join_global_gateway 工具路径', skillHtml.includes('join_global_gateway'));
  check('含 §7 首次接触 TOFU', skillHtml.includes('首次接触 TOFU'));
  check('排错含 publicKey 拒收行', skillHtml.includes('无 publicKey'));

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
  check('HTTP 正文含 version: 1.2.1', doc.includes('version: 1.2.1'));
  check('含 name: bolloon-gateway-join', doc.includes('name: bolloon-gateway-join'));
  check('含 join_global_gateway', doc.includes('join_global_gateway'));
  check('含 publicKey (TOFU 契约)', doc.includes('publicKey'));
  check('含 §7 首次接触 TOFU', doc.includes('首次接触 TOFU'));

  console.log(`\n=== 结果: ${passed} passed, ${failed} failed ===`);
  ws.close();
  proc.kill();
  try { fs.rmSync(userDir, { recursive: true, force: true }); } catch { /* noop */ }
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error('验收脚本异常:', e); process.exit(1); });
