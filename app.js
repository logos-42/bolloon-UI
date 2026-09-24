/* Bolloon 安装页 — app.js */
(function () {
  'use strict';
  document.documentElement.classList.add('js');

  // ——— 版本号：只信 live 数据（npm registry，自带 CORS），失败回退 GitHub release；
  //     两者都取不到就显示「—」——绝不硬编码版本号（旧版常量 0.4.20 会在断网/被封时
  //     谎报一个早已过期的版本，2026-09-15 去掉）———
  var versionEl = document.getElementById('version');
  if (versionEl) {
    var setVersion = function (v) {
      var s = String(v == null ? '' : v).trim().replace(/^v/, '');
      // 只接受形如 0.4.23 的版本号；tag 名（android-v0.4.22.3-signed 之类）一律不采用
      if (/^\d+\.\d+\.\d+/.test(s)) versionEl.textContent = s;
    };
    var githubFallback = function () {
      return fetch('https://api.github.com/repos/logos-42/bolloon/releases/latest', { headers: { Accept: 'application/vnd.github+json' } })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) { if (d && d.tag_name) setVersion(d.tag_name); })
        .catch(function () { /* 取不到就保持「—」 */ });
    };
    fetch('https://registry.npmjs.org/@bolloon/bolloon-agent/latest')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (data && data.version) setVersion(data.version);
        else return githubFallback();
      })
      .catch(githubFallback);
  }

  document.getElementById('year').textContent = new Date().getFullYear();

  // ——— 操作系统探测 & 标签切换 ———
  var CMD = {
    script: { unix: 'curl -fsSL https://raw.githubusercontent.com/logos-42/bolloon/master/scripts/install.sh | sh',
              windows: 'iwr -useb https://raw.githubusercontent.com/logos-42/bolloon/master/scripts/install.ps1 | iex' },
    scriptDesc: { unix: '从 GitHub 拉取安装并下载预编译包，失败自动回退 npm。',
                  windows: '以管理员身份运行 PowerShell，从 GitHub 拉取安装并下载预编译包。' },
    prompt: { unix: '$', windows: 'PS>' }
  };
  var osName = document.getElementById('os-name');
  var scriptCmd = document.getElementById('script-cmd');
  var scriptPrompt = document.getElementById('script-prompt');
  var scriptDesc = document.getElementById('script-desc');
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.os-tab'));

  function detectOS() {
    var ua = navigator.userAgent || '';
    var platform = navigator.platform || '';
    if (/Windows/i.test(ua) || /Win/i.test(platform)) return 'windows';
    return 'unix'; // macOS / Linux 走同一 one-liner
  }

  function currentOS() {
    var active = tabs.filter(function (t) { return t.getAttribute('aria-selected') === 'true'; })[0];
    return active ? active.getAttribute('data-os') : detectOS();
  }

  function applyOS(os) {
    if (scriptCmd) scriptCmd.textContent = CMD.script[os];
    if (scriptPrompt) scriptPrompt.textContent = CMD.prompt[os];
    if (scriptDesc) scriptDesc.textContent = CMD.scriptDesc[os];
    if (osName) osName.textContent = os === 'windows' ? 'Windows' : 'macOS / Linux';
  }

  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      tabs.forEach(function (t) { t.classList.remove('is-active'); t.setAttribute('aria-selected', 'false'); });
      tab.classList.add('is-active');
      tab.setAttribute('aria-selected', 'true');
      applyOS(tab.getAttribute('data-os'));
    });
  });

  // 首次按探测结果预选系统
  var detected = detectOS();
  var startTab = tabs.filter(function (t) { return t.getAttribute('data-os') === detected; })[0];
  if (startTab) {
    tabs.forEach(function (t) { t.classList.remove('is-active'); t.setAttribute('aria-selected', 'false'); });
    startTab.classList.add('is-active');
    startTab.setAttribute('aria-selected', 'true');
  }
  applyOS(detected);

  // ——— 复制按钮 ———
  var CMD_TEXT = {
    'script-cmd': CMD.script[detected],
    'npm-cmd': 'npm install -g @bolloon/bolloon-agent',
    'start1': 'bolloon',
    'start2': 'bolloon --web',
    'start3': 'bolloon --help',
    'start4': 'bolloon --cli',
    'setup': 'bolloon setup',
    'model': 'bolloon model',
    'x402': 'bolloon x402 list',
    'build': 'git clone https://github.com/logos-42/bolloon.git && cd bolloon && npm install && npm run build:all && npm start'
  };

  Array.prototype.forEach.call(document.querySelectorAll('.copy'), function (btn) {
    btn.addEventListener('click', function () {
      var key = btn.getAttribute('data-copy');
      var el = document.getElementById(key);
      var text = key === 'script-cmd' ? CMD.script[currentOS()] : (CMD_TEXT[key] || (el ? el.textContent : ''));
      if (!text) return;
      var done = function () {
        btn.textContent = '已复制';
        btn.classList.add('is-copied');
        setTimeout(function () { btn.textContent = '复制'; btn.classList.remove('is-copied'); }, 1600);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(function () { fallback(text); done(); });
      } else {
        fallback(text); done();
      }
    });
  });

  function fallback(text) {
    var ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
  }

  // ——— 滚动揭示 ———
  var revealEls = Array.prototype.slice.call(document.querySelectorAll(
    '.section-head, .cmd-plate, .os-switch, .prereq, .cap-list li, .about-grid, .intro-inner, .intro-art, .doc, .doc-table'
  ));
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12 });
    revealEls.forEach(function (el) { el.classList.add('reveal'); io.observe(el); });
  }

  // ——— 语言切换（中 / EN）———
  var LANG_KEY = 'bolloon-lang';
  var langButtons = Array.prototype.slice.call(document.querySelectorAll('.lang-toggle [data-lang]'));
  function applyLang(lang) {
    Array.prototype.forEach.call(document.querySelectorAll('[data-zh][data-en]'), function (el) {
      var attr = lang === 'en' ? 'data-en' : 'data-zh';
      var val = el.getAttribute(attr);
      if (val) el.textContent = val;
    });
    document.documentElement.lang = lang === 'en' ? 'en' : 'zh-CN';
    langButtons.forEach(function (b) { b.classList.toggle('is-active', b.getAttribute('data-lang') === lang); });
    try { localStorage.setItem(LANG_KEY, lang); } catch (e) {}
    // 动态区域（链上活动）在此之后重画自己的文字节点, 否则会被上面的 textContent 覆盖
    try { document.dispatchEvent(new CustomEvent('bolloon:lang', { detail: { lang: lang } })); } catch (e) {}
  }
  langButtons.forEach(function (b) {
    b.addEventListener('click', function () { applyLang(b.getAttribute('data-lang')); });
  });
  if (langButtons.length) {
    var storedLang = null;
    try { storedLang = localStorage.getItem(LANG_KEY); } catch (e) {}
    applyLang(storedLang === 'en' ? 'en' : 'zh');
  }

  // ——— 安装框：栏目切换 ———
  var installTabs = Array.prototype.slice.call(document.querySelectorAll('.install-tab'));
  var installPanes = Array.prototype.slice.call(document.querySelectorAll('.install-pane'));
  function activatePane(pane) {
    installTabs.forEach(function (t) {
      var on = t.getAttribute('data-pane') === pane;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    installPanes.forEach(function (p) { p.classList.toggle('is-active', p.getAttribute('data-pane') === pane); });
  }
  installTabs.forEach(function (tab) {
    tab.addEventListener('click', function () { activatePane(tab.getAttribute('data-pane')); });
  });
  // 安卓子栏：跳到对应安装栏目（并滚动到安装区）
  Array.prototype.forEach.call(document.querySelectorAll('[data-goto-pane]'), function (a) {
    a.addEventListener('click', function (e) {
      var pane = a.getAttribute('data-goto-pane');
      if (!pane) return;
      e.preventDefault();
      activatePane(pane);
      var sec = document.getElementById('install');
      if (sec && sec.scrollIntoView) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  // ——— 网关：引导 skills 命令（read <url>，复制给 agent）———
  var cmdEl = document.getElementById('skill-cmd');
  var copyBtn = document.getElementById('copy-gen');
  if (cmdEl) {
    var base = location.origin + location.pathname.replace(/[^\/]*$/, '');
    cmdEl.textContent = 'read ' + base + 'bolloon-gateway-join.md';
  }
  if (copyBtn && cmdEl) {
    copyBtn.addEventListener('click', function () {
      var text = cmdEl.textContent;
      var done = function () { copyBtn.textContent = '已复制'; setTimeout(function(){ copyBtn.textContent = copyBtn.getAttribute('data-zh') || '复制命令'; }, 1500); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done);
      else { var ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch(e){} document.body.removeChild(ta); done(); }
    });
  }
})();

/* ============================================================
   IPNS 智能体私有站 —— 地址归一化 (2026-09-21)
   静态站没有后端: 本模块**不发任何网络请求**, 只做字符串归一化, 跳转交给浏览器。
   合法输入 (只认这几种; 其余一律拒, 绝不猜、不兜底):
     ① ipns://<cid>            ② /ipns/<cid>
     ③ 裸 <cid>               k51… (CIDv1-base36) / 12D3KooW… (ed25519 peer id)
                               / Qm… (CIDv0) / b… (CIDv1-base32)
     ④ https://<host>/ipns/<cid>   本模块自己生成的链接形态 —— 粘回来必须能打开;
                                   只取 path 里的 /ipns/<cid>, 不跟随、不请求、不换 host
   拒: 空 / 超长 / 其它 scheme (javascript: file: data:) / CID 形状不对 / 带路径或查询
   ============================================================ */
var BOLLOON_IPNS = (function () {
  'use strict';
  var GATEWAY = 'https://ipfs.io/ipns/';
  var MAX_LEN = 256;   // 异常输入直接拒, 不做任何截断或猜测
  var CID_RE = /^(?:k51[0-9a-z]{20,}|12D3KooW[1-9A-HJ-NP-Za-km-z]{19,}|Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{20,})$/;
  var PATH_RE = /^\/ipns\/([^\/?#\s]+)\/*$/;

  // → 归一化后的裸 cid, 或 null (非法)
  function parse(raw) {
    if (raw == null) return null;
    var s = String(raw).trim();
    if (!s || s.length > MAX_LEN) return null;
    if (s.toLowerCase().indexOf('ipns://') === 0) {
      s = s.slice(7);
    } else if (s.charAt(0) === '/') {
      var m = PATH_RE.exec(s);
      if (!m) return null;
      s = m[1];
    } else if (/^https?:\/\//i.test(s)) {
      var path = '';
      try { path = new URL(s).pathname; } catch (e) { return null; }   // 只解析字符串, 不发请求
      var m2 = PATH_RE.exec(path);
      if (!m2) return null;
      s = m2[1];
    }
    while (s.length && s.charAt(s.length - 1) === '/') s = s.slice(0, -1);
    if (!s || /[\/?#\s]/.test(s)) return null;
    return CID_RE.test(s) ? s : null;
  }

  function url(cid) { return GATEWAY + cid; }

  return {
    gateway: GATEWAY,
    parse: parse,                                                          // → cid | null
    url: url,                                                              // cid → 网关 URL
    urlFrom: function (raw) { var c = parse(raw); return c ? url(c) : null; }  // raw → 网关 URL | null
  };
})();

/* ============================================================
   IPNS 粘贴打开器 —— 用户粘一个 IPNS 链接/裸值 → 打开新窗口 (2026-09-21)
   多实例安全: 按 [data-pulse-ipns-form] 根遍历, 区内一律 data-pulse-ipns-* 钩子 (无 id)。
   点击 / 回车都能用: <form> + type=submit 按钮 ⇒ 输入框里回车走原生隐式提交。
   安全: 新建 <a> 一律 rel="noopener noreferrer" target="_blank"; 链接文本与提示
         一律 textContent —— 输入内容**绝不**拼进 innerHTML / href 之外的任何地方。
   ============================================================ */
(function () {
  'use strict';
  var forms = document.querySelectorAll('[data-pulse-ipns-form]');
  if (!forms || !forms.length) return;

  var STR = {
    zh: {
      ph: 'ipns://k51… · /ipns/12D3KooW… · 裸 k51… / 12D3…',
      input: '粘贴 IPNS 地址或名称: 只接受 ipns://<cid> 、 /ipns/<cid> 或裸 CID',
      btn: '在新窗口打开这个 IPNS 站点',
      err: '不是合法的 IPNS 地址 —— 只接受 ipns://<cid> 、 /ipns/<cid> 或裸 k51… / 12D3…；本页不替你猜。',
      ok: '已新窗口打开: '
    },
    en: {
      ph: 'ipns://k51… · /ipns/12D3KooW… · bare k51… / 12D3…',
      input: 'Paste an IPNS address or name: ipns://<cid>, /ipns/<cid> or a bare CID only',
      btn: 'Open this IPNS site in a new window',
      err: 'Not a valid IPNS address — only ipns://<cid>, /ipns/<cid> or a bare k51… / 12D3… are accepted; this page will not guess.',
      ok: 'Opened in a new window: '
    }
  };
  function lang() { return document.documentElement.lang === 'en' ? 'en' : 'zh'; }
  function str(key) { return STR[lang()][key]; }

  var seen = { lastCid: '', lastOpened: '', lastLink: null, forms: 0 };

  function wire(form) {
    var input = form.querySelector('[data-pulse-ipns-input]');
    var msg = form.querySelector('[data-pulse-ipns-msg]');
    var btn = form.querySelector('[data-pulse-ipns-open]');
    if (!input || !btn) return false;

    function say(text, kind) {
      if (!msg) return;
      msg.textContent = text || '';                       // 只写 textContent
      msg.classList.toggle('is-error', kind === 'error');
      msg.classList.toggle('is-ok', kind === 'ok');
    }
    function syncLabels() {
      input.setAttribute('placeholder', str('ph'));
      input.setAttribute('aria-label', str('input'));
      btn.setAttribute('aria-label', str('btn'));
    }
    function open() {
      var cid = BOLLOON_IPNS.parse(input.value);
      if (!cid) {                                          // 非法: 就地报错, 不发任何请求
        input.setAttribute('aria-invalid', 'true');
        say(str('err'), 'error');
        seen.lastLink = null;
        return null;
      }
      input.removeAttribute('aria-invalid');
      var href = BOLLOON_IPNS.url(cid);
      var a = document.createElement('a');                  // 真跳转: 由浏览器开新窗口
      a.className = 'pulse-ipns-out';
      a.href = href;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = href;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      seen.lastCid = cid;
      seen.lastOpened = href;
      seen.lastLink = { href: href, rel: a.rel, target: a.target, text: a.textContent };
      say(str('ok') + href, 'ok');
      return href;
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();                                   // 静态站: 不提交表单, 只归一化 + 开新窗口
      open();
    });
    syncLabels();
    document.addEventListener('bolloon:lang', syncLabels);
    return true;
  }

  for (var i = 0; i < forms.length; i++) { if (wire(forms[i])) seen.forms++; }

  // 对外接口 (验收用): 纯函数 + 上一次真开过的链接快照
  window.__bolloonIpns = {
    version: 1,
    forms: seen.forms,
    gateway: BOLLOON_IPNS.gateway,
    lastCid: function () { return seen.lastCid; },
    lastOpened: function () { return seen.lastOpened; },
    lastLink: function () { return seen.lastLink; },
    parse: function (raw) { return BOLLOON_IPNS.parse(raw); },
    url: function (raw) { return BOLLOON_IPNS.urlFrom(raw); }
  };
})();

/* ============================================================
   链上活动 / On-chain activity —— 多实例隔离模块
   数据: 公开只读接口 GET /api/public/network/progress (无认证, 15s 缓存 + ETag)
   取数顺序: ① 根元素 data-pulse-src="<url>" ② 地址 ?pulse=<url>
             ③ 同源 network-pulse.json ④ unavailable
   静态站, 访客浏览器到不了站点作者的节点 —— 拿不到就如实降级, 绝不编造数字。

   多实例: 页面上每个 [data-pulse] 根 = 一个独立实例, 各自取数 / 轮询 / 降级。
   区内节点一律靠 data-pulse-* 钩子查找 (不用 id, 不会撞):
     data-pulse-scope · data-pulse-time · data-pulse-ago · data-pulse-age · data-pulse-hint
     data-pulse-total="nodes|agents|active|24h|tasks|tasks_completed|tasks_settled|tasks_verified|signatures"
     data-pulse-scope-tag="<同上>|…"                     (贴在该数字旁的口径短标记; 快照没给口径就留空)
     data-pulse-activity-body · data-pulse-activity-empty · data-pulse-activity-source
     data-pulse-activity-totals                        (口径行: 口径短标记 + 同源行数/不同任务 + 网络归属)
     data-pulse-feed · data-pulse-feed-empty · data-pulse-notes
     data-pulse-sites · data-pulse-sites-empty            (智能体私有站 IPNS 列表)
     data-pulse-tasks · data-pulse-tasks-empty            (待接单任务: 快照 open_tasks[])
     data-pulse-ipns-form · data-pulse-ipns-input · data-pulse-ipns-open · data-pulse-ipns-msg
       (粘贴打开器由上面的 IPNS 模块单独绑定, 与本模块无关)
   聚合计数三态 (2026-09-24): 有数 → 显示数字 (真 0 就是 0); 快照给 null 且口径标
   `unavailable` → 显示「未接入」+ 说明 (不隐藏、不写 0 —— 写 0 等于说「没发生过」);
   快照给 null 又没有口径 (老快照) → 整行隐藏「拿不到就不显示」。
   ★ 同样 2026-09-24 (leo:「未接入是什么意思, 可以去掉吗」): 网关页小结行的**「已验证」槽已从页面上
   整体去掉** —— 那个 hook 在 markup 里不再存在, 所以本模块永远不会为它渲染任何东西 (包括「未接入」)。
   这段三态逻辑本身没改: 「钱包签名」等仍按三态渲染; 一旦有人把 tasks_verified 那个 hook 塞回页面,
   本模块照样按三态渲染 —— 但 scripts/verify-site.mjs 的门 [6e★★★★] 会当场判红 (顶部计数区
   不许再出现「未接入」)。快照契约未改 (totals.tasks_verified / totals_scope.fields.tasks_verified 仍在)。
   每个数旁边贴它**自己的**口径短标记 (链上索引·全量 / 24h 脉冲 / 24h 签名审计 / 未接入),
   来自快照 `totals_scope.fields[<字段>].short` —— 明细口径进 title; 快照没给就一个都不写。

   链上活动表 (confirmed_activity) —— 网关页主体, 一行 = 一条已确认的链上任务/交易:
     列 = 任务 | 状态 | 事件 | 网络 | 区块 | 确认数/最终性 | 时间。
     任务与交易标识一律经 shortRef() 短写 (0x12ab…9f0e / sha256:1a2b…):
     长地址 / 长哈希不进页面可见文本 (快照给了全长也一样)。
     state 用中/英单词, finality 三档 (observed/confirmed/finalized) 各上一档颜色徽标;
     未知 kind / 未知 state / 未知 finality 照原样显示, 不猜、不吞、不报错。
     一条里 task 与 tx 都空 → 不画这一行: 宁可不显示, 也不留空行。
     没有数据时不是空白表格, 而是明说「本节点暂未观察到链上任务」;
     快照本身读不到时说的是「快照不可用…」—— 两种真相不混。
     数据源 confirmed_activity_source (chain-index / pulse-events / none) 与口径 (全量/观察窗口)
     一律压成极短标记, 不写整句解释 (2026-09-23 精简):
       · 口径行带 { chain-index → 链上索引 · 全量 / pulse-events → 脉冲事件 } (取自快照字段, 认不出的原样);
       · 表下那行只在这个节点真报不出源时说话 (none → 「本节点未接入链上数据源」;
         快照没读到 → 「本次未读到快照」); 认不出 / 缺字段才原样或「快照未标注」。
     两套口径的分界靠「就近短标记」而不是靠长句: 统计区「观察窗口 24h」+ 本行「链上索引 · 全量」。

   活动流 (recent_activity, 首页序栏紧凑版仍在用) —— kind 无关: 前端只认 text {zh,en}。
   所以后端将来新增任何 kind 都不会报错 / 不会空白:
     · 服务端给了 {zh,en} → 直取当前语言 (缺当前语言就退回另一种, 仍是服务端原文, 不编造);
     · 一条文案都没有 / 文案为空 → 该条不进列表 (宁可不显示一行, 也不留空白行 / 不臆造描述)。
   语言切换: 保留原始数据 (双语对象 / 原始字段), 只在渲染时取语言 → 切语言重画不串语言。
   数值与表格行变化靠下一轮轮询自动反映 (POLL_MS), 无需刷新页面。
   快照自己标的生成时间 (2026-09-24): 绝对时刻 + 相对时间都写在页面上 (钩子 data-pulse-time /
   data-pulse-ago / data-pulse-age), 唯一来源 = 快照字段 generated_at (毫秒数或 ISO 字符串);
   读不到 → 如实写「快照未标注时间」, **绝不用当前时间顶替**。相对部分随轮询刷新 (只改文字节点)。
   可选根属性: data-pulse-feed-max="N" (本实例活动流条数上限, 默认 5)
   任何一份实例失败 (含启动即失败) 都不影响另一份或页面其它区域。
   ============================================================ */
(function () {
  'use strict';

  var roots = document.querySelectorAll('[data-pulse]');
  if (!roots || !roots.length) return;

  var POLL_MS = 30000;                      // 正常轮询间隔
  var TIMEOUT_MS = 5000;                    // 单次请求超时 (AbortController)
  var BACKOFF_MS = [30000, 60000, 120000];  // 失败退避 30s → 60s → 120s（上限）
  var REL_TICK_MS = 20000;                  // 相对时间刷新（只改文字节点）
  var SNAPSHOT_FILE = 'network-pulse.json'; // 静态签名快照（可能已过期 → 就显示 stale）
  var FEED_MAX = 5;                         // 活动流条数上限 (可被 data-pulse-feed-max 覆盖)
  var ACTIVITY_MAX = 60;                    // 链上活动表行数上限
  // 链上活动表一页几行 (2026-09-24 leo:「分页栏…在十五行底部」): 15 = 这一块**高度上限**那一份的行数
  // (表框上限= 十五行, 见 style.css 的 --pulse-activity-h) —— 一页正好一屏, 翻页而不是在框里盲滚。
  // 网关页 markup 用 data-pulse-activity-page 可改; 首页序栏没有这套钩子 → 不渲染控件也不分页。
  var ACTIVITY_PAGE = 15;
  var SITES_MAX = 20;                       // 智能体私有站条数上限
  var TASKS_MAX = 20;                       // 待接单任务条数上限
  var TASKS_PAGE = 4;                       // 待接单任务一页几条 (分页; 网关页用 data-pulse-tasks-page 可改)

  var instances = [];

  // —— 链上活动表用词 (state / 事件 kind / finality / 数据源) ——
  // 表里出现的词都是固定枚举的中英对照; 枚举以外的值一律回落成原始字符串,
  // 未知就显示未知 —— 不吞、不猜、不编。
  var STATE_WORD = {
    active:   { zh: '活跃',   en: 'active' },
    released: { zh: '已释放', en: 'released' },
    refunded: { zh: '已退款', en: 'refunded' },
    expired:  { zh: '已过期', en: 'expired' },
    disputed: { zh: '争议中', en: 'disputed' },
    unknown:  { zh: '未知',   en: 'unknown' }
  };
  var EVENT_WORD = {
    task_created:   { zh: '任务创建', en: 'task created' },
    task_accepted:  { zh: '任务接下', en: 'task accepted' },
    task_completed: { zh: '任务完成', en: 'task completed' },
    trade_settled:  { zh: '交易结算', en: 'trade settled' },
    trade_verified: { zh: '交易验真', en: 'trade verified' }
  };
  var FINALITY_WORD = {
    observed:  { zh: '已观察',     en: 'observed' },
    confirmed: { zh: '已确认',     en: 'confirmed' },
    finalized: { zh: '已最终确定', en: 'finalized' }
  };
  // 口径短标记 (2026-09-23 精简): 只留「这批数来自哪套口径」的最短标记 ——
  // chain-index = 链上索引全量; pulse-events = 脉冲事件 (另一个窗口口径); none = 这个节点没有链上数据源。
  // 原来「链上数据源：链上索引」这一整行的前缀已去掉, 不写整句解释, 也不把口径改大。
  var SOURCE_WORD = {
    'chain-index':  { zh: '链上索引 · 全量', en: 'chain index · whole index' },
    'pulse-events': { zh: '脉冲事件',        en: 'pulse events' },
    none:           { zh: '本节点未接入链上数据源', en: 'no on-chain data source on this node' }
  };

  // —— 快照自己标的生成时间 (2026-09-24) ——
  // 这份快照**有多新**必须写在页面上: 绝对时刻 (本地 YYYY-MM-DD HH:MM:SS) + 相对时间 (会随轮询刷新),
  // 否则「实时」两个字分不清是 3 分钟前还是 2 小时前生成的。
  // 时间的**唯一来源 = 快照字段 generated_at** (毫秒数或 ISO 字符串, 见 parseAt)。
  // 读不到这个字段时只有一条路: 如实说「未标注」——
  // **绝不用 Date.now() 顶替** (顶替 = 把 2 小时前的快照说成刚生成, 是伪造, 不是兜底)。
  var SNAP_TIME_UNKNOWN = { zh: '快照未标注时间', en: 'Snapshot time not labeled' };

  // —— 小工具（全部只写 textContent / 属性, 不碰 innerHTML）——
  function lang() { return document.documentElement.lang === 'en' ? 'en' : 'zh'; }
  function text(node, v) { if (node) node.textContent = v == null ? '' : String(v); }
  function num(v) { return typeof v === 'number' && isFinite(v) ? v : null; }
  function pickBi(bi) {
    if (typeof bi === 'string') return bi;                    // 后端偶尔直接给裸字符串 → 直用
    if (!bi || typeof bi !== 'object') return '';
    var v = bi[lang()];
    if (typeof v === 'string' && v) return v;
    // 缺当前语言就退回另一种语言 —— 仍是服务端原文, 比空白诚实
    var other = lang() === 'en' ? bi.zh : bi.en;
    if (typeof other === 'string' && other) return other;
    return typeof bi.zh === 'string' ? bi.zh : '';
  }
  // 活动流一条「有没有可显示文案」: 任一语言非空即可 (语言在渲染时才定)
  function biText(bi) {
    if (typeof bi === 'string') return bi.trim();
    if (!bi || typeof bi !== 'object') return '';
    var zh = typeof bi.zh === 'string' ? bi.zh.trim() : '';
    var en = typeof bi.en === 'string' ? bi.en.trim() : '';
    return zh || en;
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function absTime(ms) {
    if (!ms) return '—';
    var d = new Date(ms);
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + ' ' +
      pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds());
  }
  function relTime(ms) {
    if (!ms) return '';
    var s = Math.floor((Date.now() - ms) / 1000);
    if (s < 0) s = 0;
    if (s < 45) return lang() === 'en' ? 'just now' : '刚刚';
    var m = Math.round(s / 60);
    if (m < 60) return lang() === 'en' ? m + (m === 1 ? ' minute ago' : ' minutes ago') : m + ' 分钟前';
    var h = Math.round(m / 60);
    if (h < 24) return lang() === 'en' ? h + (h === 1 ? ' hour ago' : ' hours ago') : h + ' 小时前';
    var d = Math.round(h / 24);
    return lang() === 'en' ? d + (d === 1 ? ' day ago' : ' days ago') : d + ' 天前';
  }
  function fmtCount(v) { var n = num(v); return n == null ? '—' : String(n); }
  // 聚合计数「拿不到就不显示」: 字段缺失/非数字 → 整行隐藏 (不拿 0 / — 冒充数据);
  // 真相是真 0 时照常显示 0 (0 是计数, 不是"没数据")。
  function setOptCount(node, v) {
    if (!node) return;
    var row = node.parentNode;
    var n = num(v);
    if (n == null) {
      text(node, '—');
      if (row && row.setAttribute) row.setAttribute('hidden', '');
    } else {
      text(node, String(n));
      if (row && row.removeAttribute) row.removeAttribute('hidden');
    }
  }

  // —— 顶部计数的逐字段口径 (2026-09-24 leo:「数量怎么对不上」) ——
  // 快照的 `totals_scope.fields` 给每个数各自的来源 (链上索引全量 / 24h 脉冲 / 签名审计 / 无源)。
  // 页面**就地**把它贴在数字旁 (data-pulse-scope-tag), 不再只靠 notes 或一行总口径辩解。
  // DOM 钩子名 → 快照字段名 (两处命名历史上不同: active / 24h)。
  var DOMKEY_TO_FIELD = { active: 'active_agents', '24h': 'seen_last_24h' };
  function fieldScopeOf(tf, key) {
    if (!tf || typeof tf !== 'object') return null;
    var f = tf[key];
    return (f && typeof f === 'object') ? f : null;
  }
  function scopeTagText(fs) { return fs ? pickBi(fs.short) : ''; }
  /**
   * 顶部一个数的渲染 (三态, 一个都不能少):
   *   · 快照给了数 → 显示数字 (真 0 就是 0: 0 是计数, 不是"没数据");
   *   · 快照给 null 且口径标 unavailable → 显示「未接入」+ 说明 (title/aria), **不隐藏也不写 0** ——
   *     写 0 等于说「没发生过」, 那是另一句话 (本机明明签过的签名曾被这样报成 0);
   *   · 快照给 null 且没有口径 (老快照) → 整行隐藏 (老行为不变: 拿不到就不显示)。
   */
  function setFieldCount(node, v, fs) {
    if (!node) return;
    if (num(v) == null && fs && fs.unavailable === true) {
      var row = node.parentNode;
      var en = lang() === 'en';
      text(node, en ? 'not connected' : '未接入');
      var why = pickBi(fs.label);
      if (why && node.setAttribute) node.setAttribute('title', why);
      if (row && row.removeAttribute) row.removeAttribute('hidden');
      return;
    }
    if (node.removeAttribute) node.removeAttribute('title');
    setOptCount(node, v);
  }
  function toggleEmpty(node, show) { if (node) node.classList.toggle('is-shown', !!show); }
  function clear(node) { if (node) while (node.firstChild) node.removeChild(node.firstChild); }
  function isReducedMotion() {
    return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  function readLimit(raw, def) {
    var n = parseInt(raw, 10);
    return (isFinite(n) && n > 0 && n <= def) ? n : def;
  }

  // —— 区块浏览器**交易**链接 (2026-09-23; 同日收窄为「合约不上页面」) ——
  //   · 行内唯一可点的东西是**交易标签** → `explorer_tx`。
  //   · 快照给的链接是**数据**, 页面不能盲信: 域名必须是**这条 chain_id 对应的那个**浏览器、
  //     路径必须是 `/tx/`、内嵌的 0x 必须与这一行的 `tx_hash` **逐字相同**
  //     (否则就是「指到别处/指到别的链」的链接 —— 宁可不渲染, 也不给错链接)。
  //   · 合约地址 (`contract`) **只在数据里, 页面既不渲染地址、也不生成合约链接**
  //     —— 所以这里**没有** address 链接判定, 也没有 `explorer_contract` 这条路径。
  //   · 本机隔离开发链 (31337) 等**没有公网浏览器**的链 → 无论快照写什么, 一律保持纯文本
  //     (不编 href="#", 也不接受别人塞进来的链接)。
  var EXPLORER_BY_CHAIN = { 8453: 'basescan.org', 84532: 'sepolia.basescan.org', 1: 'etherscan.io', 11155111: 'sepolia.etherscan.io' };
  var TXHASH_RE = /^0x[0-9a-f]{64}$/;
  function pickTxLink(url, txHash, chainId) {
    if (typeof url !== 'string' || !txHash) return '';
    var host = EXPLORER_BY_CHAIN[chainId];                              // 认不出的链 (含本机 31337) → 没有链接
    if (!host) return '';
    var m = /^https:\/\/([a-z0-9.-]+)\/tx\/(0x[0-9a-f]{64})$/.exec(url.trim());
    if (!m) return '';
    if (m[1] !== host) return '';                                       // 必须是这条链自己的浏览器域名
    if (m[2] !== txHash) return '';                                     // 必须指向**这一行**的交易
    return url.trim();
  }
  // 外部链接的统一写法 (与站内既有的 IPNS / 私有站链接同一套 target/rel)
  function makeExtLink(cls, href, label) {
    var a = document.createElement('a');
    a.className = cls;
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = label;                                              // 一律 textContent, 不拼 HTML
    return a;
  }

  // —— 短写: 地址 / 哈希一律截断, 长串永不进页面可见文本 ——
  //   0x1234…abcd      → 0x1234…abcd   (40 位地址: 头 4 尾 4)
  //   sha256:1a2b3c4d… → sha256:1a2b…  (算法前缀 + 头 4)
  //   裸长 hex         → 头 4…尾 4
  function shortRef(v) {
    var s = (typeof v === 'string' ? v : (v == null ? '' : String(v))).trim();
    if (!s) return '';
    var m = /^(0x)([0-9a-fA-F]{8,})$/.exec(s);
    if (m) return m[1] + m[2].slice(0, 4) + '…' + m[2].slice(-4);
    m = /^([A-Za-z][A-Za-z0-9_+.-]{1,15}):([0-9a-fA-F]{8,})$/.exec(s);
    if (m) return m[1] + ':' + m[2].slice(0, 4) + '…';
    if (/^[0-9a-fA-F]{20,}$/.test(s)) return s.slice(0, 4) + '…' + s.slice(-4);
    return s;
  }

  // 快照时间字段兼容两种写法: ISO 字符串 ("2026-09-22T05:31:00Z") / 毫秒数
  function parseAt(v) {
    if (typeof v === 'number' && isFinite(v)) return v > 0 ? v : 0;
    if (typeof v === 'string' && v.trim()) {
      var t = Date.parse(v.trim());
      return isFinite(t) ? t : 0;
    }
    return 0;
  }
  function isoOf(ms) { try { return new Date(ms).toISOString(); } catch (e) { return ''; } }
  // 短日期 (只给待接单任务的截止时间用: MM-DD) —— 完整 ISO 放 <time datetime>, 页面上不铺长串
  function shortDate(ms) { var d = new Date(ms); return pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  // 枚举词: 认得出就用中/英对照; 认不出但有原值就显示原值 (诚实优先于好看)
  function word(table, key, fbZh, fbEn) {
    var k = typeof key === 'string' ? key.trim() : '';
    var w = table[k];
    if (w) return lang() === 'en' ? w.en : w.zh;
    if (k) return k;
    return lang() === 'en' ? fbEn : fbZh;
  }
  function textNode(tag, cls, value) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    n.textContent = value == null ? '' : String(value);   // 一律 textContent
    return n;
  }

  // —— 一个实例: 绑定一个 [data-pulse] 根, 全部状态自持 (互不共享) ——
  function createInstance(root) {
    var FEED_LIMIT = readLimit(root.getAttribute('data-pulse-feed-max'), FEED_MAX);
    // 待接单任务条数上限: 首页紧凑版传 data-pulse-tasks-max="1" 只列最近到期的一条 (紧凑契约),
    // 被截掉的那几条用「+N」标出来 (不静默吞掉 —— 读者知道还有几条, 也知道去哪看全)。
    var TASKS_LIMIT = readLimit(root.getAttribute('data-pulse-tasks-max'), TASKS_MAX);
    // 一页几条 (2026-09-24 leo: 固定高度 + 下滑滚动 + 分页 + 分栏切换)。分页控件只在一页装不下时出现。
    var TASKS_PAGE_SIZE = readLimit(root.getAttribute('data-pulse-tasks-page'), TASKS_PAGE);
    // 链上活动表一页几行 (同上): 15 = 表框高度上限那一份的行数 (--pulse-activity-h 就是按它量的)
    var ACTIVITY_PAGE_SIZE = readLimit(root.getAttribute('data-pulse-activity-page'), ACTIVITY_PAGE);
    var el = {
      scope: root.querySelector('[data-pulse-scope]'),
      snapTime: root.querySelector('[data-pulse-time]'),
      snapAgo: root.querySelector('[data-pulse-ago]'),
      snapAge: root.querySelector('[data-pulse-age]'),
      nodes: root.querySelector('[data-pulse-total="nodes"]'),
      agents: root.querySelector('[data-pulse-total="agents"]'),
      active: root.querySelector('[data-pulse-total="active"]'),
      h24: root.querySelector('[data-pulse-total="24h"]'),
      tasks: root.querySelector('[data-pulse-total="tasks"]'),
      tasksCompleted: root.querySelector('[data-pulse-total="tasks_completed"]'),
      tasksVerified: root.querySelector('[data-pulse-total="tasks_verified"]'),
      tasksSettled: root.querySelector('[data-pulse-total="tasks_settled"]'),
      signatures: root.querySelector('[data-pulse-total="signatures"]'),
      // 顶部计数旁的口径短标记 (i.pulse-scope-tag[data-pulse-scope-tag=...]; 快照没给口径就留空)
      scopeTags: (function () {
        var out = {}, ns = root.querySelectorAll('[data-pulse-scope-tag]');
        for (var i = 0; i < ns.length; i++) out[ns[i].getAttribute('data-pulse-scope-tag')] = ns[i];
        return out;
      })(),
      actBody: root.querySelector('[data-pulse-activity-body]'),
      actEmpty: root.querySelector('[data-pulse-activity-empty]'),
      actSource: root.querySelector('[data-pulse-activity-source]'),
      actTotals: root.querySelector('[data-pulse-activity-totals]'),
      // 链上活动表的分页栏 (2026-09-24): 只在网关页有这套钩子; 首页序栏没有 → null, 不渲染
      actScroll: root.querySelector('[data-pulse-activity-scroll]'),
      actCtl: root.querySelector('[data-pulse-activity-ctl]'),
      actPageInfo: root.querySelector('[data-pulse-activity-pageinfo]'),
      actPrev: root.querySelector('[data-pulse-activity-prev]'),
      actNext: root.querySelector('[data-pulse-activity-next]'),
      txLine: root.querySelector('[data-pulse-activity-tx]'),
      sites: root.querySelector('[data-pulse-sites]'),
      sitesEmpty: root.querySelector('[data-pulse-sites-empty]'),
      tasksList: root.querySelector('[data-pulse-tasks]'),
      tasksEmpty: root.querySelector('[data-pulse-tasks-empty]'),
      // 分页 / 分栏控件 (2026-09-24): 只在网关页有这套钩子; 首页序栏没有 → 一直是 null, 也就不渲染
      tasksCtl: root.querySelector('[data-pulse-tasks-ctl]'),
      tasksPageInfo: root.querySelector('[data-pulse-tasks-pageinfo]'),
      tasksPrev: root.querySelector('[data-pulse-tasks-prev]'),
      tasksNext: root.querySelector('[data-pulse-tasks-next]'),
      tasksCols: root.querySelector('[data-pulse-tasks-cols]'),
      feed: root.querySelector('[data-pulse-feed]'),
      feedEmpty: root.querySelector('[data-pulse-feed-empty]'),
      notes: root.querySelector('[data-pulse-notes]')
    };

    var view = {
      state: 'loading', payload: null, snapAt: 0, rows: [], actSource: '', actRest: 0,
      actTotals: null, chainScope: null, totalsScope: null, totalsFields: null, rawFeed: [], notes: [], sites: [], tasks: [],
      tasksPage: 0, tasksCols: false, actPage: 0,
      scopeKey: 'observed', scopeLabels: null, sourceKind: null,
    };
    var timer = null, relTimer = null, failCount = 0, started = false, api = null;

    function setState(next) {
      view.state = next;
      root.setAttribute('data-pulse-state', next);
      if (api) api.state = next;
    }

    // —— 取数来源 (本实例优先看 data-pulse-src, 再 ?pulse=, 最后同源快照) ——
    function resolveSource() {
      var own = root.getAttribute('data-pulse-src');
      if (own) {
        try { return { url: new URL(own, location.href).href, kind: 'endpoint' }; } catch (e) { return null; }
      }
      var q = null;
      try { q = new URLSearchParams(location.search).get('pulse'); } catch (e) { q = null; }
      if (q) {
        try { return { url: new URL(q, location.href).href, kind: 'endpoint' }; } catch (e) { return null; }
      }
      try { return { url: new URL(SNAPSHOT_FILE, location.href).href, kind: 'snapshot' }; } catch (e) { return null; }
    }

    function fetchOnce(src) {
      var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
      var to = ctrl ? setTimeout(function () { ctrl.abort(); }, TIMEOUT_MS) : null;
      var opts = { cache: 'no-cache', headers: { Accept: 'application/json' } };
      if (ctrl) opts.signal = ctrl.signal;
      return fetch(src.url, opts).then(function (r) {
        if (to) clearTimeout(to);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.text();
      }).then(function (body) {
        var data;
        try { data = JSON.parse(body); } catch (e) { throw new Error('bad json'); }
        if (!data || typeof data !== 'object') throw new Error('bad payload');
        return data;
      }, function (err) {
        if (to) clearTimeout(to);
        throw err;
      });
    }

    function classify(payload) {
      if (!payload || typeof payload !== 'object') return 'unavailable';
      if (payload.status === 'unavailable') return 'unavailable';
      if (payload.status === 'stale') return 'stale';
      var fu = num(payload.fresh_until);
      if (fu != null && fu > 0 && fu <= Date.now()) return 'stale'; // 快照已过期 → 不伪装实时
      return 'live';
    }

    // —— 渲染（全部重建 <= FEED_LIMIT 条列表项; 相对时间只改文字节点）——
    function renderScope() {
      if (!el.scope) return;
      if (!view.payload) { el.scope.setAttribute('hidden', ''); return; }
      var fromApi = pickBi(view.scopeLabels);
      var fallback = view.scopeKey === 'verified'
        ? (lang() === 'en' ? 'Verified network snapshot' : '网络观察快照')
        : (lang() === 'en' ? 'Observed by this node' : '当前节点观察到');
      el.scope.removeAttribute('hidden');
      text(el.scope, fromApi || fallback);
    }

    // —— 链上活动表: 一行 = 一条已确认的链上任务/交易 ——
    // 列 = 任务 | 状态 | 事件 | 网络 | 区块 | 确认数/最终性 | 时间
    // 全部用 textContent 造节点; 任务/交易标识短写; 没有可标识的条目根本不进表。
    // 2026-09-23: ① 任务格里追加「交易标签」—— 有 explorer_tx 才是 <a> (新窗口 + noopener noreferrer),
    //            没有 (本机 31337 之类) 就是纯文本 <code>, **不编 href="#"**;
    //            ② **合约不上页面**: 合约地址/合约链接一律不渲染 (网络格只有 chain_id 纯文本),
    //              链接里的 0x 与这一行的 tx_hash 逐字相同 (见 pickTxLink), 可见文本一律短写。
    function renderActivity() {
      if (!el.actBody) return;
      var en = lang() === 'en';
      clear(el.actBody);
      // —— 分页 (2026-09-24 leo:「分页栏…在十五行底部」): 只渲染**当前页**的行 ——
      //    一页 ACTIVITY_PAGE_SIZE 行 (= 表框高度上限 --pulse-activity-h 就是按这么些行量出来的),
      //    页数由**表里真有的行数**算出来 (不写死); 行数变少 (快照换了一份) → 页码收拢到最后一页,
      //    不空转、不显示空页 —— 与待接单任务块同一套纪律。
      var actTotal = view.rows.length;
      var actPages = actTotal > 0 ? Math.ceil(actTotal / ACTIVITY_PAGE_SIZE) : 1;  // 空 → 1 页 (不写「0 页」)
      if (view.actPage > actPages - 1) view.actPage = actPages - 1;
      if (view.actPage < 0) view.actPage = 0;
      var actStart = view.actPage * ACTIVITY_PAGE_SIZE;
      var pageRows = view.rows.slice(actStart, Math.min(actStart + ACTIVITY_PAGE_SIZE, actTotal));
      for (var i = 0; i < pageRows.length; i++) {
        var r = pageRows[i];
        var tr = document.createElement('tr');
        tr.className = 'pulse-row';
        tr.setAttribute('data-ref', r.refKind);

        // ① 任务 (一律短写: 快照给全长也只显示头尾) + 交易标签 (可点则点, 不可点则纯文本)
        var tdTask = document.createElement('td');
        tdTask.className = 'pulse-td-task';
        tdTask.appendChild(textNode('code', '', shortRef(r.ref)));
        if (r.txHash) {
          var txLabel = shortRef(r.txHash);
          if (r.explorerTx) {
            tdTask.appendChild(makeExtLink('pulse-tx-link', r.explorerTx, txLabel + ' ↗'));
          } else {
            tdTask.appendChild(textNode('code', 'pulse-tx-ref', txLabel));   // 没有浏览器 → 纯文本, 不编死链
          }
        }

        // ② 状态 (中/英单词)
        var tdState = document.createElement('td');
        var st = textNode('span', 'pulse-state-word', word(STATE_WORD, r.state, '未知', 'unknown'));
        st.setAttribute('data-state', r.state || 'unknown');
        tdState.appendChild(st);

        // ③ 事件 (kind 枚举 → 中/英; 认不出的 kind 原样显示, 不猜)
        var tdKind = document.createElement('td');
        var kd = textNode('span', 'pulse-kind-word', word(EVENT_WORD, r.kind, '未知', 'unknown'));
        kd.setAttribute('data-kind', r.kind || 'unknown');
        tdKind.appendChild(kd);

        // ④ 网络 = 快照给的 chain_id (只显示这个数字, 不替它编网络名, 也不放合约地址/链接)
        var tdNet = document.createElement('td');
        tdNet.className = 'pulse-td-net';
        tdNet.setAttribute('data-chain', r.chainId == null ? '' : String(r.chainId));
        tdNet.textContent = r.chainId == null ? '—' : String(r.chainId);

        // ⑤ 区块
        var tdBlock = document.createElement('td');
        tdBlock.className = 'pulse-td-block';
        tdBlock.textContent = r.block == null ? '—' : String(r.block);

        // ⑥ 确认数 / 最终性 (observed / confirmed / finalized 三档各一色徽标)
        var tdFin = document.createElement('td');
        tdFin.className = 'pulse-td-fin';
        tdFin.appendChild(textNode('span', 'pulse-conf', r.confirmations == null ? '—' : String(r.confirmations)));
        var finKey = FINALITY_WORD[r.finality] ? r.finality : (r.finality ? 'other' : 'unknown');
        var badge = textNode('span', 'pulse-fin is-' + finKey, word(FINALITY_WORD, r.finality, '未知', 'unknown'));
        badge.setAttribute('data-finality', r.finality || 'unknown');
        tdFin.appendChild(badge);

        // ⑦ 时间 (快照原文是 ISO 字符串 → 转本地绝对时间; 相对时间留给活动流)
        var tdTime = document.createElement('td');
        tdTime.className = 'pulse-td-time';
        if (r.at) {
          var t = document.createElement('time');
          t.setAttribute('datetime', isoOf(r.at));
          t.textContent = absTime(r.at);
          tdTime.appendChild(t);
        } else {
          tdTime.textContent = '—';
        }

        tr.appendChild(tdTask); tr.appendChild(tdState); tr.appendChild(tdKind);
        tr.appendChild(tdNet); tr.appendChild(tdBlock); tr.appendChild(tdFin); tr.appendChild(tdTime);
        el.actBody.appendChild(tr);
      }
      // 空表格要说清是哪种空 (没观察到 ≠ 没拿到), 不留一片空白骗人
      if (el.actEmpty) {
        text(el.actEmpty, activityEmptyText());
        toggleEmpty(el.actEmpty, view.rows.length === 0);
      }
      // 数据源/口径短标记 (2026-09-23 精简): 能报口径的场合一律短写, 绝不写成整句 ——
      //   · 口径行已经带着「链上索引 · 全量」这类标记时 → 这里留空, 不重复第二遍 (省掉冗余的一行字);
      //   · 老快照没有 activity_totals (口径行整行隐藏) → 这里补上同一个短标记, 免得表里的行没了口径;
      //   · 真正「报不出来」的两种真相才单独说, 且只说最短的一句:
      //       快照压根没读到 (≠ 快照没标注) / confirmed_activity_source=none (这个节点没有链上数据源)。
      //   · 认不出的来源原值照原样 (不替快照认领来源); 字段缺失才写「快照未标注」。
      if (el.actSource) {
        var srcWord = SOURCE_WORD[view.actSource];
        var srcShort = srcWord ? (en ? srcWord.en : srcWord.zh) : view.actSource;
        var carried = view.actTotals && view.actTotals.source && view.actTotals.source !== 'none';
        if (!view.payload) {
          text(el.actSource, en ? 'snapshot not read this round' : '本次未读到快照');
        } else if (view.actSource === 'none') {
          text(el.actSource, en ? SOURCE_WORD.none.en : SOURCE_WORD.none.zh);
        } else if (carried) {
          text(el.actSource, '');
        } else if (srcShort) {
          text(el.actSource, srcShort);
        } else {
          text(el.actSource, en ? 'not specified by the snapshot' : '快照未标注');
        }
      }
      renderActivityCtl(actTotal, actPages);
    }

    /**
     * 链上活动表的分页栏 (2026-09-24 leo:「分页栏…在十五行底部」) —— 一行 = 上一页 · 第 p/pages 页 · 共 N 行 · 下一页。
     * 与待接单任务块的那一行**故意有一处不同**: 这里**始终显示**(只要有行) —— leo 要的就是「十五行底部那条分页栏」,
     * 表里正好 15 行 (= 一页) 时它写着「第 1/1 页 · 共 15 行」并禁用两个按钮 (不是藏起来)。
     * 一行都没有 (真 0 / 快照读不到) → 整行隐藏, 交给空态那句话 (不写「共 0 行」这种假 0 味的字)。
     * 「共 N 行」= 表里**真有的行数**; 超出 ACTIVITY_MAX 被截掉的部分**就地补一句** (不装看不见、也不混进分页口径)。
     */
    function renderActivityCtl(actTotal, actPages) {
      if (!el.actCtl) return;
      if (actTotal <= 0) { el.actCtl.setAttribute('hidden', ''); return; }
      el.actCtl.removeAttribute('hidden');
      var info = rowInfoText(view.actPage + 1, actPages, actTotal);
      if (view.actRest > 0) info += (lang() === 'en' ? ' · +' + view.actRest + ' not listed' : ' · 另 ' + view.actRest + ' 行未列');
      if (el.actPageInfo) text(el.actPageInfo, info);
      if (el.actPrev) el.actPrev.disabled = view.actPage <= 0;
      if (el.actNext) el.actNext.disabled = view.actPage >= actPages - 1;
      setCtlTip(el.actPrev, ctlLabel('prev'), pageTip('prev', view.actPage, actPages));
      setCtlTip(el.actNext, ctlLabel('next'), pageTip('next', view.actPage + 2, actPages));
    }

    // 「第 p/pages 页 · 共 N 行」—— N = 表里真有的行数 (与这一页画出来的行同源), 不是快照里那个全量计数。
    function rowInfoText(p, pages, total) {
      return lang() === 'en'
        ? 'Page ' + p + '/' + pages + ' · ' + total + ' row' + (total === 1 ? '' : 's')
        : '第 ' + p + '/' + pages + ' 页 · 共 ' + total + ' 行';
    }

    /**
     * 首页快照区里的「最新一笔链上交易」(data-pulse-activity-tx; 只有首页序栏有这个钩子):
     *   · 与上表**同一份 view.rows / 同一套链接校验 (pickTxLink) / 同一套短写** —— 两页不各写一套;
     *   · 有 explorer_tx → <a> (新窗口 + noopener noreferrer); 没有 (本机隔离开发链) → 纯文本 <code>;
     *   · 没有行 / 行里没有 tx_hash → 清空, 不留占位、不编链接。
     */
    function renderActivityTx() {
      if (!el.txLine) return;
      clear(el.txLine);
      var row = null;
      for (var i = 0; i < view.rows.length; i++) {           // rows 已按快照时间新→旧
        if (view.rows[i].txHash) { row = view.rows[i]; break; }
      }
      if (!row) return;                                      // 没有链上事实 → 什么都不显示
      var label = shortRef(row.txHash);
      if (row.explorerTx) {
        el.txLine.appendChild(makeExtLink('pulse-c-tx-link', row.explorerTx, label + ' ↗'));
      } else {
        el.txLine.appendChild(textNode('code', 'pulse-c-tx-ref', label));
      }
    }

    // 空表格的两种真相要分清: 快照在但一条都没有 (没观察到) ≠ 快照根本没拿到
    function activityEmptyText() {
      var en = lang() === 'en';
      if (!view.payload) {
        return en
          ? 'Snapshot unavailable — on-chain activity cannot be read right now.'
          : '快照不可用，此刻读不到链上活动。';
      }
      return en
        ? 'This node has not observed any on-chain task yet.'
        : '本节点暂未观察到链上任务。';
    }

    /**
     * 口径行 (data-pulse-activity-totals) —— 公开页**不许**出现自相矛盾的展示:
     * 小结行的「任务/已完成/已验证/签名」是 **24h 脉冲事件口径** (本节点自己上报的),
     * 而链上活动表的 N 行来自 **链上索引 (全量)** —— 两个数字同屏时, 两套口径**各自带一个极短标记**:
     *   · 小结行那四个数附近 → HTML 里的 .pulse-caveat「观察窗口 24h」(静态短标记, 不靠这一行渲染);
     *   · 链上活动表的行数这里 → 带「链上索引 · 全量」(chain-index) / 「脉冲事件」(pulse-events)。
     * 2026-09-23 精简: 原来这里还有一整句「上方 任务/已完成/已验证/签名 只数 24h 窗口内的脉冲事件,
     * 链上索引的 N 行（全量，不是 24h 窗口）是另一套口径 —— 不是数据丢了」—— 整句删掉, 口径信息由
     * 上面两个短标记就近承接 (更短, 但两套口径的分界一眼可见; 这条由 verify-site.mjs 的门守着,
     * 门同时要求「观察窗口」类标记出现在统计区 + 「全量」类标记出现在本行, 少一个都算红)。
     * 数据源 = 快照的 activity_totals (与表**同源**, rows 恒等于表里行数) + chain_id_scope。
     * 纪律: 只读快照给的字段; 缺哪块就不说哪块 (老快照没有这一行 → 整行隐藏); 只写 textContent, 不用 innerHTML;
     *       数字一律取快照给的同源计数, 前端**不自己数行数**(否则又会变成两个来源打架)。
     */
    function renderActivityTotals() {
      if (!el.actTotals) return;
      var at = view.actTotals;
      if (!at) {
        // 快照没给 activity_totals (老快照) → 整行隐藏, 不留空白行、不自己数行数
        text(el.actTotals, '');
        if (el.actTotals.setAttribute) el.actTotals.setAttribute('hidden', '');
        return;
      }
      var en = lang() === 'en';
      var parts = [];
      // ① 口径短标记 + 同源计数 (行数 + 不同任务): 与表里行数同源, 不自己数。
      //    标记取自快照自己的 activity_totals.source —— 是链上索引就说链上索引(全量),
      //    是脉冲事件就说脉冲事件; source=none (没有源) 时不认领任何来源, 只报数字。
      var rows = num(at.rows);
      var tasks = num(at.tasks);
      var head = [];
      if (at.source && at.source !== 'none') {
        var sw = SOURCE_WORD[at.source];
        head.push(sw ? (en ? sw.en : sw.zh) : String(at.source));
      }
      if (rows != null) {
        head.push(en
          ? rows + (rows === 1 ? ' row' : ' rows') + (tasks != null ? ' / ' + tasks + ' distinct task' + (tasks === 1 ? '' : 's') : '')
          : rows + ' 行' + (tasks != null ? ' / ' + tasks + ' 个不同任务' : ''));
      }
      if (head.length) parts.push(head.join(en ? ' · ' : ' · '));
      // ② 上表这批行属于哪条链 (本机 31337 = 本机隔离开发链; 认不出的 chain id 只给数字, 不编网络名)
      var cis = view.chainScope;
      if (cis) {
        var cid = num(cis.activity_chain_id);
        var clabel = pickBi(cis.activity_chain_label);
        var pubRows = num(cis.public_network_rows);
        var net = (en ? 'network: ' : '网络：') + (cid != null ? String(cid) : '—') + (clabel ? '（' + clabel + '）' : '');
        if (pubRows === 0) net += (en ? ' · no public-network activity' : ' · 不是公网活动');
        parts.push(net);
      }
      text(el.actTotals, parts.join(en ? ' · ' : ' · '));
      // 有内容才显示 (一行都没有就不留空白行)
      if (parts.length === 0) {
        if (el.actTotals.setAttribute) el.actTotals.setAttribute('hidden', '');
      } else if (el.actTotals.removeAttribute) {
        el.actTotals.removeAttribute('hidden');
      }
    }

    function renderFeed() {
      if (!el.feed) return;
      clear(el.feed);
      for (var i = 0; i < view.rawFeed.length; i++) {
        var item = view.rawFeed[i] || {};
        var at = num(item.at) || 0;
        var li = document.createElement('li');
        var t = document.createElement('time');
        t.className = 'pulse-feed-time';
        t.setAttribute('data-at', String(at));
        if (at) { try { t.setAttribute('datetime', new Date(at).toISOString()); } catch (e) {} }
        t.textContent = relTime(at);
        var s = document.createElement('span');
        s.className = 'pulse-feed-text';
        // 服务端文案 (kind 无关) → 只经 textContent, 严禁 innerHTML;
        // 条目进列表前已保证任一语言非空 → 这里不会渲染出空白行
        s.textContent = pickBi(item.text);
        li.appendChild(t); li.appendChild(s);
        el.feed.appendChild(li);
      }
      toggleEmpty(el.feedEmpty, view.rawFeed.length === 0);
    }

    function renderNotes() {
      if (!el.notes) return;
      clear(el.notes);
      for (var i = 0; i < view.notes.length; i++) {
        var li = document.createElement('li');
        li.textContent = view.notes[i];
        el.notes.appendChild(li);
      }
    }

    // —— 智能体私有站 (本节点显式发布的 IPNS): label + 可点链接 ——
    // ipns 三种形态 (裸 k51… / ipns://… / /ipns/…) 一律归一化成 https://ipfs.io/ipns/<cid>;
    // 归一化失败 (非法/缺失) → 该条不列 (宁可不显示, 不给半个链接)。
    function renderSites() {
      if (!el.sites) return;
      clear(el.sites);
      var en = lang() === 'en';
      for (var i = 0; i < view.sites.length; i++) {
        var s = view.sites[i];
        var li = document.createElement('li');
        var label = document.createElement('span');
        label.className = 'pulse-site-label';
        label.textContent = s.label || (en ? 'agent private site' : '智能体私有站');   // 一律 textContent
        var a = document.createElement('a');
        a.className = 'pulse-site-link';
        a.href = s.href;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.textContent = s.cid;                                        // 链接文本一律 textContent
        a.setAttribute('aria-label',
          (en ? 'Open ' : '打开 ') + (s.label || s.cid) + (en ? ' in a new window (IPNS via ipfs.io)' : ' 的智能体私有站（经 ipfs.io 打开，新窗口）'));
        li.appendChild(label); li.appendChild(a);
        el.sites.appendChild(li);
      }
      if (view.sites.length === 0) text(el.sitesEmpty, emptySitesText());
      toggleEmpty(el.sitesEmpty, view.sites.length === 0);
    }

    // 空列表的两种真相要分清: 本节点没发布 ≠ 快照读不到 (2026-09-23 精简: 都压成极短标记, 不写整句)
    function emptySitesText() {
      var hasSnapshot = !!view.payload;
      if (lang() === 'en') {
        return hasSnapshot
          ? 'Empty = none published (not missing data)'
          : 'snapshot unreadable — cannot tell what was published';
      }
      return hasSnapshot
        ? '空 = 未发布（不是没数据）'
        : '快照读不到，说不清发布了什么';
    }

    // —— 原子单位 → 人类可读 (2026-09-24 leo:「1000 USDC 的待接单任务？我好像没那么多钱啊」) ——
    // 公告里的预算字段是**正整数原子单位** (主仓 src/agents/task-contract.ts: `maxAmount: string; // 正整数原子单位
    // 字符串 (与 x402 一致)`, 且测试里 `toAtomicAmount('1','USDC') === '1000000'`) —— 所以 "1000" 不是
    // 1000 USDC, 而是 **0.001 USDC**。只显示原子值 + 一行「预算 · 原子」标记, 读者会把它读成 1000 USDC
    // (leo 就是这么读的) —— **标记太弱 = 缺陷**, 跟「切换也太模糊」是同一类问题。
    // 纪律: ① 只按**主仓自己的精度表**折算 (USDC 6 位 / ETH 18 位 —— 与 task-contract 只允许 USDC/ETH 的
    // 白名单同源), 不认识的币种**不折算** (折算不知道精度的币种 = 替数据编数); ② 原始原子值**留在 title 里**
    // (一个数都没被藏起来, 悬停即见 "= 1000 最小单位"); ③ 用整数移位, 不经过浮点 (0.001 不许因为 double 变 0.00100000000000000002)。
    var ATOMIC_DECIMALS = { USDC: 6, ETH: 18 };
    function fromAtomic(amount, currency) {
      var cur = String(currency == null ? '' : currency).trim().toUpperCase();
      var raw = String(amount == null ? '' : amount).trim();
      var dec = ATOMIC_DECIMALS[cur];
      if (dec == null || !/^\d+$/.test(raw)) return null;          // 不认识的币种 / 非正整数原子串 → 不折算
      var digits = raw.replace(/^0+(?=\d)/, '');
      if (digits.length <= dec) digits = new Array(dec - digits.length + 1).join('0') + digits;
      var intPart = digits.slice(0, digits.length - dec).replace(/^0+(?=\d)/, '') || '0';
      var frac = digits.slice(digits.length - dec).replace(/0+$/, '');
      return intPart + (frac ? '.' + frac : '');
    }
    // chip 上那个预算节点: 能折算就显示折算值, 折不了就显示原子值并**就地**说明按最小单位显示 (不做区块级含糊标记)。
    function budgetNode(amount, currency) {
      var cur = String(currency == null ? '' : currency).trim();
      var raw = String(amount == null ? '' : amount).trim();
      var human = fromAtomic(raw, cur);
      var en = lang() === 'en';
      var unit = en ? 'minimal units' : '最小单位';
      var node = textNode('span', 'pulse-task-budget', human != null
        ? (human + (cur ? ' ' + cur : ''))
        : (raw + (cur ? ' ' + cur : '') + (en ? ' · ' + unit : ' · ' + unit)));
      var pow = ATOMIC_DECIMALS[cur.toUpperCase()];
      if (human != null) {
        node.setAttribute('title', en
          ? human + ' ' + cur + ' (= ' + raw + ' minimal units · 1 ' + cur + ' = 10^' + pow + ')'
          : human + ' ' + cur + '（= ' + raw + ' 最小单位 · 1 ' + cur + ' = 10^' + pow + '）');
      } else {
        node.setAttribute('title', en
          ? raw + ' ' + (cur || 'units') + ' (minimal units; this page has no precision for ' + (cur || 'this currency') + ', so it does not convert)'
          : raw + ' ' + (cur || '单位') + '（最小单位；本页没有 ' + (cur || '该币种') + ' 的精度，不折算）');
      }
      return node;
    }

    // —— 待接单任务 (快照 open_tasks[]): 一行一个 chip ——
    // chip 只拼**白名单字段**: capability · 预算 + currency · network · 截止 MM-DD · announcementId(前 8 位)。
    // 纪律 (与主仓 OpenTaskRow 的白名单一一对应):
    //   · 任务正文 / 正文摘要与预览 / 买方 DID 与公钥 / 认领者 / 签名 —— **根本不读** (不读就没有
    //     "某天顺手渲染出来"的可能; 快照里本来也不该有, 由主仓门 + 站点隐私守卫双重拒)。
    //   · 预算: 快照给的是**原子单位**, 按币种精度折算后显示 (见上面 fromAtomic / budgetNode, 2026-09-24
    //     leo 把 "1000 USDC" 读成了 1000 USDC —— 那其实是 0.001 USDC), 原始值留在 title 里, 折不了的币种不折。
    //   · `claimed === true` 的行不画:「待接单」区块里出现已认领的单是事实错误 (主仓门也会拒这种快照)。
    //   · 2026-09-24 leo:「这个任务条目你设置一下固定高度…以后可以下滑滚动查看, 分页分栏切换」:
    //     ① 固定高度 + 框内滚动 = **纯 CSS** (style.css 里 .pulse-tasks-list 的 height: var(--pulse-task-row-h)) ——
    //        条目再多也不会把这一块撑高, 页面逻辑不掺和; ② 分页 = 这里**只渲染当前页** (每页
    //        TASKS_PAGE_SIZE 条, 页数由快照条数算出来, 不写死); ③ 分栏 = 一个 class 交给 CSS
    //        (is-cols2), 切换不改数据也不改高度; ④ 「+N」仍是**本页上限 TASKS_LIMIT 截掉**的那几条 ——
    //        上限口径与分页口径**不混**, 两个数各说各的。
    function renderTasks() {
      if (!el.tasksList) return;
      clear(el.tasksList);
      var en = lang() === 'en';
      var total = Math.min(view.tasks.length, TASKS_LIMIT);              // 上限之内的总条数 (= 分页的总量)
      var pages = total > 0 ? Math.ceil(total / TASKS_PAGE_SIZE) : 1;    // 空 → 1 页 (不写「0 页」)
      if (view.tasksPage > pages - 1) view.tasksPage = pages - 1;        // 条数变少 → 页码收拢到最后一页 (不空转)
      if (view.tasksPage < 0) view.tasksPage = 0;
      var start = view.tasksPage * TASKS_PAGE_SIZE;
      var shown = view.tasks.slice(start, Math.min(start + TASKS_PAGE_SIZE, total));
      if (el.tasksList.classList) el.tasksList.classList.toggle('is-cols2', view.tasksCols === true);
      for (var i = 0; i < shown.length; i++) {
        var t = shown[i];
        var chip = document.createElement('span');
        chip.className = 'pulse-task-chip';
        chip.setAttribute('data-task-id', t.announcementId || '');
        chip.appendChild(textNode('span', 'pulse-task-cap', t.capability));
        if (t.budget) chip.appendChild(budgetNode(t.budget, t.currency));
        if (t.network) chip.appendChild(textNode('span', 'pulse-task-net', t.network));
        if (t.deadline) {
          var tm = document.createElement('time');
          tm.className = 'pulse-task-deadline';
          tm.setAttribute('datetime', isoOf(t.deadline));
          tm.textContent = (en ? 'closes ' : '截止 ') + shortDate(t.deadline);
          chip.appendChild(tm);
        }
        if (t.announcementId) chip.appendChild(textNode('code', 'pulse-task-id', t.announcementId));
        el.tasksList.appendChild(chip);
      }
      // 被上限截掉的条目**如实计数**(+N), 不静默吞掉 —— 空态/截断都不许写成「没有」
      // (上限 TASKS_LIMIT 之外的才计 +N; 分页只是换个窗口看同一批, **不算被截掉**)
      var rest = view.tasks.length - total;
      if (rest > 0) {
        var more = textNode('span', 'pulse-task-more', (en ? '+' : '+') + rest);
        more.setAttribute('data-pulse-tasks-more', String(rest));
        el.tasksList.appendChild(more);
      }
      renderTasksCtl(total, pages);
      if (el.tasksEmpty) text(el.tasksEmpty, tasksEmptyText());
      toggleEmpty(el.tasksEmpty, view.tasks.length === 0);
    }

    // —— 分页 / 分栏控件 (只有网关页有钩子; 首页序栏没有 → 整个函数直接返回) ——
    // 一页装得下就整行隐藏 (不添噪音); 页数 = 从快照条数算出来的, 不写死。
    function renderTasksCtl(total, pages) {
      if (!el.tasksCtl) return;
      var show = total > TASKS_PAGE_SIZE;
      if (show) el.tasksCtl.removeAttribute('hidden');
      else el.tasksCtl.setAttribute('hidden', '');
      if (!show) return;
      if (el.tasksPageInfo) text(el.tasksPageInfo, pageInfoText(view.tasksPage + 1, pages, total));
      if (el.tasksPrev) el.tasksPrev.disabled = view.tasksPage <= 0;
      if (el.tasksNext) el.tasksNext.disabled = view.tasksPage >= pages - 1;
      setCtlTip(el.tasksPrev, ctlLabel('prev'), pageTip('prev', view.tasksPage, pages));
      setCtlTip(el.tasksNext, ctlLabel('next'), pageTip('next', view.tasksPage + 2, pages));
      if (el.tasksCols) {
        el.tasksCols.setAttribute('aria-pressed', view.tasksCols ? 'true' : 'false');
        text(el.tasksCols, colsText());
        setCtlTip(el.tasksCols, colsText(), colsTip());
      }
    }

    // 「第 p/pages 页 · 共 total 条」—— total = 快照里未认领且未过期的条数 (与 chip 同源), 不是本页渲染了几条。
    function pageInfoText(p, pages, total) {
      return lang() === 'en'
        ? 'Page ' + p + '/' + pages + ' · ' + total + ' task' + (total === 1 ? '' : 's')
        : '第 ' + p + '/' + pages + ' 页 · 共 ' + total + ' 条';
    }

    // 分栏按钮的文案随状态走 (切到双栏 ↔ 切回单栏), 所以它**故意没有 data-zh/data-en** ——
    // applyLang 只自动翻静态标记节点, 这个按钮由本函数在每次重画时按当前语言写 (切语言走 redraw() 会再进来)。
    // 2026-09-24 leo:「切换也太模糊」→ 写**动作 + 去向**(切到/切回), 不写状态名 (写「双栏」读者不知道按下去会变成什么),
    // 也不用「切换」这种两边都指的说法。
    function colsText() {
      var en = lang() === 'en';
      return view.tasksCols ? (en ? 'to 1 column' : '切回单栏') : (en ? 'to 2 columns' : '切到双栏');
    }
    function colsTip() {
      var en = lang() === 'en';
      return view.tasksCols
        ? (en ? 'press to go back to a single column (currently 2 columns)' : '按一下切回单栏显示（当前是双栏）')
        : (en ? 'press to switch to two columns (currently 1 column)' : '按一下切到双栏显示（当前是单栏）');
    }

    // —— 控件提示文案 (2026-09-24 leo:「切换也太模糊」): 每个按钮都给一句「按下去会发生什么」—— 包括**禁用时**
    //    (「已经是最后一页」), 因为"按不动"本身也要有说法。title 给鼠标/长按, aria-label 给读屏 —— 两句同源
    //    (aria-label = 可见文案 + 这句), 屏幕阅读器念出来的名字里**包含可见文字**, 不做两套说法。
    function ctlLabel(key) {
      var en = lang() === 'en';
      if (key === 'prev') return en ? 'Prev' : '上一页';
      if (key === 'next') return en ? 'Next' : '下一页';
      return en ? 'columns' : '分栏';
    }
    function pageTip(dir, toPage, pages) {
      var en = lang() === 'en';
      if (dir === 'prev') {
        return toPage < 1
          ? (en ? 'already on the first page' : '已经是第一页')
          : (en ? 'back to page ' + toPage + ' of ' + pages : '回到第 ' + toPage + ' 页（共 ' + pages + ' 页）');
      }
      return toPage > pages
        ? (en ? 'already on the last page' : '已经是最后一页')
        : (en ? 'forward to page ' + toPage + ' of ' + pages : '翻到第 ' + toPage + ' 页（共 ' + pages + ' 页）');
    }
    function setCtlTip(node, label, tip) {
      if (!node) return;
      node.setAttribute('title', tip);
      node.setAttribute('aria-label', label + ' · ' + tip);
    }

    // 空态只能说「暂未观察到」—— 不显示假 0, 也不写与事实相反的「尚未接入」(入口是接了的)。
    // 快照这次没读到 → 也仍是「暂未观察到」, 只是把「读不到」如实挂在前面 (两种真相不混)。
    function tasksEmptyText() {
      if (lang() === 'en') {
        return view.payload ? 'Empty = none observed' : 'snapshot unreadable — none observed';
      }
      return view.payload ? '暂未观察到' : '快照读不到，暂未观察到';
    }

    // —— 快照生成时间 (唯一来源 = 快照字段 generated_at; 毫秒数 / ISO 字符串都吃, 见 parseAt) ——
    // 三种真相分清楚, 不许混淆:
    //   marked   快照读到了, 而且它自己标了时间  → 绝对时刻 + 相对时间 (相对部分随轮询刷新)
    //   unmarked 快照读到了, 但它没标时间        → 「快照未标注时间」(如实说, 绝不拿 now() 顶)
    //   none     这份快照整份没读到              → 只留占位「—」(不能说「未标注」: 那是对没读到的快照下判断;
    //                                              状态徽章已经写着「快照暂时读不到」)
    function snapTimeKind() {
      if (!view.payload) return 'none';
      return view.snapAt > 0 ? 'marked' : 'unmarked';
    }
    // 徽章右手的年龄短写 (「(3 分钟前)」/「(3 minutes ago)」): 与 meta 行**同一份** view.snapAt, 不另算一套;
    // 缺时间时写「(快照未标注时间)」—— 括号与上面的相对时间同形, 一眼知道这是新鲜度标记
    function snapAgeText() {
      var kind = snapTimeKind();
      if (kind === 'marked') return '(' + relTime(view.snapAt) + ')';
      if (kind === 'unmarked') return '(' + SNAP_TIME_UNKNOWN[lang()] + ')';
      return '';
    }
    // 全部只写 textContent / <time datetime> 属性 —— 不重建节点, 所以轮询刷新时节点身份不变
    function renderSnapTime() {
      var marked = snapTimeKind() === 'marked';
      if (el.snapTime) {
        if (marked) {
          text(el.snapTime, absTime(view.snapAt));
          var iso = isoOf(view.snapAt);
          if (iso && el.snapTime.getAttribute && el.snapTime.getAttribute('datetime') !== iso) {
            el.snapTime.setAttribute('datetime', iso);          // 机器可读的同一时刻 (缺失时不写假值)
          }
        } else {
          text(el.snapTime, snapTimeKind() === 'unmarked' ? SNAP_TIME_UNKNOWN[lang()] : '—');
          if (el.snapTime.removeAttribute) el.snapTime.removeAttribute('datetime');
        }
      }
      if (el.snapAgo) text(el.snapAgo, marked ? '(' + relTime(view.snapAt) + ')' : '');
      if (el.snapAge) text(el.snapAge, snapAgeText());
    }

    function updateRelTimes() {
      renderSnapTime();                     // 绝对 + 相对 + 徽章年龄: 只改文字节点 (纯文本刷新, 无节点重建)
      if (!el.feed) return;
      var nodes = el.feed.querySelectorAll('time[data-at]');
      for (var i = 0; i < nodes.length; i++) text(nodes[i], relTime(Number(nodes[i].getAttribute('data-at'))));
    }

    /**
     * 顶部计数旁的口径短标记 (2026-09-24): 从快照 `totals_scope.fields[*].short` 取**极短**标记,
     * 就地贴在对应数字旁 (data-pulse-scope-tag), 完整口径进 title。
     * 纪律: 快照没给 fields (老快照) → 一个标记都不写 (不自己编口径、不写「未接入」以外的判断);
     *       只写 textContent + title 属性, 不用 innerHTML。
     */
    function renderScopeTags() {
      var tf = view.totalsFields;
      for (var domKey in el.scopeTags) {
        if (!Object.prototype.hasOwnProperty.call(el.scopeTags, domKey)) continue;
        var node = el.scopeTags[domKey];
        var fs = fieldScopeOf(tf, DOMKEY_TO_FIELD[domKey] || domKey);
        text(node, scopeTagText(fs));
        var full = fs ? pickBi(fs.label) : '';
        if (full && node.setAttribute) node.setAttribute('title', full);
        else if (node.removeAttribute) node.removeAttribute('title');
      }
    }

    function redraw() {
      if (!view.payload) return;
      renderScope(); renderActivity(); renderActivityTx(); renderActivityTotals(); renderScopeTags(); renderFeed(); renderNotes(); renderSites(); renderTasks(); renderSnapTime(); updateRelTimes();
    }

    function clearData() {
      view.payload = null; view.snapAt = 0; view.rows = []; view.actSource = ''; view.rawFeed = []; view.notes = []; view.sites = []; view.tasks = []; view.sourceKind = null;
      view.actTotals = null; view.chainScope = null; view.totalsScope = null; view.totalsFields = null;
      view.tasksPage = 0;    // 快照读不到 → 页码归零 (分栏偏好是读者的选择, 保留)
      view.actPage = 0;      // 同上: 活动表页码归零 (没有行可翻时不留着一个越界的页码)
      text(el.nodes, '—'); text(el.agents, '—'); text(el.active, '—'); text(el.h24, '—');
      setOptCount(el.tasks, null); setOptCount(el.tasksCompleted, null); setOptCount(el.tasksVerified, null);
      setOptCount(el.tasksSettled, null);
      setOptCount(el.signatures, null);
      renderScopeTags();
      text(el.snapTime, '—'); text(el.snapAgo, ''); text(el.snapAge, '');
      renderActivity(); renderActivityTx(); renderActivityTotals(); renderFeed(); renderNotes(); renderSites(); renderTasks(); renderScope();
    }

    function applyPayload(payload, state, kind) {
      view.payload = payload;
      view.sourceKind = kind;
      // 时间唯一来源 = 快照字段 generated_at: 毫秒数 / ISO 字符串都吃 (parseAt 是既有的两种兼容解析);
      // 解析不出来就是 0 → 渲染时如实写「快照未标注时间」
      view.snapAt = parseAt(payload.generated_at);
      view.scopeKey = payload.scope === 'verified' ? 'verified' : 'observed';
      view.scopeLabels = payload.scope_label || null;
      // 链上活动: 一行 = 一条已确认的链上任务/交易。task 与 tx 都空 → 这条不画
      // (宁可不显示一行, 也不留空行)。全长地址/哈希在渲染时才短写, DOM 里不留全文。
      // 2026-09-23 追加: tx_hash / explorer_tx (链上索引行才有;
      //   本机 31337 没有公网浏览器 → 快照里就没有 explorer_tx → 交易标签保持纯文本, 不编死链)。
      //   `contract` (escrow 合约地址) 只存在于快照数据里, **页面不读它、不渲染它** —— 合约不上页面。
      var actAll = (Array.isArray(payload.confirmed_activity) ? payload.confirmed_activity : [])
        .map(function (r) {
          if (!r || typeof r !== 'object') return null;
          var task = typeof r.task === 'string' ? r.task.trim() : '';
          var tx = typeof r.tx === 'string' ? r.tx.trim() : '';
          if (!task && !tx) return null;                     // task 与 tx 都空 → 不画
          // 公开链上事实: 形状不对就当作没有 (页面不替数据"修"形状)
          var txHash = (typeof r.tx_hash === 'string' && TXHASH_RE.test(r.tx_hash.trim())) ? r.tx_hash.trim() : '';
          return {
            ref: task || tx,                                 // task 缺失时才退到 tx
            refKind: task ? 'task' : 'tx',
            kind: typeof r.kind === 'string' ? r.kind.trim() : '',
            state: typeof r.state === 'string' ? r.state.trim() : '',
            chainId: num(r.chain_id),
            block: num(r.block),
            confirmations: num(r.confirmations),
            finality: typeof r.finality === 'string' ? r.finality.trim() : '',
            at: parseAt(r.at),
            txHash: txHash,
            // 交易链接只在「这条链有浏览器 + 形状对 + 指的就是这一行的那笔交易」时才成立 (否则空串 → 纯文本)
            explorerTx: pickTxLink(r.explorer_tx, txHash, num(r.chain_id))
          };
        })
        .filter(function (x) { return !!x; })
        .sort(function (a, b) { return (b.at || 0) - (a.at || 0); });  // 新的在上 (没有时间的沉底)
      // 行数上限 (ACTIVITY_MAX) 之外被截掉的行数**如实记账** —— 分页只是换个窗口看同一批, **不算被截掉**;
      // 这两个口径不许混 (页信息写「共 N 行」= 表里真有的行数, 被上限截掉的那部分就地补一句, 不装看不见)。
      view.actRest = Math.max(0, actAll.length - ACTIVITY_MAX);
      view.rows = actAll.slice(0, ACTIVITY_MAX);
      // 数据源: 原样读快照给的字符串, 缺就缺 (渲染时写「快照未标注」, 不替它认来源)
      view.actSource = typeof payload.confirmed_activity_source === 'string'
        ? payload.confirmed_activity_source.trim() : '';
      // 口径行 (与表同源): 只认快照给的 activity_totals / chain_id_scope / totals_scope;
      // 老快照没有 → 保持 null → 该行整行隐藏 (不自己数行数、不自己造网络名)
      var at = payload.activity_totals;
      view.actTotals = (at && typeof at === 'object' && num(at.rows) != null) ? at : null;
      var cis = payload.chain_id_scope;
      view.chainScope = (cis && typeof cis === 'object') ? cis : null;
      var ts = payload.totals_scope;
      view.totalsScope = (ts && typeof ts === 'object') ? ts : null;
      // ★ 逐字段口径 (2026-09-24): 快照没给 (老快照) → null → 页面不写任何口径标记、也不编
      view.totalsFields = (ts && typeof ts === 'object' && ts.fields && typeof ts.fields === 'object') ? ts.fields : null;
      // 活动流: 与 kind 无关 —— 只认服务端 text {zh,en} (新 kind 直用后端文案, 前端不再造一套)。
      // 没有可显示文案的条目直接丢弃: 宁可不显示一行, 也不渲染空白行 / 不臆造描述。
      // 保留原始双语对象, 语言在 renderFeed 时才取 (切语言重画不串语言)。
      view.rawFeed = (Array.isArray(payload.recent_activity) ? payload.recent_activity : [])
        .map(function (it) {
          if (!it || typeof it !== 'object') return null;
          if (!biText(it.text)) return null;
          return { at: num(it.at) || 0, text: it.text };
        })
        .filter(function (x) { return !!x; })
        .slice(0, FEED_LIMIT);
      view.notes = (Array.isArray(payload.notes) ? payload.notes : []).filter(function (n) {
        return typeof n === 'string' && n.trim();
      }).slice(0, 4);
      // agent_sites[] = 本节点**显式发布**的智能体私有站; 可能是空数组, 也可能整个字段没有。
      // ipns 三种形态都归一化; 非法条目直接跳过 (不编造链接), 空数组 → 空列表提示。
      view.sites = (Array.isArray(payload.agent_sites) ? payload.agent_sites : [])
        .map(function (s) {
          if (!s || typeof s !== 'object') return null;
          var cid = BOLLOON_IPNS.parse(s.ipns);
          if (!cid) return null;
          var label = typeof s.label === 'string' ? s.label.trim() : '';
          return { label: label, cid: cid, href: BOLLOON_IPNS.url(cid) };
        })
        .filter(function (x) { return !!x; })
        .slice(0, SITES_MAX);
      // open_tasks[] = 本节点公告板上**未认领且未过期**的公告 (主仓已筛过一遍, 页面不重复猜)。
      // 每个 chip 只取白名单字段 —— instruction / instructionPreview / buyerDid / claims / signature
      // 这些**连读都不读** (不让它们有一条进 DOM 的路)。capability 为空的行不画 (说不出是什么的单)。
      // claimed === true 的行不画:「待接单任务」里出现已认领的单是事实错误 (主仓门也会拒这种快照)。
      // deadline 缺失 → 只是不显示截止, 不编一个时间。
      view.tasks = (Array.isArray(payload.open_tasks) ? payload.open_tasks : [])
        .map(function (t) {
          if (!t || typeof t !== 'object') return null;
          if (t.claimed === true) return null;
          var cap = typeof t.capability === 'string' ? t.capability.trim() : '';
          if (!cap) return null;
          var budget = typeof t.budget === 'string' ? t.budget.trim() : '';
          return {
            capability: cap,
            budget: budget,
            currency: typeof t.currency === 'string' ? t.currency.trim() : '',
            network: typeof t.network === 'string' ? t.network.trim() : '',
            announcementId: typeof t.announcementId === 'string' ? t.announcementId.trim() : '',
            deadline: num(t.deadline) || 0
          };
        })
        .filter(function (x) { return !!x; })
        .sort(function (a, b) { return (a.deadline || 0) - (b.deadline || 0); })   // 快到期在前
        .slice(0, TASKS_MAX);
      var t = payload.totals || {};
      text(el.nodes, fmtCount(t.nodes));
      text(el.agents, fmtCount(t.agents));
      text(el.active, fmtCount(t.active_agents));
      text(el.h24, fmtCount(t.seen_last_24h));
      // ★ 顶部计数三态渲染 (2026-09-24): 「任务/已完成/已结算」= 链上索引同源值 (与下表恒等);
      //   「已验证」在链上索引口径下没有源 → 显示「未接入」而不是 0 (0 会被读成"没有验证过");
      //   「钱包签名」= 本机签名审计账真值; 无源 → 同样「未接入」。每个数旁边贴自己的口径短标记。
      var tf = view.totalsFields;
      setFieldCount(el.tasks, t.tasks, fieldScopeOf(tf, 'tasks'));
      setFieldCount(el.tasksCompleted, t.tasks_completed, fieldScopeOf(tf, 'tasks_completed'));
      setFieldCount(el.tasksSettled, t.tasks_settled, fieldScopeOf(tf, 'tasks_settled'));
      setFieldCount(el.tasksVerified, t.tasks_verified, fieldScopeOf(tf, 'tasks_verified'));
      setFieldCount(el.signatures, t.signatures, fieldScopeOf(tf, 'signatures'));
      renderScopeTags();
      renderSnapTime();
      setState(state);
      renderScope(); renderActivity(); renderActivityTx(); renderActivityTotals(); renderFeed(); renderNotes(); renderSites(); renderTasks(); updateRelTimes();
      if (!relTimer) relTimer = setInterval(function () { try { updateRelTimes(); } catch (e) {} }, REL_TICK_MS);
    }

    function showUnavailable() {
      clearData();
      setState('unavailable');
    }

    function backoffFor(n) { return BACKOFF_MS[Math.min(Math.max(n, 1) - 1, BACKOFF_MS.length - 1)]; }

    function schedule(ms) {
      if (timer) clearTimeout(timer);
      timer = setTimeout(function () { refresh(); }, ms);
    }

    function refresh() {
      if (!started) return null;
      var src = resolveSource();
      if (!src) { failCount++; showUnavailable(); schedule(backoffFor(failCount)); return null; }
      return fetchOnce(src).then(function (payload) {
        var st = classify(payload);
        if (st === 'unavailable') { failCount++; showUnavailable(); schedule(backoffFor(failCount)); return; }
        failCount = 0;
        applyPayload(payload, st, src.kind);
        schedule(POLL_MS);
      }, function () {
        failCount++;
        showUnavailable();               // 失败只影响本实例; 退避后重试
        schedule(backoffFor(failCount));
      });
    }

    // —— 分页 / 分栏的交互 (只在有这套钩子的页面生效; 没有钩子这些节点就是 null) ——
    // 越界不自己做判断: 一律交给 renderTasks 收拢页码 (它拿快照条数算出页数), 免得两处各算一套。
    if (el.tasksPrev) el.tasksPrev.addEventListener('click', function () { view.tasksPage = view.tasksPage - 1; renderTasks(); });
    if (el.tasksNext) el.tasksNext.addEventListener('click', function () { view.tasksPage = view.tasksPage + 1; renderTasks(); });
    // 活动表分页 (2026-09-24): 越界不在这里判断 —— 一律交给 renderActivity 收拢页码 (它拿行数算出页数),
    // 免得两处各算一套 (与任务块同一条纪律)。
    if (el.actPrev) el.actPrev.addEventListener('click', function () { view.actPage = view.actPage - 1; renderActivity(); });
    if (el.actNext) el.actNext.addEventListener('click', function () { view.actPage = view.actPage + 1; renderActivity(); });
    if (el.tasksCols) el.tasksCols.addEventListener('click', function () { view.tasksCols = !view.tasksCols; renderTasks(); });

    api = {
      version: 2,
      root: root,
      key: root.id || root.getAttribute('data-pulse-name') || '',
      state: 'loading',
      config: { pollMs: POLL_MS, timeoutMs: TIMEOUT_MS, backoffMs: BACKOFF_MS.slice(), relTickMs: REL_TICK_MS, feedMax: FEED_LIMIT, activityMax: ACTIVITY_MAX, activityPageSize: ACTIVITY_PAGE_SIZE, tasksMax: TASKS_LIMIT, tasksPageSize: TASKS_PAGE_SIZE },
      refresh: function () { try { return refresh(); } catch (e) { return null; } },
      tick: function () { try { updateRelTimes(); } catch (e) {} },
      redraw: function () { try { redraw(); } catch (e) {} },
      reducedMotion: isReducedMotion,
      source: function () { var s = resolveSource(); return s ? s.kind : null; },
      sites: function () { return view.sites.slice(); },
      tasks: function () { return view.tasks.slice(); },
      rows: function () { return view.rows.slice(); },
      activitySource: function () { return view.actSource; },
      activityTotals: function () { return view.actTotals; },
      failCount: function () { return failCount; },
      applyReducedMotion: function () {
        root.setAttribute('data-reduced-motion', isReducedMotion() ? 'true' : 'false');
      },
      start: function () {
        if (started) return api;
        started = true;
        api.applyReducedMotion();
        try {
          setState('loading');   // 首次: loading → 请求返回后 live / stale / unavailable
          refresh();
        } catch (e) {
          try { showUnavailable(); } catch (e2) { /* noop */ }
        }
        return api;
      }
    };
    return api;
  }

  // —— 挂载一个根 (已经挂过的跳过; 启动失败只把这份标成 unavailable, 不冒泡) ——
  function attach(root) {
    if (!root || root.getAttribute('data-pulse-bound') === 'true') return null;
    var inst = null;
    try {
      root.setAttribute('data-pulse-bound', 'true');
      inst = createInstance(root);
      instances.push(inst);
      inst.start();
    } catch (e) {
      try { root.setAttribute('data-pulse-state', 'unavailable'); } catch (e2) { /* noop */ }
      inst = null;
    }
    return inst;
  }

  for (var i = 0; i < roots.length; i++) {
    try { attach(roots[i]); } catch (e) { /* 一份失败不影响其余实例 */ }
  }

  // —— 对外接口: __bolloonPulse 保持 = 页面第一个实例 (旧断言兼容); __bolloonPulses = 全部实例 ——
  var first = instances[0] || null;
  window.__bolloonPulses = instances;
  window.__bolloonPulse = first;
  if (first) first.attach = attach;
  window.__bolloonPulseAttach = attach;   // 运行时可再挂一个新根 (测试 / 动态插入)

  // 语言切换: applyLang 跑完后重画动态文字（否则会被 data-zh/data-en 覆盖）
  document.addEventListener('bolloon:lang', function () {
    for (var k = 0; k < instances.length; k++) {
      try { instances[k].redraw(); } catch (e) { /* 单份失败不影响其它实例 */ }
    }
  });

  // prefers-reduced-motion: 只标记, 动画本身由 CSS 媒体查询关闭
  try {
    if (typeof window.matchMedia === 'function') {
      var mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      var onMq = function () {
        for (var k = 0; k < instances.length; k++) {
          try { instances[k].applyReducedMotion(); } catch (e) { /* noop */ }
        }
      };
      if (mq.addEventListener) mq.addEventListener('change', onMq);
      else if (mq.addListener) mq.addListener(onMq);
    }
  } catch (e) { /* noop */ }
})();
