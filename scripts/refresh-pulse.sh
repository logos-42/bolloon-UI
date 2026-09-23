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

echo "[refresh-pulse] $(date '+%F %T') 导出本节点观察……"
cd "$BOLLOON_REPO"
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
echo "[refresh-pulse] 完成 (记得等 20s 再用真域名验收 —— 有传播竞态)"
