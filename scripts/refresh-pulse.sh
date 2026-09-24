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

echo "[refresh-pulse] 导出本节点观察……"
npx tsx scripts/export-network-pulse.ts --out "$OUT"

echo "[refresh-pulse] 快照已写入 $OUT ($(wc -c < "$OUT" | tr -d ' ') 字节)"

# 省配额: 观察数据没变就不部署 (CF Pages Free 只有 500 次部署/月)
# 比较**去掉时间字段**的部分 —— 时间在变, 但"观察内容"没变时不该花掉一次部署。
if [ -f "$OUT.prev" ]; then
  strip() { python3 -c "
import json,sys
d=json.load(open('$1'))
for k in ('generated_at','fresh_until','published_at','signature','freshness_window_ms','freshness_semantics'):
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
