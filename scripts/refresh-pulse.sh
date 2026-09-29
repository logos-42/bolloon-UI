#!/usr/bin/env bash
# refresh-pulse.sh — 静态站的「公开观察入口」动态刷新
#
# bolloon.cn 是纯静态站, 没有后端。脉冲区取数顺序 = ① data-pulse-src ② ?pulse=<url>
# ③ 同源 network-pulse.json ④ unavailable。本脚本做第 ③ 档:
#   从**本机真节点**导出签名观察快照 → 放进站点根 → 部署 CF Pages。
#
# 快照自带 fresh_until: 过期后前端**自己降级为 stale**(不伪装实时), 所以刷新周期
# 决定的是"最新到多新", 不决定"是否诚实"。
#
# ⚠️ CF Pages Free 计划有部署次数上限 (500/月)。默认建议 cron 每 2 小时一次 (约 360/月);
#    需要更实时就改周期, 但要盯着配额 —— 或改用 ?pulse= 指向一个公开可达的节点接口。
set -euo pipefail

BOLLOON_REPO="${BOLLOON_REPO:-/Users/apple/Downloads/bolloon}"
UI_REPO="${UI_REPO:-/Users/apple/Downloads/bolloon-UI}"
OUT="$UI_REPO/network-pulse.json"

# 0) 先推进链上索引 —— 否则导出的是**陈旧索引**, 页面会把旧事件当成"最新"
#    (2026-09-23 实测踩过: 索引停在昨日 51640685, 链上已发生 51686160 的交易, 页面永远 3 行旧事件)
echo "[refresh-pulse] $(date '+%F %T') 重扫链上事件 (chain index sync)……"
cd "$BOLLOON_REPO"
SYNC_LOG="$(npx tsx src/cli-entry.ts chain index sync 2>&1 || true)"
printf '%s\n' "$SYNC_LOG" | grep -vE 'no such file|compdef' | tail -6
if printf '%s' "$SYNC_LOG" | grep -q 'INDEX_IDENTITY_CHANGED\|索引身份变了'; then
  echo "[refresh-pulse] ✗ 链索引身份不匹配 (本机 chain.json 指向的链 ≠ 索引里那条链) → 中止: 绝不导出陈旧索引冒充最新" >&2
  echo "  修法: 查 ~/.bolloon/chain.json 是否被本地测试/实验覆盖 (须指向真部署链); **别跑 sync 建议的 rebuild** (会丢弃真索引换成本地链)" >&2
  exit 3
fi

# 0.5) 关注地址集内的 USDC 转账索引 (2026-09-29) —— 「所有交互」的另一半:
#      旧索引只扫 AgentEscrow 合约日志 ⇒ 走**直付**的收款 (买方自己发 USDC 到 payTo) 链上没有任何
#      escrow 事件, 单看合约日志根本看不见。这一步把 token (USDC) 上 to/from ∈ 关注地址集的 Transfer
#      扫进 ~/.bolloon/chain/transfers.json (增量 + 每次回扫最后 32 块; eth_getLogs 单页 ≤2000 块 ——
#      mainnet.base.org 实测超过 2000 就 413)。失败**不静默**: 转账索引读不到 → 快照里那几格写「未接入」。
echo "[refresh-pulse] $(date '+%F %T') 重扫关注地址集内的 USDC 转账 (chain transfers sync)……"
TRANSFER_LOG="$(npx tsx scripts/sync-transfers.ts 2>&1 || true)"
printf '%s\n' "$TRANSFER_LOG" | grep -vE 'no such file|compdef' | tail -3
if ! printf '%s' "$TRANSFER_LOG" | grep -q '^\[transfers\] index='; then
  echo "  ⚠ 转账索引这次没同步成功 —— 快照里「链上转入 / 其中经 x402 流程」会如实写「未接入」(不拿 0 冒充)"
fi

# 0.6) 卖方端点只读汇总 (x402 台账交叉核) —— 链上**没有** x402 事件, 「经 x402 流程」只能靠
#      拿台账里的 txHash 与链上扫到的收款对账。端点/密钥不可达 → 缓存写成 available:false,
#      快照里那一格写「未知 + 原因」(★ 绝不写 0: 0 的意思是"一笔都没有", 那是另一句话)。
echo "[refresh-pulse] $(date '+%F %T') 读卖方端点只读汇总 (x402 ledger)……"
SELLER_LOG="$(npx tsx scripts/x402-seller-summary.ts 2>&1 || true)"
printf '%s\n' "$SELLER_LOG" | grep -E '^\[seller-summary\]' | tail -2

echo "[refresh-pulse] 导出本节点观察……"
npx tsx scripts/export-network-pulse.ts --out "$OUT"

echo "[refresh-pulse] 快照已写入 $OUT ($(wc -c < "$OUT" | tr -d ' ') 字节)"

# 省配额: 观察数据没变就不部署 (CF Pages Free 只有 500 次部署/月)
# 比较**去掉时间字段**的部分 —— 时间在变, 但"观察内容"没变时不该花掉一次部署。
# ★ 2026-09-29: index_scope / x402_ledger 也一并剥掉 —— 它们的头/尾块与取数时刻**每次同步都在变**
#   (last_scanned_block 每轮前进, 就算一条新事件都没有), 不剥掉就会每 30 分钟烧掉一次部署额度。
#   剥掉不等于撒谎: 部署出去的那份快照自己带 generated_at (页面在顶部显示快照时间), 页面上所有
#   数字与「落后多少块」都写明是**导出时刻**的值 —— 读者看到的是一个有明确时刻的快照, 不是"现在"。
if [ -f "$OUT.prev" ]; then
  strip() { python3 -c "
import json,sys
d=json.load(open('$1'))
for k in ('generated_at','fresh_until','published_at','signature','freshness_window_ms','freshness_semantics','index_scope','x402_ledger'):
    d.pop(k,None)
print(json.dumps(d,sort_keys=True))
"; }
  if [ "$(strip "$OUT.prev")" = "$(strip "$OUT")" ]; then
    echo "[refresh-pulse] 观察内容未变 → 跳过部署 (省配额)"
    cp "$OUT" "$OUT.prev"
    exit 0
  fi
fi
cp "$OUT" "$OUT.prev" 
cd "$UI_REPO"

# 部署前自检: 快照里绝不能有私有字段 (2026-09-23 精确化到「键名 + 形状」; 同日收窄)
# 旧版是「值里出现 0x 地址形态就拒」→ 会把**新允许的** tx_hash / contract / explorer_tx (公开链上事实,
# 正是「可核验」的前提) 一起拒掉。精确化 = 只放行这 3 个键 + 精确形状 + 交易链接必须指回本行的哈希,
# 其余任何位置出现 EOA / DID / multiaddr / peerID / IPNS / 私钥形态 / 64 位裸 hex / `/address/` 链接 → 照样拒。
# (contract 只是行里的数据, 供索引/诊断; **页面上不显示合约地址, 也没有合约链接**)
# 尺子本体: scripts/pulse-privacy-check.py;  尺子的对照测试 (合法必须过 · 注入必须拒): scripts/test-pulse-guard.sh
bash "$UI_REPO/scripts/test-pulse-guard.sh"
python3 "$UI_REPO/scripts/pulse-privacy-check.py" "$OUT"

python3 scripts/deploy-pages.py 2>&1 | tail -3

# 4) 唯一对外通道 = CF Pages (bolloon.pages.dev)。备案主机 (阿里云 ECS /var/www/bolloon.cn) **不在验收范围** ——
#    2026-09-24 leo 拍板「bolloon.pages.dev 的更新就行」, 故这里不做第二条 rsync (它的目标/凭据也不该落进仓库)。
#    别再往这个脚本里加第二通道: 一次刷新只认一个「已发布」, 免得又出现「A 通道新、B 通道旧」的假绿。

echo "[refresh-pulse] 完成 (记得等 20s 再用部署域名验收 —— 有传播竞态)"
