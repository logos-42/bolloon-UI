#!/usr/bin/env python3
"""生成 bolloon.cn 隐私政策页 (privacy.html) — 中英双语 (data-zh/data-en, 复用站点 applyLang 机制)

为什么用生成器: 隐私政策文本必须与 App 内摘要 + 应用市场表单三处一致, 单一来源(本文件)可复跑,
改文案只改这里 → python3 scripts/gen-privacy-page.py。生成物是纯静态 HTML, 无构建依赖。

事实依据 (2026-09-16 核对代码后写的, 不许写没有的事):
  · 无账号体系: 身份是本机生成的 DID (did:blln:…), 存在本机 IndexedDB
  · 无统计/崩溃上报 SDK: 依赖清单(64 个)与源码里无 sentry/analytics/ads/firebase
  · 权限见 android/app/src/main/AndroidManifest.xml: 蓝牙扫描(neverForLocation)/蓝牙连接/位置(maxSdkVersion=30)/网络
  · 相机由系统相机 App 完成, 本应用不申请 CAMERA 权限 (manifest 只声明 <queries> IMAGE_CAPTURE)
  · 无障碍服务 + Shizuku 仅官网直装版包含, 商店版 flavor 会移除
  · 站点/包分发走 Cloudflare + GitHub, 版本号查询走 npm registry, 网页字体走 Google Fonts → 均为境外服务, 须披露
"""
import os, html, re, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "privacy.html"
EFFECTIVE = "2026-09-16"
CONTACT = "yuanjieliu65@gmail.com"

# ── 内容 (zh, en 成对) ────────────────────────────────────────────────
H2 = lambda zh, en: ("h2", zh, en)
P = lambda zh, en: ("p", zh, en)
UL = lambda items: ("ul", items, None)
TABLE = lambda head, rows: ("table", head, rows)


def cell(zh, en):
    return f'<span data-zh="{html.escape(zh, quote=True)}" data-en="{html.escape(en, quote=True)}">{html.escape(zh)}</span>'


TITLE_ZH = "隐私政策"
TITLE_EN = "Privacy Policy"
LEDE = P(
    f"本政策说明 Bolloon（下称「本应用」）如何处理你的信息。生效日期 {EFFECTIVE}。"
    "一句话版本：<strong>Bolloon 是本地优先的，我们没有账号体系，不要求手机号或邮箱，"
    "你的智能体、会话与消息默认只存在你自己的设备上；我们不收集、不出售你的个人信息。</strong>",
    f"This policy explains how Bolloon (the Application) handles your information. Effective {EFFECTIVE}. "
    "In one line: <strong>Bolloon is local-first. There is no account system, no phone number or email is required, "
    "and your agents, sessions and messages live on your own device. We do not collect or sell your personal information.</strong>",
)

SECTIONS = [
    (H2("一、适用范围", "1. Scope"),
     [P("本政策适用于 Android / iOS 应用 Bolloon（Android 包名 com.hibs.bolloon；iOS Bundle ID com.hibs.bolloon）"
        "以及网站 bolloon.cn。本应用是开源软件（MIT 许可），你可以自行审阅全部源代码。",
        "This policy covers the Bolloon applications for Android (package name com.hibs.bolloon) and iOS "
        "(Bundle ID com.hibs.bolloon), and the website bolloon.cn. Bolloon is open source (MIT), so you can audit the code yourself.")]),

    (H2("二、我们收集与不收集什么", "2. What we do and do not collect"),
     [P("我们不要求你注册账号，不收集手机号、邮箱、通讯录、短信、通话记录、精确定位、"
        "设备唯一标识（IMEI / MAC / 广告标识）或应用使用行为统计。本应用不集成任何广告、行为统计或崩溃上报 SDK。",
        "We require no account. We do not collect phone numbers, email addresses, contacts, SMS, call logs, "
        "precise location, device identifiers (IMEI / MAC / advertising ID), or usage analytics. The Application ships no "
        "advertising, analytics or crash-reporting SDK."),
      P("以下数据在你的设备上产生并保存，用于让功能可用：",
        "The following data is created and stored on your device so that features work:"),
      TABLE(["数据类型 / Data", "是否离开设备 / Leaves device", "存放位置 / Stored", "用途 / Purpose", "保存期限 / Retention"],
            [["本机身份标识 DID 与密钥对 / Local identity DID and key pair",
              "P2P 网络中向对端公开（DID 与公钥） / Published to peers as DID + public key",
              "本机 / On device", "标识与验证你在网络中的身份 / Identity in the network",
              "直到你在设置中清除本机数据 / Until you clear local data"],
             ["智能体配置、会话与消息内容 / Agents, sessions, messages",
              "仅在你自己发起的 P2P 会话中传给对端 / Only to peers you talk to",
              "本机 / On device", "核心功能 / Core functionality", "同上 / Same"],
             ["好友与已知节点列表 / Friends and known peers",
              "随 P2P 握手 / During P2P handshake", "本机 / On device", "建立与维护连接 / Connectivity", "同上 / Same"],
             ["钱包与微支付账本 / Wallet and payment ledger",
              "若你启用链上支付，交易记录上链且公开 / Public on-chain if you enable payments",
              "本机 + 链上 / On device + chain", "微支付结算 / Settlement", "链上记录不可删除 / On-chain records are immutable"],
             ["蓝牙与网络状态 / Bluetooth and network state",
              "否 / No", "运行时使用，不落盘 / Used at runtime, not persisted",
              "附近设备发现与 P2P 连接 / Nearby discovery and P2P", "不保存 / Not stored"]]),
      P("如果你在应用里填写了自有的大模型 API Key（例如 DeepSeek、OpenAI 等），该 Key 与本应用的对话内容会由"
        "你的设备<strong>直接</strong>发往你选定的服务商，我们不经手、不中转、不保存。请同时阅读该服务商的隐私政策。",
        "If you configure your own LLM API key (for example DeepSeek or OpenAI), the key and your conversations are sent "
        "<strong>directly</strong> from your device to the provider you choose. We never proxy or store them. Please also read that provider's policy.")]),

    (H2("三、系统权限与用途", "3. Permissions and their purpose"),
     [TABLE(["权限 / Permission", "用途 / Purpose", "说明 / Notes"],
            [["蓝牙扫描与连接 / BLUETOOTH_SCAN, BLUETOOTH_CONNECT",
              "发现并连接附近的设备与好友 / Discover and connect nearby devices and friends",
              "已声明 neverForLocation，不用于推断位置 / Declared with neverForLocation"],
             ["位置 / ACCESS_FINE_LOCATION, ACCESS_COARSE_LOCATION",
              "仅 Android 11 及以下：系统要求蓝牙扫描需位置权限 / Android 11 and below only: the OS requires it for BLE scanning",
              "已限制 maxSdkVersion=30；Android 12+ 不再申请 / Capped at maxSdkVersion=30; not requested on Android 12+"],
             ["网络 / INTERNET, ACCESS_NETWORK_STATE", "P2P 连接与下载 / P2P connectivity and downloads", "—"],
             ["相机 / Camera", "扫码与拍摄头像 / QR scanning and avatars",
              "调用系统相机应用完成，本应用不申请 CAMERA 权限 / Uses the system camera app; no CAMERA permission is declared"],
             ["无障碍服务与 Shizuku / Accessibility service and Shizuku",
              "「智能体控制」：在你授权下让智能体操作本机界面与系统 API / Agent control of the device UI and system APIs, only with your authorization",
              "<strong>仅官网直装版本包含</strong>，需你在系统设置中显式开启，可随时关闭；应用商店版本不包含 / Included in the direct-download build only; never enabled by default; removed from app-store builds"]]),
      P("敏感权限都是按需申请：你拒绝某项权限后应用不会因此退出，只是对应功能不可用。",
        "Every sensitive permission is requested on demand. Declining a permission never force-closes the app; only that feature becomes unavailable.")]),

    (H2("四、第三方服务清单", "4. Third-party services"),
     [P("除下列服务外，本应用不向任何第三方传输你的信息。",
        "Apart from the services listed below, the Application sends your information to no third party."),
      TABLE(["服务 / Service", "用途 / Purpose", "可能涉及的数据 / Possible data", "是否出境 / Cross-border"],
            [["你自选的大模型服务商 / Your chosen LLM provider", "生成回复 / Generating replies",
              "你主动输入的对话内容与 API Key / Prompts you send and your API key", "取决于你的选择 / Depends on your choice"],
             ["Cloudflare", "网站与安装包托管、防护 / Website and package hosting",
              "访问日志（IP、User-Agent）/ Access logs (IP, User-Agent)", "是 / Yes"],
             ["GitHub", "安装包与版本信息 / Release assets and version info", "下载请求日志 / Download request logs", "是 / Yes"],
             ["npm registry", "读取最新版本号 / Latest version number", "请求 IP / Request IP", "是 / Yes"],
             ["Google Fonts", "网页字体（仅网站）/ Web fonts (website only)", "请求 IP / Request IP", "是 / Yes"],
             ["IPFS / Kubo", "你主动发布技能包时 / When you publish a skill package", "你发布的内容 / Content you publish", "分布式 / Distributed"],
             ["x402 结算与 EVM 链", "你启用微支付时 / When you enable payments", "链上交易记录（公开）/ Public on-chain transactions", "是 / Yes"]]),
      P("另外，你自己设备上的 DNS 解析与移动网络由你的运营商处理，这部分不在我们的控制范围内。",
        "DNS resolution and mobile connectivity on your device are handled by your carrier and DNS provider, outside our control.")]),

    (H2("五、未成年人", "5. Minors"),
     [P("本应用不面向 14 周岁以下儿童，我们不会主动收集儿童的个人信息。若你是未成年人，请在监护人指导下使用。",
        "The Application is not directed at children under 14, and we do not knowingly collect their personal information. Minors should use it under guardian guidance.")]),

    (H2("六、你的权利与注销路径", "6. Your rights and account deletion"),
     [P("因为在我们的服务器上没有你的个人信息，你对自己的数据有完整的即时控制权：",
        "Because we hold no personal information about you on our servers, you have immediate and complete control:"),
      UL([("查看：应用内「我 → 设置」可查看本机数据量（智能体 / 会话 / 消息）。",
           "Access: In the app, go to Me → Settings to see how much data is stored locally."),
          ("更正：智能体名称、头像、判断力配置都可随时在应用内修改。",
           "Rectify: agent names, avatars and judgement settings can be edited anytime."),
          ("删除 / 注销：应用内「我 → 设置 → 清除本机数据（注销）」会删除本机的身份标识（DID）、"
           "智能体、会话消息与钱包账本，<strong>即时生效</strong>；如遇异常，我们的处理时限为最长 7 个工作日。",
           "Delete / de-register: Me → Settings → Clear local data (de-register) removes your on-device identity (DID), agents, "
           "messages and wallet ledger. It takes effect <strong>immediately</strong>; in exceptional cases, within 7 business days."),
          ("卸载应用同样会移除本机保存的数据。已经写入公开区块链的交易记录我们无权删除，这一点任何服务方都无法更改。",
           "Uninstalling also removes locally stored data. Transactions already written to a public blockchain cannot be deleted by us or anyone else.")]),
      P(f"如你对本政策或个人信息处理有疑问，可发邮件至 <strong>{CONTACT}</strong>，我们会在 7 个工作日内答复。",
        f"Questions about this policy or your data? Email <strong>{CONTACT}</strong>; we reply within 7 business days.")]),

    (H2("七、政策更新", "7. Changes to this policy"),
     [P("本政策如有更新，我们会修改本页顶部的生效日期；涉及收集范围扩大的变更会在应用内以弹窗方式重新征求你的同意。",
        "We will update the effective date above when this policy changes. If a change expands what we collect, we will ask for your consent again in-app.")]),
]


def render_bilingual(blocks):
    out = []
    for blk in blocks:
        kind = blk[0]
        if kind == "h2":
            out.append(f'  <h2 class="doc-h2">{cell(blk[1], blk[2])}</h2>')
        elif kind == "p":
            out.append(f'  <p class="doc-body">{cell(blk[1], blk[2])}</p>')
        elif kind == "ul":
            out.append('  <ul class="doc-list">')
            for zh, en in blk[1]:
                out.append(f'    <li>{cell(zh, en)}</li>')
            out.append('  </ul>')
        elif kind == "table":
            head, rows = blk[1], blk[2]
            out.append('  <div class="doc-table-wrap">')
            out.append('  <table class="doc-table">')
            out.append('    <thead><tr>' + "".join(f'<th>{html.escape(h)}</th>' for h in head) + '</tr></thead>')
            out.append('    <tbody>')
            for r in rows:
                out.append('      <tr>' + "".join(f'<td>{html.escape(c)}</td>' for c in r) + '</tr>')
            out.append('    </tbody>')
            out.append('  </table>')
            out.append('  </div>')
    return "\n".join(out)


NAV_TEMPLATE = """<div class="topnav">
  <header class="masthead">
    <a class="brand" href="index.html" aria-label="Bolloon 首页">
      <span class="brand-mark" aria-hidden="true">◍</span>
      <span class="brand-word">bolloon</span>
    </a>
    <nav class="mast-links" aria-label="主导航">
      <div class="nav-item"><a href="index.html" data-zh="产品" data-en="Product">产品</a></div>
      <div class="nav-item"><a href="install.html" data-zh="安装" data-en="Install">安装</a></div>
      <div class="nav-item"><a href="docs.html" data-zh="文档" data-en="Docs">文档</a></div>
      <div class="nav-item"><a href="hibs.html" data-zh="Hibs" data-en="Hibs">Hibs</a></div>
      <div class="nav-item"><a href="gateway.html" data-zh="网关" data-en="Gateway">网关</a></div>
      <div class="lang-toggle" role="group" aria-label="语言">
        <button type="button" data-lang="zh" class="is-active">中</button>
        <button type="button" data-lang="en">EN</button>
      </div>
    </nav>
  </header>
</div>
"""


def build():
    sections_html = []
    for head, blocks in SECTIONS:
        sections_html.append(f'<div class="doc-block">\n  <h2 class="doc-h2">{cell(head[1], head[2])}</h2>')
        sections_html.append(render_bilingual(blocks))
        sections_html.append('</div>')
    body = "\n".join(render_bilingual([LEDE]))
    page = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>隐私政策 — bolloon</title>
<meta name="description" content="Bolloon 隐私政策：本地优先、无账号体系、不收集个人信息。P2P / DID / 本地存储的数据处理说明。">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Noto+Sans+SC:wght@300;400;500&family=Noto+Serif+SC:wght@300;400;600&display=swap" rel="stylesheet">
<link rel="icon" href="icons/favicon.ico" sizes="32x32">
<link rel="icon" type="image/png" href="icons/favicon-32x32.png" sizes="32x32">
<link rel="icon" type="image/png" href="icons/favicon-192x192.png" sizes="192x192">
<link rel="icon" type="image/png" href="icons/favicon-512x512.png" sizes="512x512">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<link rel="stylesheet" href="style.css?v=15">
</head>
<body data-page="privacy">

{NAV_TEMPLATE}
<main>
  <section class="section-head">
    <h1 class="section-title" data-zh="{TITLE_ZH}" data-en="{TITLE_EN}">{TITLE_ZH}</h1>
    <p class="section-lede" data-zh="生效日期 {EFFECTIVE}" data-en="Effective {EFFECTIVE}">生效日期 {EFFECTIVE}</p>
  </section>

  <section class="doc intro-doc">
{body}
  </section>

{chr(10).join(sections_html)}

  <section class="doc">
    <p class="doc-body" data-zh="本页同时是应用市场（华为等）隐私政策链接的落地页；应用内「设置 → 隐私政策」展示同一份内容的摘要，完整版以本页为准。"
      data-en="This page is the landing page linked from app-store listings (Huawei AppGallery etc.). In-app Settings → Privacy Policy shows a summary of the same content; this page is the authoritative version.">
      本页同时是应用市场（华为等）隐私政策链接的落地页；应用内「设置 → 隐私政策」展示同一份内容的摘要，完整版以本页为准。
    </p>
  </section>
</main>

<footer class="foot">
  <span>© <span id="year">2026</span> bolloon</span>
  <span class="foot-sep">·</span>
  <a class="foot-link" href="privacy.html" data-zh="隐私政策" data-en="Privacy Policy">隐私政策</a>
  <span class="foot-sep">·</span>
  <span>MIT License</span>
  <!-- 备案完成后在页脚公示（工信部要求，链接 beian.miit.gov.cn）：
       <span class="foot-sep">·</span><a class="foot-link" href="https://beian.miit.gov.cn/" target="_blank" rel="noopener">浙ICP备XXXXXXXX号-X</a>
       <span class="foot-sep">·</span><span>APP 备案号 XXXXXXXXXX</span> -->
  <span class="foot-right" data-zh="◍ 由节点与节点相连" data-en="◍ Connected node to node">◍ 由节点与节点相连</span>
</footer>

<script src="app.js?v=15"></script>
</body>
</html>
"""
    OUT.write_text(page, encoding="utf-8")
    n_zh = len(re.findall(r'data-zh=', page))
    print(f"写出 {OUT.relative_to(ROOT)} ({OUT.stat().st_size:,} B) | data-zh 段落 {n_zh} | 章节 {len(SECTIONS)} | 生效 {EFFECTIVE}")


if __name__ == "__main__":
    build()
