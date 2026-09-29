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
OPEN_OK = {'capability': 'code-review', 'budget': '1000', 'currency': 'USDC', 'network': 'base-sepolia',
           'deadline': 1790248756240, 'claimed': False, 'announcementId': 'ann-80c5'}

# —— 付款方智能体身份 (payer_identity, 2026-09-29): 「链下登记」短写 ——
# 合法夹具 = 真导出快照里那两个付款行长的样子 (已验签 → 只出短写), 必须 PASS;
# 注入档 = 想在这条窄路上偷放东西的六种写法, 必须 REJECT。
PI_OK = {'name_short': 'x402-buyer-test', 'did_short': 'z6MkqX2ejeXv', 'verified': True,
         'method': 'diap-address-binding/1', 'source': 'off-chain-signed'}
PI_SCOPE_OK = {'loaded': 1, 'verified': 1, 'rejected': 0, 'rejected_reasons': [], 'rows_with_identity': 1,
               'reason': '重验 1 条 → 通过 1 条', 'label': {'zh': '链下登记(可离线验签)', 'en': 'off-chain registration (verifiable offline)'},
               'note': {'zh': '链下登记, 不是链上事实', 'en': 'off-chain registration, not an on-chain fact'},
               'method': 'diap-address-binding/1', 'source': 'off-chain-signed'}

def pay_row_idx(d):
    """找一个 kind='payment_in' 的行号 (真快照里一定有)"""
    for i, r in enumerate(d.get('confirmed_activity') or []):
        if isinstance(r, dict) and r.get('kind') == 'payment_in':
            return i
    return 0

def strip_pi(d):
    """把快照里**所有** payer_identity 与顶层口径块摘掉 —— 合法夹具要求"自洽":
    改了行就必须同步口径 (不然门报 rows_with_identity 与行数不符, 那是夹具自己不自洽)"""
    for r in (d.get('confirmed_activity') or []):
        if isinstance(r, dict):
            r.pop('payer_identity', None)
    d.pop('payer_identity_scope', None)

def pi_ok(d):
    """合法对照: 恰好一条付款行带已验签短写 + 顶层口径块 (rows_with_identity 与行数一致)"""
    strip_pi(d)
    i = pay_row_idx(d)
    d['confirmed_activity'][i]['payer_identity'] = json.loads(json.dumps(PI_OK))
    d['payer_identity_scope'] = json.loads(json.dumps(PI_SCOPE_OK))

def pi_no_field(d): strip_pi(d)                                   # 老快照 (没有这个字段) —— 必须仍然 PASS


def legit_public(d): pass                                        # 真快照原样
def legit_local(d):                                              # 本机链行: 有事实、无浏览器
    d['confirmed_activity'] = [{
        'task': 'sha256:0b0b0b0b', 'kind': 'task_created', 'state': 'active', 'chain_id': 31337,
        'block': 676, 'tx': 'sha256:11112222', 'confirmations': 1, 'finality': 'observed',
        'at': '2026-09-22T09:51:57Z', 'tx_hash': '0x' + 'c3' * 32, 'contract': ESCROW}]
    strip_pi(d)                                                  # 行被整批换掉了 → 身份/口径一起摘掉 (保持自洽)
def legit_open_tasks(d): d['open_tasks'] = [dict(OPEN_OK)]       # 待接单任务: 白名单 7 键, 未认领
def legit_open_tasks_empty(d): d['open_tasks'] = []              # 板上没有待接单任务 = 空数组 (合法)
dump('legit-real', legit_public)
dump('legit-local-chain', legit_local)
dump('legit-open-tasks', legit_open_tasks)
dump('legit-open-tasks-empty', legit_open_tasks_empty)
dump('legit-payer-identity', pi_ok)                              # 付款行带**已验签**短写 + 口径块
dump('legit-no-payer-identity', pi_no_field)                     # 老快照: 没有这个字段也合法

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
# —— 待接单任务 (open_tasks) 的注入档 (2026-09-23 第二批精确化) ——
dump('leak-open-task-instruction', lambda d: d.update({'open_tasks': [{**OPEN_OK, 'instruction': 'SECRET-BODY 内部正文'}]}))
dump('leak-open-task-buyer-did', lambda d: d.update({'open_tasks': [{**OPEN_OK, 'buyerDid': 'did:key:z6MkpTHR8VNsBxYAAWHut2Geadd9jSwuBV8xRoAnwWsdvktH'}]}))
dump('leak-open-task-full-id', lambda d: d.update({'open_tasks': [{**OPEN_OK, 'announcementId': 'ann-80c51faa3442da4b'}]}))
dump('leak-open-task-claimed-true', lambda d: d.update({'open_tasks': [{**OPEN_OK, 'claimed': True}]}))
dump('leak-open-task-budget-did', lambda d: d.update({'open_tasks': [{**OPEN_OK, 'budget': 'did:key:z6MkpTHR8VNsBxYAAWHut2Geadd9jSwuBV8xRoAnwWsdvktH'}]}))
dump('leak-open-task-capability-address', lambda d: d.update({'open_tasks': [{**OPEN_OK, 'capability': SELLER}]}))
dump('leak-open-tasks-not-list', lambda d: d.update({'open_tasks': {'capability': 'x'}}))
dump('leak-full-ann-id-in-notes', lambda d: d['notes'].append('公告 ann-80c51faa3442da4b 待接单'))
# —— 付款方身份 (payer_identity) 的注入档 (2026-09-29 第三批) ——
#   每一种都是"想在这条窄路上偷放东西": 未验签当可信 / 换协议名 / 名字里塞地址 / did_short 带前缀 /
#   多塞一个键 / 长在非付款行上 / 出现在顶层 / 口径与行数对不上。
def pi(d, **over):
    i = pay_row_idx(d)
    row = json.loads(json.dumps(PI_OK)); row.update(over)
    d['confirmed_activity'][i]['payer_identity'] = row
    d['payer_identity_scope'] = json.loads(json.dumps(PI_SCOPE_OK))

def pi_scope(d, **over):
    d['payer_identity_scope'] = {**json.loads(json.dumps(PI_SCOPE_OK)), **over}

dump('leak-payer-identity-unverified', lambda d: pi(d, verified=False))              # 未验签当可信
dump('leak-payer-identity-no-verified', lambda d: (pi(d), d['confirmed_activity'][pay_row_idx(d)]['payer_identity'].pop('verified')))
dump('leak-payer-identity-wrong-method', lambda d: pi(d, method='some-other-binding/1'))
dump('leak-payer-identity-wrong-source', lambda d: pi(d, source='on-chain'))
dump('leak-payer-identity-name-is-address', lambda d: pi(d, name_short=BUYER))       # 名字里塞 EOA
dump('leak-payer-identity-name-with-space', lambda d: pi(d, name_short='a b c'))
dump('leak-payer-identity-name-too-long', lambda d: pi(d, name_short='x' * 25))
dump('leak-payer-identity-did-short-full-did', lambda d: pi(d, did_short='did:key:z6MkqX2ejeXv'))
dump('leak-payer-identity-extra-key', lambda d: pi(d, address=BUYER))                # 多塞一个键
dump('leak-payer-identity-on-task-row', lambda d: d['confirmed_activity'][pay_row_idx(d)].update({'kind': 'task_created'}) or pi(d))
def pi_with_bad_label(d):
    pi(d)
    d['payer_identity_scope'] = {**json.loads(json.dumps(PI_SCOPE_OK)), 'label': {'zh': '链下登记(可离线验签)'}}
dump('leak-payer-identity-scope-label-no-en', pi_with_bad_label)                      # 口径句只写一种语言
def pi_top(d):
    d['payer_identity'] = json.loads(json.dumps(PI_OK))
dump('leak-payer-identity-at-top-level', pi_top)
dump('leak-payer-identity-scope-count-mismatch', lambda d: (pi(d), pi_scope(d, rows_with_identity=5)))
dump('leak-payer-identity-scope-verified-zero', lambda d: (pi(d), pi_scope(d, verified=0)))
def pi_without_scope(d):
    i = pay_row_idx(d)
    d['confirmed_activity'][i]['payer_identity'] = json.loads(json.dumps(PI_OK))
    d.pop('payer_identity_scope', None)
dump('leak-payer-identity-without-scope', pi_without_scope)                          # 有身份没口径
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
run_case '待接单任务行 (白名单 7 键, 未认领)'      PASS   legit-open-tasks
run_case '待接单任务空数组 (板上暂无)'             PASS   legit-open-tasks-empty
run_case '付款行带**已验签**身份短写 + 口径块'      PASS   legit-payer-identity
run_case '老快照没有身份字段 (合法, 不拒)'          PASS   legit-no-payer-identity
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
run_case '待接单行被展平进 instruction 正文'       REJECT leak-open-task-instruction
run_case '待接单行带 buyerDid 身份'                REJECT leak-open-task-buyer-did
run_case '待接单行给完整 announcementId'            REJECT leak-open-task-full-id
run_case '待接单行 claimed=true (筛选坏了)'        REJECT leak-open-task-claimed-true
run_case '待接单行预算里塞 DID'                    REJECT leak-open-task-budget-did
run_case '待接单行 capability 里塞钱包地址'         REJECT leak-open-task-capability-address
run_case 'open_tasks 不是数组 (对象冒充)'           REJECT leak-open-tasks-not-list
run_case 'notes 里出现完整公告 id'                 REJECT leak-full-ann-id-in-notes
run_case '付款方身份 verified=false (未验签当可信)'  REJECT leak-payer-identity-unverified
run_case '付款方身份缺 verified 键'                REJECT leak-payer-identity-no-verified
run_case '付款方身份换成别的协议名'                 REJECT leak-payer-identity-wrong-method
run_case '付款方身份自称 on-chain 来源'             REJECT leak-payer-identity-wrong-source
run_case '名字里塞买方 EOA 地址'                   REJECT leak-payer-identity-name-is-address
run_case '名字带空格'                              REJECT leak-payer-identity-name-with-space
run_case '名字超 24 字符'                          REJECT leak-payer-identity-name-too-long
run_case 'did_short 塞完整 did:key:'               REJECT leak-payer-identity-did-short-full-did
run_case '身份对象多塞一个键 (address)'             REJECT leak-payer-identity-extra-key
run_case '身份长在非付款行 (任务行) 上'             REJECT leak-payer-identity-on-task-row
run_case '口径块 label 只写中文 (缺 en)'            REJECT leak-payer-identity-scope-label-no-en
run_case '身份出现在顶层 (不在付款行上)'            REJECT leak-payer-identity-at-top-level
run_case '口径块 rows_with_identity 与行数不符'     REJECT leak-payer-identity-scope-count-mismatch
run_case '口径块 verified=0 却行里有身份'           REJECT leak-payer-identity-scope-verified-zero
run_case '有身份却整块口径缺失'                    REJECT leak-payer-identity-without-scope

echo
echo "[guard-test] === 合计: $PASSED 通过, $FAILED 不符 ==="
if [ "$FAILED" -gt 0 ]; then
  printf '[guard-test] 不符: %s\n' "$FAILED_NAMES" >&2
  exit 1
fi
exit 0
