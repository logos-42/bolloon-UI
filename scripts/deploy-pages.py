#!/usr/bin/env python3
"""把站点部署到 Cloudflare Pages —— 带同域 APK 镜像。

背景：bolloon.cn 由 Cloudflare Pages（direct-upload 型项目）托管，而 APK 走 GitHub Release
在国内网络会连不上（实测 github.com:443 直接超时），用户下载到的是残包 → 「点开无反应」。
所以站点自己也放一份同域镜像：dl/*.apk 由本脚本一并上传，公网地址
https://bolloon.cn/dl/<file>，与 GitHub Release 互为备份。

用法:
  python3 scripts/deploy-pages.py                 # 镜像仓库 + dl/ 下所有 .apk, 然后 wrangler 部署
  python3 scripts/deploy-pages.py --no-deploy     # 只生成 build-site/ (干跑, 看会传什么)

约定:
  * 源 = 仓库根（与历来 ad_hoc 部署一致, README/docs/scripts 也对外可访问）
  * dl/ 与 build-site/ 都在 .gitignore 里 —— APK **不进 git**，每次发布放一份到 dl/ 即可
  * 单文件上限 25 MiB（CF Pages 硬限制）→ 脚本会提前拦住超限文件
"""
from __future__ import annotations

import argparse
import hashlib
import os
import pathlib
import shutil
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
BUILD = ROOT / "build-site"
DL = ROOT / "dl"
PROJECT = "bolloon"
BRANCH = "main"
ECS_IP = "120.26.82.43"   # 备案主机 (阿里云 ECS, nginx): pay./efficode. 子域与 network-pulse.json 的来源
MAX_FILE = 25 * 1024 * 1024  # CF Pages 单文件硬上限 25 MiB

# 不镜像进站点的东西（部署产物/本地状态/仓库内部）
#   2026-09-16: 加 .kilo —— 它是本地 git worktree 的副本目录（6.1 MB 整站重复），
#   线上本来不需要，且此前每次部署都把它一并传上去（旧部署实测 https://bolloon.cn/.kilo/ = 200）。
EXCLUDE_DIRS = {".git", "build-site", "dl", ".wrangler", "node_modules", ".github", ".claude", ".kilo"}


def mirror() -> list[pathlib.Path]:
    if BUILD.exists():
        shutil.rmtree(BUILD)
    BUILD.mkdir()
    copied = 0
    for item in sorted(ROOT.iterdir()):
        if item.name in EXCLUDE_DIRS:
            continue
        dest = BUILD / item.name
        if item.is_dir():
            shutil.copytree(item, dest, ignore=shutil.ignore_patterns(*EXCLUDE_DIRS))
        else:
            shutil.copy2(item, dest)
        copied += 1

    apks = []
    if DL.exists():
        out = BUILD / "dl"
        out.mkdir()
        for apk in sorted(DL.glob("*.apk")):
            if apk.stat().st_size > MAX_FILE:
                sys.exit(f"[deploy-pages] {apk.name} 超过 CF Pages 单文件上限 25 MiB，拒绝上传")
            shutil.copy2(apk, out / apk.name)
            apks.append(apk)
    print(f"[deploy-pages] mirrored {copied} top-level entries → build-site/")

    # 2026-09-30: bolloon.cn 从备案主机切到 CF Pages 后, 备案主机独有的机器面文件
    #   /network-pulse.json (观察层静态签名快照, 由 ECS 上的节点定期重写) 会丢 —— 站点上那条
    #   同源回退路径就 404。这里在部署时**从 ECS 的 bolloon.cn vhost 拉一份**塞进站点根:
    #   * 迁就 DNS 已经指向 CF 的事实 → 用 curl --resolve 直接打到 ECS, 不走解析;
    #   * 拉不到只打警告、不拦部署 (站点其余部分照旧); 文件是带 fresh_until 的签名快照,
    #     页面本来就按新鲜度判过期, 所以「一份稍旧的快照」比 404 好。
    pulse = fetch_pulse()
    if pulse:
        print(f"[deploy-pages]   network-pulse.json  {pulse.stat().st_size/1024:.1f} KB (取自备案主机)")

    for apk in apks:
        print(f"[deploy-pages]   dl/{apk.name}  ({apk.stat().st_size/1048576:.2f} MiB)")
    if not apks:
        print("[deploy-pages]   (dl/ 里没有 apk —— 站点将不带同域镜像)")
    # 指纹: 让「部署产物陈旧 / 部署没生效」在日志里就能看出来 ——
    # build-site/ 每次都是从仓库根重建 (mirror() 先 rmtree), 所以这里的哈希应当与仓库根逐字一致;
    # 一旦不一致就是拷贝环节出了问题 (而不是线上缓存)。部署后可用同一条 curl 对齐线上文件。
    for rel in ("skill.html", "bolloon-network.md", "bolloon-gateway-join.md", "gateway.html", "app.js", "style.css"):
        p = BUILD / rel
        if p.exists():
            digest = hashlib.sha256(p.read_bytes()).hexdigest()[:16]
            same = (ROOT / rel).exists() and hashlib.sha256((ROOT / rel).read_bytes()).hexdigest()[:16] == digest
            print(f"[deploy-pages]   {rel} sha256:{digest}{'' if same else '  ⚠️ 与仓库根不一致'}")
    return apks


def fetch_pulse() -> pathlib.Path | None:
    """把备案主机 (ECS) 上的 /network-pulse.json 抓一份放进 build-site/ 根。

    为什么用 --resolve: bolloon.cn 的 DNS 已经指到 CF Pages, 而这份快照只在 ECS 的
    bolloon.cn vhost 上 —— 所以绕过解析直接打到 ECS IP (证书仍是 bolloon.cn, 走 https 校验)。
    拉不到就返回 None (只警告, 不拦部署)。
    """
    dst = BUILD / "network-pulse.json"
    url = "https://bolloon.cn/network-pulse.json"
    attempts = [
        ["curl", "-sS", "--resolve", f"bolloon.cn:443:{ECS_IP}", "--max-time", "20", "-o", str(dst), url],
        ["curl", "-sS", "--max-time", "20", "-o", str(dst), url],   # 兜底: DNS 还在 ECS 时也能用
    ]
    for cmd in attempts:
        try:
            r = subprocess.run(cmd, capture_output=True, text=True)
        except OSError as e:
            print(f"[deploy-pages]   ⚠️ network-pulse.json 抓取失败({e}) —— 站点将没有这条同源快照")
            return None
        if r.returncode == 0 and dst.exists() and dst.stat().st_size > 0:
            try:
                if not (dst.read_bytes()[:1] == b"{"):
                    continue
            except OSError:
                continue
            return dst
    if dst.exists():
        dst.unlink()
    print("[deploy-pages]   ⚠️ network-pulse.json 抓不到 (备案主机不可达?) —— 站点将没有这条同源快照")
    return None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-deploy", action="store_true", help="只生成 build-site/")
    ap.add_argument("--allow-no-apk", action="store_true",
                    help="dl/ 为空时也允许部署（默认拒：一次没有 dl/ 的部署会把这个站点的 APK 镜像整个抹掉）")
    args = ap.parse_args()

    apks = mirror()
    if args.no_deploy:
        return 0

    # 2026-09-30 事故: 另一次并行 session 用别的方式部署过一次**不含 dl/** 的站点 → 它成了
    #   canonical 部署 ⇒ 站点主按钮 (bolloon.cn/dl/*.apk) 直接 404、install.html 也回退到旧版。
    #   CF Pages 每次部署都是**整站快照**，所以「没有 dl/」= 把镜像删掉，不是「不改动它」。
    if not apks and not args.allow_no_apk:
        sys.exit("[deploy-pages] 拒绝部署: dl/ 里没有 .apk —— 本次部署会让站点失去同域镜像"
                 "（主按钮 404）。先放一份 APK 进 dl/，或确属有意为之再加 --allow-no-apk。")

    exe = shutil.which("wrangler") or shutil.which("wrangler.cmd")
    if not exe:
        sys.exit("[deploy-pages] 找不到 wrangler（npm i -g wrangler 或加进 PATH）")
    tail = ["pages", "deploy", str(BUILD),
            "--project-name", PROJECT, "--branch", BRANCH, "--commit-dirty=true"]
    # Windows 上 wrangler 是 .cmd 包装脚本, 必须经 cmd.exe 调用
    if exe.lower().endswith((".cmd", ".bat")):
        cmd = [os.environ.get("COMSPEC", "cmd.exe"), "/c", exe, *tail]
    else:
        cmd = [exe, *tail]
    print("[deploy-pages] " + " ".join(cmd))
    return subprocess.call(cmd, cwd=ROOT)


if __name__ == "__main__":
    sys.exit(main())
