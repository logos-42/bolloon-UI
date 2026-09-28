---
name: efficode
version: 1.0.0
description: Efficode = Efficient + Code —— AI 之间的紧凑交流语言（参考实现 + 诚实边界）。含 6 条符号指令与前缀表达式语法、逐位包结构（Header / DID 段 / 指令段 / 数据块 / CRC32）、压缩三档（none / lz77 / deflate）与默认“压不小就不压”、三条协商硬规则（只有双方都声明才用，否则明确回落并记一笔），以及**真测出来的效率边界**（20B 载荷 → 111B 包 = 放大 5.55x；大而重复的帧 4089B → 289B = 省 92.9%）。明确标出**没做到**的：签名与密钥交换、声波模式、5G / 链上适配、跨机验证。
status: active
tier: protocol
protocol: efficode/1
execution:
  entrypoint: bolloon
  module: src/efficode
requires:
  - bolloon-cli
triggers:
  - efficode
  - AI 交流语言 / agent 间紧凑语言
  - 省带宽 / 省 token 的 agent 帧
  - 包结构 / opcode / CRC32
  - 语言协商回落
capabilities:
  - lang.encode
  - lang.decode
  - lang.compress
  - lang.negotiate
  - identity.digest
plannedCapabilities:
  - identity.sign        # 签名验证 = 规范中，未实现（刻意不写假实现）
  - session.ecc-key      # ECC 临时会话密钥 = 规范中，未实现
  - transport.sound      # 声波 / 语音模式 = 仓内 0 行代码
  - transport.5g         # 5G 适配 = 纯设想
  - transport.onchain    # 链上承载 = 纯设想（与链上模块零 import 关系）
hardRules:
  - 只有**双方都声明** efficode 才用；单方声明 / 对端不支持 ⇒ 明确回落自然语言并记一笔
  - 不认识的 opcode / 压缩 id / 语言声明一律抛错，**绝不猜着解**
  - CRC32 只防传输损坏，**不是防篡改** —— 今天的真实性 / 认证保护为 0，不许写成“已签名”
  - 身份只有 32B 摘要：只能比对“是不是同一个身份”，不能还原身份、不能独立证明持有私钥
  - 省不省完全取决于内容：短消息上包比正文大（20B → 111B），不许宣传单一倍数
---

# Efficode — AI 之间的紧凑交流语言（参考实现 · 诚实边界）

**一句话**：把 agent 之间来回的结构化文本帧压成**自描述的紧凑包**（二进制或 Base64 文本），
用 6 条符号指令 + 前缀表达式描述“谁在说 / 说什么 / 什么动作”。

**先看适用面，再看细节**（§5 有真测数字）：

| 场景 | 值不值 |
|---|---|
| 大而重复的结构化文本 / 批量帧（真发 JSON 帧 ×40：4089B → 289B，**省 92.9%**） | ✅ 真赚 |
| 可压的长文本 / 重复日志（1KB 重复日志 804B → 187B，省 76.7%） | ✅ 真赚 |
| 十几字节的寒暄 / 随机字节 / 已压过的内容 | ❌ **不赚甚至倒亏**（真随机 1KB：lz77 **+13.0%**） |

---

## 0. 本文件怎么用

- 本文件是**自包含**的：读完它就能实现一个可互操作的编解码端（含逐位包结构、错误码语义、协商规则）。
- 字段 / 端点 / 数字全部来自真实实现与真跑验收门；**没做的一律标“未实现 / 设想”**，不美化。
- 唯一事实源 = 主仓 `docs/wiki/efficode.md`（含逐节状态总表与复现命令）；本文件是它的**对外精简版**。

---

## 1. 语言结构

**符号化指令集 + 前缀表达式**。六条指令，二进制里各一个 opcode：

| 符号 | opcode | 载荷 | 语义 |
|---|---|---|---|
| `@DID:` | 1 | 有 | 身份（发送方身份串） |
| `#DATA:` | 2 | 有 | 数据正文 |
| `#REQ:` | 3 | 有 | 请求 |
| `!ACK` | 4 | 无 | 确认 |
| `!SEND` | 5 | 无 | 发送 |
| `!END` | 6 | 无 | 结束 |

指令段二进制形状：`[1B opcode][varint payloadLen][payload UTF-8]` —— **末尾没有隐式终止符**，
靠 `payloadLen` 自描述；少一个字节就报截断。不在表里的 opcode 一律抛 `EFFICODE_UNKNOWN_OPCODE`。

**文本（前缀表达式）形态**是 `instructionsToSymbolic()` 的产物：

```text
@DID:did:bolloon:a #DATA: !SEND
```

`symbolicToInstructions()` 的解析规则是**写死的四条**（不是“随便切”）：
① 按空白切词；② 词首是 sigil（`@` / `#` / `!`）必须匹配一条**已知**前缀，否则抛错；
③ 不带 sigil 的词追加到**上一条**指令的载荷后面（没有上一条 → 抛错）；④ 控制指令（`!ACK`/`!SEND`/`!END`）后面不许跟载荷。

**双模式**：`compact`（默认，真二进制）与 `text`（整包 Base64，线上可打印）。
包头低 4 位记 mode；**传输形态与包头声明不一致即抛** `EFFICODE_BAD_MODE`（把 Base64 串当二进制喂进去必报错）。

**三条协商硬规则**（`negotiateLang`，落地在 `encodeForPeer` / `decodeFromPeer`）：

1. 只有**双方都声明** `efficode` 才用 Efficode；
2. 单方声明 / 对端不支持 / 对端声明了本机不认识的字符串 ⇒ **明确回落自然语言**，并**记一笔**
   （`recordLangDecision` → `langDecisionLogPath`）；
3. 声明语言**不是** efficode 的载荷，**绝不去解析它**（不猜、不试解）—— 对端声明 `efficode`
   而本机没声明支持时抛 `EFFICODE_LANG_UNSUPPORTED`，**不硬解**。

本机默认声明**永不猜成 efficode**：没给就是 `natural`（env 可覆盖：`BOLLOON_EFFICODE_LANG`）。

---

## 2. 包结构（逐位）

```text
[Header 2B] | [DID 验证段 32B（可选）] | [指令段 动态] | [数据块 动态] | [CRC32 4B]
```

**Header 2B**：

| 字节 | 位 | 含义 |
|---|---|---|
| byte0 | 高 4 位 | 版本（`EFFICODE_VERSION = 1`）—— 不认识就抛 `EFFICODE_BAD_VERSION` |
| byte0 | 低 4 位 | 模式 `0=compact` · `1=text` |
| byte1 | bit0 | 有 DID 段 |
| byte1 | bit1 | 有指令段（**本实现必置 1** —— 不接受无指令的包） |
| byte1 | bit2 | 有数据块 |
| byte1 | bit3 | 数据块已压缩 |
| byte1 | bit4..7 | 保留，**必须 0**（置位即抛 `EFFICODE_BAD_FLAGS`） |

- 指令段：`[varint opLen][opBytes]` · 数据块：`[varint dataLen][dataBytes]`；
  其中 `dataBytes[0]` = 压缩算法 id（`0=none` `1=lz77` `2=deflate`），未知 id 抛 `EFFICODE_UNKNOWN_COMPRESSION`。

**两处“诚实边界”写在包层**：

- DID 段 32B 在规范里是固定段，参考实现**允许省略**（省 32B），省略时 flags 如实写 0，
  解码端**按 flags 解、不假设段存在** ⇒ `MIN_PACKET_BYTES = 2 + 1 + 2 + 4 = 9B` 是“无 DID 段”的下限，
  带 DID 段的包应 ≥ 41B，由 flags 驱动逐段校验。
- **CRC32 只防传输损坏，不是防篡改**（无密钥）。篡改要真签名 —— **规范中**，见 §3。

**两条硬纪律**：① 解析必须**逐段自描述**，长度对不上就报截断；
② 尾段 CRC32 覆盖 CRC 之前的**全部**字节，对不上就报 `EFFICODE_CRC_MISMATCH`，绝不放行“内容看着像就收下”。
规范向量：`crc32("123456789") === 0xCBF43926`。

---

## 3. 身份与安全

**DID 段 32 字节布局**（`encodeDidSegment` / `decodeDidSegment`）：

| 偏移 | 长度 | 内容 |
|---|---|---|
| 0 | 1B | algo id（= 1，`sha256-截断`） |
| 1..3 | 3B | 原始身份串字节数（24 位大端，上限 16MB） |
| 4..31 | 28B | `sha256(身份串)` 的**前 28 字节** |

**真做了的**：编 / 解段 · 摘要比对（`matchesDidSegment`，返回值如实标 `method: 'digest'`、`signed: false`）·
摘要的稳定文本形式 `algo1:<56 hex>`（单向，可安全落日志）· 未知 algo id 抛 `EFFICODE_DID_SEGMENT_BAD`。

**明确没做的（不许含糊）**：

- 32B **装不下**一个 DID / 公钥 ⇒ 本段是**摘要**：只能做“是不是同一个身份”的比对，
  **不能**从段里还原身份，也**不能**独立证明持有私钥（摘要里不含原文，门里有断言）。
- **链上签名验证** / **ECC 临时会话密钥** = **规范中，未实现**。本模块**没有**签名函数、**没有**密钥交换函数
  —— 刻意不写假实现。签名校验的接线点只有 packet 层的 `verifyDid` 回调（预留）。
- CRC32 **不做认证**。⇒ 今天这条链的**真实性保护 = 0**：有能力改包的人可以改完重算 CRC。

**“猜着解”在三个地方被堵死**：未知 opcode · 未知压缩 id · 未知语言声明。

---

## 4. 传输现状（哪些真跑过，哪些只是设想）

| 载体 | 状态 | 依据 |
|---|---|---|
| 任何**可打印文本**通道（JSON 帧 / 群消息文本） | ✅ 已实现 | `text` 模式 = 整包 Base64；agent 帧 `{type:'agent_message', payload:{text, lang}}` 与群消息 `lang` 字段就是它 |
| 本机两进程**管道** | ✅ 真跑过 | 门 [E]：真起两个进程，发送侧 `encoded=true bytes=140`，接收侧真解出原文，三进程退出码全 0 |
| **5G / 运营商侧** | 🚧 纯设想 | 仓内 **0 行代码**：Efficode 只产字节串，走什么承载与它无关 |
| **区块链** | 🚧 纯设想 | 仓内 **0 行代码**：没有把包写进 calldata / 事件 / blob 的编码器；与链上模块**零 import 关系** |
| **声波 / 语音**（ggwave 类） | ❌ 未实现 | `mode` 枚举没有这一位；编码请求被 `EFFICODE_MODE_NOT_IMPLEMENTED` 直接拒掉 |

---

## 5. “更高效吗” —— 真测数字（同一样本，真跑）

### 5.1 宣传句 vs 实测

| 说法 | 实测到的 | 判据出处 |
|---|---|---|
| 「压缩率提升 30%」 | **逐样本差极大，没有单一数字**：12B 寒暄包 **-31.8%** · 51B 群消息 **-25.3%** · 77B 任务公告 **-28.5%** · 1KB 重复日志 **-76.7%** · 真发 JSON 帧 ×40 **-92.9%** · **真随机 1KB：负收益**（lz77 **+13.0%**） | 验收门 [D] 逐样本 + `pickAlgo` 在不可压内容上真退回 `none` |
| 「信息密度提升 20 倍」 | **实测最高 14.15x**（真发 JSON 帧 ×40：4089B → 289B）；12B 寒暄只有 **1.47x** | 同上 |
| 「兼容度 100%」 | **未测** —— 只有本仓**一个**实现，没有第二实现互编互解 | 无 |
| 「微秒级」 | **未测** —— 没有任何编解码耗时基准 | 无 |
| 「链路缩短 50%」 | **未测** —— 没有端到端延迟测量（字节数 ≠ 链路时间） | 无 |

### 5.2 最要紧的一条：**短消息会被包头吃回去**

20 字节载荷真编真解，逐段拆开（`@DID:` 指令把身份明文再写一遍 = 今天 `encodeForPeer` 的真实路径）：

```text
载荷 = 20B
[带 DID 段] 3 指令无压缩包 = 111B     ← 实测
  算式: 2(Header) + 32(DID段) + 1(指令段长 varint)
      + 50(指令段: @DID: 1B码+1B长+44B身份明文 / #DATA: 2B / !SEND 2B)
      + 1(数据块长 varint) + 1(压缩算法id) + 20(载荷) + 4(CRC32) = 111B   (算式 == 实测)
  净开销 = 91B · 开销/载荷 = 4.55x · 总/载荷 = 5.55x
```

| 口径 | 包总字节 | 净开销 | 开销/载荷 |
|---|---|---|---|
| 今天 `encodeForPeer` 真实路径（身份写两遍：32B 摘要段 + `@DID:` 44B 明文） | **111B** | **91B** | **4.55x** |
| 去重口径（身份只留 32B 摘要段，不重复 `@DID:` 指令） | **33B** | **13B** | 0.65x |
| `text` 模式上线（整包 Base64） | **148 字符** | — | ×1.354（Base64 膨胀） |
| 自然语言帧基线（真代码 `buildAgentMessage` 无声明） | 159B | — | — |

**固定开销不随载荷消失**（带 DID 段 · 3 指令 · 无压缩，真跑）：

| 载荷 | 0B | 12B | 20B | 50B | 100B | 1KB | 4KB |
|---|---|---|---|---|---|---|---|
| 包 | 89B | 103B | 111B | 141B | 191B | 1116B | 4188B |
| 开销/载荷 | 纯开销 | 7.58x | 4.55x | 1.82x | 0.91x | 0.09x | 0.02x |

三条**量出来**的结论：

1. **短消息上包比正文大得多**：20B → 111B（放大 5.55x）。开销要到载荷 ~100B 才降到 1x 以下，
   ~4KB 才基本可忽略。⇒ Efficode **只在大而重复的结构化文本上真省**。
2. **身份被写了两遍**，白多花 46B（`@DID:` 的 1B 码 + 1B 长 + 44B 明文），而包头里已经有 32B 摘要段。
   这是**已量化的一条设计缺陷候选**（修正属**规范中**，本轮**只量不改**）。去掉它，20B 载荷的包 111B → 33B。
3. **< 32B 的数据块连压缩头都不开**：`pickAlgo` 直接返回 `none`（省下的不该是负数），
   但数据块仍要多付 1B 算法 id + 1B 长度。默认策略**压不小就不压**，不为好看而硬压。

### 5.3 什么时候真赚

真发 JSON 帧样本（×40，3350B 正文）：自然语言帧 **4089B** → 紧凑包 **289B**（**省 92.9%**，deflate）。
1KB 重复日志：804B → 187B（省 76.7%）。**这就是适用面**：大而重复的结构化文本 / 批量帧。
随机字节 / 已高度压缩的内容 / 十几字节的寒暄，一概不赚甚至倒亏 —— 默认策略会**如实退回 `none`**。

---

## 6. 怎么用（真实 API）

模块入口 `src/efficode/index.ts`（导出面 = types / ops / crc32 / lz77 / compress / did / packet / negotiate）：

```ts
import {
  encodeForPeer, decodeFromPeer,     // 端到端（含语言协商 + 记一笔）
  encodePacket, parsePacket,         // 包层（逐段自描述 + CRC 校验）
  instructionsToSymbolic, symbolicToInstructions,  // 文本（前缀表达式）形态
  encodeDidSegment, decodeDidSegment, matchesDidSegment, didDigestString,
  compressBlock, decompressBlock, pickAlgo,
  negotiateLang, normalizeLang, defaultDeclaredLang, recordLangDecision, readLangDecisionLog,
  measureAll,                        // 真跑量体（§5 的数字就是它量出来的）
  EFFICODE_VERSION, MIN_PACKET_BYTES,
} from './efficode/index.js';
```

真跑路径（门 [E] 同源）：发送侧 `encoded=true bytes=140` ⇒ 接收侧真解出原文；两端语言都声明 `efficode` 才走包，
否则**回落自然语言并记一笔**。Agent 帧里的形态就是 `{type:'agent_message', payload:{text, lang}}`。

---

## 7. 没做到 / 未验证（逐条，不许美化）

1. **签名与密钥交换完全没做** —— 没有签名函数、没有 ECC 临时会话密钥、没有密钥轮转；真实性保护 = 0。
2. **声波 / 语音模式没有一行代码** —— 只有“显式拒绝”这一半。
3. **5G / 区块链适配是纯设想** —— 仓内 0 行代码，与链上模块零 import 关系。
4. **「兼容度 100%」测不了** —— 只有一个实现，没有第三方实现对编。
5. **耗时 / 延迟一个数都没测** —— 「微秒级」「链路缩短 50%」目前没有判据。
6. **真跨机未验** —— 门 [E] 的“两个进程”是**同一台机器**走管道；公网 / 跨设备未做。
7. **短消息开销缺陷未修** —— 身份写两遍（46B）已量化，修正属规范阶段。
8. **指令集只有 6 条，没有扩展机制** —— 未知 opcode 一律抛（这是故意的严格性），
   但也就意味着未来加指令**必须同时改两端**，没有版本协商位。
9. **论坛 / 更新渠道未定地址** —— 规范与实现更新只走本仓与 `https://bolloon.cn`，不编第三方地址。

---

## 8. 门与复现命令

```bash
# 验收门（55 passed / 0 failed，6 节 A–F + 变异 4/4 判红）
npx tsx scripts/verify-efficode.ts

# 单测（53 passed）
npx vitest run src/test/efficode.test.ts

# 变异脚本（拆机制 ⇒ 门必须变红）
python3 scripts/verify-efficode-mutations.py
```

§5 的真数字来自**同一口径**：「自然语言帧」基线一律取
`buildAgentMessage({ text, from, mine: [], theirs: undefined }).frame` 的 UTF-8 字节数（与门 [D] 同源）；
小包逐段算式已在 §5.2 写出并与实测对齐。

**唯一事实源**：主仓 `docs/wiki/efficode.md`（逐节状态总表 · 诚实边界 · 真数字）。
本文件是它的对外精简版；两份不一致时**以主仓那份为准**。
