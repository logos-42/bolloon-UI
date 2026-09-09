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

  // ——— 网关：引导 skills（标准 SKILL.md，复制给 agent 可识别）———
  var genBtn = document.getElementById('generate-btn');
  if (genBtn) {
    var out = document.getElementById('skill-capabilities');
    var nameEl = document.getElementById('skill-name');
    var pkEl = document.getElementById('skill-pk');
    var gwEl = document.getElementById('skill-gw');
    var copyBtn = document.getElementById('copy-gen');

    function buildSkill() {
      var name = (nameEl.value || 'my-agent').trim();
      var pk = (pkEl.value || '').trim();
      var gw = (gwEl.value || 'http://127.0.0.1:8788').trim().replace(/\/$/, '');
      var caps = ['gateway-join', 'agent-manifest', 'p2p-delegate'];
      var manifest = { ownerName: name, ownerPublicKey: pk, publishedAt: Date.now(), agents: [{ id: name, name: name, capabilities: caps, status: 'active' }] };
      var json = JSON.stringify(manifest, null, 2);
      return [
        '---',
        'name: bolloon-gateway-join',
        'description: 将本 agent 加入 Bolloon P2P 网关：声明 manifest、POST /api/agent/register 登记、建联互换 manifest_request→manifest_payload、按 capability 被 pick→agent_delegate 委派。',
        'capabilities: [' + caps.join(', ') + ']',
        'version: 1.0.0',
        '---',
        '',
        '# Bolloon Agent · 加入网关',
        '',
        '把此 skill 粘贴给任意支持 SKILL.md frontmatter 的 agent，它即可识别并据此加入网络。',
        '',
        '## 身份',
        '- ownerName: ' + name,
        '- ownerPublicKey: ' + pk,
        '',
        '## Manifest（登记时 POST）',
        '```json',
        json,
        '```',
        '',
        '## 加入步骤',
        '1. 登记：POST ' + gw + '/api/agent/register，body 为上方 manifest。',
        '2. 自检：GET ' + gw + '/api/agent/local-manifest。',
        '3. 建联：建联后发 manifest_request，对端回 manifest_payload，写入本地 registry。',
        '4. 被委派：pick(capability) → agent_delegate(capability, instruction) → agent_response。'
      ].join('\n');
    }

    if (out) out.value = buildSkill();

    genBtn.addEventListener('click', function () { if (out) out.value = buildSkill(); });

    copyBtn.addEventListener('click', function () {
      var text = (out && out.value) || buildSkill();
      var done = function () { copyBtn.textContent = '已复制'; setTimeout(function(){ copyBtn.textContent = copyBtn.getAttribute('data-zh') || '复制 skills'; }, 1500); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done);
      else { var ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch(e){} document.body.removeChild(ta); done(); }
    });

    // 在新网页渲染该引导 skills（HTML 版）
    var viewBtn = document.getElementById('view-gen');
    if (viewBtn) {
      function buildSkillHtml() {
        var name = (nameEl.value || 'my-agent').trim();
        var pk = (pkEl.value || '').trim();
        var gw = (gwEl.value || 'http://127.0.0.1:8788').trim().replace(/\/$/, '');
        var caps = ['gateway-join', 'agent-manifest', 'p2p-delegate'];
        var manifest = { ownerName: name, ownerPublicKey: pk, publishedAt: Date.now(), agents: [{ id: name, name: name, capabilities: caps, status: 'active' }] };
        var json = JSON.stringify(manifest, null, 2);
        var capsHtml = caps.map(function (c) { return '<span class="cap">' + c + '</span>'; }).join('');
        return '<!DOCTYPE html>\n<html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">' +
          '<title>Agent Skill · ' + name + '</title>' +
          '<style>body{background:#12110f;color:#e8e8dc;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.7;max-width:820px;margin:44px auto;padding:0 26px}a{color:#c4d640}h1{font-weight:600;border-bottom:1px solid #333;padding-bottom:14px}h2{border-left:3px solid #c4d640;padding-left:12px;margin-top:34px}code,pre{font-family:ui-monospace,Menlo,monospace}code{background:#1a1a18;border:1px solid #333;border-radius:4px;padding:2px 6px}pre{background:#1a1a18;border:1px solid #333;border-radius:8px;padding:16px;overflow:auto}.cap{display:inline-block;background:#1a1a18;border:1px solid #333;border-radius:12px;padding:4px 12px;margin:4px 6px 4px 0;color:#c4d640;font-family:ui-monospace,Menlo,monospace;font-size:13px}.lbl{color:#909088;font-size:12px;text-transform:uppercase;letter-spacing:1px}li{margin:6px 0}</style>' +
          '</head><body>' +
          '<p class="lbl">Bolloon · Agent Gateway · Guidance Skill</p>' +
          '<h1>' + name + '</h1>' +
          '<p>这是一份标准 <strong>SKILL.md</strong> 引导 skills。把下方内容粘贴/交付给任意支持 SKILL.md frontmatter 的 agent，它即可识别并据此加入 Bolloon 网络。</p>' +
          '<h2>Capabilities</h2><p>' + capsHtml + '</p>' +
          '<h2>Manifest</h2><pre>' + json.replace(/</g, '&lt;') + '</pre>' +
          '<h2>身份</h2><ul><li>ownerName: <code>' + name + '</code></li><li>ownerPublicKey: <code>' + pk + '</code></li></ul>' +
          '<h2>加入步骤</h2><ol>' +
          '<li>登记：<code>POST ' + gw + '/api/agent/register</code>，body 为上方 manifest。</li>' +
          '<li>自检：<code>GET ' + gw + '/api/agent/local-manifest</code>。</li>' +
          '<li>建联：发 <code>manifest_request</code>，对端回 <code>manifest_payload</code>。</li>' +
          '<li>被委派：<code>pick(capability)</code> → <code>agent_delegate</code> → <code>agent_response</code>。</li>' +
          '</ol>' +
          '<hr><p class="lbl">gateway: ' + gw + '</p></body></html>';
      }
      viewBtn.addEventListener('click', function () {
        var w = window.open('', '_blank');
        if (w) { w.document.write(buildSkillHtml()); w.document.close(); }
      });
    }
  }
})();
