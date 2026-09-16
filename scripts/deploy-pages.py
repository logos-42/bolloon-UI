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
    for apk in apks:
        print(f"[deploy-pages]   dl/{apk.name}  ({apk.stat().st_size/1048576:.2f} MiB)")
    if not apks:
        print("[deploy-pages]   (dl/ 里没有 apk —— 站点将不带同域镜像)")
    return apks


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-deploy", action="store_true", help="只生成 build-site/")
    args = ap.parse_args()

    mirror()
    if args.no_deploy:
        return 0

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
