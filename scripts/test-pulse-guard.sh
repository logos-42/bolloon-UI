#!/usr/bin/env bash
# test-pulse-guard.sh — 私有字段自检的**对照测试** (2026-09-23)
#
# 为什么要有这个文件: 尺子精确化 (放行 tx_hash / contract / explorer_*) 的时候, 最怕两件事:
#   ① 放松过头 —— 真泄漏 (EOA / DID / multiaddr / peerID / IPNS / 私钥) 被放过去;
#   ② 误伤 —— 合法快照 (真 tx_hash + escrow 合约地址) 被拒部署。
# 所以这里的每一行都是**对照**: 合法夹具必须 PASS, 6 种注入 + 5 种精确化边界必须 REJECT。
# 任何一行不符 → 退出码非 0 (可接进 CI)。
set -uo pipefail
set +e    # 本脚本靠 run_case 读 python 的退出码做判定; 若父 shell 导出 errexit (SHELLOPTS) 会提前自杀 ⇒ 显式关掉

UI_REPO="${UI_REPO:-/Users/apple/Downloads/bolloon-UI}"
SNAP="${SNAP:-$UI_REPO/network-pulse.json}"
GUARD="$UI_REPO/scripts/pulse-privacy-check.py"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

[ -f "$SNAP" ] || { echo "找不到真快照 $SNAP (先跑 scripts/refresh-pulse.sh 导出)" >&2; exit 1; }
[ -f "$GUARD" ] || { echo "找不到尺子 $GUARD" >&2; exit 1; }

echo "[guard-test] 夹具目录 $WORK (临时)"
python3 - "$SNAP" "$WORK" <<'PY'
import json, pathlib, sys
snap = json.loads(pathlib.Path(sys.argv[1]).read_text())
work = pathlib.Path(sys.argv[2])

ESCROW = '0x4e689f98b64ac5b8ea947ac2aa93708cdd30f7ae'   # 真 escrow 合约 (公开事实)
BUYER  = '0xb4e9dCF79055A8232670ebb1c8c664Dff4E70066'   # 买方 EOA —— 永远不许进快照
SELLER = '0x5Ca9fb35D795b436f0EBDddE7f25020C35EA8F9E'   # 卖方 EOA —— 永远不许进快照
TX     = '0xf7ec877665aac51be867831a7b6a573b8cbff2a5b4df3dbf2903a022b37a4165'

def dump(name, mutate):
    d = json.loads(json.dumps(snap))
    mutate(d)
    (work / f'{name}.json').write_text(json.dumps(d, ensure_ascii=False))

def row(d, i=0):
    return d['confirmed_activity'][i]

def put(d, key, value, i=0):
    row(d, i)[key] = value

# —— 合法对照 (必须 PASS) ——
def legit_public(d): pass                                        # 真快照原样
def legit_local(d):                                              # 本机链行: 有事实、无浏览器
    d['confirmed_activity'] = [{
        'task': 'sha256:0b0b0b0b', 'kind': 'task_created', 'state': 'active', 'chain_id': 31337,
        'block': 676, 'tx': 'sha256:11112222', 'confirmations': 1, 'finality': 'observed',
        'at': '2026-09-22T09:51:57Z', 'tx_hash': '0x' + 'c3' * 32, 'contract': ESCROW}]
dump('legit-real', legit_public)
dump('legit-local-chain', legit_local)

# —— 真泄漏 (必须 REJECT) ——
dump('leak-escrow-in-address-key', lambda d: put(d, 'address', ESCROW))
dump('leak-escrow-in-notes', lambda d: d['notes'].append(ESCROW))
dump('leak-seller-eoa-in-kind', lambda d: put(d, 'kind', SELLER))
dump('leak-seller-eoa-in-explorer-url', lambda d: put(d, 'explorer_tx', f'https://basescan.org/tx/{SELLER}'))
dump('leak-buyer-eoa-as-tx-hash', lambda d: put(d, 'tx_hash', BUYER))
dump('leak-did', lambda d: d['notes'].append('did:key:z6MkpTHR8VNsBxYAAWHut2Geadd9jSwuBV8xRoAnwWsdvktH'))
dump('leak-multiaddr', lambda d: d['notes'].append('/ip4/203.0.113.7/tcp/4001/p2p/12D3KooWDpJ7As7BWAwRMfu1VU2WCqNjvq387JEYKDBj4kx6nXTN'))
dump('leak-peerid', lambda d: d['notes'].append('12D3KooWDpJ7As7BWAwRMfu1VU2WCqNjvq387JEYKDBj4kx6nXTN'))
dump('leak-ipns', lambda d: d['notes'].append('k51qzi5uqu5dlvj2baxnqndepeb86cbk3ng7n3i46uzyxzyqj2xjonzllnv0v8'))
dump('leak-privatekey-shape', lambda d: d.update({'wallet': '4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d'}))
dump('leak-64hex-in-address-key', lambda d: put(d, 'address', '0x' + 'ab' * 32))
dump('leak-unknown-host-url', lambda d: put(d, 'explorer_tx', f'https://evil.example/tx/{TX}'))
dump('leak-url-points-elsewhere', lambda d: put(d, 'explorer_tx', 'https://basescan.org/tx/' + '0x' + 'dd' * 32))
dump('leak-local-chain-with-explorer', lambda d: row(d) .update(
    {'chain_id': 31337, 'explorer_tx': f'https://basescan.org/tx/{row(d)["tx_hash"]}',
     'explorer_contract': f'https://basescan.org/address/{ESCROW}'}))
dump('leak-two-different-contracts', lambda d: d['confirmed_activity'].append(
    {**row(d), 'contract': '0x' + '99' * 20}))
# 合约**不上页面** (2026-09-23 收窄): 谁把合约链接塞回来都算泄漏
dump('leak-explorer-contract-key', lambda d: put(d, 'explorer_contract', f'https://basescan.org/address/{ESCROW}'))
dump('leak-address-url-in-notes', lambda d: d['notes'].append(f'托管合约 https://basescan.org/address/{ESCROW}'))
print('夹具已生成:', len(list(work.glob('*.json'))))
PY

PASSED=0
FAILED=0
FAILED_NAMES=''
run_case() { # $1=名字 $2=PASS|REJECT $3=文件
  local name="$1" expect="$2" file="$3" out rc verdict detail mark
  out="$(python3 "$GUARD" "$WORK/$file.json" 2>&1)"; rc=$?
  case "$rc" in
    0) verdict="PASS" ;;
    2) verdict="REJECT" ;;
    *) verdict="ERROR(rc=$rc)" ;;
  esac
  detail="$(printf '%s' "$out" | tr '\n' ' ' | cut -c1-150)"
  if [ "$verdict" = "$expect" ]; then
    mark="✔"; PASSED=$((PASSED + 1))
  else
    mark="✘"; FAILED=$((FAILED + 1)); FAILED_NAMES="$FAILED_NAMES$name | "
  fi
  printf '  %s %-7s %-38s %s\n' "$mark" "$verdict" "$name" "$detail"
}

echo
echo "[guard-test] 对照结果 (期望值 / 实际值):"
run_case '真快照 (真 txHash + escrow 地址)'      PASS   legit-real
run_case '本机链快照 (31337, 无 explorer)'        PASS   legit-local-chain
run_case 'escrow 地址塞进 address 键'             REJECT leak-escrow-in-address-key
run_case 'escrow 地址塞进 notes'                  REJECT leak-escrow-in-notes
run_case '卖方 EOA 塞进 kind'                     REJECT leak-seller-eoa-in-kind
run_case '卖方 EOA 冒充 explorer_tx 的哈希'       REJECT leak-seller-eoa-in-explorer-url
run_case '买方 EOA 冒充 tx_hash'                  REJECT leak-buyer-eoa-as-tx-hash
run_case 'DID 形态'                               REJECT leak-did
run_case 'multiaddr 形态'                         REJECT leak-multiaddr
run_case 'libp2p peerID 形态'                     REJECT leak-peerid
run_case 'IPNS key 形态'                          REJECT leak-ipns
run_case '私钥形态 (64 位裸 hex 在 wallet 键下)'  REJECT leak-privatekey-shape
run_case '64 位 hex 塞进 address 键'              REJECT leak-64hex-in-address-key
run_case 'explorer_tx 指向非白名单域名'           REJECT leak-unknown-host-url
run_case 'explorer_tx 指向别的哈希'               REJECT leak-url-points-elsewhere
run_case '本机链 (31337) 行带 explorer_*'         REJECT leak-local-chain-with-explorer
run_case '同一份快照出现两个不同 contract'        REJECT leak-two-different-contracts
run_case 'explorer_contract 键被塞回来 (合约链接)' REJECT leak-explorer-contract-key
run_case 'notes 里出现 /address/ 合约链接'         REJECT leak-address-url-in-notes

echo
echo "[guard-test] === 合计: $PASSED 通过, $FAILED 不符 ==="
if [ "$FAILED" -gt 0 ]; then
  printf '[guard-test] 不符: %s\n' "$FAILED_NAMES" >&2
  exit 1
fi
exit 0
