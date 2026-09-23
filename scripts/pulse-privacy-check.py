#!/usr/bin/env python3
"""pulse-privacy-check.py — 公开观察快照的私有字段自检 (2026-09-23 精确化)

为什么单独成文件: `refresh-pulse.sh` 部署前必须过这一关, 而这一关的**尺子本身**也要能被
对照测试反复敲 (见 `scripts/test-pulse-guard.sh`)。把尺子放进脚本里, 就没法单独拿夹具喂它。

## 尺子为什么是两把 (而不是「扫到 0x 就拒」)

旧版第一把尺子是**裸子串**扫整份文本 → 撞上合法事件类型名 `wallet_signed` 就把真数据当泄漏。
第二把 (2026-09-22) 是「值里出现 0x 地址形态就拒」→ 撞上**新允许的** `tx_hash` / `contract` /
`explorer_tx` (公开链上事实, 就是「可核验」的前提) 也会把真数据拒掉。

精确化的方向是「只认形状 + 只认键名」, 不是放松:
  · `tx_hash`     : 必须 **小写** `0x` + 64 位十六进制 (交易哈希)
  · `contract`    : 必须 `0x` + 40 位十六进制 (deployment 的 AgentEscrow 合约地址; **只给索引/诊断**)
  · `explorer_tx` : 必须**正好**是已知浏览器的 `https://<host>/tx/0x<64>`, 而且内嵌的哈希必须
                    **与同一行的 tx_hash 逐字相同** (指到别处 = 指到别人的交易, 一样不算可核验)
  · **`explorer_contract` / 任何 `/address/0x…` 链接都不存在** (2026-09-23 leo 拍板: 合约不上页面)
    —— 出现即拒 (白名单里没有这个键, 值里的 0x40 也会被形态尺子抓住)
  · 上面两把之外, **任何位置**出现 0x40 / 0x64 / DID / multiaddr / peerID / IPNS / 裸 64 位十六进制
    → 一律拒绝 (买方/卖方 EOA、taskKey 原文、args 里的地址都归这一档)
  · 认不出的链 (如本机 31337) **不许**带 explorer_tx 字段 —— 没有公网浏览器就没有链接
  · `contract` 若给了, 还要与链索引 (`~/.bolloon/chain/index.json`) 里的合约地址对得上
    (第二份来源的交叉核对; 索引不可读时显式打印「跳过」, 不静默放过)

## 2026-09-23 第二批精确化: `open_tasks[]` (公开「待接单任务」)

快照新增 `open_tasks[]` —— 每行只该有 7 个键 (capability/budget/currency/network/deadline/
claimed/announcementId)。这一块的尺子**只加不减**:
  · 行的**键集必须 ⊆ 那 7 个** —— 多一个键就拒 (真泄漏路径: 有人把 `instruction` / `buyerDid` /
    `claims` 之类展平进行里, 键名黑名单只覆盖了其中一部分)
  · `announcementId` 必须是**前 8 位** (`ann-` + 4 位字母数字); 完整 id (`ann-` + 16 位 hex)
    出现即拒 (`ann-…{16}` 已进 SHAPES —— 它不该出现在公开快照的任何位置)
  · `claimed` 必须是 `false` (本字段只列**未认领**的公告; 出现 true 就是筛选坏了, 页面会把已接
    的单当待接单) · `deadline` 必须是正数 · `capability` 必须非空串 ·
    `budget`/`currency`/`network` 只许字符串或 null
  · 老快照没有 `open_tasks` → **不拒**, 只打一行 note (尺子收紧的是「有新字段时它长什么样」,
    不是「必须有新字段」)

用法:
    python3 scripts/pulse-privacy-check.py [快照路径] [--quiet]
退出码: 0 = 通过; 2 = 拒绝 (发现私有字段/形态); 1 = 用法或读取错误
"""
from __future__ import annotations

import argparse
import json
import pathlib
import re
import sys

# —— 键名黑名单: 这些键名**本身**就是私有语义, 无论值是什么都拒 ——
BAD_KEYS = {"did", "peerid", "peer_id", "multiaddrs", "wallet", "address", "privatekey", "instruction"}

# —— 只放行这两个叶子键 (且值形状必须精确) ——
OK_HEX64_KEYS = {"tx_hash"}
OK_HEX40_KEYS = {"contract"}
OK_URL_KEYS = {"explorer_tx"}

# —— 公网浏览器白名单: chainId → 域名 (与 src/agents/chain/explorer.ts 同一份映射) ——
BROWSER_BY_CHAIN = {8453: "basescan.org", 84532: "sepolia.basescan.org", 1: "etherscan.io", 11155111: "sepolia.etherscan.io"}

# —— 待接单任务行的字段白名单 (与主仓 `OpenTaskRow` 逐字一致) ——
OPEN_TASK_KEYS = {"capability", "budget", "currency", "network", "deadline", "claimed", "announcementId"}
# 公开页只出 announcementId 的**前 8 位** (`ann-` + 4 位字母数字, 因为 id 形如 ann-<16 位 hex>)
OPEN_TASK_ID_SHORT = re.compile(r"^ann-[A-Za-z0-9]{4}$")

HEX40 = re.compile(r"^0x[0-9a-f]{40}$")
HEX64 = re.compile(r"^0x[0-9a-f]{64}$")
URL_TX = re.compile(r"^https://([a-z0-9.-]+)/tx/(0x[0-9a-f]{64})$")

# —— 非白名单位置上「出现即泄漏」的形态 ——
SHAPES = [
    (re.compile(r"/address/0x[0-9a-fA-F]{40}"), "合约地址链接 (/address/) —— 合约不上页面"),
    (re.compile(r"0x[0-9a-fA-F]{40}"), "0x 地址形态"),
    (re.compile(r"0x[0-9a-fA-F]{64}"), "0x 哈希形态"),
    (re.compile(r"did:(key|peer|pkh|web|ethr):"), "DID 形态"),
    (re.compile(r"/(ip4|ip6|dns4|dns6|tcp|udp|p2p)/"), "multiaddr 形态"),
    (re.compile(r"12D3Koo[0-9A-Za-z]{20,}"), "libp2p peerID 形态"),
    (re.compile(r"k51[0-9a-z]{20,}"), "IPNS key 形态"),
    (re.compile(r"^[0-9a-fA-F]{64}$"), "裸 64 位十六进制(疑似私钥)"),
    # 完整公告 id 不该出现在公开快照的任何位置 (公开投影只给前 8 位) —— 2026-09-23 补
    (re.compile(r"ann-[0-9a-f]{16}"), "原始 announcementId 全文(公开投影只出前 8 位)"),
]

CHAIN_INDEX = pathlib.Path.home() / ".bolloon" / "chain" / "index.json"


def load_index_addresses(path: pathlib.Path) -> set[str] | None:
    """链索引里的合约地址集合 (第二份来源)。读不到 → None (调用方显式打印「跳过」)。"""
    try:
        raw = json.loads(path.read_text())
    except Exception:
        return None
    out: set[str] = set()
    entries = raw.get("entries") if isinstance(raw, dict) else None
    if not isinstance(entries, list):
        return None
    for e in entries:
        if isinstance(e, dict) and isinstance(e.get("address"), str):
            out.add(e["address"].lower())
    return out


def check(snap: dict, index_addresses: set[str] | None) -> tuple[list[str], list[str]]:
    hits: list[str] = []
    notes: list[str] = []

    def walk(o, path="", key=None):
        if isinstance(o, dict):
            for k, v in o.items():
                lk = str(k).lower()
                if lk in BAD_KEYS:
                    hits.append(f"键名 {path}.{k} (私有语义键)")
                walk(v, f"{path}.{k}", lk)
        elif isinstance(o, list):
            for i, v in enumerate(o):
                walk(v, f"{path}[{i}]", key)
        elif isinstance(o, str):
            # 白名单键: 只认精确形状 (形状不对也拒 —— 不因为「像」就放行)
            if key in OK_HEX64_KEYS:
                if not HEX64.match(o):
                    hits.append(f"{path} = 交易哈希位不是「小写 0x + 64 位十六进制」")
            elif key in OK_HEX40_KEYS:
                if not HEX40.match(o):
                    hits.append(f"{path} = 合约地址不是「0x + 40 位十六进制」")
            elif key in OK_URL_KEYS:
                if not URL_TX.match(o):
                    hits.append(f"{path} = 不是已知浏览器白名单形状的链接")
            else:
                # 白名单之外: **任何**位置 (含 list 里的裸字符串) 出现这些形态都算泄漏
                for rx, label in SHAPES:
                    if rx.search(o):
                        hits.append(f"{path} = {label}")
                        break

    walk(snap)

    # ① URL 必须指回**同一行**的事实; ② 认不出的链不许有 explorer 字段
    seen_contracts: set[str] = set()
    rows = snap.get("confirmed_activity")
    for i, row in enumerate(rows if isinstance(rows, list) else []):
        if not isinstance(row, dict):
            continue
        rid = f"confirmed_activity[{i}]"
        cid = row.get("chain_id")
        host = BROWSER_BY_CHAIN.get(cid) if isinstance(cid, int) else None
        tx_hash = row.get("tx_hash")
        contract = row.get("contract")
        if isinstance(contract, str):
            seen_contracts.add(contract.lower())
            if not HEX40.match(contract):
                hits.append(f"{rid}.contract = 合约地址不是「0x + 40 位十六进制」")
        if isinstance(tx_hash, str) and not HEX64.match(tx_hash):
            hits.append(f"{rid}.tx_hash = 交易哈希位不是「小写 0x + 64 位十六进制」")
        if "explorer_tx" in row or "explorer_contract" in row:
            if host is None:
                hits.append(f"{rid} = 链 {cid} 没有公网浏览器, 却不许有 explorer_* 字段")
                continue
            u = row.get("explorer_tx")
            if isinstance(u, str):
                m = URL_TX.match(u)
                if not m or m.group(1) != host or m.group(2) != tx_hash:
                    hits.append(f"{rid}.explorer_tx = 必须正好是 https://{host}/tx/<本行 tx_hash>")
            if "explorer_contract" in row:
                hits.append(f"{rid}.explorer_contract = 合约链接这个键不存在 (合约不上页面)")

    if seen_contracts:
        if index_addresses:
            if not seen_contracts <= {a.lower() for a in index_addresses}:
                hits.append(f"contract 与链索引地址对不上: {sorted(seen_contracts - index_addresses)}")
            else:
                notes.append(f"contract 交叉核对通过 (∈ 链索引 {len(index_addresses)} 个地址)")
        else:
            notes.append("contract 交叉核对跳过: 链索引不可读")
        if len(seen_contracts) > 1:
            hits.append(f"contract 出现多个不同取值 (这份快照只该有一个 escrow 合约): {sorted(seen_contracts)}")

    # —— open_tasks[] (公开「待接单任务」): 行的白名单 + 短 id + 事实不变式 (2026-09-23 第二批精确化) ——
    # 这一块**只收紧不放松**: 上面 walk() 的形态尺子照旧扫行里每个字符串 (行不是白名单键),
    # 这里再加「键集/形状/事实」三档 —— 少一档就等于给「展平正文」「原始 id」「已认领当待接单」留门。
    open_tasks = snap.get("open_tasks", None)
    if open_tasks is None:
        notes.append("快照没有 open_tasks 字段 (老快照或未重新导出) —— 不拒, 仅提示")
    elif not isinstance(open_tasks, list):
        hits.append("open_tasks 必须是数组 (没有就给空数组, 不写 null/对象)")
    else:
        for i, row in enumerate(open_tasks):
            rid = f"open_tasks[{i}]"
            if not isinstance(row, dict):
                hits.append(f"{rid} 不是对象")
                continue
            extra = sorted(set(row.keys()) - OPEN_TASK_KEYS)
            if extra:
                hits.append(f"{rid} 出现白名单外的键: {extra} (公开投影只许 {sorted(OPEN_TASK_KEYS)})")
            cap = row.get("capability")
            if not isinstance(cap, str) or not cap.strip():
                hits.append(f"{rid}.capability 缺失/为空")
            aid = row.get("announcementId")
            if not isinstance(aid, str) or not OPEN_TASK_ID_SHORT.match(aid):
                hits.append(f"{rid}.announcementId 必须是 announcementId 的**前 8 位** (ann- + 4 位字母数字), 实得 {aid!r}")
            if row.get("claimed") is not False:
                hits.append(f"{rid}.claimed={row.get('claimed')!r} —— 公开快照只许列**未认领**的公告 (出现 true = 筛选坏了)")
            dl = row.get("deadline")
            if not isinstance(dl, (int, float)) or isinstance(dl, bool) or dl <= 0:
                hits.append(f"{rid}.deadline 必须是正的 ms 时间戳, 实得 {dl!r}")
            for k in ("budget", "currency", "network"):
                if k in row and row[k] is not None and not isinstance(row[k], str):
                    hits.append(f"{rid}.{k} 只许字符串或 null, 实得 {row[k]!r}")
        notes.append(f"open_tasks 行结构核对通过 ({len(open_tasks)} 行, 键白名单 {len(OPEN_TASK_KEYS)} 个)")
    return hits, notes


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("snapshot", nargs="?", default="/Users/apple/Downloads/bolloon-UI/network-pulse.json")
    ap.add_argument("--index", default=str(CHAIN_INDEX), help="链索引 (交叉核对 contract 用)")
    ap.add_argument("--quiet", action="store_true", help="只在失败时打印")
    args = ap.parse_args()

    p = pathlib.Path(args.snapshot)
    try:
        snap = json.loads(p.read_text())
    except Exception as e:  # 读不到 = 用法/环境错误, 不是泄漏
        print(f"[pulse-privacy] 读不了快照 {p}: {e}", file=sys.stderr)
        return 1

    hits, notes = check(snap, load_index_addresses(pathlib.Path(args.index)))
    rows = snap.get("confirmed_activity") or []
    if hits:
        print(f"[pulse-privacy] 拒绝: 快照含私有字段/形态 {sorted(set(hits))[:8]}", file=sys.stderr)
        return 2
    if not args.quiet:
        open_tasks = snap.get("open_tasks", None)
        ot = "字段缺失(老快照)" if open_tasks is None else (f"{len(open_tasks)} 行" if isinstance(open_tasks, list) else "非数组!")
        print(f"[pulse-privacy] 通过: status={snap.get('status')} scope={snap.get('scope')} "
              f"signed={bool(snap.get('signature'))} rows={len(rows)} open_tasks={ot} "
              f"chain_ids={[r.get('chain_id') for r in rows if isinstance(r, dict)][:4]}")
        for n in notes:
            print(f"[pulse-privacy]   {n}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
