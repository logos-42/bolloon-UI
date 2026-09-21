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

# 部署前自检: 快照里绝不能有私有字段
python3 - <<'PY'
import json, sys, pathlib
p = pathlib.Path('/Users/apple/Downloads/bolloon-UI/network-pulse.json')
snap = json.loads(p.read_text())
bad = ['did', 'peerId', 'peer_id', 'multiaddrs', 'wallet', 'address', 'privateKey', 'instruction']
raw = p.read_text().lower()
hits = [k for k in bad if k.lower() in raw]
if hits:
    print(f'[refresh-pulse] 拒绝部署: 快照含私有字段 {hits}', file=sys.stderr)
    sys.exit(2)
print(f"[refresh-pulse] 自检通过: status={snap.get('status')} scope={snap.get('scope')} "
      f"signed={bool(snap.get('signature'))} totals={snap.get('totals')}")
PY

python3 scripts/deploy-pages.py 2>&1 | tail -3
echo "[refresh-pulse] 完成 (记得等 20s 再用真域名验收 —— 有传播竞态)"
