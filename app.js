/* Bolloon 安装页 — app.js */
(function () {
  'use strict';
  document.documentElement.classList.add('js');

  // ——— 版本号：优先跟随 npm 包最新版（registry 自带 CORS），失败回退 GitHub release，最后常量 ———
  var VERSION_FALLBACK = '0.4.20';
  var versionEl = document.getElementById('version');
  if (versionEl) {
    versionEl.textContent = VERSION_FALLBACK;
    fetch('https://registry.npmjs.org/@bolloon/bolloon-agent/latest')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (data && data.version) versionEl.textContent = String(data.version);
      })
      .catch(function () {
        return fetch('https://api.github.com/repos/logos-42/bolloon/releases/latest', { headers: { Accept: 'application/vnd.github+json' } })
          .then(function (r) { return r.ok ? r.json() : null; })
          .then(function (d) {
            if (d && d.tag_name) versionEl.textContent = String(d.tag_name).replace(/^v/, '');
          })
          .catch(function () { /* 静默，用回退值 */ });
      });
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

  // ——— 网关：生成隐式 skills HTML（独立可打开的纯 HTML）———
  var genBtn = document.getElementById('generate-btn');
  if (genBtn) {
    var preview = document.getElementById('gen-preview');
    var nameEl = document.getElementById('skill-name');
    var pkEl = document.getElementById('skill-pk');
    var gwEl = document.getElementById('skill-gw');
    var capEl = document.getElementById('skill-capabilities');
    var downloadEl = document.getElementById('download-gen');
    var copyBtn = document.getElementById('copy-gen');
    var openBtn = document.getElementById('open-gen');

    function buildSkillsHtml() {
      var name = (nameEl.value || 'my-agent').trim();
      var pk = (pkEl.value || '').trim();
      var gw = (gwEl.value || 'http://127.0.0.1:8788').trim().replace(/\/$/, '');
      var caps = (capEl.value || '').split(/[\n,，]+/).map(function (s) { return s.trim(); }).filter(Boolean);
      if (!caps.length) caps = ['general'];
      var manifest = { ownerName: name, ownerPublicKey: pk, publishedAt: Date.now(), agents: [{ id: name, name: name, capabilities: caps, status: 'active' }] };
      var json = JSON.stringify(manifest, null, 2);
      var capsHtml = caps.map(function (c) { return '<li><code>' + c + '</code></li>'; }).join('');
      return '<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<title>Agent Skills · ' + name + '</title>\n<style>\nbody{background:#12110f;color:#e8e8dc;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.7;max-width:860px;margin:40px auto;padding:0 24px}\na{color:#c4d640}\nh1{font-weight:600;border-bottom:1px solid #333;padding-bottom:12px}\ncode{background:#1a1a18;border:1px solid #333;border-radius:4px;padding:2px 6px;font-family:ui-monospace,Menlo,monospace}\npre{background:#1a1a18;border:1px solid #333;border-radius:8px;padding:16px;overflow:auto}\nul li{margin:4px 0}\n.label{color:#909088;font-size:12px;text-transform:uppercase;letter-spacing:1px}\n</style>\n</head>\n<body>\n<p class="label">Bolloon · Agent Gateway · Implicit Skills</p>\n<h1>' + name + '</h1>\n<p>此页面为一个加入 Bolloon P2P 网络的 <strong>agent 隐式 skills</strong> 声明。网关/节点读取本页即可发现该 agent 并按能力委派。</p>\n<h2>Manifest</h2>\n<pre>' + json.replace(/</g, '&lt;') + '</pre>\n<h2>Skills / Capabilities</h2>\n<ul>' + capsHtml + '</ul>\n<h2>加入网关</h2>\n<ol>\n<li>登记 manifest：<code>POST ' + gw + '/api/agent/register</code>，body 为上方 manifest。</li>\n<li>查本机：<code>GET ' + gw + '/api/agent/local-manifest</code>。</li>\n<li>建联后发 <code>manifest_request</code>，对端回 <code>manifest_payload</code>。</li>\n<li>被选中：<code>pick(capability)</code> 后接收 <code>agent_delegate</code>。</li>\n</ol>\n<hr>\n<p class="label">gateway: ' + gw + '</p>\n</body>\n</html>';
    }

    genBtn.addEventListener('click', function () {
      var html = buildSkillsHtml();
      preview.textContent = html;
      downloadEl.setAttribute('href', 'data:text/html;charset=utf-8,' + encodeURIComponent(html));
      copyBtn.setAttribute('data-ready', html);
    });

    copyBtn.addEventListener('click', function () {
      var html = copyBtn.getAttribute('data-ready') || buildSkillsHtml();
      var done = function () { copyBtn.textContent = '已复制'; setTimeout(function(){ copyBtn.textContent = '复制'; }, 1500); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(html).then(done);
      else { var ta = document.createElement('textarea'); ta.value = html; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch(e){} document.body.removeChild(ta); done(); }
    });

    openBtn.addEventListener('click', function () {
      var w = window.open('', '_blank');
      if (w) { w.document.write(buildSkillsHtml()); w.document.close(); }
    });
  }
})();
