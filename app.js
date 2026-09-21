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
    // 动态区域（全球网络脉冲）在此之后重画自己的文字节点, 否则会被上面的 textContent 覆盖
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
   全球网络脉冲 / Network pulse —— 多实例隔离模块
   数据: 公开只读接口 GET /api/public/network/progress (无认证, 15s 缓存 + ETag)
   取数顺序: ① 根元素 data-pulse-src="<url>" ② 地址 ?pulse=<url>
             ③ 同源 network-pulse.json ④ unavailable
   静态站, 访客浏览器到不了站点作者的节点 —— 拿不到就如实降级, 绝不编造数字。

   多实例: 页面上每个 [data-pulse] 根 = 一个独立实例, 各自取数 / 轮询 / 降级。
   区内节点一律靠 data-pulse-* 钩子查找 (不用 id, 不会撞):
     data-pulse-scope · data-pulse-time · data-pulse-ago · data-pulse-hint
     data-pulse-total="nodes|agents|active|24h" · data-pulse-caps · data-pulse-caps-empty
     data-pulse-feed · data-pulse-feed-empty · data-pulse-notes
   可选根属性: data-pulse-feed-max="N" (本实例活动条数上限, 默认 5)
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
  var FEED_MAX = 5;                         // 活动条数上限 (可被 data-pulse-feed-max 覆盖)
  var CAPS_MAX = 8;                         // 能力条数上限

  var instances = [];

  // —— 小工具（全部只写 textContent / 属性, 不碰 innerHTML）——
  function lang() { return document.documentElement.lang === 'en' ? 'en' : 'zh'; }
  function text(node, v) { if (node) node.textContent = v == null ? '' : String(v); }
  function num(v) { return typeof v === 'number' && isFinite(v) ? v : null; }
  function pickBi(bi) {
    if (!bi || typeof bi !== 'object') return '';
    var v = bi[lang()];
    if (typeof v === 'string') return v;
    return typeof bi.zh === 'string' ? bi.zh : '';
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
  function toggleEmpty(node, show) { if (node) node.classList.toggle('is-shown', !!show); }
  function clear(node) { if (node) while (node.firstChild) node.removeChild(node.firstChild); }
  function isReducedMotion() {
    return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  function readLimit(raw, def) {
    var n = parseInt(raw, 10);
    return (isFinite(n) && n > 0 && n <= def) ? n : def;
  }

  // —— 一个实例: 绑定一个 [data-pulse] 根, 全部状态自持 (互不共享) ——
  function createInstance(root) {
    var FEED_LIMIT = readLimit(root.getAttribute('data-pulse-feed-max'), FEED_MAX);
    var el = {
      scope: root.querySelector('[data-pulse-scope]'),
      snapTime: root.querySelector('[data-pulse-time]'),
      snapAgo: root.querySelector('[data-pulse-ago]'),
      nodes: root.querySelector('[data-pulse-total="nodes"]'),
      agents: root.querySelector('[data-pulse-total="agents"]'),
      active: root.querySelector('[data-pulse-total="active"]'),
      h24: root.querySelector('[data-pulse-total="24h"]'),
      caps: root.querySelector('[data-pulse-caps]'),
      capsEmpty: root.querySelector('[data-pulse-caps-empty]'),
      feed: root.querySelector('[data-pulse-feed]'),
      feedEmpty: root.querySelector('[data-pulse-feed-empty]'),
      notes: root.querySelector('[data-pulse-notes]')
    };

    var view = { state: 'loading', payload: null, snapAt: 0, capRows: [], rawFeed: [], notes: [], scopeKey: 'observed', scopeLabels: null, sourceKind: null };
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

    function renderCaps() {
      if (!el.caps) return;
      clear(el.caps);
      var rows = view.capRows, max = 0, i;
      for (i = 0; i < rows.length; i++) if (rows[i].count > max) max = rows[i].count;
      for (i = 0; i < rows.length; i++) {
        var li = document.createElement('li');
        var key = document.createElement('span');
        key.className = 'pulse-cap-key';
        key.textContent = rows[i].key === 'other'
          ? (lang() === 'en' ? 'other (merged)' : '其它（已合并）')
          : rows[i].key;
        var bar = document.createElement('span');
        bar.className = 'pulse-cap-bar';
        var fill = document.createElement('i');
        fill.className = 'pulse-cap-fill';
        fill.style.width = max > 0 ? Math.round(rows[i].count / max * 100) + '%' : '0%';
        bar.appendChild(fill);
        var cnt = document.createElement('span');
        cnt.className = 'pulse-cap-count';
        cnt.textContent = String(rows[i].count);
        li.appendChild(key); li.appendChild(bar); li.appendChild(cnt);
        el.caps.appendChild(li);
      }
      toggleEmpty(el.capsEmpty, rows.length === 0);
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
        s.textContent = pickBi(item.text); // 服务端文本 → 只经 textContent, 严禁 innerHTML
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

    function updateRelTimes() {
      if (el.snapAgo) text(el.snapAgo, view.snapAt ? '(' + relTime(view.snapAt) + ')' : '');
      if (!el.feed) return;
      var nodes = el.feed.querySelectorAll('time[data-at]');
      for (var i = 0; i < nodes.length; i++) text(nodes[i], relTime(Number(nodes[i].getAttribute('data-at'))));
    }

    function redraw() {
      if (!view.payload) return;
      renderScope(); renderCaps(); renderFeed(); renderNotes(); updateRelTimes();
    }

    function clearData() {
      view.payload = null; view.snapAt = 0; view.capRows = []; view.rawFeed = []; view.notes = []; view.sourceKind = null;
      text(el.nodes, '—'); text(el.agents, '—'); text(el.active, '—'); text(el.h24, '—');
      text(el.snapTime, '—'); text(el.snapAgo, '');
      renderCaps(); renderFeed(); renderNotes(); renderScope();
    }

    function applyPayload(payload, state, kind) {
      view.payload = payload;
      view.sourceKind = kind;
      view.snapAt = num(payload.generated_at) || 0;
      view.scopeKey = payload.scope === 'verified' ? 'verified' : 'observed';
      view.scopeLabels = payload.scope_label || null;
      var caps = Array.isArray(payload.capabilities) ? payload.capabilities : [];
      view.capRows = caps.filter(function (c) {
        return c && typeof c.key === 'string' && num(c.count) != null;
      }).map(function (c) { return { key: c.key, count: num(c.count) }; })
        .sort(function (a, b) { return b.count - a.count; })
        .slice(0, CAPS_MAX);
      view.rawFeed = (Array.isArray(payload.recent_activity) ? payload.recent_activity : []).slice(0, FEED_LIMIT);
      view.notes = (Array.isArray(payload.notes) ? payload.notes : []).filter(function (n) {
        return typeof n === 'string' && n.trim();
      }).slice(0, 4);
      var t = payload.totals || {};
      text(el.nodes, fmtCount(t.nodes));
      text(el.agents, fmtCount(t.agents));
      text(el.active, fmtCount(t.active_agents));
      text(el.h24, fmtCount(t.seen_last_24h));
      text(el.snapTime, absTime(view.snapAt));
      setState(state);
      renderScope(); renderCaps(); renderFeed(); renderNotes(); updateRelTimes();
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

    api = {
      version: 2,
      root: root,
      key: root.id || root.getAttribute('data-pulse-name') || '',
      state: 'loading',
      config: { pollMs: POLL_MS, timeoutMs: TIMEOUT_MS, backoffMs: BACKOFF_MS.slice(), relTickMs: REL_TICK_MS, feedMax: FEED_LIMIT, capsMax: CAPS_MAX },
      refresh: function () { try { return refresh(); } catch (e) { return null; } },
      tick: function () { try { updateRelTimes(); } catch (e) {} },
      redraw: function () { try { redraw(); } catch (e) {} },
      reducedMotion: isReducedMotion,
      source: function () { var s = resolveSource(); return s ? s.kind : null; },
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
