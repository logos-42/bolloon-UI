#!/usr/bin/env python3
"""桌面自动更新链路的一键验签门。

为什么需要它: 这条链上有三份东西必须**同时**自洽 ——
  ① `tauri.conf.json` 的 `pubkey`（被编进 App 二进制，客户端真用它验签）
  ② 站点上的 `latest.json`（里面的 `platforms.*.signature`）
  ③ 站点上那个 `Bolloon.app.tar.gz` 的**实际字节**
任一份错位，用户侧表现都是「检出更新 → 下载完成 → 验签失败 → 静默不装」，
而只看「有更新」是看不出来的。本项目已踩过三次（并行重建换掉 tar.gz 而 .sig 留在旧字节、
pubkey 格式写成 key 行、并行会话互相覆盖 updater 私钥）。

用法:
  python3 scripts/verify-update-chain.py                     # 验线上 + 本地工作树那份
  python3 scripts/verify-update-chain.py --no-local          # 只验线上
  python3 scripts/verify-update-chain.py --base https://bolloon.cn/update

退出码: 0 全绿 · 1 有不一致（每条都会说清是哪一环）
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import json
import pathlib
import sys
import urllib.request

UA = {"User-Agent": "Bolloon-UpdateCheck/1.0"}
ROOT = pathlib.Path(__file__).resolve().parents[1]
DEFAULT_CONF = ROOT.parent / "bolloon" / "rust" / "app-tauri" / "src-tauri" / "tauri.conf.json"


def fetch(url: str) -> bytes:
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120).read()


def pubkey_bytes(conf_path: pathlib.Path) -> tuple[bytes, str]:
    """tauri.conf 的 pubkey = base64(minisign 公钥文本)；取其中 `RW…` 行的 42 字节。"""
    conf = json.loads(conf_path.read_text())
    field = conf["plugins"]["updater"]["pubkey"].strip()
    text = field if field.startswith(("untrusted comment", "RW")) else base64.b64decode(field).decode()
    line = [l for l in text.splitlines() if l.startswith("RW")][0]
    raw = base64.b64decode(line)
    if len(raw) != 42:
        raise SystemExit(f"[FAIL] 公钥长度 {len(raw)} != 42（不是 minisign 公钥）")
    return raw, raw[2:10].hex()


def sig_bytes(signature_field: str) -> bytes:
    """manifest 的 signature = base64(minisign 签名文本)；取签名行再解。"""
    text = base64.b64decode(signature_field).decode()
    line = [l for l in text.splitlines() if l.startswith("RUS") or l.startswith("RUQ")][0]
    raw = base64.b64decode(line)
    if len(raw) != 74:
        raise SystemExit(f"[FAIL] 签名长度 {len(raw)} != 74")
    return raw


def verify(conf_path: pathlib.Path, base: str, local_art: pathlib.Path | None, local_sig: pathlib.Path | None) -> int:
    try:
        from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
    except Exception:
        print("[SKIP] 没有 cryptography —— 只做大小/指纹比对，不做密码学验签", file=sys.stderr)
        Ed25519PublicKey = None  # type: ignore

    pub, keyid = pubkey_bytes(conf_path)
    print(f"[1/5] conf 公钥 keyid={keyid} ({conf_path.name})")

    manifest_url = base + "/latest.json"
    manifest = json.loads(fetch(manifest_url))
    plats = manifest.get("platforms") or {}
    if not plats:
        print(f"[FAIL] {manifest_url} 没有任何 platform 条目")
        return 1
    print(f"[2/5] manifest version={manifest.get('version')} 平台={sorted(plats)}")

    rc = 0
    for plat, entry in sorted(plats.items()):
        sig = sig_bytes(entry["signature"])
        if sig[2:10].hex() != keyid:
            print(f"[FAIL] {plat}: 签名 keyid={sig[2:10].hex()} 与 conf 公钥 {keyid} 不同 (客户端会拒装)")
            rc = 1
        body = fetch(entry["url"])
        digest = hashlib.sha256(body).hexdigest()
        print(f"[3/5] {plat}: {len(body)} 字节 sha256={digest[:16]} url={entry['url']}")

        if Ed25519PublicKey is not None:
            digest512 = hashlib.blake2b(body, digest_size=64).digest()
            try:
                Ed25519PublicKey.from_public_bytes(pub[10:]).verify(sig[10:], digest512)
                print(f"[4/5] {plat}: ed25519+blake2b 验签通过")
            except Exception:
                print(f"[FAIL] {plat}: 验签失败 —— 线上产物与 manifest 签名不匹配（不要发布这一版）")
                rc = 1

        # 本地这份是不是线上这份（发布源头一致性）
        if local_art and local_art.exists():
            lb = local_art.read_bytes()
            if lb != body:
                print(f"[FAIL] 本地 {local_art.name} 与线上字节不同（{len(lb)} vs {len(body)}）—— 部署的可能是 target/ 里另一份构建")
                rc = 1
            else:
                print(f"[5/5] 本地 {local_art.name} 与线上逐字节一致")
            if local_sig and local_sig.exists():
                if local_sig.read_text().strip() != entry["signature"]:
                    print("[FAIL] 本地 .sig 与 manifest.signature 不同（只更新了其中一份）")
                    rc = 1
                else:
                    print("      .sig 与 manifest.signature 一致")
        break  # 目前只发一个平台；多平台时逐条看上面输出

    print("OK 链路自洽" if rc == 0 else "FAILED 见上面的具体环节")
    return rc


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="https://bolloon.cn/update", help="update 目录基址")
    ap.add_argument("--conf", default=str(DEFAULT_CONF), help="tauri.conf.json 路径")
    ap.add_argument("--no-local", action="store_true", help="跳过本地产物比对")
    a = ap.parse_args()
    art = None if a.no_local else ROOT / "update" / "macos" / "Bolloon.app.tar.gz"
    sig = None if a.no_local else ROOT / "update" / "macos" / "Bolloon.app.tar.gz.sig"
    return verify(pathlib.Path(a.conf), a.base.rstrip("/"), art, sig)


if __name__ == "__main__":
    sys.exit(main())
