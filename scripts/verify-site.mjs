/**
 * verify-site.mjs — bolloon.cn 站点上线后真浏览器验收 (零依赖, 自包含 CDP)
 *
 * 为什么自包含: 站点仓不装 npm 包, 但它要能自己验自己 —— 只用 node 全局 WebSocket
 * 驱动本机 Chrome (headless=new), 不引任何依赖。
 *
 * 覆盖:
 *   ① 5 页版本徽章 = live npm 版本 (取自 registry, 不再硬编码)
 *   ② 徽章在 JS 失败时显示「—」而不是过期版本 (静态 HTML 内已是占位符)
 *   ③ skill.html 已同步文档 v1.3.0 + 站内 skills 索引区 (bolloon-gateway-join / bolloon-network)
 *   ④ gateway.html 的粘贴命令 = 本页实际源 + bolloon-gateway-join.md
 *   ⑤ /bolloon-gateway-join.md 线上正文 = v1.3.0 且含 join_global_gateway / publicKey
 *   ⑤′ /bolloon-network.md 线上正文 = 主仓 skills/bolloon-network/SKILL.md 的原样镜像
 *      (frontmatter 原样: name/version/protocol/paymentModes/hardRules + 正文首尾锚点都在)
 *   ⑥ gateway.html 链上活动 (公开只读接口 /api/public/network/progress 的 confirmed_activity):
 *      页面主体 = 一句短说明 + 小结行 (节点/智能体/任务/已完成/已结算/钱包签名) + 一张表
 *      (列 = 任务|状态|事件|网络|区块|确认数/最终性|时间)。断言: 表头/行渲染逐格逐字、
 *      短写 (40 位地址→0x…头4尾4, 64 位 sha256→sha256:头4…)、state 中英单词、
 *      finality 三档徽标 (data-finality + 三档颜色互不相同)、数据源标注三种取值、
 *      空态「本节点暂未观察到链上任务」与降级态「快照不可用」文案、
 *      loading/live/stale/unavailable 四态 (CDP Fetch 拦夹具, 不对真实网络下断言)、
 *      超时 (请求挂住 6s → 自己放弃)、失败不阻断其它区域、30s 轮询 + 5s 超时 + 退避常量、
 *      textContent 纪律 (带 <b> 的标识不被解析)、中英切换、prefers-reduced-motion、
 *      390px 纵向堆叠 + 表格横向滚动、回退同源 network-pulse.json、无 console 错误
 *   ⑦ index.html 序栏 (hero) 紧凑版: 同一数据源、同一诚实四态、紧凑度确实优于网关页;
 *      活动流缺当前语言退回另一种语言 + 相对时间只改文字节点
 *   ⑧ 多实例隔离: 同一页两个 [data-pulse] 实例各自独立取数/降级 (一个失败另一个仍活)
 *   ⑨ 全站 7 页无重复 id
 *   ⑩ 网关页顺序: 链上活动区在「加入方式 / 如何加入」之前 (序厅已删), 且链上活动与加入方式
 *      同处一行的**左/右两栏** (.gateway-row: 桌面同行 · 加入方式在右, ≤900px 堆叠)
 *   ⑪ 聚合计数「拿不到就不显示」: tasks / tasks_completed / tasks_settled / signatures
 *      缺失 → 小结行整行隐藏, 不编造; 空表要说清 + agent_sites=[] 诚实提示
 *      ★ 2026-09-24 (leo:「链上活动页, 未接入是什么意思, 可以去掉吗」): 网关页小结行的「已验证」槽
 *      **整体下线** —— 链上索引没有第四类事件可报 (无源) ⇒ 与其在计数行显示一个要再解释一次的
 *      「未接入」, 不如不显示这一格。**快照契约一字未改** (totals.tasks_verified 仍为 null ·
 *      totals_scope.fields.tasks_verified 仍带 source/unavailable/short/label), 由门 [6e★★★★] 守:
 *      静态 HTML 里这一格的钩子 0 处 + 两页真 DOM 的计数行整块文本无「未接入」+ 其余六格一格没少,
 *      并带阴性对照 (把这一格塞回页面 → 必红, 见 docs/wiki/log.md)。
 *   ⑫ 智能体私有站 (IPNS): agent_sites[] 三种形态归一化 + 空数组诚实提示 + 非法条目不渲染链接
 *   ⑬ IPNS 粘贴框: 真 input + 真按钮, 合法才开新窗口 (真新标签页), 非法就地报错且输入不进 innerHTML
 *   ⑭ 全站资源 ?v=31 一致 (逐页抓原始 HTML)
 *   ⑮ 小结行的钱包签名钩子 (data-pulse-total="signatures") 必列 + 字段缺失整行隐藏
 *   ⑯ 表格枚举容错: 认不出的 kind/state/finality 原样显示 (不猜不吞不报错),
 *      task 与 tx 都空的条目根本不画 (不留空行)
 *   ⑰ 数值与表格行变化在下一轮 30s 轮询内自动反映 (新 agent 加入 → 自己变, 页面不刷新)
 *   ⑱ 旧名清除: 7 页原始 HTML + 渲染后可见文本与导航里都没有「网络脉冲 / Network pulse /
 *      全球网络脉冲」; 「加入网络」**不是**旧名 (2026-09-22 leo 要的首页 CTA 按钮) ——
 *      只允许作为首页那一个 <a class="join-network-cta" href="gateway.html"> 出现,
 *      摘掉该按钮文案后其余位置零命中 (防旧网关序厅 / 旧导航项复发);
 *      页面可见文本无 40 位地址 / 64 位哈希
 *   ⑲ 技能索引版本号逐字断言 (bolloon-network = 1.2.0), 且与线上 .md frontmatter 一致
 *      —— 不再只匹配「1.x.y 形状」(那会漏掉「本机改了、线上没部署」)
 *   ⑳ 公开页数字不许自相矛盾 (2026-09-22 立 · 2026-09-23 文案精简后更严 · **2026-09-24 加强成"同一概念不变量门"**):
 *      (a) **两套口径各自带就近短标记**: 统计区「观察窗口」类标记 (.pulse-caveat) + 表区
 *          「链上索引·全量」类标记 (口径行 data-pulse-activity-totals, 老快照没有它时退到表下
 *          data-pulse-activity-source) + 行数/不同任务 + 这批行属于哪条链。少任何一个标记 = 红。
 *      (b) ★ **同一概念的顶部计数不得与其表格矛盾而不解释** (`contradictionFindings`, 只看真 DOM):
 *          ① 顶部数就地标了「链上索引·全量」→ 必须与表里同概念数**逐字相等** (解释无效);
 *          ② 不同源时 0 vs N → 顶部口径标记 + 表区标记两个都必须在场, 缺一即"并排矛盾且无一字解释";
 *          ③ 反向: 顶部报数而表里一行都没有, 且没有一处说明两者不同源;
 *          ④ 快照标「无源」(`source:'none'`)的数不许显示裸 0 (0 = "没发生过", 是另一句话);
 *          ⑤ 快照标 `unavailable` 的数必须真写「未接入」(不许 0 / 隐藏 / —) —— 只对**页面上真有这个槽**
 *             的字段生效 (2026-09-24: 「已验证」槽已整体下线, 它的缺席由新门 [6e★★★★] 守; 见下);
 *          并**自证这道门活着** (§[6e★★★] 变异验证): 拿真快照改成 tasks=0 / signatures=0 而口径仍写
 *          链上索引 → 门必须真判红; 改成 null+未接入 → 页面必须写「未接入」而门保持干净。
 *      整句解释已删 (2026-09-23 leo 要求页面干净): 差异靠就近短标记承接, 不靠长句、也不靠
 *      「不是全网…」这类否定句兜底 —— 本脚本同时反向断言这些长句/夸大措辞不再出现在可见文案里。
 *      老快照缺 activity_totals/chain_id_scope → 口径行整行隐藏 (不自己数行数、不编网络名),
 *      也不写任何逐字段口径标记 (页面绝不替快照编口径)。
 *   ⑳³ 顶部计数行「未接入」下线门 (2026-09-24 leo:「链上活动页, 未接入是什么意思, 可以去掉吗」) §[6e★★★★]:
 *      网关页小结行的「已验证」槽**整体去掉** (链上索引没有第四类事件 → 无源可报), 页面不再显示
 *      「未接入」字样。门只看**真渲染出来的东西**: ① 两页静态 HTML 里这一格的钩子 0 处;
 *      ② 网关页 + 首页真 DOM 的计数行整块可见文本里 0 次「未接入 / not connected」;
 *      ③ 小结行仍是六格 (少的是「已验证」, 其余一格没少 —— 不许顺手删别的);
 *      ④ **快照契约没被改**: totals.tasks_verified 仍为 null · totals_scope.fields.tasks_verified
 *         仍在 (页面不显示 ≠ 假装这个字段不存在); ⑤ 表区那行「本节点未接入链上数据源」是**另一件事**
 *         (整表无源时的降级说明, 由 [6b] 单独守), 不在本门范围内。
 *      阴性对照 (规则 1): 把这一格塞回页面 → ①②③ 必须当场判红 → 恢复后全绿 (docs/wiki/log.md 有原样载荷)。
 *   ⑳² 文案预算 (2026-09-23 leo: 「这些内容不用显示, 简洁最好」): 脉冲区三个动态文案节点
 *      (caveat / 口径行 / 数据源行) 一律**不写整句** —— 不得出现句号「。」「；」或「 —— 」这类
 *      成句标点, 且每个节点长度有硬上限; 「智能体私有网站」的列表说明整句已删, 空态压成
 *      「空 = 未发布（不是没数据）」这类极短诚实标记 (空 ≠ 没数据 这条没被删掉, 也没被改成假 0)。
 *      真正的设计意图 (公开只读接口 / 无 DID·peerId·IP·钱包地址·任务正文 / 短写) 保留在 HTML 注释里
 *      —— 注释不算可见文本, 但断言要求它还在 (不是把诚实性一起删掉, 是只把长句从可见处拿掉)。
 *   ㉑ 网关页两栏版式 + 首页「加入网络」CTA (2026-09-22 leo 要求, 全部真布局测量):
 *      #pulse / #skills 同父 (.gateway-row) 且文档顺序 pulse → skills;
 *      1440px: 两区同一行 (顶边对齐) 且加入方式在链上活动右侧 (右列左边界 ≥ 左列右边界) +
 *      两栏间距 = 声明的 column-gap; 390px: 加入方式堆叠到链上活动下方 + 同列左右对齐 +
 *      容器/右列/命令块都不超出视口 (两栏隐藏前后整页横向溢出不变 ⇒ 新两栏不贡献溢出);
 *      首页「加入网络」= 真 <a href="gateway.html"> 纯文本节点, 位于「开始安装」右侧同一行
 *      (CTA 顺序 开始安装 → 加入网络 → 阅读文档), 双语文案齐, 切 EN 变 "Join the network";
 *      真 Tab 键能走到它 (在 Tab 序里) 且焦点环是可见的 lime 2px outline; 390px 换行不溢出。
 *   ⑳′ 过期假标签防复发: 7 页原始 HTML + 渲染后可见文本与导航里都不许再出现
 *      「尚未接入 / Public observation endpoint not connected」类**现在为假**的文案
 *      (入口早已接入并在供给 25 行数据); unavailable 态必须说真话 (「快照暂时读不到」+ 真原因)。
 *   ㉒ 待接单任务 (快照 `open_tasks[]`, 2026-09-23): 网关页 + 首页序栏都展示本节点公告板上
 *      **未认领且未过期**的公告 —— 每个 chip 只拼白名单字段 (capability · 预算原子值 + currency ·
 *      network · 截止 · announcementId 前 8 位), 任务正文 / 正文摘要与预览 / 买方 DID·公钥 /
 *      认领者 / 签名**既不在快照里也不在页面上**。断言: 快照行只有那 7 个键 + claimed 全 false +
 *      id 是前 8 位短写; 静态 HTML 就有钩子与空态文案; chip 逐字段 == **从快照推导**的期望值
 *      (不写死 capability/预算); 条数 == 快照未认领数; 被本页上限截掉时挂「+N」如实计数;
 *      空态只能说「暂未观察到 / Empty = none observed」(不许假 0、不许「尚未接入」);
 *      区块与整页可见文本无 0x40 / DID / multiaddr / peerId / 64 位私钥形态; 页面不含本机公告
 *      文件的正文/买方身份/签名任何样本串 (全文 + 20 字窗口, 本机没有公告板时**显式跳过**);
 *      390px 下这一块在视口内、不自溢出、不贡献整页横向溢出。
 *   ㉓ 快照自己标的生成时间显式上页面 (2026-09-24 leo:「为什么网页没有实时更新这个记录?」—— 纯静态站 +
 *      签名快照架构下, 页面必须让人**一眼看出这份快照有多新**):
 *      ① **绝对 + 相对**: 时间格 (`data-pulse-time`) 写本地 `YYYY-MM-DD HH:MM:SS` + `<time datetime>` =
 *         同一时刻的 ISO; meta 行的 `data-pulse-ago` 与**状态徽章右边**的 `data-pulse-age` 都写相对时间
 *         (「(3 分钟前)」/「(3 minutes ago)」), 三者同源 = 同一份字段; 期望值一律**从夹具的 generated_at
 *         推导** (不写死字符串, 也不许拿当前时间凑)。
 *      ② **唯一来源 = 快照字段 generated_at**: 毫秒数 / ISO 字符串两种写法都要吃 (`parseAt` 兼容解析);
 *         页面显示的时刻必须逐字等于该字段 —— 「不是任意时间」由这条守着。
 *      ③ **缺字段 → 如实写「快照未标注时间」/「Snapshot time not labeled」**: 时间格与徽章年龄都写,
 *         `<time datetime>` 留空, 并且页面**不得出现当前时刻**(YYYY-MM-DD HH:MM 一个字符都不许有)、
 *         不得出现「刚刚 / N 分钟前」这类只有拿 `now()` 顶替才会有的相对说法 —— 换句话说:
 *         「绝不拿当前时间顶替」这件事有一条会判红的断言守着 (变异验证见 docs/wiki/log.md)。
 *      ④ **随轮询刷新且只改文字节点**: 快进 2 小时后 `tick()` → 相对时间文本按同一套规则变成小时档,
 *         而徽章 / 元信息行 / 表格行的**节点身份与 childNodes 结构一个都没动** (重建 DOM 就红)。
 *      ⑤ **stale 也显示时间**: `fresh_until` 已过只是「不伪装实时」, 该快照多旧照样写出来
 *         (绝对 + 相对 + 徽章年龄同一份); `stale` 语义本身**没被改动** (既有断言原样保留)。
 *      ⑥ aria-live 用法不变: 徽章年龄那段在 `role=status`/`aria-live=polite` 的活区里, 每 20s 会重写 ——
 *         故标 `aria-hidden="true"` (屏幕阅读器不被每 20s 打断), 同样的相对时间在活区外的 meta 行随时可读;
 *         活区属性本身 (role/aria-live) 与改动前逐字相同, 由既有断言守着。
 *   ㉔ 待接单任务的**固定高度 + 下滑滚动 + 分页 + 分栏切换** (2026-09-24 leo:「这个任务条目你设置一下固定高度,
 *      就这个目前的高度就可以, 以后可以下滑滚动查看, 分页分栏切换」): 列表容器 `[data-pulse-tasks]` 由 CSS
 *      固定成**一行 chip 的高度** (`--pulse-task-row-h`, 1440px 实测 40.69px / 390px 61.38px) 且 `overflow-y:auto`
 *      —— 条目再多也不撑高这一块; 一页 = `data-pulse-tasks-page` (网关页 4) 条, 页数由**快照条数**算出;
 *      控件 (`[data-pulse-tasks-ctl]`) 只在条数 > 一页时出现; 「切到双栏 / 切回单栏」按钮切 `is-cols2` 双栏并记
 *      `aria-pressed` (2026-09-24 leo:「切换也太模糊」→ 按钮文案写**动作 + 去向**: 分栏按钮不写状态名「双栏」, 翻页
 *      写「上一页 / 下一页」, 每个按钮另带 title 与含可见文案的 aria-label, 禁用时也写明「已经是第一页/最后一页」;
 *      门里有一条专门抓「切换」这类两边都指的说法);
 *      「+N」仍只数**上限之外**被截掉的条目 (与分页口径不混)。断言 [14] 分两段: 先用**真数据**量出这一块的
 *      高度当基准 (并验「一页装得下 ⇒ 控件整行隐藏」), 再注入夹具 FX_TASKS_MANY (7 条) 验分页/分栏/边界,
 *      并在每步都要求 **高度逐像素等于基准** (即「加了 6 条, 这一块一像素没长」), 390px 下双栏不许撑破视口。
 *      期望值全部从夹具/快照推导 (页数 `Math.ceil(7/每页)`, 第 2 页的 capability = 排序后的后段), 不写死。
 *   ㉕ 链上活动表的**高度上限 = 十五行 + 表头钉住 + 底部十五行/页** (2026-09-24 leo:「链上索引 · 全量 · 15 行 …
 *      可以按十五行的高度来设计吗」+「分页栏切换…在十五行底部」): 表体外面那一层 `[data-pulse-activity-scroll]`
 *      用 CSS 变量 `--pulse-activity-h` 封顶在**现在这份 15 行的真高度**上 (1440px 实测 865.03px = caption 30.69
 *      + 表头 41.19 + 15×52.84; 窄屏 1233px), 超出就在框内滚 —— 整页不再被表拉长; 表头 `position: sticky`
 *      + 不透明底 (滚到下面列名还在, 行不从背后透出来)。分页栏 (`[data-pulse-activity-ctl]`) 贴着十五行底部,
 *      一页 = `data-pulse-activity-page` (15) 行 = 高度上限那一份 ⇒「翻页」= 「换一屏」; 与待接单任务那一行**故意
 *      不同**: 只要有行就**始终显示** (leo 要的就是这条栏), 一行都没有才整行 hidden (不写「共 0 行」这种假 0)。
 *      断言 [15] 分两段: 先用**真数据**量出 15 行的几何当基准 (并验 max-height 与它逐像素一致 —— 样式里那个
 *      字面量不许跟真实行高漂开), 再注入夹具 FX_ACTIVITY_MANY (70 行 = 60 上限 + 10 未列) 验「高度一像素没长」
 *      「多出来的真在框里滚」「逐页翻到底每页行数 = min(每页, 剩余)」「末页按钮禁用」「上限口径 (页信息 60+10)
 *      与口径行 (70 行) 对得上」「390px 上限跟着窄屏行高走且横向仍可滚」。期望值全部推导, 不写死某页几行。
 *      ① 每页 = 上限那一份 ⇒ 每页**正好一屏** (scrollHeight == clientHeight): 翻页就够了, 不用在框里盲滚;
 *      「内容一超上限就在框内滚」这条是**安全网**, 门用「页面里临时把行摞到 60 行」直接量它 —— 并顺手量一次
 *      「把上限拿掉这一块会被撑到多高」(拿掉才长的上限才是载荷的; 只在 15 行上量不出来: 15 行正好等于上限)。
 *      ② 分页栏文案同样按「动作 + 去向」断言 (含禁用态的说法), 与 [14] 共用同一支控件探针;
 *      ③ 控件配色按**品牌色**断言: 禁用态 = 暗调 lime + 虚线边 (真快照长期 1/1 页 ⇒ 这栏天天是禁用样, 一旦写成
 *      灰字灰边, bolloon 色系在线上根本看不见 —— 这条回归是真截图复核抓到的, 所以要有门守着)。
 *
 * 活动区钩子约定 (见 app.js 末尾多实例模块): 根 = [data-pulse],
 * 区内节点 = data-pulse-scope / data-pulse-time / data-pulse-ago / data-pulse-age
 *            / data-pulse-total="nodes|agents|active|24h|tasks|tasks_completed|tasks_settled|signatures"
 *              (2026-09-24: 「已验证」槽已下线 → 页面不再有 tasks_verified 这个钩子; app.js 仍支持它,
 *               但 markup 里没有 = 渲染不出来)
 *            / data-pulse-scope-tag="<同上>|…"  (2026-09-24: 每个数就地贴的逐字段口径短标记)
 *            / data-pulse-activity-body / data-pulse-activity-empty / data-pulse-activity-source
 *            / data-pulse-activity-scroll (表体那一层: 高度上限 / 框内滚动 / 表头 sticky —— 纯 CSS, app.js 不读它,
 *              但门要从它身上量几何, 所以也列为钩子) / data-pulse-activity-ctl / -pageinfo / -prev / -next
 *              (2026-09-24: 链上活动表底部那行分页栏; 一页几行由 <section> 上的 data-pulse-activity-page 声明)
 *            / data-pulse-feed / data-pulse-notes / data-pulse-hint
 *            / data-pulse-sites / data-pulse-sites-empty
 *            / data-pulse-ipns-form / data-pulse-ipns-input / data-pulse-ipns-open / data-pulse-ipns-msg
 * 改钩子名必须同步三处: markup · app.js 的 querySelector · 本脚本的探针 (踩过这个坑)。
 * 纯函数入口: window.BOLLOON_IPNS.parse/url (归一化) · window.__bolloonIpns (上次真开过的链接快照)。
 *
 * 用法: node scripts/verify-site.mjs [基址]      # 默认 https://bolloon.cn
 *       node scripts/verify-site.mjs http://127.0.0.1:8897
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const BASE = (process.argv[2] || 'https://bolloon.cn').replace(/\/$/, '');
const PAGES = ['index.html', 'install.html', 'hibs.html', 'gateway.html', 'docs.html'];
const ALL_PAGES = [...PAGES, 'privacy.html', 'skill.html'];
// 链上活动表一页几行 + 行数上限 (2026-09-24): 与页面/样式对齐 —— markup 上 data-pulse-activity-page="15",
// app.js 的 ACTIVITY_MAX = 60。两个数在断言里都用**推导** (页数 = ceil(行数/每页), 每页行数 = min(每页, 剩余)),
// 不写死某一页画几行 —— 只有这两个「来源」是常量。
const ACT_PAGE_EXP = 15;
const ACT_MAX_EXP = 60;

function resolveChrome() {
  const cands = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
    path.join(os.homedir(), 'Applications/Google Chrome.app/Contents/MacOS/Google Chrome'),
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ];
  for (const c of cands) if (fs.existsSync(c)) return c;
  return null;
}

let passed = 0, failed = 0, skipped = 0, fxFailures = 0;

// 显式跳过 (只给「本环境本来就不该跑」的断言用): 必须打印 + 单独计数, 不许默默跳过、不许假装通过。
// 目前全脚本用 0 次 —— 理由: 「靠 CDP Fetch 注入夹具」与站点来源无关 (拦截发生在浏览器网络栈里,
// 对 127.0.0.1 与真域名语义相同), 真域名上从来没有「夹具断言不该跑」这回事, 只有过
// 「拦截没命中 → 夹具没生效」这一种真实故障。故障要明确报出来 (见 fxSelfProof), 不是该跳过的项。
const skip = (name, why) => { skipped++; console.log(`  ⏭️  [显式跳过] ${name} — ${why}`); };

// 当前断言的夹具自证结论 (null = 本节断言不吃夹具)。
// 夹具没生效时, 失败的断言必须归因到「夹具错」, 不能让读者以为页面坏了 —— 这就是本节的唯一目的。
let fxNow = null;
const check = (name, ok, detail = '') => {
  if (ok) { passed++; console.log(`  ✅ ${name}`); return; }
  failed++;
  if (fxNow && fxNow.delivered === false) {
    // 夹具错: 自证没过 (拦截未命中 / 夹具没送达) → 本条失败不代表页面有缺陷
    fxFailures++;
    console.log(`  ❌ [夹具错 · 未生效] ${name} — 夹具没生效(${fxNow.reason}); 本条不是页面缺陷` +
      `${detail ? ` · 现场取值: ${detail}` : ''}`);
    return;
  }
  // 夹具已自证生效 (跑完 fxSelfProof 的三道证, 见输出的「🔒 夹具自证 ✔」行) → 此时失败才真的是页面错
  const tag = fxNow && fxNow.delivered === true ? '[页面错] ' : '';
  console.log(`  ❌ ${tag}${name}${detail ? ` — ${detail}` : ''}`);
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 真域名抓取本机常被本地代理/ClashX 搅成 ETIMEDOUT/ECONNRESET (一次抖动就整轮崩) →
// 所有「抓正文」的请求走这个带重试的包装 (对本地 http.server 也一样的语义)。
const fetchText = async (url, attempts = 4) => {
  let lastErr = null;
  for (let i = 0; i < attempts; i++) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.text();
    } catch (e) {
      lastErr = e;
      if (i < attempts - 1) await sleep(1200 * (i + 1));
    }
  }
  throw lastErr;
};

// 活动区探针: 只认 data-pulse-* 钩子 (不依赖 id), 网关页的链上活动表与首页序栏紧凑份通用
const pulseProbe = (rootSel) => `(() => {
  const root = document.querySelector(${JSON.stringify(rootSel)});
  if (!root) return null;
  const q = (s) => root.querySelector(s);
  const t = (s) => { const n = q(s); return n ? n.textContent.trim() : null; };
  const txt = (s) => { const n = q(s); return n ? n.textContent : ''; };
  const visText = Array.from(root.querySelectorAll('.pulse-state-text')).filter((e) => getComputedStyle(e).display !== 'none')[0] || {};
  const hint = q('.pulse-hint');
  const caveat = q('.pulse-caveat');
  const hid = (k) => { const n = q('[data-pulse-total="' + k + '"]'); return n ? n.parentNode.hasAttribute('hidden') : null; };
  const form = q('[data-pulse-ipns-form]');
  const sitesEmpty = q('[data-pulse-sites-empty]');
  const table = q('[data-pulse-activity]');
  const tbody = q('[data-pulse-activity-body]');
  const trs = tbody ? Array.from(tbody.querySelectorAll('tr')) : [];
  const empty = q('[data-pulse-activity-empty]');
  const c = (tr, sel) => tr.querySelector(sel);
  return {
    state: root.getAttribute('data-pulse-state'),
    visible: visText.textContent || '',
    nodes: t('[data-pulse-total="nodes"]'),
    agents: t('[data-pulse-total="agents"]'),
    active: t('[data-pulse-total="active"]'),
    h24: t('[data-pulse-total="24h"]'),
    tasks: t('[data-pulse-total="tasks"]'),
    tasksDone: t('[data-pulse-total="tasks_completed"]'),
    tasksVerified: t('[data-pulse-total="tasks_verified"]'),
    tasksSettled: t('[data-pulse-total="tasks_settled"]'),
    signatures: t('[data-pulse-total="signatures"]'),
    tasksHidden: { tasks: hid('tasks'), done: hid('tasks_completed'), settled: hid('tasks_settled'), verified: hid('tasks_verified'), sig: hid('signatures') },
    // ★ 2026-09-24: 每个数**就地**带的口径短标记 (i.pulse-scope-tag; 快照没给口径 → 空字符串)
    scopeTags: (() => {
      const out = {};
      Array.from(root.querySelectorAll('[data-pulse-scope-tag]')).forEach((n) => {
        out[n.getAttribute('data-pulse-scope-tag')] = { text: n.textContent.trim(), title: n.getAttribute('title') || '' };
      });
      return out;
    })(),
    summary: Array.from(root.querySelectorAll('.pulse-summary li')).map((li) => {
      const b = li.querySelector('b'); const sp = li.querySelector('span'); const st = li.querySelector('.pulse-scope-tag');
      return { value: b ? b.textContent.trim() : null, label: sp ? sp.textContent.trim() : null,
        scopeTag: st ? st.textContent.trim() : null,
        key: b ? b.getAttribute('data-pulse-total') : null, hidden: li.hasAttribute('hidden') };
    }),
    act: table ? {
      headers: Array.from(table.querySelectorAll('thead th')).map((th) => th.textContent.trim()),
      caption: (table.querySelector('caption') || {}).textContent || '',
      rowCount: trs.length,
      blankRows: trs.filter((tr) => !tr.textContent.trim()).length,
      rows: trs.map((tr) => ({
        cells: Array.from(tr.querySelectorAll('td')).map((td) => td.textContent.trim()),
        task: c(tr, '.pulse-td-task code') ? c(tr, '.pulse-td-task code').textContent : null,
        taskKids: c(tr, '.pulse-td-task code') ? c(tr, '.pulse-td-task code').childNodes.length : null,
        taskHtml: c(tr, '.pulse-td-task code') ? c(tr, '.pulse-td-task code').innerHTML : null,
        ref: tr.getAttribute('data-ref'),
        stateKey: c(tr, '.pulse-state-word') ? c(tr, '.pulse-state-word').getAttribute('data-state') : null,
        stateText: c(tr, '.pulse-state-word') ? c(tr, '.pulse-state-word').textContent.trim() : null,
        kindKey: c(tr, '.pulse-kind-word') ? c(tr, '.pulse-kind-word').getAttribute('data-kind') : null,
        kindText: c(tr, '.pulse-kind-word') ? c(tr, '.pulse-kind-word').textContent.trim() : null,
        chain: c(tr, '.pulse-td-net') ? c(tr, '.pulse-td-net').getAttribute('data-chain') : null,
        net: c(tr, '.pulse-td-net') ? c(tr, '.pulse-td-net').textContent.trim() : null,
        block: c(tr, '.pulse-td-block') ? c(tr, '.pulse-td-block').textContent.trim() : null,
        conf: c(tr, '.pulse-conf') ? c(tr, '.pulse-conf').textContent.trim() : null,
        fin: c(tr, '.pulse-fin') ? c(tr, '.pulse-fin').getAttribute('data-finality') : null,
        finText: c(tr, '.pulse-fin') ? c(tr, '.pulse-fin').textContent.trim() : null,
        finClass: c(tr, '.pulse-fin') ? c(tr, '.pulse-fin').className : null,
        time: c(tr, '.pulse-td-time time') ? c(tr, '.pulse-td-time time').textContent.trim() : null,
        timeIso: c(tr, '.pulse-td-time time') ? c(tr, '.pulse-td-time time').getAttribute('datetime') : null,
        // 交易标签 / 合约链接 (2026-09-23): tag='a' = 可点 (新窗口), tag='code' = 纯文本 (链没有公网浏览器)
        txLink: (function () {
          const a = c(tr, '.pulse-tx-link'); const p = c(tr, '.pulse-tx-ref');
          return { tag: a ? 'a' : (p ? 'code' : null),
            href: a ? a.getAttribute('href') : null, target: a ? a.getAttribute('target') : null,
            rel: a ? a.getAttribute('rel') : null, text: a ? a.textContent.trim() : (p ? p.textContent.trim() : null) };
        })(),
        contractLink: (function () {
          const a = c(tr, '.pulse-contract-link');
          return { tag: a ? 'a' : null,
            href: a ? a.getAttribute('href') : null, target: a ? a.getAttribute('target') : null,
            rel: a ? a.getAttribute('rel') : null, text: a ? a.textContent.trim() : null,
            zh: a ? a.getAttribute('data-zh') : null, en: a ? a.getAttribute('data-en') : null,
            aria: a ? a.getAttribute('aria-label') : null };
        })(),
      })),
      emptyShown: empty ? getComputedStyle(empty).display !== 'none' : null,
      emptyText: empty ? empty.textContent.trim() : null,
      source: txt('[data-pulse-activity-source]').trim(),
      totalsLine: txt('[data-pulse-activity-totals]').trim(),
      totalsLineShown: (function () {
        const n = q('[data-pulse-activity-totals]');
        return n ? getComputedStyle(n).display !== 'none' : null;
      })(),
      // —— 表框几何 + 分页栏 (2026-09-24「上限 = 十五行 + 底部十五行/页」) ——
      // box = .pulse-table-scroll 那一层 (表体唯一滚动归属); 高度上限/表头是否钉住/能不能滚都从这里量。
      box: (function () {
        const b = q('[data-pulse-activity-scroll]');
        if (!b) return null;
        const r = b.getBoundingClientRect();
        const cs = getComputedStyle(b);
        const cap = q('[data-pulse-activity] caption');
        const thead = q('[data-pulse-activity] thead');
        const th = q('[data-pulse-activity] thead th');
        const thcs = th ? getComputedStyle(th) : null;
        const r0 = trs[0] ? trs[0].getBoundingClientRect() : null;
        return {
          h: +r.height.toFixed(2), clientH: b.clientHeight, scrollH: b.scrollHeight,
          scrollW: b.scrollWidth, clientW: b.clientWidth, scrollTop: b.scrollTop, top: Math.round(r.top),
          maxH: cs.maxHeight, overflowY: cs.overflowY, overflowX: cs.overflowX,
          capH: cap ? +cap.getBoundingClientRect().height.toFixed(2) : null,
          theadH: thead ? +thead.getBoundingClientRect().height.toFixed(2) : null,
          rowH: r0 ? +r0.height.toFixed(2) : null,
          thPos: thcs ? thcs.position : null, thBg: thcs ? thcs.backgroundColor : null,
        };
      })(),
      ctlShown: (function () {
        const c = q('[data-pulse-activity-ctl]');
        return c ? !(c.hasAttribute('hidden') || getComputedStyle(c).display === 'none') : null;
      })(),
      pageInfo: txt('[data-pulse-activity-pageinfo]').trim(),
      prevDisabled: q('[data-pulse-activity-prev]') ? q('[data-pulse-activity-prev]').disabled : null,
      nextDisabled: q('[data-pulse-activity-next]') ? q('[data-pulse-activity-next]').disabled : null,
      declaredPage: root.getAttribute('data-pulse-activity-page'),
      cfgPageSize: (window.__bolloonPulses && window.__bolloonPulses[0] && window.__bolloonPulses[0].config)
        ? window.__bolloonPulses[0].config.activityPageSize : null,
    } : null,
    // 旧版网关页的三块内容 (8 个数字格 / 能力分布 / 最近活动) 已不该出现在活动区里
    // (不算 .pulse-sub —— 智能体私有站的标题仍在用这个类)
    legacyBlocks: root.querySelectorAll('.pulse-stats, .pulse-stat, .pulse-grid, .pulse-cap-list, [data-pulse-caps], [data-pulse-feed]').length,
    finality: Array.from(root.querySelectorAll('.pulse-fin')).map((e) => ({ key: e.getAttribute('data-finality'), color: getComputedStyle(e).color, cls: e.className })),
    sites: Array.from(root.querySelectorAll('[data-pulse-sites] li')).map((li) => {
      const a = li.querySelector('a');
      return { label: (li.querySelector('.pulse-site-label') || {}).textContent || '',
        href: a ? a.href : null, rel: a ? a.rel : null, target: a ? a.target : null,
        text: a ? a.textContent : null, kids: a ? a.childNodes.length : null };
    }),
    sitesEmptyShown: sitesEmpty ? getComputedStyle(sitesEmpty).display !== 'none' : null,
    sitesEmptyText: sitesEmpty ? sitesEmpty.textContent.trim() : null,
    ipns: form ? { inputTag: form.querySelector('[data-pulse-ipns-input]').tagName,
      inputType: form.querySelector('[data-pulse-ipns-input]').type,
      inputAria: form.querySelector('[data-pulse-ipns-input]').getAttribute('aria-label'),
      btnTag: form.querySelector('[data-pulse-ipns-open]').tagName,
      btnType: form.querySelector('[data-pulse-ipns-open]').type,
      btnAria: form.querySelector('[data-pulse-ipns-open]').getAttribute('aria-label'),
      msgRole: form.querySelector('[data-pulse-ipns-msg]').getAttribute('role'),
      msgLive: form.querySelector('[data-pulse-ipns-msg]').getAttribute('aria-live'),
      msg: form.querySelector('[data-pulse-ipns-msg]').textContent,
      invalids: root.querySelectorAll('[data-pulse-ipns-input][aria-invalid="true"]').length } : null,
    // 合约**不上页面** (2026-09-23 leo 拍板收窄): 活动区里任何 /address/0x40 的链接都算违规
    addrLinks: Array.from(root.querySelectorAll('a')).map((a) => a.getAttribute('href') || '')
      .filter((h) => /\\/address\\/0x[0-9a-f]{40}$/i.test(h)),
    scope: t('[data-pulse-scope]'),
    // 首页快照区里的「最新一笔链上交易」(data-pulse-activity-tx; 只有首页序栏有这个钩子 → 网关页为 null)
    txLine: (function () {
      const n = q('[data-pulse-activity-tx]');
      if (!n) return null;
      const a = n.querySelector('a');
      const c2 = n.querySelector('code');
      return { text: n.textContent.trim(), tag: a ? 'a' : (c2 ? 'code' : null),
        href: a ? a.getAttribute('href') : null, target: a ? a.getAttribute('target') : null,
        rel: a ? a.getAttribute('rel') : null, kids: n.childNodes.length };
    })(),
    scopeHidden: !!q('[data-pulse-scope]') && q('[data-pulse-scope]').hasAttribute('hidden'),
    snap: t('[data-pulse-time]'),
    // <time datetime>: 机器可读的同一时刻 (缺 generated_at 时必须为空, 不许写假时刻)
    snapIso: (function () { const n = q('[data-pulse-time]'); return n ? (n.getAttribute('datetime') || '') : null; })(),
    ago: t('[data-pulse-ago]'),
    // 状态徽章右边的快照年龄 (data-pulse-age): 空 = 这份快照整份没读到 (此时不写任何年龄)
    age: t('[data-pulse-age]'),
    ageShown: (function () {
      const n = q('[data-pulse-age]');
      return n ? (getComputedStyle(n).display !== 'none' && !!n.textContent.trim()) : null;
    })(),
    stateKids: (function () { const n = q('.pulse-state'); return n ? n.childNodes.length : null; })(),
    feed: Array.from(root.querySelectorAll('[data-pulse-feed] li')).map((li) => li.textContent.trim()),
    feedText: Array.from(root.querySelectorAll('[data-pulse-feed] .pulse-feed-text')).map((e) => e.textContent),
    feedBlank: Array.from(root.querySelectorAll('[data-pulse-feed] li'))
      .filter((li) => { const s = li.querySelector('.pulse-feed-text'); return !s || !s.textContent.trim(); }).length,
    feedAt: Array.from(root.querySelectorAll('[data-pulse-feed] time')).map((e) => e.getAttribute('data-at')),
    notes: txt('[data-pulse-notes]').trim(),
    hintShown: hint ? getComputedStyle(hint).display !== 'none' : false,
    hint: hint ? hint.textContent : '',
    caveat: caveat ? caveat.textContent.trim() : '',
    api: !!window.__bolloonPulse,
  };
})()`;

// ═══ 文案预算 / 口径短标记 (2026-09-23 精简: 「这些内容不用显示, 简洁最好」) ═══
// 精简不是把诚实性删掉, 而是把长句换成**就近的极短标记**。所以这一轮的门分两半:
//   ① 要求短标记在 (统计区「观察窗口」类 + 表区「链上索引/全量」类, 少一个都红 —— 删成一片空白也红);
//   ② 要求长句/夸大措辞不在 (被删的五段一旦回来就红, 且不许反向改成「全网总量」这类更大口径)。
// 两半都硬编码在这里, 各断言共用, 免得各写一套正则。
const SCOPE_WINDOW_MARK = /观察窗口|24h|24 小时|24 hour/i;          // 统计区 (24h 脉冲事件口径)
const SCOPE_WHOLE_MARK = /全量|链上索引|whole index|chain index/i;  // 表区 (链上索引全量口径)
const SENTENCE_PUNCT = /。|；|;|——/;                                 // 成句标点 = 又写成整句了
const PROSE_CAP = { caveat: 24, source: 30, totals: 96 };           // 每个文案节点的字符上限
// 被删掉的那几段长文案的特征串 (可见文案里再出现 = 精简被回退)
const KILLED_PROSE = [
  '不是全网精确总量', 'not an exact global total',
  '观察窗口内计数', 'counts within the observation window',
  '不是数据丢了', 'not lost data', '另一套口径',
  '链上数据源：', 'on-chain data source:',
  '列表为空', 'list means none were published',
  '没有 did', 'no did', '没有 peerid', 'no peerid',
];
// 页面可见文案 (剥掉脚本/样式/服务端 notes —— notes 是签名快照里的数据原文, 不是本站文案;
// 同时剥掉 HTML 注释节点 —— textContent 会带上注释文字, 而设计意图正是留在注释里的)。
const PAGE_PROSE_JS = `(() => {
  const c = document.body.cloneNode(true);
  const w = document.createTreeWalker(c, NodeFilter.SHOW_COMMENT, null);
  const cs = []; while (w.nextNode()) cs.push(w.currentNode);
  cs.forEach((n) => n.parentNode && n.parentNode.removeChild(n));
  c.querySelectorAll('script, style, [data-pulse-notes], .pulse-notes').forEach((n) => n.remove());
  return c.textContent.replace(/\\s+/g, ' ');
})()`;
const killedHits = (text) => KILLED_PROSE.filter((k) => String(text || '').toLowerCase().includes(k));
const proseBudgetOk = (v) => {
  const nodes = [['caveat', v.caveat], ['totals', v.act && v.act.totalsLine], ['source', v.act && v.act.source]];
  const bad = [];
  for (const [k, t] of nodes) {
    const s = String(t || '').trim();
    if (!s) continue;
    if (SENTENCE_PUNCT.test(s)) bad.push(`${k}: 有整句标点「${s}」`);
    if (s.length > PROSE_CAP[k]) bad.push(`${k}: ${s.length} 字 > 上限 ${PROSE_CAP[k]}「${s}」`);
  }
  return bad;
};
// 「两套口径各自带就近短标记」: 统计区标记 + 表区标记必须同时在场。
// 表区标记可以落在口径行 (activity_totals 在时) 或表下数据源行 (老快照没有口径行时的回退)。
const scopeMarkers = (v) => {
  const stats = String(v.caveat || '');
  const table = [v.act && v.act.totalsLine, v.act && v.act.source].filter(Boolean).join(' · ');
  return { stats, table,
    statsOk: SCOPE_WINDOW_MARK.test(stats),
    tableOk: SCOPE_WHOLE_MARK.test(table),
    both: SCOPE_WINDOW_MARK.test(stats) && SCOPE_WHOLE_MARK.test(table) };
};

// ★★ 同一概念不变量门 (2026-09-24 leo:「数量怎么对不上, 尤其是后面的任务和钱包」)。
//    线上真事: 顶部写「0 任务」, 同屏的链上活动表有 15 行任务 —— 同一个概念两个数字并排, 无人解释。
//    这道门只看**页面真渲染出来的字**(DOM), 不看快照自述, 返回 [] = 无矛盾, 否则每条 = 一处并排矛盾。
//    规则 (逐条都要能在「变异快照」上真判红, 见 [6e★★★]):
//      ① 顶部数若标了「链上索引 · 全量」(与表同源) → 必须与表里同概念数**逐字相等**: 解释无效;
//      ② 不同源时 0 vs N → 顶部必须就地有口径标记 **且** 表区有「链上索引 · 全量」标记, 缺一即并排矛盾;
//      ③ 反向矛盾: 顶部报了数而表里一行都没有;
//      ④ 快照标无源 (`source:'none'`) 的数不许显示裸 0 (0 会被读成「没发生过」);
//      ⑤ 快照标 `unavailable` 的数, 页面必须真写「未接入」(不许 0 / 隐藏 / —)。
const CONTRADICTION_PAIRS = [
  ['tasks', 'tasks', '任务'],
  ['tasks_completed', 'tasks_completed', '已完成'],
  ['tasks_settled', 'tasks_settled', '已结算'],
];
const contradictionFindings = (p, snap) => {
  const out = [];
  if (!p || !p.act) return ['探针没取到活动区 (判断不了同一概念是否打架)'];
  const rows = p.act.rows || [];
  const rowCount = p.act.rowCount || 0;
  const at = (snap && snap.activity_totals) || null;
  const fields = (snap && snap.totals_scope && snap.totals_scope.fields) || null;
  const tagOf = (k) => String(((p.scopeTags || {})[k] || {}).text || '');
  const fieldOf = (k) => (fields && typeof fields[k] === 'object' && fields[k]) || null;
  const domNum = (v) => (v == null || v === '' || v === '—' ? null : (/^-?\d+$/.test(String(v)) ? Number(v) : null));
  const top = { tasks: domNum(p.tasks), tasks_completed: domNum(p.tasksDone), tasks_settled: domNum(p.tasksSettled) };
  const raw = { tasks: p.tasks, tasks_completed: p.tasksDone, tasks_settled: p.tasksSettled };
  const atN = { tasks: at && at.tasks, tasks_completed: at && at.tasks_completed, tasks_settled: at && at.tasks_settled };
  // 表格里**真画出来**的同概念数 (不同任务去重); 表只画前 60 行时用快照同源计数兜底 (不误判截断)
  const truncated = !!(snap && Array.isArray(snap.confirmed_activity) && snap.confirmed_activity.length > rowCount);
  const uniqTasks = (pred) => new Set(rows.filter(pred).map((r) => r.task).filter(Boolean)).size;
  const tbl = {
    tasks: truncated ? atN.tasks : uniqTasks(() => true),
    tasks_completed: truncated ? atN.tasks_completed : uniqTasks((r) => r.kindKey === 'task_completed'),
    tasks_settled: truncated ? atN.tasks_settled : uniqTasks((r) => r.kindKey === 'trade_settled'),
  };
  const tableMarks = [p.act.totalsLine, p.act.source].filter(Boolean).join(' · ');
  const tableOk = SCOPE_WHOLE_MARK.test(tableMarks);
  for (const [k, atKey, zh] of CONTRADICTION_PAIRS) {
    const t = top[k];
    const sameSource = SCOPE_WHOLE_MARK.test(tagOf(atKey)) ||
      !!(fieldOf(atKey) && fieldOf(atKey).source === 'chain-index');
    const n = tbl[k];
    if (sameSource && t !== n) {
      out.push(`同一概念两个数: 顶部「${zh}」=${raw[k]} 而表里 ${n} 个 (${rowCount} 行) —— 两处都标「链上索引 · 全量」却不相等`);
    }
    if (!sameSource && n > 0 && (t === null || t === 0)) {
      const tag = tagOf(atKey);
      // 「就地解释」= 这个数自带口径标记, 或统计区那条观察窗口标记 (老快照没有逐字段口径时的等价说法);
      // 表区还必须有「链上索引 · 全量」—— 两处各说清一半, 才叫解释过。
      const statsOk = SCOPE_WINDOW_MARK.test(tag) || SCOPE_WHOLE_MARK.test(tag) || SCOPE_WINDOW_MARK.test(String(p.caveat || ''));
      if (!statsOk || !tableOk) {
        out.push(`顶部「${zh}」=${raw[k]} 与表里 ${n} 个同类 (${rowCount} 行) 并排矛盾且无一字解释 (就地口径标记=${JSON.stringify(tag)})`);
      }
    }
    if (t !== null && t > 0 && rowCount === 0 && n === 0) {
      // 反向 (顶部报数 / 表里一行都没有): 只有**一处口径标记都没有**时才算矛盾 ——
      // 顶部数允许比表宽 (24h 脉冲事件 ⊃ 已确认链上行), 但必须两处各自说清, 否则读者只能读成"在撒谎"。
      const tag = tagOf(atKey);
      const statsOk = SCOPE_WINDOW_MARK.test(tag) || SCOPE_WHOLE_MARK.test(tag) || SCOPE_WINDOW_MARK.test(String(p.caveat || ''));
      if (!statsOk || !tableOk) {
        out.push(`反向矛盾: 顶部「${zh}」=${raw[k]} 而表里一行都没有, 且没有一处说明这两个数不同源`);
      }
    }
  }
  for (const k of ['tasks_verified', 'signatures']) {
    const f = fieldOf(k);
    const v = k === 'signatures' ? p.signatures : p.tasksVerified;
    // ★ 2026-09-24: 「已验证」槽已从页面整体去掉 (链上索引无源可报 → 页面不显示这一格)。
    //   ⇒「快照标了未接入就必须写未接入」只对**页面上真有这个槽**的字段成立 —— 槽根本不存在时
    //   探针读到 null, 那是「这一格已下线」而不是「页面把它藏起来了」(后者才该判红)。
    //   槽的缺席本身由 [6e★★★★] 守 (静态 HTML 钩子 0 处 + 快照契约仍在), 这里不重复也不放水。
    const slotExists = v !== null && v !== undefined;
    if (f && f.source === 'none' && domNum(v) === 0) {
      out.push(`「${k}」快照标了无源却显示裸 0 (0 会被读成「没发生过」)`);
    }
    if (f && f.unavailable === true && slotExists && !/未接入|not connected/.test(String(v == null ? '' : v))) {
      out.push(`「${k}」快照标了未接入, 页面却显示 ${JSON.stringify(v)} —— 必须如实写「未接入」`);
    }
  }
  return out;
};

async function main() {
  const chrome = resolveChrome();
  if (!chrome) { console.error('找不到 Chrome'); process.exit(1); }
  const port = 9333 + Math.floor(Math.random() * 200);
  const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bolloon-site-verify-'));
  const proc = spawn(chrome, [
    '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${userDir}`,
    // macOS: headless Chrome 默认会去访问登录钥匙串 (Safe Storage) → 后台/无人值守时
    // 会卡在系统授权弹窗上 (子智能体点不了"允许")。这些开关让 Chrome 用内存钥匙串,
    // 不碰系统钥匙串 —— 验收行为不受影响。
    '--use-mock-keychain', '--password-store=basic', '--no-first-run', '--no-default-browser-check',
    '--no-first-run', '--no-default-browser-check', '--disable-gpu', 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'ignore'] });

  // 等 CDP 就绪
  let wsUrl = null;
  for (let i = 0; i < 60 && !wsUrl; i++) {
    await sleep(300);
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (r.ok) wsUrl = (await r.json()).webSocketDebuggerUrl;
    } catch { /* 还没起来 */ }
  }
  if (!wsUrl) { console.error('Chrome CDP 未就绪'); proc.kill(); process.exit(1); }

  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0;
  const pending = new Map();
  let sessionId = null;
  // 事件通道: Fetch 拦截 (夹具数据) / console 错误 / 异常
  const handlers = new Map();
  const on = (method, fn) => {
    if (!handlers.has(method)) handlers.set(method, new Set());
    handlers.get(method).add(fn);
    return () => handlers.get(method).delete(fn);
  };
  const consoleErrors = [];
  on('Runtime.exceptionThrown', (p) => {
    const d = p.exceptionDetails || {};
    consoleErrors.push('exception: ' + (d.text || '') + ' ' + (d.exception && d.exception.description ? d.exception.description : ''));
  });
  on('Runtime.consoleAPICalled', (p) => {
    if (p.type === 'error' || p.type === 'assert') {
      consoleErrors.push('console.' + p.type + ': ' + (p.args || []).map((a) => (a.value !== undefined ? a.value : a.description || a.type)).join(' '));
    }
  });
  ws.onmessage = (ev) => {
    const msg = JSON.parse(typeof ev.data === 'string' ? ev.data : ev.data.toString());
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); return; }
    if (msg.method && handlers.has(msg.method)) handlers.get(msg.method).forEach((fn) => fn(msg.params, msg));
  };
  const cdp = (method, params = {}, useSession = true) => new Promise((resolve, reject) => {
    const mid = ++id;
    pending.set(mid, (m) => (m.error ? reject(new Error(`${method}: ${m.error.message}`)) : resolve(m.result)));
    ws.send(JSON.stringify({ id: mid, method, params, ...(useSession && sessionId ? { sessionId } : {}) }));
  });

  const { targetId } = await cdp('Target.createTarget', { url: 'about:blank' }, false);
  const att = await cdp('Target.attachToTarget', { targetId, flatten: true }, false);
  sessionId = att.sessionId;
  await cdp('Page.enable');
  await cdp('Runtime.enable');

  // —— 新窗口侦察 (IPNS 粘贴框验收用) ——
  // autoAttach + waitForDebuggerOnStart ⇒ 新标签页在启动前挂起: 验收只统计「真的开了新窗口」,
  // 然后立刻关掉它, 不让验收去访问 ipfs.io。
  const popups = [];
  let popupWatch = false;
  on('Target.attachedToTarget', (p) => { if (popupWatch && p.targetInfo.targetId !== targetId) popups.push(p.targetInfo); });
  const watchPopups = async (on2) => {
    popupWatch = on2;
    try { await cdp('Target.setAutoAttach', on2 ? { autoAttach: true, waitForDebuggerOnStart: true, flatten: true } : { autoAttach: false }, false); } catch { /* 不致命 */ }
  };
  const closePopups = async () => {
    for (const t of popups) { try { await cdp('Target.closeTarget', { targetId: t.targetId }, false); } catch { /* 已关 */ } }
    popups.length = 0;
  };

  const evalJs = async (code) => {
    const r = await cdp('Runtime.evaluate', { expression: code, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception?.description || ''));
    return r.result.value;
  };

  // 等稳定再测量 (2026-09-22 父 agent 定向要求, 治「固定 sleep」会撒谎的毛病):
  // 渲染慢的那一轮 (实测: 老快照档 rows:0 时探针已取值 = 量到中间态) 用固定 sleep 会偶发假失败,
  // 也会把「夹具没生效」误报成「页面不对」。这里轮询同一个探针:
  //   连续两次读数逐字相同 **且** 满足传入的谓词 → 才算稳定, 返回该值;
  //   超时/谓词始终不满足 → 返回最后一次读数 (断言照旧失败, 但报出来的是真实形态, 不是假的绿)。
  const waitStable = async (expr, pred, { tries = 40, interval = 150 } = {}) => {
    let prev, last = null;
    for (let i = 0; i < tries; i++) {
      const v = await evalJs(expr).catch(() => null);
      last = v;
      if (v !== null && pred(v) && JSON.stringify(v) === JSON.stringify(prev)) return v;
      prev = v;
      await sleep(interval);
    }
    return last;
  };
  // 只等一个布尔条件成立 (不比较两次读数); 超时返回 false。
  const waitUntil = async (expr, { tries = 40, interval = 150 } = {}) => {
    for (let i = 0; i < tries; i++) {
      if ((await evalJs(expr).catch(() => false)) === true) return true;
      await sleep(interval);
    }
    return false;
  };

  console.log(`=== bolloon.cn 站点真浏览器验收 (${BASE}) ===\n`);

  // live npm 版本 (作为期望值)
  // 2026-09-22 修 (假红): 原来只在开头取**一次** registry。/latest 在**发布新版本的瞬间**会翻值
  // (CDN 传播窗口), 而页面徽章是页面自己另取一次 ⇒ 两个独立来源短暂不一致 ⇒ 把「刚发布了新版本」
  // 这个**正确动作**判成假红 (实测: 页面 dom=0.4.32 而脚本 live=0.4.31 → 真域名 244/2)。
  // 改为**稳定化取值**: 连续两次读到同一个值才算稳定 (最多 12 次 × 1.5s), 拿到的就是翻值后的最终值。
  const readRegistryVersion = async () => {
    try {
      const r = await fetch('https://registry.npmjs.org/@bolloon/bolloon-agent/latest');
      if (r.ok) return (await r.json()).version;
    } catch { /* 网络问题, 后面按 DOM 判断 */ }
    return null;
  };
  let liveVersion = null;
  {
    let prev = null;
    for (let i = 0; i < 12; i++) {
      const v = await readRegistryVersion();
      liveVersion = v;
      if (v && v === prev) break;         // 连续两次一致 = 已稳定
      prev = v;
      await sleep(1500);
    }
  }
  console.log(`[0] npm registry latest = ${liveVersion || '(取不到)'} (已稳定化: 连续两次一致才采信)`);

  // ① 徽章
  console.log('\n[1] 版本徽章 (5 页)');
  for (const p of PAGES) {
    await cdp('Page.navigate', { url: `${BASE}/${p}` });
    await sleep(1200);
    // 等 JS 把徽章填上 (最多 8s)
    let shown = '';
    for (let i = 0; i < 16; i++) {
      shown = String(await evalJs(`document.getElementById('version') && document.getElementById('version').textContent.trim()`));
      if (/^\d+\.\d+\.\d+/.test(shown)) break;
      await sleep(500);
    }
    check(`${p} 徽章 = ${shown}`, /^\d+\.\d+\.\d+/.test(shown) && (!liveVersion || shown === liveVersion),
      `live=${liveVersion} dom=${shown}`);
  }

  // ② 静态占位 (断网也不谎报): 直接读原始 HTML
  console.log('\n[2] 静态 HTML 不含过期硬编码');
  for (const p of PAGES) {
    const html = await fetchText(`${BASE}/${p}`);
    const hard = /id="version">([^<]*)</.exec(html);
    const val = hard ? hard[1].trim() : '(未找到 #version)';
    check(`${p} 占位 = 「${val}」(非过期版本号)`, !/^\d+\.\d+\.\d+$/.test(val), val);
  }

  // ③ skill.html 文档同步
  console.log('\n[3] skill.html 已同步文档 v1.3.0');
  const skillHtml = await fetchText(`${BASE}/skill.html`);
  check('版本 1.3.0 (逐字)', skillHtml.includes('>1.3.0<'));
  // 版本号必须逐字断言 + 与线上 .md 的 frontmatter 对得上 —— 只匹配「1.x.y 形状」会把
  // 「本机改了、线上没部署」漏过去 (2026-09-22 实测: 线上 skill.html 长期停在 1.0.1)。
  const SKILL_EXPECT = { 'bolloon-gateway-join': '1.3.0', 'bolloon-network': '1.2.0' };
  const mdVersionOf = (md) => {
    const fm = /^---\n([\s\S]*?)\n---/.exec(md);
    if (!fm) return '(无 frontmatter)';
    const v = /^version:\s*(\S+)\s*$/m.exec(fm[1]);
    return v ? v[1] : '(未找到 version)';
  };
  const mdVersions = {};
  for (const slug of Object.keys(SKILL_EXPECT)) mdVersions[slug] = mdVersionOf(await fetchText(`${BASE}/${slug}.md`));
  check('线上 .md frontmatter 的 version 就是期望值 (两份 skill 都逐字对上)',
    Object.keys(SKILL_EXPECT).every((s) => mdVersions[s] === SKILL_EXPECT[s]), JSON.stringify(mdVersions));
  check('含「0.1 三条执行路径」', skillHtml.includes('0.1 三条执行路径'));
  check('含手机端路径 A′ (本机内核执行)', skillHtml.includes('路径 A′') && skillHtml.includes('bolloon_gateway_join'));
  check('含 join_global_gateway 工具路径', skillHtml.includes('join_global_gateway'));
  check('含 §7 首次接触 TOFU', skillHtml.includes('首次接触 TOFU'));
  check('排错含 publicKey 拒收行', skillHtml.includes('无 publicKey'));
  check('含 §11 M1 任务闭环', skillHtml.includes('11. 用买到的能力完成任务') && skillHtml.includes('bolloon task'));

  // ③′ 站内 skills 索引区 —— bolloon-UI 就是 skills 的完整索引
  console.log('\n[3b] skill.html 站内 skills 索引区 (完整索引)');
  check('有索引区 (id=skills-index + [data-skills-index])',
    skillHtml.includes('id="skills-index"') && skillHtml.includes('data-skills-index'));
  check('索引区两份 skill 名称 + 具体 version 都在原始 HTML 里 (bolloon-network = 1.2.0, 不再是「1.x.y 形状」)',
    skillHtml.includes('>bolloon-gateway-join<') && skillHtml.includes('>1.3.0<') &&
    skillHtml.includes('>bolloon-network<') && skillHtml.includes('>1.2.0<'));
  check('每行都有 read 钩子 + 复制按钮 + 直达 .md 链接',
    (skillHtml.match(/data-skill-read="bolloon-gateway-join"/g) || []).length === 1 &&
    (skillHtml.match(/data-skill-read="bolloon-network"/g) || []).length === 1 &&
    (skillHtml.match(/data-copy-skill="/g) || []).length === 2 &&
    skillHtml.includes('href="bolloon-gateway-join.md"') && skillHtml.includes('href="bolloon-network.md"'));
  await cdp('Page.navigate', { url: `${BASE}/skill.html` });
  await sleep(900);
  const idxRows = await evalJs(`(() => Array.from(document.querySelectorAll('[data-skills-index] tbody tr')).map((tr) => ({
    name: tr.cells[0].textContent.trim(), version: tr.cells[1].textContent.trim(),
    read: tr.querySelector('[data-skill-read]').textContent,
    slug: tr.querySelector('[data-skill-read]').getAttribute('data-skill-read'),
    kids: tr.querySelector('[data-skill-read]').childNodes.length,
    direct: tr.cells[4].querySelector('a').getAttribute('href'),
    copy: !!tr.querySelector('[data-copy-skill]') })))()`);
  check('索引区 read 命令按实际访问源生成 (read <BASE>/<name>.md), 文本节点只 1 个',
    Array.isArray(idxRows) && idxRows.length === 2 && idxRows.every((r) => r.read === `read ${BASE}/${r.slug}.md` && r.kids === 1),
    JSON.stringify(idxRows && idxRows.map((r) => r.read)));
  check('索引区名称/version/直达链接/复制按钮逐行都对 (bolloon-network 逐字 = 1.2.0)',
    idxRows.length === 2 &&
    idxRows[0].name === 'bolloon-gateway-join' && idxRows[0].version === '1.3.0' &&
    idxRows[0].direct === 'bolloon-gateway-join.md' && idxRows[0].copy === true &&
    idxRows[1].name === 'bolloon-network' && idxRows[1].version === '1.2.0' &&
    idxRows[1].direct === 'bolloon-network.md' && idxRows[1].copy === true,
    JSON.stringify(idxRows.map((r) => [r.name, r.version, r.direct, r.copy])));
  check('索引区 version 与线上 .md frontmatter 逐字一致 (只改一边必失败)',
    idxRows.every((r) => r.version === mdVersions[r.slug]),
    JSON.stringify({ rows: idxRows.map((r) => [r.slug, r.version]), md: mdVersions }));
  const idxCount = await evalJs(`(document.querySelector('[data-skills-count]')||{}).textContent||''`);
  check('索引区标注「共 2 份 · 索引里列的就是全部」', /共 2 份/.test(idxCount), idxCount);
  await evalJs(`(() => { window.__copyBtn = document.querySelector('[data-copy-skill="bolloon-network"]'); window.__copyBtn.click(); return 1; })()`);
  await sleep(400);   // 剪贴板写入是异步的, 等它 settle 再读按钮文案
  const idxCopy = await evalJs(`window.__copyBtn.textContent`);
  check('索引区复制按钮真的可点 (点击 → 「已复制」)', idxCopy === '已复制', idxCopy);

  // ④ gateway.html 命令
  console.log('\n[4] gateway.html 粘贴命令跟随访问源');
  await cdp('Page.navigate', { url: `${BASE}/gateway.html` });
  await sleep(1500);
  const cmd = String(await evalJs(`(document.getElementById('skill-cmd')||{}).textContent`));
  check(`命令 = "${cmd}"`, cmd.startsWith('read ') && cmd.endsWith('/bolloon-gateway-join.md'), cmd);
  check('网关页 skills 栏仍然只给一条 read 命令, 旁边指向站内 skills 索引',
    (await evalJs(`document.querySelectorAll('#skills .skill-cmd code').length`)) === 1 &&
    (await evalJs(`!!document.querySelector('#skills a[href="skill.html#skills-index"]')`)) === true);

  // ⑤ 文档正文
  console.log('\n[5] /bolloon-gateway-join.md 线上正文');
  const doc = await fetchText(`${BASE}/bolloon-gateway-join.md`);
  check('HTTP 正文含手机端路径 A′', doc.includes('路径 A′'));
  check('HTTP 正文含 version: 1.3.0', doc.includes('version: 1.3.0'));
  check('含 name: bolloon-gateway-join', doc.includes('name: bolloon-gateway-join'));
  check('含 join_global_gateway', doc.includes('join_global_gateway'));
  check('含 publicKey (TOFU 契约)', doc.includes('publicKey'));
  check('含 §7 首次接触 TOFU', doc.includes('首次接触 TOFU'));
  check('含 §11 M1 任务闭环', doc.includes('## 11. 用买到的能力完成任务') && doc.includes('bolloon task'));

  // ⑤′ /bolloon-network.md 线上正文 (bolloon 主仓 skills/bolloon-network/SKILL.md 的原样镜像)
  console.log('\n[5b] /bolloon-network.md 线上正文 (主仓 SKILL.md 镜像)');
  const netDoc = await fetchText(`${BASE}/bolloon-network.md`);
  check('首行就是 frontmatter 起始 (---)，没有前缀空行', netDoc.startsWith('---\n'), JSON.stringify(netDoc.slice(0, 16)));
  check('frontmatter 头三行原样 + version 逐字 = 1.2.0 (不是「1.x.y 形状」匹配)',
    /^---\nname: bolloon-network\nversion: 1\.2\.0\ndescription: /.test(netDoc), JSON.stringify(netDoc.slice(0, 80)));
  check('frontmatter 关键块原样 (status/tier/protocol/capabilities/plannedCapabilities/paymentModes/hardRules)',
    netDoc.includes('\nstatus: active\n') && netDoc.includes('\ntier: capability\n') &&
    netDoc.includes('\nprotocol: bolloon-task/1\n') && netDoc.includes('capabilities:\n  - network.join') &&
    netDoc.includes('plannedCapabilities:') && netDoc.includes('paymentModes:') && netDoc.includes('hardRules:'));
  check('正文首尾都在 (没被截断/没被渲染成 HTML): 标题 + §⑥ 支付规范 + 附: 清单',
    netDoc.includes('# bolloon-network — 外部 Agent 接入 Skill') && netDoc.includes('## ⑥ 支付规范') &&
    netDoc.includes('## 附: 本 Skill 的 `(planned)` 清单'));
  check('正文含真命令 (bolloon task / bolloon setup / 54188), 不是占位摘要',
    netDoc.includes('bolloon task') && netDoc.includes('bolloon setup') && netDoc.includes('54188'));

  // ——— CDP Fetch 拦截: 用夹具数据确定性地驱动脉冲区的四种状态 ———
  // 注意: 文档 URL 里带着 ?pulse=<夹具地址>, 所以 urlPattern 也会命中文档本身 ——
  // 必须把非目标请求 (Document 等) 立刻 continueRequest, 否则 Page.navigate 永远不返回。
  const PULSE_PATTERN = '*network-pulse-verify*';
  const pausedQueue = [];
  const pausedWaiters = [];
  let shouldIntercept = () => false;
  // 多实例隔离用: 第二实例的来源 (直接失败 / 过期夹具) + 「让第一个实例的取数失败」开关
  const B_SRC = `${BASE}/network-pulse-verify-b.json`;
  let bMode = 'fail';
  let aFail = false;
  // 「缺 tasks* + agent_sites 为空」夹具 (第三档) 的开关
  let cMode = 'full';
  // 新事件 kind / 30s 轮询自动更新 夹具 (第四档) 的开关: base → 新 kind 快照; grown → 新 agent 加入后的快照
  let growMode = 'base';
  // 浏览器链接夹具 (第五档) 的开关: chain → 六行混装 (真链可点 / 本机链纯文本); local → 只有本机链一行
  let eMode = 'chain';
  // 变异快照 (第六档, 2026-09-24 新不变量门) 的开关: 'tasks-zero' | 'sig-bare-zero' | 'sig-unavailable'
  let contraMode = 'tasks-zero';

  // ——— 夹具自证的取证通道 (只记账, 不改拦截行为) ———
  // 为什么需要: 靠拦截换夹具的断言, 一旦拦截没命中 (请求被放行去了 CDN / 命中缓存 / 超时),
  // 页面拿到的就是**真快照** —— 那种 DOM 形态与「页面坏了」一模一样, 红的时候分不清谁错。
  // 这里把「拦到什么、回了哪一份、还是压根没拦住」逐条记下来, 断言前的自证 (fxSelfProof)
  // 和失败消息都从这里取证 (请求 URL / 拦截模式 / 是否 CDN 接管)。
  const fxServed = new Map();      // tag → 拦截命中并回了这份夹具的次数 (页面自己的取数请求)
  const fxServedUrls = new Map();  // tag → 最后一次回夹具的请求 URL
  const fxFailed = new Map();      // tag → 我方**故意** failRequest 的次数 (unavailable 档夹具)
  const fxDiag = [];               // 最近 10 条拦截记录 (报错时一起打印)
  let fxFetchOn = false;           // CDP Fetch.enable 是否已发 (拦截链路的前置条件)
  let fxPattern = null;            // 当前拦截模式
  const fxClock = () => new Date().toISOString().slice(11, 19);
  const fxLog = (line) => { fxDiag.push(`${fxClock()} ${line}`); if (fxDiag.length > 10) fxDiag.shift(); };
  const fxHit = (tag, url) => { fxServed.set(tag, (fxServed.get(tag) || 0) + 1); fxServedUrls.set(tag, url); };
  const fxFailHit = (tag, url) => { fxFailed.set(tag, (fxFailed.get(tag) || 0) + 1); fxServedUrls.set(tag, url); };
  const shortUrl = (u) => String(u || '').replace(/^https?:\/\//, '').slice(0, 96);

  on('Fetch.requestPaused', (p) => {
    // 自证探针优先: 不受本节 shouldIntercept 开关影响, 也永不进手工队列。
    // 探针 URL 与夹具同 pattern (network-pulse-verify*) —— 它拿回 marker ⇒ 拦截链路对这类 URL 是活的。
    if (p.request.url.includes('network-pulse-verify-probe')) {
      const m = /[?&]tag=([^&]+)/.exec(p.request.url);
      const tag = m ? decodeURIComponent(m[1]) : 'unknown';
      fxLog(`探针命中 → 回探针夹具 marker=probe:${tag}`);
      fulfillJson(p.requestId, { __verify_fixture: 'probe:' + tag, probe_tag: tag, served_at: Date.now() });
      return;
    }
    // 文档请求也命中 pattern (URL 里带着 ?pulse=<夹具地址>), 必须放行, 否则 Page.navigate 不返回
    if (p.resourceType === 'Document' || !shouldIntercept(p)) {
      if (p.resourceType !== 'Document') fxLog(`放行(未拦) ${shortUrl(p.request.url)}`);
      cdp('Fetch.continueRequest', { requestId: p.requestId }).catch(() => {});
      return;
    }
    // 第六档: 变异快照 (2026-09-24 新不变量门) —— contraMode 决定回哪一份:
    //   'tasks-zero' → 顶部 0 任务 + 逐字段口径仍写链上索引 (同源不相等, 必须判红)
    //   'sig-bare-zero' → 签名 = 0 而无源 (裸 0, 必须判红)
    //   'sig-unavailable' → 签名 = null + 未接入 (正例: 页面必须写「未接入」, 门必须干净)
    // ⚠️ 必须排在 C 档之前: URL 里的 'network-pulse-verify-contra' 含有 'network-pulse-verify-c' 子串,
    //    放在后面会被 C 档先吃掉 (夹具名撞了 → 变异根本没生效, 而断言会读成"页面错")。
    if (p.request.url.includes('network-pulse-verify-contra')) {
      const pick = contraMode === 'sig-bare-zero' ? FX_CONTRA_SIG_BARE_ZERO
        : contraMode === 'sig-unavailable' ? FX_SIG_UNAVAILABLE : FX_CONTRA_TASKS_ZERO;
      if (!pick) { cdp('Fetch.continueRequest', { requestId: p.requestId }).catch(() => {}); return; }
      fxHit(`contra-${contraMode}`, p.request.url);
      fxLog(`Contra 档 (${contraMode}) → 回变异快照 contra-${contraMode}`);
      fulfillJson(p.requestId, pick);
      return;
    }
    // 第二实例的来源: 按 bMode 直接失败或回过期夹具 (不走手工队列)
    if (p.request.url.includes('network-pulse-verify-b')) {
      if (bMode === 'fail') {
        fxFailHit('b-fail', p.request.url);
        fxLog(`B 档 → 我方故意 failRequest (ConnectionRefused) ${shortUrl(p.request.url)}`);
        cdp('Fetch.failRequest', { requestId: p.requestId, errorReason: 'ConnectionRefused' }).catch(() => {});
      } else {
        fxHit('expired-b', p.request.url);
        fxLog(`B 档 → 回过期夹具 (expired-b) ${shortUrl(p.request.url)}`);
        fulfillJson(p.requestId, FX_EXPIRED);
      }
      return;
    }
    // 第三档: cMode='full' → FX_LIVE; 'no-tasks' → FX_NO_TASKS (缺 tasks* 且 agent_sites=[]);
    //        'pulse-zero' → FX_PULSE_ZERO (0 任务 + 25 行, 快照自带口径说明);
    //        'pulse-zero-legacy' → 同形但没有口径三块 (口径行必须整行隐藏)
    if (p.request.url.includes('network-pulse-verify-c')) {
      const tag = cMode === 'full' ? 'live' : cMode === 'no-tasks' ? 'no-tasks'
        : cMode === 'pulse-zero' ? 'pulse-zero' : cMode === 'tasks-many' ? 'tasks-many'
          : cMode === 'activity-many' ? 'activity-many' : 'pulse-zero-legacy';
      fxHit(tag, p.request.url);
      fxLog(`C 档 (${cMode}) → 回夹具 ${tag}`);
      fulfillJson(p.requestId,
        cMode === 'full' ? FX_LIVE
          : cMode === 'no-tasks' ? FX_NO_TASKS
            : cMode === 'pulse-zero' ? FX_PULSE_ZERO
              : cMode === 'tasks-many' ? FX_TASKS_MANY
                : cMode === 'activity-many' ? (FX_ACTIVITY_MANY || FX_LIVE)
                  : FX_PULSE_ZERO_LEGACY);
      return;
    }
    // 第五档: 浏览器链接夹具 (2026-09-23) —— 每轮按 eMode 自动回夹具 (不走手工队列),
    //   'chain' → 六行混装 (真链可点 / 本机链纯文本); 'local' → 只有本机链一行 (绝无 explorer 字段)
    if (p.request.url.includes('network-pulse-verify-explorer')) {
      const tag = eMode === 'local' ? 'explorer-local' : 'explorer';
      fxHit(tag, p.request.url);
      fxLog(`Explorer 档 (${eMode}) → 回夹具 ${tag}`);
      fulfillJson(p.requestId, fxMark(eMode === 'local' ? FX_EXPLORER_LOCAL : FX_EXPLORER, tag));
      return;
    }
    // 第六档: 变异快照 (2026-09-24 新不变量门) —— contraMode 决定回哪一份:
    //   'tasks-zero' → 顶部 0 任务 + 逐字段口径仍写链上索引 (同源不相等, 必须判红)
    //   'sig-bare-zero' → 签名 = 0 而无源 (裸 0, 必须判红)
    //   'sig-unavailable' → 签名 = null + 未接入 (正例: 页面必须写「未接入」, 门必须干净)
    if (p.request.url.includes('network-pulse-verify-contra')) {
      const pick = contraMode === 'sig-bare-zero' ? FX_CONTRA_SIG_BARE_ZERO
        : contraMode === 'sig-unavailable' ? FX_SIG_UNAVAILABLE : FX_CONTRA_TASKS_ZERO;
      if (!pick) { cdp('Fetch.continueRequest', { requestId: p.requestId }).catch(() => {}); return; }
      fxHit(`contra-${contraMode}`, p.request.url);
      fxLog(`Contra 档 (${contraMode}) → 回变异快照 contra-${contraMode}`);
      fulfillJson(p.requestId, pick);
      return;
    }
    // 第四档: 新事件 kind + 数值变化自动反映 —— 每轮请求都按 growMode 自动回夹具 (不走手工队列),
    // 这样 30s 自动轮询拿到的是「新 agent 加入后」的快照, 而验收无需手动触发 refresh。
    if (p.request.url.includes('network-pulse-verify-grow')) {
      const tag = growMode === 'grown' ? 'grown' : 'newkinds';
      fxHit(tag, p.request.url);
      fxLog(`Grow 档 (${growMode}) → 回夹具 ${tag}`);
      fulfillJson(p.requestId, growMode === 'grown' ? FX_GROWN : FX_NEWKINDS);
      return;
    }
    // 「让第一个实例失败」开关
    if (aFail && p.request.url.includes('network-pulse-verify.json')) {
      fxFailHit('a-fail', p.request.url);
      fxLog(`A 档 → 我方故意 failRequest (aFail) ${shortUrl(p.request.url)}`);
      cdp('Fetch.failRequest', { requestId: p.requestId, errorReason: 'ConnectionRefused' }).catch(() => {});
      return;
    }
    fxLog(`进手工队列 (等验收侧 fulfill) ${shortUrl(p.request.url)}`);
    const w = pausedWaiters.shift();
    if (w) w(p); else pausedQueue.push(p);
  });
  const nextPaused = (timeout = 8000) => {
    if (pausedQueue.length) return Promise.resolve(pausedQueue.shift());
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('等待 Fetch.requestPaused 超时')), timeout);
      pausedWaiters.push((p) => { clearTimeout(t); resolve(p); });
    });
  };
  const fulfillJson = (requestId, obj) => cdp('Fetch.fulfillRequest', {
    requestId,
    responseCode: 200,
    responseHeaders: [
      { name: 'Content-Type', value: 'application/json' },
      { name: 'Cache-Control', value: 'no-store' },
    ],
    body: Buffer.from(JSON.stringify(obj), 'utf8').toString('base64'),
  });
  // CDP Fetch 开关的唯一入口 (记账用: 自证要报「拦截模式 / Fetch 是否已开」)
  const fxEnable = async (pattern) => {
    await cdp('Fetch.enable', { patterns: [{ urlPattern: pattern, requestStage: 'Request' }] });
    fxFetchOn = true; fxPattern = pattern;
  };
  const fxDisable = async () => { await cdp('Fetch.disable'); fxFetchOn = false; };

  const T0 = Date.now();
  // —— 快照时间的期望值一律**从夹具的 generated_at 推导** (脚本自己定的那个毫秒数), 不写死字符串 ——
  // 写死就变成「页面必须显示我抄的那个时间」, 抄错了反而绿; 推导出来才能真正验「显示的就是快照字段」。
  const localAbs = (ms) => {
    const d = new Date(ms); const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  };
  // 相对时间的分钟数 (与 app.js relTime 同一套取整) —— 断言用「与 generated_at 一致 (±1 分钟)」而不是逐字,
  // 因为验收跑一轮要几分钟, 分钟数会自己走一格, 那不是页面错。
  const relMinutes = (ms) => Math.round((Date.now() - ms) / 60000);
  // 页面上的相对时间文本 → 分钟数 (只认「N 分钟前」; 小时/天档单独断言)
  const agoMinutesOf = (s) => { const m = /\((\d+) 分钟前\)/.exec(String(s || '')); return m ? Number(m[1]) : null; };
  // 活动文本故意带 <b>: 用它证明渲染走 textContent 而不是 innerHTML
  const MARKUP_TEXT = { zh: '节点 <b>42</b> 发布 manifest & 计数', en: 'Node <b>42</b> published a manifest & counters' };
  const iso = (ms) => new Date(ms).toISOString();
  // —— 链上活动夹具 (confirmed_activity 冻结形状) ——
  // 故意混进 全长 40 位地址 / 全长 64 位 sha256 / 裸 64 位 hex:
  // 页面必须只显示短写 (0x12ab…b5c6 / sha256:cc33…), 全长绝不进可见文本。
  const ACT_LONG_ADDR = '0x12ab34cd56ef7890a1b2c3d4e5f60718293a4b5c6';
  const ACT_LONG_HASH = 'sha256:cc33dd44ee55ff6677889900aabbccddeeff00112233445566778899aabbccdd';
  const ACT_BARE_HASH = 'a1b2c3d4e5f60718293a4b5c6d7e8f90112233445566778899aabbccddeeff00';
  // 任务标识里带 <b>: 证明表格单元格也走 textContent (标签不会被解析)
  const MARKUP_TASK = 'sha256:<b>42</b> probe';
  const ACT_LIVE = [
    { task: 'sha256:1a2b3c4d', kind: 'task_created', state: 'active', chain_id: 84532, block: 47142222,
      tx: 'sha256:9f0e1d2c', confirmations: 12, finality: 'observed', at: iso(T0 - 3 * 60000) },
    { task: ACT_LONG_ADDR, kind: 'task_completed', state: 'released', chain_id: 84532, block: 47142500,
      tx: ACT_LONG_HASH, confirmations: 128, finality: 'finalized', at: iso(T0 - 40 * 60000) },
    { task: 'sha256:aa11bb22', kind: 'task_accepted', state: 'active', chain_id: 84532, block: 47142301,
      tx: ACT_BARE_HASH, confirmations: 42, finality: 'confirmed', at: iso(T0 - 8 * 60000) },
    { task: 'sha256:77aa88bb', kind: 'trade_settled', state: 'refunded', chain_id: 84532, block: 47142610,
      tx: 'sha256:deadbeef', confirmations: 3, finality: 'observed', at: iso(T0 - 20 * 60000) },
    { task: 'sha256:55cc66dd', kind: 'trade_verified', state: 'expired', chain_id: 84532, block: 47142699,
      tx: 'sha256:cafebabe', confirmations: 6, finality: 'confirmed', at: iso(T0 - 15 * 60000) },
    { task: 'sha256:11ee22ff', kind: 'unknown_future_kind_2099', state: 'disputed', chain_id: 84532, block: 47142777,
      tx: 'sha256:0f1e2d3c', confirmations: 0, finality: 'finalized', at: iso(T0 - 5 * 60000) },
    { task: 'sha256:99aa00bb', kind: 'task_created', state: 'unknown', chain_id: 84532, block: 47142800,
      tx: 'sha256:1234abcd', confirmations: 1, finality: 'unknown', at: iso(T0 - 2 * 60000) },
    // task 缺失 → 用 tx 当任务标识 (仍要画一行, 不能空着)
    { kind: 'task_accepted', state: 'active', chain_id: 84532, block: 47142900,
      tx: 'sha256:abcdef12', confirmations: 2, finality: 'observed', at: iso(T0 - 60000) },
    // task 与 tx 都空 → 这一条不该画出来 (宁可少一行, 不留空行)
    { task: '', tx: '', kind: 'task_created', state: 'active', chain_id: 84532, block: 47142901,
      confirmations: 1, finality: 'observed', at: iso(T0 - 30000) },
  ];
  // IPNS 夹具: 三种合法形态 (裸 k51… / ipns://12D3… / /ipns/k51…) + 一条非法 (必须被丢弃, 不渲染链接)
  const CID_1 = 'k51qzi5uqu5dlvj2baxnqndepeb86cbk3ng7n3i46uzyxzyqj2xjonzllnv0v8';
  const CID_2 = '12D3KooWQq7fUuY8gTZ2mNpRx4vBcDeFkLg';
  const CID_3 = 'k51qzi5uqu5dgn2p8v06tw5xrs3lhhh9sfwvbm2baxnqndepeb86cbk3ng';
  const IPNS_OK = [CID_1, 'ipns://' + CID_1, '/ipns/' + CID_1, 'https://ipfs.io/ipns/' + CID_2, 'ipns://' + CID_2, '/ipns/' + CID_3, CID_3];
  const IPNS_BAD = ['', '   ', 'hello', 'ipns://', '/ipns/', 'javascript:alert(1)', 'https://evil.example/x',
    'k51', 'QmTooShort', 'file:///etc/passwd', 'data:text/html,x', CID_1 + '/extra/path'];
  const FX_LIVE = {
    status: 'live', generated_at: T0 - 3 * 60000, fresh_until: T0 + 3600000,
    scope: 'observed', scope_label: { zh: '当前节点观察到', en: 'Observed by this node' },
    totals: { nodes: 7, agents: 12, active_agents: 4, seen_last_24h: 5, tasks: 21, tasks_completed: 13, tasks_verified: 6, signatures: 42 },
    agent_sites: [
      { label: 'leo-node', ipns: CID_1, added_at: T0 - 86400000 },
      { label: 'research', ipns: 'ipns://' + CID_2, added_at: T0 - 3600000 },
      { label: 'mirror', ipns: '/ipns/' + CID_3, added_at: T0 - 60000 },
      { label: 'bogus', ipns: 'javascript:alert(1)', added_at: T0 },       // 非法 → 必须不渲染
    ],
    confirmed_activity_source: 'chain-index',
    confirmed_activity: ACT_LIVE,
    capabilities: [{ key: 'code-review', count: 6 }, { key: 'translation', count: 3 }, { key: 'other', count: 2 }],
    recent_activity: [
      { kind: 'manifest_published', at: T0 - 3 * 60000, text: MARKUP_TEXT },
      { kind: 'node_joined', at: T0 - 2 * 3600000, text: { zh: '一个新节点加入', en: 'A node joined' } },
    ],
    notes: ['计数按隐私阈值合并', '观察窗口内的聚合值'],
  };
  // 缺 tasks* 三个聚合计数 + confirmed_activity 空 + agent_sites 空数组:
  // 证明「拿不到就不显示」「空表要说明白」「空 ≠ 没数据」
  const FX_NO_TASKS = {
    status: 'live', generated_at: T0 - 60000, fresh_until: T0 + 3600000,
    scope: 'verified', scope_label: { zh: '网络观察快照', en: 'Verified network snapshot' },
    totals: { nodes: 2, agents: 3, active_agents: 0, seen_last_24h: 3 },
    confirmed_activity_source: 'none',
    confirmed_activity: [],
    agent_sites: [],
    capabilities: [{ key: 'search', count: 1 }],
    recent_activity: [],
    notes: [],
  };
  // status 仍写 live, 靠 fresh_until 已过来证明「过期即 stale, 不伪装实时」
  const FX_EXPIRED = {
    status: 'live', generated_at: T0 - 3600000, fresh_until: T0 - 60000,
    scope: 'verified', scope_label: { zh: '网络观察快照', en: 'Verified network snapshot' },
    totals: { nodes: 9, agents: 15, active_agents: 0, seen_last_24h: 2 },
    capabilities: [{ key: 'search', count: 4 }],
    recent_activity: [],
    notes: [],
  };
  const FX_STALE_FLAG = {
    status: 'stale', generated_at: T0 - 7200000, fresh_until: T0 + 60000,
    scope: 'observed', scope_label: { zh: '当前节点观察到', en: 'Observed by this node' },
    totals: { nodes: 3, agents: 3, active_agents: 1, seen_last_24h: 1 },
    capabilities: [], recent_activity: [], notes: ['快照已过期'],
  };
  // —— 快照时间夹具 (2026-09-24): 「这份快照有多新」必须写在页面上 ——
  //   ① FX_NO_TIME: 快照读到了, 但**没有** generated_at 字段 → 页面只能如实写「快照未标注时间」,
  //      **绝不许**拿 Date.now() 顶替 (顶替 = 把不知道多久以前的快照说成刚生成的, 是伪造不是兜底)。
  //   ② FX_ISO_TIME: generated_at 写成 ISO 字符串 (老写法) → 与毫秒数一样必须显示成**那个**时刻。
  //   notes 各自一份: fxMark 会往 notes 里追自证标记, 共用同一个数组会把两份夹具的标记串到一起 (自证就废了)。
  const ISO_GEN = T0 - 2 * 3600000;
  const FX_NO_TIME = (() => {
    const c = { ...FX_LIVE, notes: (FX_LIVE.notes || []).slice() };
    delete c.generated_at;
    return c;
  })();
  const FX_ISO_TIME = { ...FX_LIVE, notes: (FX_LIVE.notes || []).slice(), generated_at: new Date(ISO_GEN).toISOString() };

  // ——— 链上活动表的容错契约: 认不出的 kind / state / finality 一律原样显示, 空标识不画行 ———
  const EN_ONLY_TEXT = 'EN-only server text (no zh)';
  // 基准轮 3 条: ① 任务标识里带 <b> (证明单元格走 textContent)
  //             ② 枚举全认不出 (kind/state/finality 原样显示, 不猜)
  //             ③ task 与 tx 全空 (必须不画这一行)
  const FX_ACT_ROWS = [
    { task: MARKUP_TASK, kind: 'task_created', state: 'active', chain_id: 84532, block: 47150000,
      tx: 'sha256:11112222', confirmations: 2, finality: 'observed', at: iso(T0 - 30000) },
    { task: 'sha256:abcd1234', kind: 'brand_new_kind_2099b', state: 'settling', chain_id: 1, block: 21000000,
      tx: 'sha256:33334444', confirmations: 9, finality: 'settled-weird', at: iso(T0 - 40000) },
    { task: '', tx: '', kind: 'task_completed', state: 'active', chain_id: 84532, block: 47150001,
      confirmations: 1, finality: 'observed', at: iso(T0 - 50000) },
  ];
  const FX_NEWKINDS = {
    status: 'live', generated_at: T0 - 60000, fresh_until: T0 + 600000,
    scope: 'observed', scope_label: { zh: '当前节点观察到', en: 'Observed by this node' },
    totals: { nodes: 7, agents: 12, active_agents: 4, seen_last_24h: 5, tasks: 21, tasks_completed: 13, tasks_verified: 6, signatures: 3 },
    confirmed_activity_source: 'pulse-events',
    confirmed_activity: FX_ACT_ROWS,
    agent_sites: [],
    capabilities: [{ key: 'code-review', count: 6 }],
    recent_activity: [],
    notes: [],
  };
  // —— 浏览器链接夹具 (2026-09-23): 「真链行可点 / 本机链行不可点」两页各验一遍 ——
  // 六行覆盖六种情形: ①真链齐全(**还硬塞了 explorer_contract** —— 看页面会不会把它渲染出来) ②本机链(31337)有事实但没链接 ③有哈希没合约 ④域名不在白名单
  //                   ⑤链接指向**别的**哈希 (必须不渲染成链接) ⑥本机链行被人硬塞了合法 basescan 链接
  const FX_TX_A = '0x' + 'a1'.repeat(32);
  const FX_TX_B = '0x' + 'b2'.repeat(32);
  const FX_TX_C = '0x' + 'd4'.repeat(32);
  const FX_TX_LOCAL = '0x' + 'c3'.repeat(32);
  const FX_ESCROW = '0x' + '4e'.repeat(20);
  const FX_URL_TX_A = `https://basescan.org/tx/${FX_TX_A}`;
  const FX_URL_TX_B = `https://basescan.org/tx/${FX_TX_B}`;
  const FX_URL_C_A = `https://basescan.org/address/${FX_ESCROW}`;
  const FX_SHORT_A = '0xa1a1…a1a1';         // 页面上的短写标签 (头 4…尾 4)
  const FX_SHORT_LOCAL = '0xc3c3…c3c3';
  const FX_EXPLORER_ROWS = [
    { task: 'sha256:0a0a0a0a', kind: 'trade_settled', state: 'released', chain_id: 8453, block: 51640672,
      tx: 'sha256:7ab4155b', confirmations: 14, finality: 'finalized', at: iso(T0 - 60000),
      tx_hash: FX_TX_A, contract: FX_ESCROW, explorer_tx: FX_URL_TX_A, explorer_contract: FX_URL_C_A },
    { task: 'sha256:0b0b0b0b', kind: 'task_created', state: 'active', chain_id: 31337, block: 676,
      tx: 'sha256:11112222', confirmations: 1, finality: 'observed', at: iso(T0 - 120000),
      tx_hash: FX_TX_LOCAL, contract: FX_ESCROW },
    { task: 'sha256:0c0c0c0c', kind: 'task_completed', state: 'active', chain_id: 8453, block: 51640600,
      tx: 'sha256:33334444', confirmations: 5, finality: 'confirmed', at: iso(T0 - 180000),
      tx_hash: FX_TX_B, explorer_tx: FX_URL_TX_B },
    { task: 'sha256:0d0d0d0d', kind: 'task_created', state: 'active', chain_id: 8453, block: 51640500,
      tx: 'sha256:55556666', confirmations: 2, finality: 'observed', at: iso(T0 - 240000),
      tx_hash: FX_TX_C, explorer_tx: `https://evil.example/tx/${FX_TX_C}` },
    { task: 'sha256:0e0e0e0e', kind: 'trade_verified', state: 'expired', chain_id: 8453, block: 51640400,
      tx: 'sha256:77778888', confirmations: 3, finality: 'observed', at: iso(T0 - 300000),
      tx_hash: FX_TX_C, explorer_tx: `https://basescan.org/tx/${FX_TX_B}` },        // 指向别的哈希 → 不给链接
    { task: 'sha256:0f0f0f0f', kind: 'trade_settled', state: 'refunded', chain_id: 31337, block: 675,
      tx: 'sha256:99990000', confirmations: 1, finality: 'observed', at: iso(T0 - 360000),
      tx_hash: '0x' + 'e5'.repeat(32), contract: FX_ESCROW,
      explorer_tx: `https://basescan.org/tx/${'0x' + 'e5'.repeat(32)}`,
      explorer_contract: FX_URL_C_A },                                             // 本机链 + 硬塞合法链接: 一律不许渲染
  ];
  const FX_EXPLORER = {
    status: 'live', generated_at: T0 - 60000, fresh_until: T0 + 3600000,
    scope: 'verified', scope_label: { zh: '网络观察快照', en: 'Verified network snapshot' },
    totals: { nodes: 4, agents: 5, active_agents: 1, seen_last_24h: 5, tasks: 2, tasks_completed: 1, tasks_verified: 1, signatures: 1 },
    confirmed_activity_source: 'chain-index',
    confirmed_activity: FX_EXPLORER_ROWS,
    agent_sites: [], capabilities: [{ key: 'other', count: 2 }], recent_activity: [], notes: ['浏览器链接夹具'],
  };
  // 只有本机链一行 (31337, 有 tx_hash/contract 但绝无 explorer 字段) → 两页都必须保持纯文本
  const FX_EXPLORER_LOCAL = {
    status: 'live', generated_at: T0 - 60000, fresh_until: T0 + 3600000,
    scope: 'observed', scope_label: { zh: '当前节点观察到', en: 'Observed by this node' },
    totals: { nodes: 2, agents: 3, active_agents: 1, seen_last_24h: 3, tasks: 1, tasks_completed: 0, tasks_verified: 0, signatures: 0 },
    confirmed_activity_source: 'chain-index',
    confirmed_activity: [{
      task: 'sha256:0b0b0b0b', kind: 'task_created', state: 'active', chain_id: 31337, block: 676,
      tx: 'sha256:11112222', confirmations: 1, finality: 'observed', at: iso(T0 - 120000),
      tx_hash: FX_TX_LOCAL, contract: FX_ESCROW,
    }],
    agent_sites: [], capabilities: [{ key: 'other', count: 2 }], recent_activity: [], notes: ['本机链夹具 (无公网浏览器)'],
  };

  // 「公开页数字不许打架」夹具 (2026-09-22 leo 拍板): 复刻真快照那一幕 ——
  // 小结行是 totals.tasks=0 / tasks_completed=0 / signatures=0 (24h 脉冲事件口径),
  // 而 confirmed_activity 有 **25 行** (链上索引口径), 且快照自带 activity_totals (同源计数) +
  // totals_scope.differs_from_activity + chain_id_scope (本机 31337 · 非公网)。
  // 页面必须把这两套口径的关系讲在明面上 ——「0 个任务」与「25 行任务」并存而不解释 = 验收失败。
  const ZERO_TASKS_NOTE = '口径不同, 不是数据丢失: totals.tasks/tasks_completed/tasks_verified/signatures 只数本节点 24h 窗口内的脉冲事件 (本快照 tasks=0 · tasks_completed=0 · tasks_verified=0 · signatures=0); 上表 25 行来自链上索引 (全量, 不是 24h 窗口) —— 同源计数见 activity_totals';
  const ACT_25 = Array.from({ length: 25 }, (_, i) => ({
    // 12 个不同任务 (i % 12) × 三种事件 → 与真快照的 25 行 / 12 任务同形
    task: 'sha256:' + (i % 12 + 16).toString(16).padStart(2, '0').repeat(4),
    kind: i % 3 === 0 ? 'task_created' : (i % 3 === 1 ? 'task_completed' : 'trade_settled'),
    state: i % 3 === 1 ? 'active' : (i % 3 === 2 ? 'released' : 'active'),
    chain_id: 31337, block: 676 - i,
    tx: 'sha256:' + (i + 48).toString(16).padStart(2, '0').repeat(4),
    confirmations: 1 + i,
    finality: i < 4 ? 'confirmed' : 'finalized',
    at: iso(T0 - i * 60000),
  }));
  const FX_PULSE_ZERO = {
    status: 'live', generated_at: T0 - 60000, fresh_until: T0 + 3600000,
    scope: 'verified', scope_label: { zh: '网络观察快照', en: 'Verified network snapshot' },
    totals: { nodes: 3, agents: 4, active_agents: 3, seen_last_24h: 4, tasks: 0, tasks_completed: 0, tasks_verified: 0, signatures: 0 },
    totals_scope: {
      source: 'pulse-events', window_ms: 86400000,
      label: { zh: '只统计本节点 24h 观察窗口内收到的脉冲事件 (本节点自己上报的)', en: 'Only pulse events received by this node within the 24h observation window' },
      differs_from_activity: true,
    },
    confirmed_activity_source: 'chain-index',
    confirmed_activity: ACT_25,
    activity_totals: {
      source: 'chain-index', rows: 25, tasks: 12, tasks_completed: 7, tasks_settled: 6,
      by_finality: { observed: 0, confirmed: 4, finalized: 21 }, gates: { confirmed: 1, finalized: 12 },
    },
    chain_id_scope: {
      chain_ids: [31337], activity_chain_id: 31337,
      activity_chain_label: { zh: '本机隔离开发链', en: 'local isolated dev chain' },
      is_public_network: false, public_network_rows: 0,
      public_network: { chain_id: 84532, label: { zh: 'Base Sepolia 测试网', en: 'Base Sepolia testnet' } },
      note: { zh: 'chain_id 归属: 上表 25 行来自 chainId 31337（本机隔离开发链） · 公网链（Base Sepolia 测试网 84532）0 行 —— 这不是公网活动', en: 'chain_id scope: all 25 rows come from chainId 31337' },
    },
    agent_sites: [],
    capabilities: [{ key: 'other', count: 3 }],
    recent_activity: [],
    notes: ['多签名来源汇总 (2 个签名节点)', 'confirmed_activity 来自链上索引 (chain-index): 25 行 · 12 个不同任务 · finality 分布 observed=0 / confirmed=4 / finalized=21', ZERO_TASKS_NOTE],
  };
  // 老快照 (有 25 行但**没有** activity_totals/totals_scope/chain_id_scope): 口径行必须整行隐藏, 不猜不编
  const FX_PULSE_ZERO_LEGACY = (() => {
    const c = { ...FX_PULSE_ZERO };
    delete c.activity_totals; delete c.totals_scope; delete c.chain_id_scope;
    return c;
  })();
  // 下一轮轮询的快照: 一个新 agent 加入 (计数自己变) + 表里多出一条已验证交易
  const FX_GROWN = {
    status: 'live', generated_at: T0 + 60000, fresh_until: T0 + 900000,
    scope: 'observed', scope_label: { zh: '当前节点观察到', en: 'Observed by this node' },
    totals: { nodes: 8, agents: 13, active_agents: 5, seen_last_24h: 6, tasks: 22, tasks_completed: 14, tasks_verified: 7, signatures: 42 },
    confirmed_activity_source: 'chain-index',
    confirmed_activity: [
      { task: 'sha256:ffeeddcc', kind: 'trade_verified', state: 'released', chain_id: 84532, block: 47150999,
        tx: 'sha256:99887766', confirmations: 64, finality: 'finalized', at: iso(T0 - 5000) },
    ].concat(FX_ACT_ROWS.slice(0, 2)),
    agent_sites: [],
    capabilities: [{ key: 'code-review', count: 6 }],
    recent_activity: [],
    notes: [],
  };
  // 首页活动流仍在用的「只有一种语言」夹具 (语言回落规则: 缺当前语言退回另一种, 仍是服务端原文)
  const FX_EN_ONLY = {
    status: 'live', generated_at: T0 - 30000, fresh_until: T0 + 600000,
    scope: 'observed', scope_label: { zh: '当前节点观察到', en: 'Observed by this node' },
    totals: { nodes: 7, agents: 12, active_agents: 4, seen_last_24h: 5, tasks: 21, tasks_completed: 13, tasks_verified: 6, signatures: 42 },
    confirmed_activity_source: 'chain-index',
    confirmed_activity: [],
    agent_sites: [],
    recent_activity: [{ kind: 'agent_announced_unknown_kind', at: T0 - 20000, text: { en: EN_ONLY_TEXT } }],
    notes: [],
  };

  // ═══════════════ 夹具自证: 让这一节的门**不会撒谎** ═══════════════
  // 病灶 (2026-09-22 实测): 靠 CDP Fetch 拦快照请求换夹具的断言, 一旦拦截没命中
  // (请求被放行到线上 / 命中 CDN 缓存 / 页面太慢还没渲染), 页面拿到的是**真快照** ——
  // 那时 DOM 的形态与「页面坏了」长得一模一样 (rows:0 / [] ), 红的时候分不清谁错。
  // 处方: 每次注夹具后、断言之前, 先过三道证, 拿不到就在断言前明确失败并给出可操作信息:
  //   ① 送达证 (拦截器侧): 页面自己的取数请求被拦住, 且我们回给它的就是带 marker 的这份夹具
  //   ② 链路证 (页面侧): 在页面里 fetch 一个同 pattern 的探针 URL, 必须拿回带 marker 的 JSON
  //                       —— 拿不到 = 拦截链路整体没生效 → 报「夹具未生效(拦截未命中)」
  //   ③ 消费证 (DOM 侧): DOM 里出现只有这份夹具才有的标记 (夹具 notes 里的 __vfy:<tag>)
  //                       —— 拿不到 = 页面没消费夹具 → 报「页面错 · 夹具已送达但页面没渲染」
  // 断言只加不减: 自证没过时, 该组原有的每条断言照旧计入 failed, 但报的是「夹具错 · 未生效」
  // (见 check()), 读者一眼知道这不是页面缺陷。三道证都过 → 失败才是真页面错。
  const FX_MARK_FIELD = '__verify_fixture';
  // 夹具标记的文本形态: 结尾的 :__ 是**边界符** —— 没有它, tag 'pulse-zero' 会命中
  // 'pulse-zero-legacy' 的标记 (前缀包含), 自证就成了自欺。
  const fxNoteText = (tag) => `__vfy:${tag}:__`;
  const fxMark = (fx, tag) => {
    fx[FX_MARK_FIELD] = tag;
    // 标记同时写进 notes: notes 是页面**真会渲染**的字段 (网关页/克隆实例都有),
    // 于是「DOM 里出现 __vfy:<tag>:__」= 页面确实拿了这份夹具, 且整轮渲染已跑完 (redraw 一次画完)。
    fx.notes = (fx.notes || []).filter((n) => !/^__vfy:/.test(n)).concat([fxNoteText(tag)]);
    return fx;
  };
  fxMark(FX_LIVE, 'live');
  fxMark(FX_NO_TASKS, 'no-tasks');
  fxMark(FX_EXPIRED, 'expired');
  fxMark(FX_STALE_FLAG, 'stale-flag');
  fxMark(FX_NO_TIME, 'no-time');
  fxMark(FX_ISO_TIME, 'iso-time');
  fxMark(FX_NEWKINDS, 'newkinds');
  fxMark(FX_GROWN, 'grown');
  fxMark(FX_EN_ONLY, 'en-only');
  fxMark(FX_PULSE_ZERO, 'pulse-zero');
  fxMark(FX_PULSE_ZERO_LEGACY, 'pulse-zero-legacy');   // 覆盖继承来的 __vfy:pulse-zero

  // ★ 待接单任务**多于一页** 的夹具 (2026-09-24 leo 要的「固定高度 + 下滑滚动 + 分页 + 分栏」):
  //   FX_LIVE 只有 1 条待接单 → 分页控件按纪律**不出现**, 拿它验分页等于验了个寂寞。
  //   这里 7 条 (全部 claimed:false + 只有那 7 个白名单键, 与真快照同形): 一页 4 条 → 2 页 (第 2 页 3 条),
  //   且按 deadline 升序排 → 页 1 = 最近到期的 4 条, 页 2 = 剩下 3 条 (期望值从这份夹具推导, 不写死条数)。
  const FX_TASKS_MANY = (() => {
    const caps = ['fusion-conversion-consistency', 'code-review', 'translation', 'data-labeling', 'prompt-audit', 'schema-check', 'arxiv-digest'];
    const nets = ['base', 'base-sepolia', 'base', 'base-sepolia', 'base', 'base-sepolia', 'base'];
    const fx = JSON.parse(JSON.stringify(FX_LIVE));
    fx.open_tasks = caps.map((c, i) => ({
      capability: c, budget: String(1000 + i), currency: 'USDC', network: nets[i],
      deadline: T0 + (i + 1) * 3600000, claimed: false, announcementId: 'ann-9m' + String(i).padStart(2, '0'),
    }));
    return fxMark(fx, 'tasks-many');
  })();

  // ★★★ 变异快照夹具 (2026-09-24 新不变量门用): 全部从**真快照** (network-pulse.json) 改一个字段得到。
  //   为什么必须变异: 一条永远返回 [] 的门等于没有门 —— 只有「故意做成自相矛盾的快照必须判红」
  //   才能证明这道门活着 (跟 [6e] 的真数据断言互为反向: 真数据必须干净, 变异数据必须脏)。
  //   真快照在磁盘上真读 (不经 HTTP), 所以"真快照长什么样"决定变异长什么样; 读不到就整段跳过 (下面按需 fxPre)。
  const REAL_SNAP_ON_DISK = (() => {
    try { return JSON.parse(fs.readFileSync(new URL('../network-pulse.json', import.meta.url), 'utf8')); }
    catch { return null; }
  })();
  const snapClone = (o) => JSON.parse(JSON.stringify(o));
  // 变异 1 (① 同源不相等): 顶部「任务」改成 0, 逐字段口径**仍**写「链上索引 · 全量」+ 表格 N 行 →
  //   线上那一幕的重演 (顶部 0 个任务 vs 表里 N 行), 必须判「同一概念两个数」。
  const FX_CONTRA_TASKS_ZERO = (() => {
    if (!REAL_SNAP_ON_DISK) return null;
    const c = snapClone(REAL_SNAP_ON_DISK);
    c.totals = { ...c.totals, tasks: 0, tasks_completed: 0, tasks_settled: 0 };
    return fxMark(c, 'contra-tasks-zero');
  })();
  // 变异 2 (④ 裸 0 冒充): 「钱包签名」= 0 而口径标 source='none' (无源) → 0 会被读成「没发生过」,
  //   但本机明明签过名 —— 必须判「裸 0」。
  const FX_CONTRA_SIG_BARE_ZERO = (() => {
    if (!REAL_SNAP_ON_DISK) return null;
    const c = snapClone(REAL_SNAP_ON_DISK);
    const f = ((c.totals_scope || {}).fields || {}).signatures || {};
    c.totals = { ...c.totals, signatures: 0 };
    c.totals_scope = { ...c.totals_scope, fields: { ...c.totals_scope.fields,
      signatures: { ...f, source: 'none', window: 'unknown', unavailable: true,
        short: { zh: '未接入', en: 'not connected' },
        label: { zh: '没有可用源 → 报「未接入」而不是 0 (本机签名审计账读不到)', en: 'no source → report not connected, not 0' } } } };
    return fxMark(c, 'contra-sig-bare-zero');
  })();
  // 变异 3 (⑤ 正例, 不是矛盾): 「钱包签名」= null + 口径标「未接入」→ 页面**必须写「未接入」**
  //   (不写 0、不隐藏、不显示 —); 同时门必须干净 (未接入 ≠ 矛盾)。
  const FX_SIG_UNAVAILABLE = (() => {
    if (!REAL_SNAP_ON_DISK) return null;
    const c = snapClone(REAL_SNAP_ON_DISK);
    const f = ((c.totals_scope || {}).fields || {}).signatures || {};
    c.totals = { ...c.totals, signatures: null };
    c.totals_scope = { ...c.totals_scope, fields: { ...c.totals_scope.fields,
      signatures: { ...f, source: 'none', window: 'unknown', unavailable: true,
        short: { zh: '未接入', en: 'not connected' },
        label: { zh: '没有可用源 → 报「未接入」而不是 0 (本机签名审计账读不到)', en: 'no source → report not connected, not 0' } } } };
    return fxMark(c, 'sig-unavailable');
  })();

  // ★★★★★ 链上活动表「七十行」夹具 (2026-09-24 leo:「链上索引 · 全量 · 15 行 … 可以按十五行的高度来设计吗」):
  //   真快照此刻正好 15 行 = 一页 → 翻页按钮全禁用, 拿它**验不出**「翻页真换行」, 也验不出「行数涨了这一块一像素不长」。
  //   这里从**真快照**把行复制到 70 条 (= 60 行上限之内的 60 + 被上限截掉的 10), activity_totals.rows 同步改 70 ——
  //   于是「页信息 (共 60 行 · 另 10 行未列)」与「口径行 (70 行)」两个数**对得上** (不是各说各话)。
  //   行数/页数/每页几条的期望值全部从这份夹具**推导**, 不写死某一页画几行。
  //   (位置: 必须排在 REAL_SNAP_ON_DISK / snapClone 之后 —— 早一步引用就是 TDZ 崩, 踩过。)
  const ACT_MANY_ROWS = 70;
  const FX_ACTIVITY_MANY = (() => {
    if (!REAL_SNAP_ON_DISK || !Array.isArray(REAL_SNAP_ON_DISK.confirmed_activity)
      || !REAL_SNAP_ON_DISK.confirmed_activity.length) return null;
    const c = snapClone(REAL_SNAP_ON_DISK);
    const src = c.confirmed_activity;
    c.confirmed_activity = Array.from({ length: ACT_MANY_ROWS }, (_, i) => {
      const r = snapClone(src[i % src.length]);
      r.block = (Number(r.block) || 1) + Math.floor(i / src.length);   // 每条仍是一条独立事实 (区块各不相同)
      return r;
    });
    if (c.activity_totals && typeof c.activity_totals === 'object') {
      c.activity_totals = { ...c.activity_totals, rows: ACT_MANY_ROWS };
    }
    return fxMark(c, 'activity-many');
  })();

  const fxNotesHas = (tag) => (v) => !!(v && typeof v.notes === 'string' && v.notes.includes(fxNoteText(tag)));
  // 首页紧凑版没有 notes 元素 → 用「只有夹具才有的形态」当消费证 (夹具值是脚本自己定的, 真快照撞不出来)
  const fxFeedHas = (text) => (v) => !!(v && Array.isArray(v.feedText) && v.feedText.some((t) => t === text));
  const fxVals = (obj) => (v) => !!(v && Object.keys(obj).every((k) => v[k] === obj[k]));

  const fxProbeUrl = (tag) => `${BASE}/network-pulse-verify-probe.network-pulse.json?tag=${encodeURIComponent(tag)}&n=${Math.random().toString(36).slice(2)}`;
  // 探针 URL 特意同时含 'network-pulse-verify'(夹具 pattern) 与 'network-pulse.json'(回退档 pattern),
  // 这样在任何一节里它都会被拦到 —— 「链路证不适用」这种情况不存在。
  // ② 链路证: 在**页面里** fetch 探针 URL (与夹具同 pattern)。拿回 marker ⇒ 这类 URL 的拦截是活的;
  //    拿回 200 text/html / 404 ⇒ 请求根本没被拦到, 被线上 (Pages 的 SPA 兜底 / CDN 缓存 / 404) 接管了。
  const fxProbe = async (tag) => {
    const url = fxProbeUrl(tag);
    const r = await evalJs(`(async () => {
      try {
        const ctl = typeof AbortController === 'function' ? new AbortController() : null;
        const to = ctl ? setTimeout(function () { ctl.abort(); }, 5000) : null;
        const res = await fetch(${JSON.stringify(url)}, { cache: 'no-store', signal: ctl ? ctl.signal : undefined });
        if (to) clearTimeout(to);
        const body = await res.text();
        let j = null; try { j = JSON.parse(body); } catch (e) { j = null; }
        return { ok: true, status: res.status, ctype: res.headers.get('content-type') || '',
                 redirected: res.redirected, finalUrl: res.url, len: body.length,
                 marker: j ? j[${JSON.stringify(FX_MARK_FIELD)}] : null, head: body.slice(0, 44) };
      } catch (e) { return { ok: false, err: String((e && e.name) || '') + ' ' + String((e && e.message) || e) }; }
    })()`).catch((e) => ({ ok: false, err: 'eval 失败: ' + e.message }));
    return { url, ...(r || { ok: false, err: '无返回值' }) };
  };
  const fxProbeDesc = (p) => {
    if (!p) return '探针没跑起来';
    if (p.ok === false) return `✘ 探针异常 (${p.err})`;
    const looks = p.marker === 'probe:__tag__' ? '' : (p.marker ? `marker=${p.marker}` : `marker=无 (head=${JSON.stringify(p.head)})`);
    return `✘ HTTP ${p.status} · ${p.ctype || '(无 content-type)'}${p.redirected ? ` · 被重定向到 ${p.finalUrl}` : ''} · ${looks}`;
  };

  // —— 断言前的自证: 等「消费证」出现 (页面渲染是异步的, 固定 sleep 会量到中间态 —— 这是老毛病的根) ——
  const fxSelfProof = async (tag, { servedKey = tag, domSignal, rootSel = '#pulse', probeExpr = null, timeoutMs = 20000, what = '', mode = 'fulfill', quietOk = false } = {}) => {
    const t0 = Date.now();
    const probe = await fxProbe(tag);
    const probeOk = probe && probe.ok === true && probe.marker === `probe:${tag}`;
    const signal = domSignal || fxNotesHas(tag);
    let dom = null, consumed = false;
    while (Date.now() - t0 < timeoutMs) {
      dom = await evalJs(probeExpr || pulseProbe(rootSel)).catch(() => null);
      if (dom && signal(dom)) { consumed = true; break; }
      await sleep(200);
    }
    const waited = ((Date.now() - t0) / 1000).toFixed(1);
    const served = fxServed.get(servedKey) || 0;
    const failedN = fxFailed.get(servedKey) || 0;
    const injected = mode === 'fail' ? failedN : served;      // 「我方真的把这份夹具给了页面」的证据
    // 送达 = ① 消费证已出现, 或 ② 我方确实把这份夹具回过/把请求打失败过 (fxServed / fxFailed 计数)。
    // 注意**不把探针通过**算作送达: 探针只证明「拦截链路是活的」, 不证明「这个夹具到了这个页面」。
    const delivered = consumed || injected > 0;
    let reason = '';
    if (!consumed && !delivered) {
      if (!fxFetchOn) reason = 'CDP Fetch 没启用 (拦截根本没开)';
      else if (!probeOk) reason = '拦截未命中';
      else reason = '页面没对本节的夹具 URL 发起请求 (取数走了别的来源)';
    }
    const url = fxServedUrls.get(servedKey) || probe.url;
    const v = { tag, delivered, consumed, reason, probe, probeOk, served, failedN, mode, waited, url, dom, what };
    // —— 自证结果一律打印出来 (绿也要看见它验了什么; 红要给到能直接定位的信息) ——
    const head = `[${tag}${what ? ' · ' + what : ''}]`;
    // 「消费证」到底是哪一种: 默认是夹具 notes 里的标记; 传了 domSignal 的 (失败档 / 首页紧凑版) 是自定义形态。
    const proofKind = domSignal ? '自定义消费证' : `DOM 标记 ${fxNoteText(tag)}`;
    const domNow = dom ? `state=${dom.state} rows=${dom.act ? dom.act.rowCount : 'n/a'} notes=${JSON.stringify(String(dom.notes).slice(0, 40))}` : '(探针读不到 DOM)';
    const servedText = mode === 'fail' ? `我方故意 failRequest ${failedN} 次` : `回夹具 ${served} 次`;
    if (consumed) {
      if (!quietOk) {
        console.log(`  🔒 夹具自证 ${head} ✔ ${servedText} · 链路证 ${probeOk ? `marker=probe:${tag}` : `探针未过(${fxProbeDesc(probe)})`}` +
          ` · 消费证 ${proofKind} 已满足 (等了 ${waited}s)`);
      }
    } else if (delivered) {
      console.log(`  🔒 夹具自证 ${head} ⚠️ **夹具已送达但页面没消费** (${servedText} · 链路证 ${probeOk ? '✔' : fxProbeDesc(probe)})`);
      console.log(`       请求 URL  : ${url}`);
      console.log(`       消费证    : ✘ ${proofKind} 未出现 (等了 ${waited}s) · 现况 ${domNow}`);
      console.log(`       结论      : 夹具确实到了页面却没渲染出来 → 下面这组失败按「页面错」计`);
    } else {
      console.log(`  🔒 夹具自证 ${head} ✘ **夹具未生效(${reason})**`);
      console.log(`       请求 URL  : ${url}`);
      console.log(`       拦截模式  : ${fxPattern || '(无)'} · Fetch.enable ${fxFetchOn ? '已发' : '**没发**'} · requestStage=Request`);
      console.log(`       送达证    : ${mode === 'fail' ? `我方故意 failRequest ${failedN} 次` : `页面取数请求被回夹具 ${served} 次`}`);
      console.log(`       链路证    : ${probeOk ? `✔ marker=probe:${tag}` : fxProbeDesc(probe)}`);
      console.log(`       消费证    : ✘ ${proofKind} 未出现 (等了 ${waited}s) · 现况 ${domNow}`);
      if (fxDiag.length) console.log(`       最近拦截  : ${fxDiag.join(' ; ')}`);
      console.log(`       结论      : 本节断言按「夹具错 · 未生效」计入失败 —— 它们不代表页面有缺陷`);
    }
    fxNow = v;
    return v;
  };
  // 手工 fulfill / failRequest 的记账包装 (自证要的「送达证」对这类请求同样成立)
  const fxServe = (paused, obj, tag) => { if (paused) fxHit(tag, paused.request.url); return fulfillJson(paused.requestId, obj); };
  const fxFailServe = (paused, tag) => { if (paused) fxFailHit(tag, paused.request.url); return cdp('Fetch.failRequest', { requestId: paused.requestId, errorReason: 'ConnectionRefused' }); };
  // 只读自证结论的轻量包装: 给「没等到请求被拦」这类前置条件用 (不带探针, 不改变本次口径)
  const fxPre = (tag, ok, why) => {
    const v = { tag, delivered: !!ok, consumed: !!ok, reason: ok ? '' : why, pre: true };
    if (!ok) {
      console.log(`  🔒 夹具自证 [${tag}] ✘ **夹具未生效(${why})**`);
      console.log(`       拦截模式  : ${fxPattern || '(无)'} · Fetch.enable ${fxFetchOn ? '已发' : '**没发**'}`);
      if (fxDiag.length) console.log(`       最近拦截  : ${fxDiag.join(' ; ')}`);
      console.log(`       结论      : 本节断言按「夹具错 · 未生效」计入失败 —— 它们不代表页面有缺陷`);
    }
    fxNow = v;
    return v;
  };
  const fxOff = () => { fxNow = null; };

  // ⑥ 链上活动 (网关页主体 = 一句短说明 + 小结行 + 一张表)
  console.log('\n[6] gateway.html 链上活动 (公开只读接口 / confirmed_activity)');
  const pulseSrc = `${BASE}/network-pulse-verify.json`;
  const errStart = consoleErrors.length;
  shouldIntercept = (p) => p.request.url.includes('network-pulse-verify');   // 只拦取数请求 (文档已放行)
  await fxEnable(PULSE_PATTERN);
  await cdp('Page.navigate', { url: `${BASE}/gateway.html?pulse=${encodeURIComponent(pulseSrc)}` });
  let req1 = null;
  try { req1 = await nextPaused(9000); } catch { /* 下面按 DOM 判断 */ }
  await sleep(400);

  const region = await evalJs(`(() => {
    const s = document.getElementById('pulse');
    if (!s) return null;
    const before = (a, b) => !!(a && b && (a.compareDocumentPosition(b) & 4));
    return {
      state: s.getAttribute('data-pulse-state'),
      ariaLive: !!s.querySelector('[aria-live="polite"]'),
      role: (s.querySelector('[role="status"]') || {}).getAttribute ? s.querySelector('[role="status"]').getAttribute('role') : null,
      caveat: (s.querySelector('.pulse-caveat') || {}).textContent || '',
      states: Array.from(s.querySelectorAll('.pulse-state-text')).map(e => e.getAttribute('data-state')),
      summaryKeys: Array.from(s.querySelectorAll('.pulse-summary [data-pulse-total]')).map(e => e.getAttribute('data-pulse-total')),
      order: Array.from(document.querySelectorAll('section[id]')).map(x => x.id),
      pulseFirst: before(s, document.getElementById('skills')) && before(s, document.getElementById('join')),
      idsInside: s.querySelectorAll('[id]').length,
      legacy: s.querySelectorAll('.pulse-stats, .pulse-stat, .pulse-grid, .pulse-cap-list, [data-pulse-caps], [data-pulse-feed]').length,
      h1: (document.querySelector('h1') || {}).textContent || '',
      headers: Array.from(s.querySelectorAll('.pulse-table thead th')).map((th) => th.textContent.trim()),
      hasTable: !!s.querySelector('[data-pulse-activity]'),
      hasBody: !!s.querySelector('[data-pulse-activity-body]'),
      hasEmpty: !!s.querySelector('[data-pulse-activity-empty]'),
      hasSource: !!s.querySelector('[data-pulse-activity-source]'),
      caption: (s.querySelector('.pulse-table caption') || {}).textContent || '',
    };
  })()`);
  check('gateway.html 存在 #pulse 链上活动区 (根 = [data-pulse])', !!region, '未找到 #pulse');
  check('活动区有 aria-live=polite + role=status', !!region && region.ariaLive && region.role === 'status', JSON.stringify(region && { a: region.ariaLive, r: region.role }));
  check('四种状态文案都在 DOM (loading/live/stale/unavailable)',
    !!region && ['loading', 'live', 'stale', 'unavailable'].every((s) => region.states.includes(s)),
    JSON.stringify(region && region.states));
  const pageProse = await evalJs(PAGE_PROSE_JS);
  check('统计区有「观察窗口」类短标记 (zh) —— 原来那句「观察窗口内计数 · 不是全网精确总量。」已删, 只留极短标记',
    !!region && SCOPE_WINDOW_MARK.test(region.caveat) && !SENTENCE_PUNCT.test(region.caveat), region && region.caveat);
  check('★ 反夸大: 网关页可见文案里不再出现「全网精确总量 / not an exact global total」类措辞 (删长句 ≠ 把口径改大)',
    killedHits(pageProse).length === 0, JSON.stringify(killedHits(pageProse).concat([pageProse.slice(0, 160)])));
  check('活动表四个钩子齐 (table / tbody / 空态 / 数据源标注)',
    !!region && region.hasTable && region.hasBody && region.hasEmpty && region.hasSource,
    JSON.stringify(region && { t: region.hasTable, b: region.hasBody, e: region.hasEmpty, s: region.hasSource }));
  check('表头 7 列 = 任务|状态|事件|网络|区块|确认数 / 最终性|时间',
    !!region && JSON.stringify(region.headers) === JSON.stringify(['任务', '状态', '事件', '网络', '区块', '确认数 / 最终性', '时间']),
    JSON.stringify(region && region.headers));
  check('小结行钩子 = nodes/agents/tasks/tasks_completed/tasks_settled/signatures (不再有 active/24h; 「已验证」槽 2026-09-24 已整体下线)',
    !!region && JSON.stringify(region.summaryKeys) === JSON.stringify(['nodes', 'agents', 'tasks', 'tasks_completed', 'tasks_settled', 'signatures']),
    JSON.stringify(region && region.summaryKeys));
  check('旧三块 (8 个数字格 / 能力分布 / 最近活动) 在网关页活动区里已不存在',
    !!region && region.legacy === 0, String(region && region.legacy));
  check('网关页已去掉「加入网络」序厅 (页面里没有大字 h1 占屏)',
    !!region && !/加入网络/.test(region.h1), JSON.stringify(region && region.h1));
  check('页面顺序: 链上活动 → 加入方式 → 如何加入 → manifest → 端点 → 开发者',
    !!region && JSON.stringify(region.order) === JSON.stringify(['pulse', 'skills', 'join', 'manifest', 'endpoints', 'developer']),
    JSON.stringify(region && region.order));
  check('链上活动区在「加入方式 / 如何加入」之前 (仪表盘入口先给数据)',
    !!region && region.pulseFirst === true, JSON.stringify(region && region.pulseFirst));
  check('活动区内部不再依赖 id (只用 data-pulse-* 钩子, 避免多实例撞 id)',
    !!region && region.idsInside === 0, region && String(region.idsInside));

  // 首次 loading 这批断言吃「请求被拦住挂着」这个前置 (拦不住 = 页面可能已拿到真快照) →
  // 先自证, 拿不到就在断言前明确报「夹具未生效」, 不把取不到算成页面缺陷。
  fxPre('live', !!req1, '初始取数请求 9s 内没被 CDP Fetch 拦住 (页面可能已拿到真快照)');
  const loading = await evalJs(pulseProbe('#pulse'));
  check('首次 loading 状态 + 数值占位「—」',
    loading.state === 'loading' && loading.visible.includes('正在读取快照') && loading.nodes === '—' && loading.api,
    JSON.stringify({ s: loading.state, v: loading.visible, n: loading.nodes, api: loading.api }));
  check('?pulse= 参数被当作接口地址', (await evalJs('window.__bolloonPulse.source()')) === 'endpoint');
  check('请求真的发出 (CDP 拦到 #pulse 的取数)', !!req1, req1 ? '' : '未拦到请求 — 可能没发起');
  // 活动区小结数字的字号 = 后面判断「首页那份更轻」的基准
  const gwValueFont = parseFloat(String(await evalJs(`getComputedStyle(document.querySelector('#pulse .pulse-summary b')).fontSize`)));

  if (req1) await fxServe(req1, FX_LIVE, 'live');
  // 断言前先自证夹具生效 (送达证 + 链路证 + 消费证), 并**等**页面把夹具渲染出来 ——
  // 固定 sleep 在线上会量到中间态 (rows:0 的假红), 那是本节历史上唯一的不稳定来源。
  await fxSelfProof('live', { what: '网关页 FX_LIVE' });
  const live = await evalJs(pulseProbe('#pulse'));
  const LV = live.act;
  const has = (k, v) => LV.rows.some((r) => r[k] === v);
  check('live: 状态标签 = 实时', live.state === 'live' && live.visible.includes('实时'), JSON.stringify({ s: live.state, v: live.visible }));
  check('live: 小结行 5 个老计数 = 接口原值 (节点 7 / 智能体 12 / 任务 21 / 已完成 13 / 钱包签名 42); 新增「已结算」本夹具没给 → 整行隐藏 (不拿 0 冒充); 「已验证」槽已下线 → 连钩子都没有 (不是显示 0 / 不是 —)',
    live.nodes === '7' && live.agents === '12' && live.tasks === '21' && live.tasksDone === '13' &&
    live.signatures === '42' && live.tasksSettled === '—' && live.tasksHidden.settled === true &&
    live.tasksHidden.tasks === false && live.tasksHidden.done === false && live.tasksHidden.sig === false &&
    live.tasksVerified === null && live.tasksHidden.verified === null,
    JSON.stringify({ n: live.nodes, a: live.agents, t: live.tasks, d: live.tasksDone, v: live.tasksVerified, s: live.signatures,
      settled: live.tasksSettled, h: live.tasksHidden }));
  check('live: 小结行标签 = 节点 / 智能体 / 任务 / 已完成 / 已结算 / 钱包签名 (六格, 「已验证」已下线)',
    JSON.stringify(live.summary.map((r) => r.label)) === JSON.stringify(['节点', '智能体', '任务', '已完成', '已结算', '钱包签名']),
    JSON.stringify(live.summary.map((r) => r.label)));
  // ★ 同一概念不变量门 (2026-09-24) 在**老形态夹具**上的表现: 顶部 21 任务 vs 表里 N 个已确认任务
  //   = 两套口径 (24h 脉冲 ⊃ 已确认链上行), 页面两处都标了口径 → 门**不许**误判成矛盾 (否则这道门会到处假红)。
  const liveFindings = contradictionFindings(live, FX_LIVE);
  check('★ 同一概念不变量门 · 老形态夹具: 两套口径各自标出 → 门干净 (不把"上宽下窄"的口径差当矛盾)',
    liveFindings.length === 0, JSON.stringify(liveFindings));
  check('live: 9 条夹具画成 8 行 (task 与 tx 都空的那条不画), 没有空白行',
    LV.rowCount === 8 && LV.blankRows === 0, JSON.stringify({ rows: LV.rowCount, blank: LV.blankRows }));
  check('live: 每行 7 格 (表头 7 列的列数一致)',
    LV.rows.every((r) => r.cells.length === 7), JSON.stringify(LV.rows.map((r) => r.cells.length)));
  check('live: 任务列短写 —— sha256:1a2b3c4d 显示成「sha256:1a2b…」(逐字)',
    has('task', 'sha256:1a2b…'), JSON.stringify(LV.rows.map((r) => r.task)));
  check('live: 40 位地址短写成 0x 头 4…尾 4, 全长不进页面文本',
    !has('task', ACT_LONG_ADDR) && !has('task', ACT_LONG_HASH) && LV.rows.some((r) => /^0x[0-9a-f]{4}…[0-9a-f]{4}$/.test(r.task || '')),
    JSON.stringify(LV.rows.map((r) => r.task)));
  check('live: task 缺失的条目退到 tx 当任务标识 (该行 data-ref=tx), 不留空任务格',
    LV.rows.some((r) => r.ref === 'tx' && /^sha256:/.test(r.task || '')), JSON.stringify(LV.rows.map((r) => [r.ref, r.task])));
  const LV_BLOCKS = ['47142900', '47142800', '47142222', '47142777', '47142301', '47142699', '47142610', '47142500'];
  check('live: 表格按快照时间从新到旧 (实测区块顺序与夹具的 at 顺序一致)',
    JSON.stringify(LV.rows.map((r) => r.block)) === JSON.stringify(LV_BLOCKS),
    JSON.stringify(LV.rows.map((r) => r.block)));
  check('live: 状态列 = 中/英单词里的中文词 (活跃 / 已释放 / 已退款 / 已过期 / 争议中 / 未知)',
    ['活跃', '已释放', '已退款', '已过期', '争议中', '未知'].every((w) => LV.rows.some((r) => r.stateText === w)) &&
    LV.rows.every((r) => r.stateKey && r.stateKey.length > 0),
    JSON.stringify([...new Set(LV.rows.map((r) => r.stateText))]));
  check('live: 事件列 = 中文事件词 (任务创建 / 任务接下 / 任务完成 / 交易结算 / 交易验真)',
    ['任务创建', '任务接下', '任务完成', '交易结算', '交易验真'].every((w) => LV.rows.some((r) => r.kindText === w)),
    JSON.stringify([...new Set(LV.rows.map((r) => r.kindText))]));
  check('live: 认不出的 kind 原样显示 (不猜、不吞、不报错)',
    has('kindText', 'unknown_future_kind_2099') && has('kindKey', 'unknown_future_kind_2099'),
    JSON.stringify([...new Set(LV.rows.map((r) => r.kindText))]));
  check('live: 网络列 = 快照 chain_id (84532), 区块列 = 快照 block (逐行都在)',
    LV.rows.every((r) => r.chain === '84532' && /^47\d{6}$/.test(r.block || '')),
    JSON.stringify(LV.rows.map((r) => [r.chain, r.block])));
  check('live: 确认数/最终性同格 (确认数原文 + 三档文案 已观察/已确认/已最终确定)',
    LV.rows.some((r) => r.conf === '128' && r.finText === '已最终确定') &&
    LV.rows.some((r) => r.finText === '已确认') && LV.rows.some((r) => r.finText === '已观察'),
    JSON.stringify(LV.rows.map((r) => [r.conf, r.finText])));
  check('live: finality 三档各有 data-finality 且三档颜色互不相同 (徽标真的分档上色)',
    ['observed', 'confirmed', 'finalized'].every((k) => live.finality.some((f) => f.key === k)) &&
    new Set(['observed', 'confirmed', 'finalized'].map((k) => (live.finality.find((f) => f.key === k) || {}).color)).size === 3,
    JSON.stringify(live.finality.slice(0, 8)));
  check('live: 认不出的 finality → 原值照原样 + 虚线「其他」徽标 is-other (不假装是三档之一)',
    has('fin', 'unknown') && LV.rows.some((r) => r.fin === 'unknown' && /is-other/.test(r.finClass || '') && r.finText === 'unknown'),
    JSON.stringify(LV.rows.map((r) => [r.fin, r.finText, r.finClass])));
  check('live: 时间列 = <time datetime=ISO> + 本地绝对时间 (YYYY-MM-DD HH:MM:SS)',
    LV.rows.every((r) => /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(r.timeIso || '') && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(r.time || '')),
    JSON.stringify(LV.rows.slice(0, 2).map((r) => [r.timeIso, r.time])));
  check('live: 表区口径短标记 = 「链上索引 · 全量」(confirmed_activity_source = chain-index) —— 原来的「链上数据源：链上索引」长前缀已删',
    SCOPE_WHOLE_MARK.test(LV.source) && LV.source === '链上索引 · 全量', LV.source);
  check('★ live: 两套口径各自带就近短标记 (统计区「观察窗口」+ 表区「链上索引 · 全量」)',
    scopeMarkers(live).both, JSON.stringify({ stats: scopeMarkers(live).stats, table: scopeMarkers(live).table }));
  check('★ live: 脉冲区文案不写整句、且都在长度上限内 (口径行/数据源行/caveat)',
    proseBudgetOk(live).length === 0, JSON.stringify(proseBudgetOk(live)));
  check('live: 有行时不显示空态文案', LV.emptyShown === false, JSON.stringify({ shown: LV.emptyShown, text: LV.emptyText }));
  const longScan = await evalJs(`(() => {
    const t = document.body.innerText;
    return { addr: /\\b0x[0-9a-fA-F]{40}\\b/.test(t), hash: /\\b[0-9a-fA-F]{64}\\b/.test(t) };
  })()`);
  check('live: 页面可见文本里没有 40 位地址 / 64 位哈希 (夹具给了全长, 页面只显示短写)',
    longScan.addr === false && longScan.hash === false, JSON.stringify(longScan));
  check('live: agent_sites 三种 ipns 形态都归一化成 https://ipfs.io/ipns/<cid> (非法条目被丢弃)',
    live.sites.length === 3 && live.sites.map((s) => s.href).join('|') ===
      [`https://ipfs.io/ipns/${CID_1}`, `https://ipfs.io/ipns/${CID_2}`, `https://ipfs.io/ipns/${CID_3}`].join('|') &&
      live.sites.map((s) => s.label).join('|') === 'leo-node|research|mirror',
    JSON.stringify(live.sites));
  check('live: 站点链接 = rel=noopener noreferrer + target=_blank + 链接文本是裸 cid (只 1 个文本节点)',
    live.sites.length === 3 && live.sites.every((s) => s.rel === 'noopener noreferrer' && s.target === '_blank' &&
      s.kids === 1 && s.text === s.href.replace('https://ipfs.io/ipns/', '')),
    JSON.stringify(live.sites));
  check('live: 活动区内没有任何 javascript: 链接 (非法 ipns 没被渲染)',
    (await evalJs(`Array.from(document.querySelectorAll('#pulse a')).every((a) => !/^javascript:/i.test(a.getAttribute('href') || ''))`)) === true);
  check('live: scope=observed → 「当前节点观察到」', live.scope === '当前节点观察到' && !live.scopeHidden, live.scope);
  check('live: 快照时间 + 相对时间都在 (快照时间 YYYY-MM-DD HH:MM:SS)',
    /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(live.snap || '') && /\d+ (分钟前|小时前|刚刚)/.test(live.ago || ''),
    JSON.stringify({ snap: live.snap, ago: live.ago }));
  // ★ 快照时间 (2026-09-24): 页面上那个时刻必须是**快照自己标的** generated_at, 不是任意/当前时间 ——
  //   期望值从夹具的 generated_at (T0 - 3 分钟) 推导, 逐字对上才算数。
  const LIVE_GEN = T0 - 3 * 60000;
  check('★ live: 快照时间 = 快照 generated_at 的可读形式 (绝对时刻逐字对上, <time datetime> = 同一时刻的 ISO)',
    live.snap === localAbs(LIVE_GEN) && live.snapIso === new Date(LIVE_GEN).toISOString(),
    JSON.stringify({ got: live.snap, want: localAbs(LIVE_GEN), iso: live.snapIso, wantIso: new Date(LIVE_GEN).toISOString() }));
  const liveAgoMin = agoMinutesOf(live.ago);
  check('★ live: 相对时间由同一字段算出 (与 generated_at 相差 ≤1 分钟), 且状态徽章右边也挂着同一份年龄「(N 分钟前)」',
    liveAgoMin !== null && Math.abs(liveAgoMin - relMinutes(LIVE_GEN)) <= 1 &&
    String(live.age) === `(${liveAgoMin} 分钟前)` && live.ageShown === true,
    JSON.stringify({ ago: live.ago, age: live.age, shown: live.ageShown, wantMin: relMinutes(LIVE_GEN) }));
  check('live: 服务端 notes 文字可见', live.notes.includes('隐私阈值'), live.notes);
  check('live: 表格每一格的任务标识都只 1 个文本节点 (textContent 造节点, 不拼 HTML)',
    LV.rows.every((r) => r.taskKids === 1), JSON.stringify(LV.rows.map((r) => r.taskKids)));
  const appSrc = await fetchText(`${BASE}/app.js`);
  check('app.js 不写 innerHTML / outerHTML / insertAdjacentHTML',
    !/\.innerHTML\s*(\+?=|\.)/.test(appSrc) && !/\.outerHTML\s*(\+?=)/.test(appSrc) && !appSrc.includes('insertAdjacentHTML') && !appSrc.includes('document.write'),
    '源码里出现 innerHTML 赋值');
  const gwHtml = await fetchText(`${BASE}/gateway.html`);
  check('网关页静态 HTML 就有小结行签名钩子 (data-pulse-total="signatures" 恰好 1 处 + 双语标签, JS 挂了也读得到)',
    (gwHtml.match(/data-pulse-total="signatures"/g) || []).length === 1 &&
    /data-zh="钱包签名" data-en="wallet signatures"/.test(gwHtml),
    JSON.stringify({ n: (gwHtml.match(/data-pulse-total="signatures"/g) || []).length }));
  check('网关页静态 HTML 就有表格钩子 (table 自身的 data-pulse-activity + -body/-empty/-source 各 1 处)',
    gwHtml.includes('data-pulse-activity>') &&
    (gwHtml.match(/data-pulse-activity-body/g) || []).length === 1 &&
    (gwHtml.match(/data-pulse-activity-empty/g) || []).length === 1 &&
    (gwHtml.match(/data-pulse-activity-source/g) || []).length === 1);
  // ★ 静态文案预算 (2026-09-23 精简): 那几段长文案不许再出现在**可见** HTML 里 (注释剥掉后再查);
  //   同时要求设计意图仍在注释里 —— 删的是长句, 不是诚实性本身。
  const gwVisibleHtml = gwHtml.replace(/<!--[\s\S]*?-->/g, '');
  const idxHtml = await fetchText(`${BASE}/index.html`);
  const idxVisibleHtml = idxHtml.replace(/<!--[\s\S]*?-->/g, '');
  check('★ 两页静态 HTML 就有快照年龄钩子 (data-pulse-age 各恰好 1 处, 与 data-pulse-time/-ago 同一行; 无 id 不撞)',
    (gwHtml.match(/data-pulse-age/g) || []).length === 1 && (idxHtml.match(/data-pulse-age/g) || []).length === 1 &&
    /<p class="pulse-state"[^>]*>[\s\S]*?data-pulse-age[\s\S]*?<\/p>/.test(gwHtml) &&
    /<p class="pulse-state"[^>]*>[\s\S]*?data-pulse-age[\s\S]*?<\/p>/.test(idxHtml),
    JSON.stringify({ gw: (gwHtml.match(/data-pulse-age/g) || []).length, idx: (idxHtml.match(/data-pulse-age/g) || []).length }));
  check('网关页可见 HTML 不再有那几段长文案 (口径整句 / 隐私整句 / 「链上数据源：」前缀 / 私有站整句)',
    killedHits(gwVisibleHtml).length === 0 && !/显式发布、公开可读的智能体私有站/.test(gwVisibleHtml),
    JSON.stringify(killedHits(gwVisibleHtml)));
  check('首页可见 HTML 不再有口径长句 (「观察窗口内计数 · 不是全网精确总量。」等)',
    killedHits(idxVisibleHtml).length === 0, JSON.stringify(killedHits(idxVisibleHtml)));
  check('★ 删长句 ≠ 删诚实性: 被删的作用域/隐私声明仍以 HTML 注释留在网关页源码里 (公开只读接口 + 无 DID/peerId/IP/钱包地址/任务正文 + 短写)',
    /<!--[^]*?GET \/api\/public\/network\/progress[^]*?没有 DID[^]*?短写[^]*?-->/.test(gwHtml) && /<!--[^]*?精简[^]*?-->/.test(gwHtml));
  check('★ 「智能体私有网站」的整句说明 <p class="pulse-sites-note"> 已删 (只剩标题 + 极短空态), 空态诚实标记仍在 (空 = 未发布（不是没数据）, 双语齐)',
    !/pulse-sites-note/.test(gwVisibleHtml) &&
    /data-pulse-sites-empty[^>]*data-zh="空 = 未发布（不是没数据）"[^>]*data-en="Empty = none published \(not missing data\)"/.test(gwHtml));
  check('★ app.js 的**可执行代码**里不再有那几段长文案 (注释里保留的说明不算)',
    killedHits(appSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '')).length === 0,
    JSON.stringify(killedHits(appSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, ''))));
  check('app.js 真的绑定 signatures 钩子 (取数赋值走三态 setFieldCount + 加载/失败时按"拿不到"清空)',
    /data-pulse-total="signatures"/.test(appSrc) && (appSrc.match(/setFieldCount\(el\.signatures/g) || []).length === 1 &&
    (appSrc.match(/setOptCount\(el\.signatures/g) || []).length === 1);
  check('app.js 真的绑定表格三个钩子 (data-pulse-activity-body / -empty / -source)',
    appSrc.includes('[data-pulse-activity-body]') && appSrc.includes('[data-pulse-activity-empty]') && appSrc.includes('[data-pulse-activity-source]'));
  check('app.js 从不按活动 kind 分支渲染 (无 item.kind 比较 / 无 switch) — 未知 kind 不可能报错',
    !/\bitem\.kind\b/.test(appSrc) && !/\bit\.kind\b/.test(appSrc) && !/\bswitch\s*\(/.test(appSrc),
    'app.js 里出现按活动 kind 分支');

  // 中英切换: 表头 / 状态词 / 事件词 / finality / 小结标签 / 数据源标注 都要跟着变
  await evalJs(`document.querySelector('.lang-toggle [data-lang="en"]').click()`);
  await sleep(300);
  const en = await evalJs(pulseProbe('#pulse'));
  const enTitle = await evalJs(`document.querySelector('#pulse .section-title').textContent.trim()`);
  const enCaveat = await evalJs(`document.querySelector('#pulse .pulse-caveat').textContent.trim()`);
  const enSubs = await evalJs(`Array.from(document.querySelectorAll('#pulse .pulse-sub')).map(e=>e.textContent.trim())`);
  check('EN: 活动区标题 = On-chain activity', enTitle === 'On-chain activity', enTitle);
  check('EN: 状态/scope 都变英文 (Live + Observed by this node)',
    en.visible.includes('Live') && en.scope === 'Observed by this node',
    JSON.stringify({ v: en.visible, s: en.scope }));
  check('EN: 表头 7 列英文 = Task|State|Event|Network|Block|Confirmations / finality|Time',
    JSON.stringify(en.act.headers) === JSON.stringify(['Task', 'State', 'Event', 'Network', 'Block', 'Confirmations / finality', 'Time']),
    JSON.stringify(en.act.headers));
  check('EN: 状态列英文单词 (active/released/refunded/expired/disputed/unknown) + 事件列英文词',
    ['active', 'released', 'refunded', 'expired', 'disputed', 'unknown'].every((w) => en.act.rows.some((r) => r.stateText === w)) &&
    ['task created', 'task accepted', 'task completed', 'trade settled', 'trade verified'].every((w) => en.act.rows.some((r) => r.kindText === w)),
    JSON.stringify([...new Set(en.act.rows.map((r) => r.stateText))]));
  check('EN: finality 徽标英文 (observed / confirmed / finalized) + 认不出的仍原样',
    ['observed', 'confirmed', 'finalized'].every((w) => en.act.rows.some((r) => r.finText === w)) &&
    en.act.rows.some((r) => r.finText === 'unknown'),
    JSON.stringify([...new Set(en.act.rows.map((r) => r.finText))]));
  check('EN: 短写不受语言影响 (sha256:1a2b… 仍在)',
    en.act.rows.some((r) => r.task === 'sha256:1a2b…'), JSON.stringify(en.act.rows.map((r) => r.task)));
  const enSummary = await evalJs(`Array.from(document.querySelectorAll('#pulse .pulse-summary span')).map(e=>e.textContent.trim())`);
  check('EN: 小结行标签英文 = nodes/agents/tasks/completed/settled/wallet signatures (六格, 「已验证」已下线)',
    JSON.stringify(enSummary) === JSON.stringify(['nodes', 'agents', 'tasks', 'completed', 'settled', 'wallet signatures']),
    JSON.stringify(enSummary));
  check('EN: 表区口径短标记英文 (chain index · whole index) —— 原来的「On-chain data source:」前缀已删',
    en.act.source === 'chain index · whole index', en.act.source);
  check('EN: 空态文案英文 (未显示但有英文原文)',
    /not observed any on-chain task/.test(en.act.emptyText || '') || en.act.emptyShown === false, en.act.emptyText);
  check('EN: 统计区短标记英文 (24h observation window) + 不写成整句、不出现「exact global total」类措辞',
    SCOPE_WINDOW_MARK.test(enCaveat) && !SENTENCE_PUNCT.test(enCaveat) && !/global total/i.test(enCaveat), enCaveat);
  check('EN: 智能体私有站小标题英文',
    JSON.stringify(enSubs) === JSON.stringify(['Agent private sites']), JSON.stringify(enSubs));
  check('EN: 相对时间英文 (minutes ago / hours ago / just now)',
    /minutes ago|hours ago|just now/.test(String(en.ago)), String(en.ago));
  // ★ EN: 徽章年龄也要跟着切英文, 单位与单复数都要对 (1 minute ago / N minutes ago / N hours ago)
  const enAgoM = /\((\d+) (minute|minutes|hour|hours) ago\)/.exec(String(en.ago || ''));
  const enAgeM = /\((\d+) (minute|minutes|hour|hours) ago\)/.exec(String(en.age || ''));
  check('★ EN: 快照年龄在英文界面下也是英文, 单位/单复数正确, 徽章与 meta 是同一份值',
    !!enAgoM && !!enAgeM && String(en.age) === String(en.ago) &&
    enAgoM[2] === enAgeM[2] && (Number(enAgoM[1]) === 1 ? !/s$/.test(enAgoM[2]) : /s$/.test(enAgoM[2])) &&
    (Number(enAgoM[1]) >= 60 ? /^hour/.test(enAgoM[2]) : /^minute/.test(enAgoM[2])) &&
    !/[前刚刚]/.test(String(en.age) + String(en.ago)),
    JSON.stringify({ ago: en.ago, age: en.age }));
  const enIpns = await evalJs(`(() => {
    const f = document.querySelector('#pulse [data-pulse-ipns-form]');
    const i = f.querySelector('[data-pulse-ipns-input]');
    i.value = 'nope'; f.requestSubmit();
    const out = { ph: i.getAttribute('placeholder'), aria: i.getAttribute('aria-label'),
      btnAria: f.querySelector('[data-pulse-ipns-open]').getAttribute('aria-label'),
      btnText: f.querySelector('[data-pulse-ipns-open]').textContent,
      msg: f.querySelector('[data-pulse-ipns-msg]').textContent,
      hint: document.querySelector('#pulse .pulse-ipns-hint').textContent,
      sitesEmpty: document.querySelector('#pulse [data-pulse-sites-empty]').textContent,
      siteAria: (document.querySelector('#pulse [data-pulse-sites] a') || {}).getAttribute ? document.querySelector('#pulse [data-pulse-sites] a').getAttribute('aria-label') : '' };
    i.value = ''; return out;
  })()`);
  check('EN: 粘贴框 placeholder/aria-label/按钮/报错/提示 全英文 (含站点链接 aria)',
    /IPNS address or name/.test(enIpns.aria) && /ipns:\/\//.test(enIpns.ph) && /new window/.test(enIpns.btnAria) &&
    enIpns.btnText === 'Open' && /Not a valid IPNS address/.test(enIpns.msg) &&
    /no network request/.test(enIpns.hint) && /none published/.test(enIpns.sitesEmpty) &&
    !/\b0\b/.test(enIpns.sitesEmpty) &&                       // 空态不许显示假 0
    /in a new window/.test(enIpns.siteAria), JSON.stringify(enIpns));
  await evalJs(`document.querySelector('.lang-toggle [data-lang="zh"]').click()`);
  await sleep(250);
  const zhBack = await evalJs(pulseProbe('#pulse'));
  check('切回中文: 状态/事件/finality 词复原 (原始值只存一份, 渲染时才取语言)',
    zhBack.act.rows.some((r) => r.stateText === '活跃') && zhBack.act.rows.some((r) => r.kindText === '任务创建') &&
    zhBack.act.rows.some((r) => r.finText === '已最终确定') &&
    zhBack.act.source === '链上索引 · 全量' && zhBack.caveat === '观察窗口 24h',
    JSON.stringify({ src: zhBack.act.source, caveat: zhBack.caveat }));

  // 相对时间刷新: 只改文字节点, 表格行不重建 (行是「新数据来了才重画」)
  const tickBefore = await evalJs(`(() => {
    const ago = document.querySelector('#pulse [data-pulse-ago]');
    const tr = document.querySelector('#pulse [data-pulse-activity-body] tr');
    window.__ago0 = ago; window.__tr0 = tr;
    window.__bolloonPulse.tick();
    return {
      sameAgo: document.querySelector('#pulse [data-pulse-ago]') === window.__ago0,
      sameRow: document.querySelector('#pulse [data-pulse-activity-body] tr') === window.__tr0,
      rows: document.querySelectorAll('#pulse [data-pulse-activity-body] tr').length,
      ago: ago.textContent,
    };
  })()`);
  check('相对时间刷新 (tick) 只改文字节点: 表格行与节点复用, 不重建',
    tickBefore.sameAgo === true && tickBefore.sameRow === true && tickBefore.rows === 8 && /前|刚刚/.test(tickBefore.ago),
    JSON.stringify(tickBefore));

  // ★ 快照年龄必须随节拍/轮询自己刷新, 且**只改文字节点** (节点身份与结构一个都不许动) ——
  //   用「快进 2 小时」把差值做成确定性的: 快进后相对时间必须真的变 (分钟档 → 小时档),
  //   期望值用**同一套规则**从「(现在+2h) - generated_at」算出来 (不写死, 也不依赖跑得多快)。
  const ageTick = await evalJs(`(() => {
    const GEN = ${JSON.stringify(LIVE_GEN)};
    const root = document.querySelector('#pulse');
    const nAge = root.querySelector('[data-pulse-age]');
    const nAgo = root.querySelector('[data-pulse-ago]');
    const nState = root.querySelector('.pulse-state');
    const nMeta = root.querySelector('.pulse-snapshot');
    const nRow = root.querySelector('[data-pulse-activity-body] tr');
    const kids = nState.childNodes.length;
    const before = { age: nAge.textContent, ago: nAgo.textContent };
    const realNow = Date.now;
    Date.now = function () { return realNow() + 7200000; };          // 快进 2 小时 (只影响这一次 tick)
    try { window.__bolloonPulse.tick(); } finally { Date.now = realNow; }
    const mins = Math.round((realNow() + 7200000 - GEN) / 60000);
    return {
      before: before,
      age: nAge.textContent,
      ago: nAgo.textContent,
      exp: mins < 60 ? '(' + mins + ' 分钟前)' : '(' + Math.round(mins / 60) + ' 小时前)',
      ageSame: root.querySelector('[data-pulse-age]') === nAge,
      agoSame: root.querySelector('[data-pulse-ago]') === nAgo,
      stateSame: root.querySelector('.pulse-state') === nState,
      metaSame: root.querySelector('.pulse-snapshot') === nMeta,
      rowSame: root.querySelector('[data-pulse-activity-body] tr') === nRow,
      kidsSame: root.querySelector('.pulse-state').childNodes.length === kids,
    };
  })()`);
  check('★ 快照年龄随节拍刷新 (快进 2h → tick: 文本按同一规则变成小时档), 且**只改文字节点** (徽章/元信息/表格行的节点身份与结构一个都没动)',
    ageTick.age === ageTick.exp && ageTick.ago === ageTick.exp && ageTick.age !== ageTick.before.age &&
    ageTick.ageSame && ageTick.agoSame && ageTick.stateSame && ageTick.metaSame && ageTick.rowSame && ageTick.kidsSame,
    JSON.stringify(ageTick));

  // prefers-reduced-motion (live 状态下先确认动画存在, 再确认 reduce 时关掉)
  const animOn = await evalJs(`getComputedStyle(document.querySelector('#pulse .pulse-dot')).animationName`);
  await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await sleep(250);
  const rm = await evalJs(`(() => ({ matched: window.matchMedia('(prefers-reduced-motion: reduce)').matches, anim: getComputedStyle(document.querySelector('#pulse .pulse-dot')).animationName, api: window.__bolloonPulse.reducedMotion(), state: document.getElementById('pulse').getAttribute('data-pulse-state') }))()`);
  check('prefers-reduced-motion: 脉冲点动画关闭 (默认有动画 pulse-dot)',
    animOn === 'pulse-dot' && rm.matched === true && rm.anim === 'none' && rm.api === true && rm.state === 'live',
    JSON.stringify({ animOn, rm }));
  await cdp('Emulation.setEmulatedMedia', { features: [] });

  // 手机宽度: 小结行纵向堆叠 + 表格在容器里横向滚动 (且表格不贡献页面横向溢出)
  // 注: 390px 下页面本身有 ~155px 横向溢出, 但那是顶栏 (nav-menu / mast-meta) 的老问题,
  //     与活动表无关 —— 这里用「把表格藏起来前后, 页面溢出不变」把责任划清。
  await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await sleep(350);
  const mob = await evalJs(`(() => {
    const de = document.documentElement;
    const sum = document.querySelector('#pulse .pulse-summary');
    // 2026-09-24: 承接滚动的是**内层** .pulse-table-scroll (它同时管横向 overflow:auto 与十五行的高度上限);
    //   外层 .pulse-table-wrap 只剩外边距 —— 量的东西必须和负责滚的东西是同一个, 否则量到的是 342==342 的假绿。
    const wrap = document.querySelector('#pulse .pulse-table-scroll');
    const overAll = de.scrollWidth - de.clientWidth;
    const prev = wrap.style.display;
    wrap.style.display = 'none';
    const overNoTable = de.scrollWidth - de.clientWidth;
    wrap.style.display = prev;
    return {
      w: window.innerWidth,
      dir: getComputedStyle(sum).flexDirection,
      wrapOverflow: getComputedStyle(wrap).overflowX,
      wrapClient: wrap.clientWidth,
      wrapScroll: wrap.scrollWidth,
      overAll: overAll,
      overNoTable: overNoTable,
    };
  })()`);
  check('390px: 小结行改纵向堆叠 (值左 · 标签右)', mob.w <= 640 && mob.dir === 'column', JSON.stringify(mob));
  check('390px: 活动表在容器里横向滚动 (容器 overflow-x:auto + 表格比容器宽), 表格不贡献页面横向溢出',
    mob.wrapOverflow === 'auto' && mob.wrapScroll > mob.wrapClient && mob.overAll === mob.overNoTable,
    JSON.stringify(mob));
  const mobIpns = await evalJs(`(() => {
    const de = document.documentElement;
    const f = document.querySelector('#pulse [data-pulse-ipns-form]');
    const row = f.querySelector('.pulse-ipns-row');
    const btn = f.querySelector('[data-pulse-ipns-open]');
    const input = f.querySelector('[data-pulse-ipns-input]');
    const sites = document.querySelector('#pulse .pulse-sites');
    const list = document.querySelector('#pulse [data-pulse-sites] li');
    return { rowDir: getComputedStyle(row).flexDirection, btnW: Math.round(btn.getBoundingClientRect().width),
      formW: Math.round(f.getBoundingClientRect().width), inputW: Math.round(input.getBoundingClientRect().width),
      sitesW: Math.round(sites.getBoundingClientRect().width), clientW: de.clientWidth,
      liDir: list ? getComputedStyle(list).flexDirection : null,
      linkWrap: list ? list.querySelector('a').getBoundingClientRect().right <= de.clientWidth + 1 : null };
  })()`);
  check('390px: IPNS 粘贴框与站点列表改纵向堆叠, 宽度不超出视口 (不横向溢出)',
    mobIpns.rowDir === 'column' && mobIpns.liDir === 'column' && mobIpns.linkWrap === true &&
    mobIpns.btnW <= mobIpns.formW && mobIpns.formW <= mobIpns.clientW && mobIpns.inputW <= mobIpns.formW,
    JSON.stringify(mobIpns));
  await cdp('Emulation.clearDeviceMetricsOverride');
  await sleep(200);

  // 过期快照 (fresh_until 已过)
  const p2 = nextPaused(7000);
  await evalJs(`(() => { window.__bolloonPulse.refresh(); return 1; })()`);
  let req2 = null;
  try { req2 = await p2; } catch { /* 没拦到 → 下面自证会明确报「夹具未生效」, 不把取不到算成页面错 */ }
  fxPre('expired', !!req2, 'refresh() 的取数请求 7s 内没被 CDP Fetch 拦住');
  if (req2) await fxServe(req2, FX_EXPIRED, 'expired');
  await fxSelfProof('expired', { what: 'FX_EXPIRED (fresh_until 已过)' });
  const stale = await evalJs(pulseProbe('#pulse'));
  check('stale: fresh_until 已过 → 快照已过期', stale.state === 'stale' && stale.visible.includes('快照已过期'), JSON.stringify({ s: stale.state, v: stale.visible }));
  check('stale: scope=verified → 「网络观察快照」', stale.scope === '网络观察快照' && !stale.scopeHidden, stale.scope);
  check('stale: 仍显示快照数字 (9); 该快照没有 confirmed_activity → 0 行 + 明说「本节点暂未观察到链上任务」(不是一片空白)',
    stale.nodes === '9' && stale.act.rowCount === 0 && stale.act.emptyShown === true && /暂未观察到链上任务/.test(stale.act.emptyText),
    JSON.stringify({ n: stale.nodes, rows: stale.act.rowCount, shown: stale.act.emptyShown, text: stale.act.emptyText }));
  // ★ stale 时**也要**显示时间 (过期 ≠ 不必说它多旧; 反过来, 也不许拿当前时间冒充):
  //   绝对时刻 = 该夹具的 generated_at (T0 - 1 小时), 相对时间 = 小时档, 徽章年龄同一份值。
  check('★ stale: 过期快照仍照常显示自己的生成时间 (绝对 = generated_at 时刻 + 相对小时档 + 徽章年龄同一份; 不是空白, 也不是当前时间)',
    stale.snap === localAbs(T0 - 3600000) && stale.snapIso === new Date(T0 - 3600000).toISOString() &&
    /\(\d+ 小时前\)/.test(String(stale.ago)) && String(stale.age) === String(stale.ago) && stale.ageShown === true &&
    !/未标注/.test(String(stale.snap) + String(stale.ago) + String(stale.age)),
    JSON.stringify({ snap: stale.snap, ago: stale.ago, age: stale.age, state: stale.state }));

  // status=stale 单独一条路径
  const p3 = nextPaused(7000);
  await evalJs(`(() => { window.__bolloonPulse.refresh(); return 1; })()`);
  let req3 = null;
  try { req3 = await p3; } catch { /* 同上: 交给自证判「夹具未生效」 */ }
  fxPre('stale-flag', !!req3, 'refresh() 的取数请求 7s 内没被 CDP Fetch 拦住');
  if (req3) await fxServe(req3, FX_STALE_FLAG, 'stale-flag');
  await fxSelfProof('stale-flag', { what: 'FX_STALE_FLAG (status=stale)' });
  const stale2 = await evalJs(pulseProbe('#pulse'));
  check('stale: status="stale" 也被如实标为过期', stale2.state === 'stale' && stale2.visible.includes('快照已过期'), JSON.stringify({ s: stale2.state, v: stale2.visible }));

  // ★★ 缺 generated_at (2026-09-24): 快照读到了, 但它没标时间 —— 页面**只能**如实说「快照未标注时间」。
  //    这条断言的意义就是「绝不用 Date.now() 顶替」: 顶替的代码一注入, 这里立刻红 (见 docs/wiki/log.md 的变异验证)。
  {
    const pNoTime = nextPaused(7000);
    await evalJs(`(() => { window.__bolloonPulse.refresh(); return 1; })()`);
    let reqNoTime = null;
    try { reqNoTime = await pNoTime; } catch { /* 交给自证判「夹具未生效」 */ }
    fxPre('no-time', !!reqNoTime, 'refresh() 的取数请求 7s 内没被 CDP Fetch 拦住');
    if (reqNoTime) await fxServe(reqNoTime, FX_NO_TIME, 'no-time');
    await fxSelfProof('no-time', { what: 'FX_NO_TIME (缺 generated_at 字段)' });
    const noTime = await evalJs(pulseProbe('#pulse'));
    check('★ 缺 generated_at → 如实写「快照未标注时间」(时间格 + 徽章年龄都写), <time datetime> 留空不编假时刻',
      /未标注/.test(String(noTime.snap)) && /未标注/.test(String(noTime.age)) && noTime.snapIso === '' &&
      /未标注/.test(String(await evalJs(`(() => { const r = document.querySelector('#pulse'); const n = r.querySelector('[data-pulse-age]'); return n.textContent; })()`))),
      JSON.stringify({ snap: noTime.snap, age: noTime.age, iso: noTime.snapIso }));
    // 「不出现当前时间」: 当前时刻的 YYYY-MM-DD HH:MM 一个字符都不许出现在时间/年龄文本里,
    // 而且不许出现「刚刚 / N 分钟前」这类只有拿 now() 顶替才会有的相对说法 (快照本身没给时间, 就没得算)。
    const nowHm = localAbs(Date.now()).slice(0, 16);
    const timeTexts = JSON.stringify({ snap: noTime.snap, ago: noTime.ago, age: noTime.age, iso: noTime.snapIso });
    check('★ 缺 generated_at → 页面上不出现当前时间、也不给假的相对时间 (绝不用 now() 顶替)',
      !timeTexts.includes(nowHm) && !/刚刚|just now/.test(String(noTime.ago) + String(noTime.age)) &&
      !/\d+\s*(分钟前|小时前|天前)|minutes? ago|hours? ago/.test(String(noTime.ago) + String(noTime.age)) &&
      noTime.nodes === '7' && noTime.state === 'live',                       // 页面其它部分照常 (证明夹具真被消费了)
      JSON.stringify({ texts: timeTexts, now: nowHm, nodes: noTime.nodes, state: noTime.state }));
    await evalJs(`document.querySelector('.lang-toggle [data-lang="en"]').click()`);
    await sleep(300);
    const noTimeEn = await evalJs(pulseProbe('#pulse'));
    check('★ EN: 缺 generated_at → 「Snapshot time not labeled」(徽章与时间格都对), 仍不给假时间',
      /Snapshot time not labeled/.test(String(noTimeEn.snap)) && /Snapshot time not labeled/.test(String(noTimeEn.age)) &&
      !/\d+\s*(minute|minutes|hour|hours) ago/.test(String(noTimeEn.ago) + String(noTimeEn.age)),
      JSON.stringify({ snap: noTimeEn.snap, age: noTimeEn.age, ago: noTimeEn.ago }));
    await evalJs(`document.querySelector('.lang-toggle [data-lang="zh"]').click()`);
    await sleep(250);
  }

  // ★ generated_at 写成 ISO 字符串 (老写法) 也必须吃 —— 判成「未标注」就是漏了兼容解析
  {
    const pIso = nextPaused(7000);
    await evalJs(`(() => { window.__bolloonPulse.refresh(); return 1; })()`);
    let reqIso = null;
    try { reqIso = await pIso; } catch { /* 交给自证判「夹具未生效」 */ }
    fxPre('iso-time', !!reqIso, 'refresh() 的取数请求 7s 内没被 CDP Fetch 拦住');
    if (reqIso) await fxServe(reqIso, FX_ISO_TIME, 'iso-time');
    await fxSelfProof('iso-time', { what: 'FX_ISO_TIME (generated_at = ISO 字符串)' });
    const isoT = await evalJs(pulseProbe('#pulse'));
    check('★ generated_at 写成 ISO 字符串也照常显示成那一刻 (不判成「未标注」): 绝对时刻逐字 + <time datetime> 原样 ISO + 相对时间小时档',
      isoT.snap === localAbs(ISO_GEN) && isoT.snapIso === new Date(ISO_GEN).toISOString() &&
      /小时前/.test(String(isoT.age)) && !/未标注/.test(String(isoT.snap) + String(isoT.age)),
      JSON.stringify({ snap: isoT.snap, want: localAbs(ISO_GEN), iso: isoT.snapIso, age: isoT.age }));
  }

  // 接口失败 → unavailable, 且不阻断其它区域 (这条夹具 = 「我方把请求打失败」, 所以送达证记在 fxFailed)
  const p4 = nextPaused(7000);
  await evalJs(`(() => { window.__bolloonPulse.refresh(); return 1; })()`);
  let req4 = null;
  try { req4 = await p4; } catch { /* 同上 */ }
  fxPre('a-fail', !!req4, 'refresh() 的取数请求 7s 内没被 CDP Fetch 拦住 (无法注入失败)');
  if (req4) await fxFailServe(req4, 'a-fail');
  await fxSelfProof('a-fail', { mode: 'fail', domSignal: (v) => !!v && v.state === 'unavailable', what: '取数失败夹具 (unavailable)' });
  const un = await evalJs(pulseProbe('#pulse'));
  check('unavailable: 请求失败 → 快照暂时读不到',
    un.state === 'unavailable' && un.visible.includes('快照暂时读不到') && un.hintShown,
    JSON.stringify({ s: un.state, v: un.visible, h: un.hintShown }));
  check('unavailable: 提示含 ?pulse= 与本机节点示例',
    un.hint.includes('?pulse=') && un.hint.includes('127.0.0.1:54188'), un.hint.slice(0, 120));
  check('unavailable: 数值清空 + 表格 0 行 + 空态说「快照不可用」+ 数据源标注也说读不到快照 (两种空法不混)',
    un.nodes === '—' && un.agents === '—' && un.act.rowCount === 0 && un.act.emptyShown === true &&
    /快照不可用/.test(un.act.emptyText) && /未读到快照/.test(un.act.source),
    JSON.stringify({ n: un.nodes, rows: un.act.rowCount, empty: un.act.emptyText, src: un.act.source }));
  check('unavailable: 快照不可用时不会编造任何行 (0 行, 且没有空白行)', un.act.rowCount === 0 && un.act.blankRows === 0);
  const others = await evalJs(`(() => ({
    badge: (document.getElementById('version')||{}).textContent || '',
    cmd: (document.getElementById('skill-cmd')||{}).textContent || '',
    year: (document.getElementById('year')||{}).textContent || '',
    footer: document.querySelectorAll('.foot a').length,
    pulseState: document.getElementById('pulse').getAttribute('data-pulse-state'),
  }))()`);
  check('接口失败不阻断页面其它区域 (命令/徽章/页脚仍正常)',
    /^read /.test(others.cmd) && others.cmd.endsWith('/bolloon-gateway-join.md') &&
    (!liveVersion || others.badge === liveVersion) && /^\d{4}$/.test(others.year) && others.footer >= 1,
    JSON.stringify(others));
  check('失败后 backoff 生效 (failCount ≥ 1)', (await evalJs('window.__bolloonPulse.failCount()')) >= 1);

  // 超时 (5s AbortController): 把请求挂住不放, 模块必须自己放弃 → unavailable, 不卡在 loading
  // 这里的「夹具」= 我方把请求挂住不放。所以自证 = 请求确实被我方拦住了 (reqTimeout 到手);
  // 拿不到就明确报「夹具未生效」, 不把「没挂住」当成页面没超时。
  const pTimeout = nextPaused(7000);
  await evalJs(`(() => { window.__bolloonPulse.refresh(); return 1; })()`);
  let reqTimeout = null;
  try { reqTimeout = await pTimeout; } catch { /* 没拦到就按 DOM 判断 */ }
  fxPre('timeout-hang', !!reqTimeout, '取数请求 7s 内没被拦住 (请求没挂住, 本轮超时断言不成立)');
  await sleep(6000);                       // 单次请求超时 = 5s
  const to = await evalJs(pulseProbe('#pulse'));
  check('超时: 请求挂住 6s → 模块自己放弃 (unavailable), 不永久停在 loading',
    to.state === 'unavailable' && to.visible.includes('快照暂时读不到') && to.act.rowCount === 0,
    JSON.stringify({ s: to.state, v: to.visible }));
  if (reqTimeout) { try { await fxServe(reqTimeout, FX_LIVE, 'live'); } catch { /* 已 abort, 拦截 id 失效是正常的 */ } }
  await sleep(200);
  fxOff();   // 下面这组 (配置常量) 不吃夹具

  // 轮询与超时常量
  const cfg = await evalJs(`(() => { const p = window.__bolloonPulse; return p ? { poll: p.config.pollMs, timeout: p.config.timeoutMs, backoff: p.config.backoffMs, rel: p.config.relTickMs, feedMax: p.config.feedMax, activityMax: p.config.activityMax, capsMax: p.config.capsMax, refresh: typeof p.refresh, tick: typeof p.tick, src: p.source() } : null; })()`);
  check('30 秒轮询 + 5 秒超时 + 退避 30/60/120 上限 120',
    !!cfg && cfg.poll === 30000 && cfg.timeout === 5000 && JSON.stringify(cfg.backoff) === JSON.stringify([30000, 60000, 120000]),
    JSON.stringify(cfg));
  check('轮询/刷新函数存在 (refresh + tick) + 表格行上限 activityMax, 旧 capsMax 已移除',
    !!cfg && cfg.refresh === 'function' && cfg.tick === 'function' && cfg.activityMax === 60 && cfg.capsMax === undefined,
    JSON.stringify(cfg));
  // 无 ?pulse= → 回退同源 network-pulse.json (站点上通常不存在 → 如实 unavailable, 不阻断其它区域)
  shouldIntercept = (p) => p.request.url.endsWith('/network-pulse.json');
  await fxEnable('*network-pulse.json*');
  const p5 = nextPaused(9000);
  await cdp('Page.navigate', { url: `${BASE}/gateway.html` });
  let req5 = null;
  try { req5 = await p5; } catch { /* 下面按结果判断 */ }
  fxPre('fallback-404', !!req5, '无 ?pulse= 时的同源快照请求 9s 内没被 CDP Fetch 拦住 (无法注入 404)');
  check('无 ?pulse= 时回退到同源 network-pulse.json', !!req5 && /\/network-pulse\.json$/.test(req5.request.url), req5 ? req5.request.url : '未拦到请求');
  if (req5) {
    fxFailHit('fallback-404', req5.request.url);   // 送达证: 这个 404 是**我方**注入的
    await cdp('Fetch.fulfillRequest', {
      requestId: req5.requestId, responseCode: 404,
      responseHeaders: [{ name: 'Content-Type', value: 'text/plain' }],
      body: Buffer.from('not found', 'utf8').toString('base64'),
    });
  }
  await fxSelfProof('fallback-404', { mode: 'fail', domSignal: (v) => !!v && v.state === 'unavailable', what: '回退快照 404 夹具' });
  const fb = await evalJs(pulseProbe('#pulse'));
  const fbCmd = await evalJs(`(document.getElementById('skill-cmd')||{}).textContent||''`);
  check('回退拿到 404 → unavailable, 页面其它区域仍正常',
    fb.state === 'unavailable' && fb.visible.includes('快照暂时读不到') && /^read /.test(fbCmd),
    JSON.stringify({ state: fb.state, cmd: fbCmd.slice(0, 40) }));
  await fxDisable();
  fxOff();

  // ⑥‴′ 同源**真快照** (无 ?pulse=, 不对真实网络下断言之外的猜测): 线上真数据必须真渲染,
  //       且「0 个任务 + N 行任务」这类同屏数字必须自带口径解释 —— 这是本页对线上的最终交付断言。
  //       注: 这一段**故意不注夹具** (要验的就是线上真快照), 所以它不参与夹具自证。
  console.log('\n[6e] 同源真快照 (无 ?pulse=) → 真行数 + 口径行 + 链归属');
  const realRaw = await fetchText(`${BASE}/network-pulse.json`);
  let realObj = null;
  try { realObj = JSON.parse(realRaw); } catch { realObj = null; }
  check('同源 network-pulse.json 可读且形状齐 (confirmed_activity + activity_totals + chain_id_scope + totals_scope)',
    !!realObj && Array.isArray(realObj.confirmed_activity) && !!realObj.activity_totals &&
    !!realObj.chain_id_scope && !!realObj.totals_scope,
    realObj ? `rows=${(realObj.confirmed_activity || []).length}` : '读不到 / 不是 JSON');
  await cdp('Page.navigate', { url: `${BASE}/gateway.html` });
  // 真快照是真网络请求 (CDN 更慢) → 等「真渲染出 N 行」再断言, 不用固定 sleep 量中间态
  const real = await waitStable(pulseProbe('#pulse'), (v) => v && v.act && v.act.rowCount === (realObj ? Math.min(realObj.confirmed_activity.length, 60) : -1), { tries: 80, interval: 150 });
  const expRows = realObj ? Math.min(realObj.confirmed_activity.length, 60) : -1;   // 前端表格上限 60
  check('真快照真渲染: 表格行数 = min(快照行数, 60)',
    real.state === 'live' && expRows > 0 && real.act.rowCount === expRows,
    JSON.stringify({ s: real.state, rows: real.act.rowCount, exp: expRows }));
  check('真快照: 表区口径短标记 = 「链上索引 · 全量」(口径行在时数据源行不重复第二遍)',
    SCOPE_WHOLE_MARK.test(real.act.totalsLine) && real.act.totalsLine.startsWith('链上索引 · 全量 ·') &&
    real.act.source === '', JSON.stringify({ line: real.act.totalsLine, src: real.act.source }));
  check('★ 真快照: 两套口径各自带就近短标记 (统计区「观察窗口 24h」+ 表区「链上索引 · 全量」)',
    scopeMarkers(real).both && real.caveat === '观察窗口 24h',
    JSON.stringify({ stats: real.caveat, table: real.act.totalsLine }));
  // 链归属措辞 (2026-09-22 修): 真链数据上线后 8453 用的是「Base 主网」措辞,
  // 旧正则只认「本机隔离开发链|公网」→ 把真数据判成假红。改为**按链的性质分开要求**(更严):
  //   公网链 (is_public_network=true) → 必须点明 公网/主网/测试网
  //   本机链                         → 必须点明 本机隔离开发链
  const cidScope = realObj.chain_id_scope || {};
  const cidStr = String(cidScope.activity_chain_id);
  const chainIsPublic = cidScope.is_public_network === true;
  const chainWordingOk = chainIsPublic
    ? /公网|主网|测试网/.test(real.act.totalsLine)
    : /本机隔离开发链/.test(real.act.totalsLine);
  check('真快照的口径行: 行数与实际一致 + 写明这批行属于哪条链 (不留给读者猜)',
    real.act.totalsLineShown === true && real.act.totalsLine.includes(expRows + ' 行') &&
    real.act.totalsLine.includes(cidStr) && chainWordingOk,
    JSON.stringify({ line: real.act.totalsLine, cid: cidStr, isPublic: chainIsPublic }));
  const realMarks = scopeMarkers(real);
  check('★ 真数据反矛盾 (2026-09-23 加强): 「0 个任务」与「N 行」同屏时, 统计区「观察窗口」标记 + 表区「链上索引 · 全量」标记**两个都必须在场** —— 缺任何一个就是「并列而不解释」(线上真快照当场验)',
    realMarks.statsOk && !(real.act.rowCount > 0 && real.tasks === '0' && !realMarks.tableOk),
    JSON.stringify({ rows: real.act.rowCount, tasks: real.tasks, stats: realMarks.stats, table: realMarks.table }));
  check('★ 真快照: 脉冲区文案不写整句、且都在长度上限内 (口径行/数据源行/caveat) —— 长解释删掉后页面不靠新长句补回来',
    proseBudgetOk(real).length === 0, JSON.stringify(proseBudgetOk(real)));

  // ⑥‴★★★ 同一概念不变量门 (2026-09-24 leo:「数量怎么对不上, 尤其是后面的任务和钱包」):
  //   验收对象 = **页面真渲染出来的字**: 顶部「任务/已完成/已结算」与同屏表格里的同概念数必须相等。
  //   两半都要有: (a) 真快照上门必须**干净** + 数字确实是链上索引同源值;
  //              (b) 三个变异快照上门必须**真判红** (否则这道门等于不存在)。
  console.log('\n[6e★★★] 同一概念不变量门: 顶部计数 vs 表格同概念数 (真快照干净 + 变异快照必红)');
  const realAt = (realObj && realObj.activity_totals) || null;
  const realFields = (realObj && realObj.totals_scope && realObj.totals_scope.fields) || null;
  const realFindings = contradictionFindings(real, realObj);
  check('★ 真快照: 同一概念不变量门 = 干净 (顶部任务类计数与表格同概念数一个都不打架)',
    realFindings.length === 0, JSON.stringify(realFindings));
  check('★ 真快照: 顶部「任务/已完成/已结算」= 链上索引同源值 activity_totals.tasks/tasks_completed/tasks_settled (不再是窄脉冲流的 0)',
    !!realAt && real.tasks === String(realAt.tasks) && real.tasksDone === String(realAt.tasks_completed) &&
    real.tasksSettled === String(realAt.tasks_settled) && realAt.tasks > 0,
    JSON.stringify({ dom: [real.tasks, real.tasksDone, real.tasksSettled],
      at: realAt && [realAt.tasks, realAt.tasks_completed, realAt.tasks_settled] }));
  check('★ 真快照: 顶部这个数就地标了口径短标记「链上索引 · 全量」(与表同源写在数字旁, 不藏在 notes / title 里)',
    SCOPE_WHOLE_MARK.test(((real.scopeTags || {}).tasks || {}).text || '') &&
    SCOPE_WHOLE_MARK.test(((real.scopeTags || {}).tasks_completed || {}).text || ''),
    JSON.stringify({ tasks: (real.scopeTags || {}).tasks, done: (real.scopeTags || {}).tasks_completed }));
  check('★ 真快照: 「已验证」槽已从页面整体去掉 —— 链上索引口径下没有对应事件 (无源可报) ⇒ 页面不再有这一格 (不显示「未接入」, 也不是 0 / — / 整行隐藏)',
    !!realFields && realFields.tasks_verified.source === 'none' &&
    real.tasksVerified === null && real.tasksHidden.verified === null,
    JSON.stringify({ field: realFields && realFields.tasks_verified, dom: real.tasksVerified, hidden: real.tasksHidden.verified }));
  check('★ 真快照: 「钱包签名」要么是审计账真值 (数字), 要么如实「未接入」—— 绝不许在无源时裸写 0',
    !!realFields && (/^\d+$/.test(String(real.signatures)) ? real.signatures !== '0' : real.signatures === '未接入'),
    JSON.stringify({ field: realFields && realFields.signatures, dom: real.signatures }));

  // (b) 变异验证: 拿**真快照**改一个数 → 页面必然自相矛盾 → 门必须判红 (真判红, 不是"理论上会红")
  shouldIntercept = (p) => p.request.url.includes('network-pulse-verify-contra');
  await fxEnable(PULSE_PATTERN);
  fxPre('contra-fixtures', !!REAL_SNAP_ON_DISK, 'network-pulse.json 读不到 → 变异快照造不出来 (先跑 refresh)');
  // 变异 1: 顶部「任务」= 0 而口径仍标「链上索引·全量」+ 表里 N 行 → 同一概念两个数
  contraMode = 'tasks-zero';
  await cdp('Page.navigate', { url: `${BASE}/gateway.html?pulse=${encodeURIComponent(`${BASE}/network-pulse-verify-contra.json`)}` });
  const cTZ = await waitStable(pulseProbe('#pulse'), (v) => !!(v && v.act && v.act.rowCount === expRows), { tries: 80, interval: 150 });
  const cTZf = contradictionFindings(cTZ, FX_CONTRA_TASKS_ZERO);
  check('★ 变异验证 1 (顶部 0 任务 + 表里 N 行) → 门真判红: 页面顶部显示 0, 表格却真有 N 行, 门报「同一概念两个数」',
    cTZ.tasks === '0' && cTZ.act.rowCount === expRows && expRows > 0 && cTZf.length > 0 &&
    cTZf.some((s) => /同一概念两个数/.test(s) && /任务|已完成|已结算/.test(s)),
    JSON.stringify({ dom: cTZ.tasks, rows: cTZ.act.rowCount, findings: cTZf }));
  // 变异 2: 「钱包签名」= 0 但口径标无源 → 裸 0 会被读成「没发生过」→ 门真判红
  contraMode = 'sig-bare-zero';
  await cdp('Page.navigate', { url: `${BASE}/gateway.html?pulse=${encodeURIComponent(`${BASE}/network-pulse-verify-contra.json`)}` });
  const cSB = await waitStable(pulseProbe('#pulse'), (v) => !!(v && v.act && v.act.rowCount === expRows), { tries: 80, interval: 150 });
  const cSBf = contradictionFindings(cSB, FX_CONTRA_SIG_BARE_ZERO);
  check('★ 变异验证 2 (签名 = 0 却标无源) → 门真判红: 「裸 0 会被读成没发生过」被抓住',
    cSB.signatures === '0' && cSBf.some((s) => /signatures/.test(s) && /裸 0/.test(s)),
    JSON.stringify({ dom: cSB.signatures, findings: cSBf }));
  // 变异 3 (正例): 「钱包签名」= null + 未接入 → 页面必须写「未接入」, 且门保持干净 (未接入 ≠ 矛盾)
  contraMode = 'sig-unavailable';
  await cdp('Page.navigate', { url: `${BASE}/gateway.html?pulse=${encodeURIComponent(`${BASE}/network-pulse-verify-contra.json`)}` });
  const cSU = await waitStable(pulseProbe('#pulse'), (v) => !!(v && v.act && v.act.rowCount === expRows), { tries: 80, interval: 150 });
  const cSUf = contradictionFindings(cSU, FX_SIG_UNAVAILABLE);
  check('★ 变异验证 3 (签名 = null + 未接入) → 页面如实写「未接入」(不是 0 / 不是 — / 不隐藏), 且门判**干净**',
    cSU.signatures === '未接入' && cSU.tasksHidden.sig === false && cSUf.length === 0,
    JSON.stringify({ dom: cSU.signatures, hidden: cSU.tasksHidden.sig, findings: cSUf }));
  check('★ 「未接入」的就地口径标记也贴在数字旁 (data-pulse-scope-tag=signatures → 未接入), 不藏在 notes / 不给 title 了事',
    ((await evalJs(`(() => { const n = document.querySelector('#pulse [data-pulse-scope-tag="signatures"]'); return n ? n.textContent.trim() : null; })()`)) === '未接入'),
    'data-pulse-scope-tag=signatures 的就地口径标记');
  // 收尾: 门自己的反向自证 (空探针必须报「判断不了」, 不能静默返回 [])
  check('★ 门自身不留空门: 探针缺失时返回「判断不了」(不是悄悄返回 [])',
    JSON.stringify(contradictionFindings(null, null)) !== '[]' && JSON.stringify(contradictionFindings(null, null)).includes('判断不了'),
    JSON.stringify(contradictionFindings(null, null)));

  // ⑥‴★★★★ 顶部计数行「未接入」下线门 (2026-09-24 leo:「链上活动页, 未接入是什么意思, 可以去掉吗」):
  //   「已验证」槽已在**两页**整体去掉 —— 链上索引没有第四类事件可报 (无源) ⇒ 与其在计数行显示一个
  //   要再解释一次的「未接入」, 不如不显示这一格。**快照契约一字未改** (页面不显示 ≠ 假装字段不存在)。
  //   这道门只看**真渲染出来的东西**: ① 两页静态 HTML 里这一格的钩子 0 处;
  //   ② 两页真 DOM 的计数行整块可见文本 0 次「未接入 / not connected」; ③ 计数行仍六格、一格没少;
  //   ④ 快照契约仍在。每条「没有 X」型断言前面都先给正面前置 (计数行 markup/DOM 真的在、真快照真读到) ——
  //   缺失类断言在空输入上恒真 (规则 3)。
  //   阴性对照 (规则 1) 见 docs/wiki/log.md: 把这一格塞回页面 → ①②③ 必须当场判红 → 恢复后全绿。
  console.log('\n[6e★★★★] 顶部计数行不再出现「未接入」(「已验证」槽整体下线 · 快照契约不变)');
  const UNAVAIL_RE = /未接入|not connected/;
  const VERIFIED_RE = /验证|verified/i;
  const gwTopRaw = await fetchText(`${BASE}/gateway.html`);
  const idxTopRaw = await fetchText(`${BASE}/index.html`);
  const hookCount = (html, attr) => (html.match(new RegExp(`data-pulse-${attr}="tasks_verified"`, 'g')) || []).length;
  check('★ 静态 HTML · 网关页: 「已验证」槽的钩子一个不剩 (data-pulse-total / data-pulse-scope-tag = tasks_verified 各 0 处)', 
    gwTopRaw.includes('data-pulse-total="nodes"') &&                 // 前置: 小结行 markup 真在 (不是残页/抓空)
    hookCount(gwTopRaw, 'total') === 0 && hookCount(gwTopRaw, 'scope-tag') === 0,
    JSON.stringify({ hasNodes: gwTopRaw.includes('data-pulse-total="nodes"'),
      total: hookCount(gwTopRaw, 'total'), tag: hookCount(gwTopRaw, 'scope-tag') }));
  check('★ 静态 HTML · 首页: 同样没有这一格的钩子 (两页同一条纪律 —— 首页本来就只有六格)',
    idxTopRaw.includes('data-pulse-total="nodes"') &&
    hookCount(idxTopRaw, 'total') === 0 && hookCount(idxTopRaw, 'scope-tag') === 0,
    JSON.stringify({ hasNodes: idxTopRaw.includes('data-pulse-total="nodes"'),
      total: hookCount(idxTopRaw, 'total'), tag: hookCount(idxTopRaw, 'scope-tag') }));
  // 真 DOM · 网关页 (同源真快照; 等「真渲染出 N 行」再量 —— 固定 sleep 会量到中间态)
  await cdp('Page.navigate', { url: `${BASE}/gateway.html` });
  const topGw = await waitStable(pulseProbe('#pulse'), (v) => !!(v && v.act && v.act.rowCount === expRows), { tries: 80, interval: 150 });
  const topGwText = await evalJs(`(() => { const n = document.querySelector('#pulse .pulse-summary'); return n ? n.innerText.replace(/\\s+/g, ' ').trim() : null; })()`);
  check('★ 真 DOM · 网关页 (真快照): 计数行整块可见文本里 **0 次**「未接入 / not connected」',
    typeof topGwText === 'string' && topGwText.length > 0 && !UNAVAIL_RE.test(topGwText),
    JSON.stringify({ text: topGwText }));
  check('★ 真 DOM · 网关页: 计数行仍六格 (键 = nodes/agents/tasks/tasks_completed/tasks_settled/signatures), 少的是「已验证」—— 不许顺手删别的, 也不许把这一格塞回来',
    JSON.stringify(topGw.summary.map((r) => r.key)) === JSON.stringify(['nodes', 'agents', 'tasks', 'tasks_completed', 'tasks_settled', 'signatures']) &&
    topGw.summary.length === 6 &&
    !Object.prototype.hasOwnProperty.call(topGw.scopeTags || {}, 'tasks_verified') &&
    !VERIFIED_RE.test(topGw.summary.map((r) => r.label).join('|')),
    JSON.stringify(topGw.summary.map((r) => [r.key, r.label, r.hidden])));
  // 真 DOM · 首页 (紧凑版真快照; 同一份决定: 顶部不出现「未接入」)
  await cdp('Page.navigate', { url: `${BASE}/index.html` });
  const topIdxRow = await waitStable(`(() => {
    const row = document.querySelector('#intro .pulse-compact .pulse-c-totals');
    if (!row) return null;
    return { text: row.innerText.replace(/\\s+/g, ' ').trim(),
      keys: Array.from(row.querySelectorAll('[data-pulse-total]')).map((e) => e.getAttribute('data-pulse-total')),
      labels: Array.from(row.querySelectorAll('li > span')).map((e) => e.textContent.trim()) };
  })()`, (v) => !!(v && v.keys && v.keys.length >= 5), { tries: 80, interval: 150 });
  check('★ 真 DOM · 首页 (真快照): 紧凑计数行整块可见文本里 **0 次**「未接入 / not connected」',
    !!topIdxRow && topIdxRow.text.length > 0 && !UNAVAIL_RE.test(topIdxRow.text),
    JSON.stringify(topIdxRow && { text: topIdxRow.text }));
  check('★ 真 DOM · 首页: 计数行六格键齐 (节点/agents/活跃 agent/24 小时内出现/任务/已完成), 没有「已验证」这一格',
    !!topIdxRow &&
    JSON.stringify(topIdxRow.keys) === JSON.stringify(['nodes', 'agents', 'active', '24h', 'tasks', 'tasks_completed']) &&
    topIdxRow.labels.length === 6 && !VERIFIED_RE.test(topIdxRow.labels.join('|')),
    JSON.stringify(topIdxRow && { keys: topIdxRow.keys, labels: topIdxRow.labels }));
  // 快照契约 (导出器侧一个字都没改): 页面不显示 ≠ 假装这个字段不存在
  const ctrFields = (realObj && realObj.totals_scope && realObj.totals_scope.fields) || null;
  const ctrV = ctrFields && ctrFields.tasks_verified;
  check('★ 快照契约一字未改: totals.tasks_verified 仍在且为 null + totals_scope.fields.tasks_verified 仍带 source/unavailable/short/label (页面不显示这一格 ≠ 假装这个字段不存在)',
    !!realObj && Object.prototype.hasOwnProperty.call(realObj.totals || {}, 'tasks_verified') &&
    realObj.totals.tasks_verified === null &&
    !!ctrV && ctrV.source === 'none' && ctrV.unavailable === true &&
    !!(ctrV.short && (ctrV.short.zh || ctrV.short.en)) &&
    !!(ctrV.label && (ctrV.label.zh || ctrV.label.en)),
    JSON.stringify({ top: realObj && realObj.totals && realObj.totals.tasks_verified, field: ctrV }));
  // 收尾: 把浏览器放回**网关页 + 真快照**(等它真渲染出 N 行) —— 下一节 [6e★★] 假设「当前页 = 网关页」
  //   并直接量 `#pulse` 的 innerText; 本门自己导航去首页量过计数行, 所以必须把现场还原回去。
  await cdp('Page.navigate', { url: `${BASE}/gateway.html` });
  await waitStable(pulseProbe('#pulse'), (v) => !!(v && v.act && v.act.rowCount === expRows), { tries: 80, interval: 150 });

  // ⑥‴★★ 浏览器链接 (2026-09-23): 「网页行可索引到链上合约 + 交易可跳区块浏览器」——**两页各验一遍**
  //   为什么必须分页: 网关页 = 完整表 (任务格里的交易标签 + 网络格尾的合约链接); 首页序栏 = 紧凑快照区
  //   (只有「最新一笔链上交易」一行)。两处共用 app.js 同一份 view.rows / 同一套链接校验与短写 ⇒
  //   断言也必须落在两页各一份; 而且**只在有 explorer 字段时才是 <a>**, 本机链绝不许编 href="#" 死链。
  //   这一段用夹具把六种情形验死 (真数据那一段在 [6e] 已验过真链行可点)。
  console.log('\n[6e★★] 浏览器链接 · 真快照 (网关页 + 首页, 分页验)');
  const IDX_PULSE_ROOT = '#intro .pulse-compact';
  const realPubRows = ((realObj && realObj.confirmed_activity) || []).filter((r) => r.chain_id === 8453);
  const gwPubRows = real.act.rows.filter((r) => r.chain === '8453');
  check('真快照 · 网关页: 公网链行 (8453) 的交易标签**确实**是 <a> (href = basescan/tx/0x64hex, target=_blank, rel 含 noopener)',
    realPubRows.length > 0 && gwPubRows.length === realPubRows.length && gwPubRows.every((r) => r.txLink && r.txLink.tag === 'a' &&
      /^https:\/\/[a-z.]*basescan\.org\/tx\/0x[0-9a-f]{64}$/.test(r.txLink.href || '') &&
      r.txLink.target === '_blank' && /noopener/.test(r.txLink.rel || '')),
    JSON.stringify({ live: realPubRows.length, rows: gwPubRows.map((r) => [r.chain, r.txLink && r.txLink.tag, r.txLink && r.txLink.href]) }));
  check('真快照 · 网关页: **合约不上页面** —— 活动区里没有任何 /address/0x40 的链接, 每行也没有合约链接节点 (网络格仍是 chain_id 纯文本)',
    gwPubRows.length > 0 && real.addrLinks.length === 0 &&
    gwPubRows.every((r) => !r.contractLink || r.contractLink.tag === null) &&
    gwPubRows.every((r) => r.cells.length === 7) &&
    realPubRows.every((r) => !('explorer_contract' in r)),
    JSON.stringify({ addrLinks: real.addrLinks, rows: gwPubRows.map((r) => [r.chain, r.contractLink && r.contractLink.tag]) }));
  check('真快照 · 网关页: 链接文本一律短写 (可见文本里没有 40 位地址 / 64 位哈希; 全长只在 href 里)',
    gwPubRows.length > 0 && gwPubRows.every((r) => /^0x[0-9a-f]{4}…[0-9a-f]{4} ↗$/.test(r.txLink.text || '')) &&
    (await evalJs(`(() => { const t = document.querySelector('#pulse').innerText; return !/0x[0-9a-fA-F]{40}/.test(t) && !/[0-9a-fA-F]{64}/.test(t); })()`)) === true,
    JSON.stringify(gwPubRows.map((r) => r.txLink && r.txLink.text)));
  await cdp('Page.navigate', { url: `${BASE}/index.html` });
  const realIdxPulse = await waitStable(pulseProbe(IDX_PULSE_ROOT), (v) => !!(v && v.txLine && v.txLine.tag === 'a'), { tries: 80, interval: 150 });
  check('真快照 · 首页快照区: 「最新链上交易」**确实**是 <a> (basescan/tx/0x64hex, target=_blank, rel 含 noopener, 文本短写)',
    !!realIdxPulse.txLine && realIdxPulse.txLine.tag === 'a' &&
    /^https:\/\/[a-z.]*basescan\.org\/tx\/0x[0-9a-f]{64}$/.test(realIdxPulse.txLine.href || '') &&
    realIdxPulse.txLine.target === '_blank' && /noopener/.test(realIdxPulse.txLine.rel || '') &&
    /^0x[0-9a-f]{4}…[0-9a-f]{4} ↗$/.test(realIdxPulse.txLine.text || ''),
    JSON.stringify(realIdxPulse.txLine));
  check('真快照 · 首页: 链接指向的那笔交易 = 快照里最新的那条公网链行 (不是随便一笔)',
    realPubRows.length > 0 && !!realIdxPulse.txLine &&
    realPubRows.some((r) => `https://basescan.org/tx/${r.tx_hash}` === realIdxPulse.txLine.href),
    JSON.stringify({ href: realIdxPulse.txLine && realIdxPulse.txLine.href, live: realPubRows.map((r) => r.tx_hash) }));
  check('真快照 · 首页快照区: **合约不上页面** —— 序栏里也没有任何 /address/0x40 的链接',
    realIdxPulse.addrLinks.length === 0 && realIdxPulse.txLine.tag === 'a',
    JSON.stringify({ addrLinks: realIdxPulse.addrLinks }));
  check('真快照 · 首页: 双语提示在 (最新链上交易 / latest on-chain tx), 且序栏里没有 href="#" 之类的死链',
    (await evalJs(`(() => { const r = document.querySelector('${IDX_PULSE_ROOT}'); const h = r && r.querySelector('.pulse-c-tx-hint');
      const dead = Array.from(r ? r.querySelectorAll('a') : []).filter((a) => { const h2 = a.getAttribute('href') || ''; return h2 === '#' || h2 === '' || /^javascript:/i.test(h2); });
      return !!h && h.getAttribute('data-zh') === '最新链上交易' && h.getAttribute('data-en') === 'latest on-chain tx' && dead.length === 0; })()`)) === true);

  // —— 夹具档: 六种情形 (真链可点 / 本机链绝不点) ——
  console.log('\n[6f] 网关页表格 · 浏览器链接夹具 (真链行可点 / 本机链行纯文本)');
  const exErrStart = consoleErrors.length;
  eMode = 'chain';
  shouldIntercept = (p) => p.request.url.includes('network-pulse-verify');
  await fxEnable(PULSE_PATTERN);
  await cdp('Page.navigate', { url: `${BASE}/gateway.html?pulse=${encodeURIComponent(`${BASE}/network-pulse-verify-explorer.json`)}` });
  await fxSelfProof('explorer', { what: 'FX_EXPLORER (六行混装)' });
  const ex = await waitStable(pulseProbe('#pulse'), (v) => !!(v && v.act && v.act.rowCount === FX_EXPLORER_ROWS.length), { tries: 80, interval: 150 });
  const exRow = (block) => ex.act.rows.find((r) => r.block === block) || null;
  check(`网关页夹具: ${FX_EXPLORER_ROWS.length} 行都画出来 (含本机链那两行)`,
    ex.act.rowCount === FX_EXPLORER_ROWS.length, JSON.stringify({ rows: ex.act.rowCount }));
  check('网关页夹具 · 真链行 (8453): 交易标签是 <a> + basescan/tx/0x64hex + target=_blank + rel 含 noopener',
    !!exRow('51640672') && exRow('51640672').txLink.tag === 'a' && exRow('51640672').txLink.href === FX_URL_TX_A &&
    exRow('51640672').txLink.target === '_blank' && /noopener/.test(exRow('51640672').txLink.rel || '') &&
    exRow('51640672').txLink.text === FX_SHORT_A + ' ↗',
    JSON.stringify(exRow('51640672') && exRow('51640672').txLink));
  check('网关页夹具 · **合约不上页面**: 夹具硬塞了 explorer_contract, 页面仍然不渲染合约链接 (表里 0 个 /address/ 链接, 行里没有合约链接节点)',
    ex.addrLinks.length === 0 &&
    ex.act.rows.every((r) => !r.contractLink || r.contractLink.tag === null) &&
    (await evalJs(`document.querySelectorAll('#pulse [data-pulse-activity-body] a').length === Array.from(document.querySelectorAll('#pulse [data-pulse-activity-body] a')).filter((a) => /\\/tx\\//.test(a.getAttribute('href') || '')).length`)) === true &&
    (await evalJs(`document.getElementById('pulse').innerText.indexOf('/address/') === -1`)) === true,
    JSON.stringify({ addrLinks: ex.addrLinks, links: ex.act.rows.map((r) => [r.contractLink && r.contractLink.tag, r.txLink && r.txLink.tag]) }));
  check('网关页夹具 · 本机链行 (31337, 没有 explorer_tx): 交易标签是纯文本, 也没有任何合约链接',
    !!exRow('676') && exRow('676').txLink.tag === 'code' && exRow('676').txLink.href === null &&
    exRow('676').txLink.text === FX_SHORT_LOCAL && (!exRow('676').contractLink || exRow('676').contractLink.tag === null),
    JSON.stringify({ row: exRow('676') && exRow('676').txLink, c: exRow('676') && exRow('676').contractLink }));
  check('网关页夹具 · 本机链行被人硬塞了合法 basescan 链接 → 仍不渲染成 <a> (认不出的链一律不给链接)',
    !!exRow('675') && exRow('675').txLink.tag === 'code' && exRow('675').txLink.href === null &&
    (!exRow('675').contractLink || exRow('675').contractLink.tag === null),
    JSON.stringify({ row: exRow('675') && exRow('675').txLink, c: exRow('675') && exRow('675').contractLink }));
  check('网关页夹具 · 只有 txHash 没有 escrow 的行: 交易可点, 网络格尾没有合约链接 (合约本来就不上页面)',
    !!exRow('51640600') && exRow('51640600').txLink.tag === 'a' && exRow('51640600').txLink.href === FX_URL_TX_B &&
    (!exRow('51640600').contractLink || exRow('51640600').contractLink.tag === null),
    JSON.stringify({ row: exRow('51640600') && exRow('51640600').txLink, c: exRow('51640600') && exRow('51640600').contractLink }));
  check('网关页夹具 · 域名不在白名单 / 链接指向别的哈希 → 都**不**渲染成链接 (宁可不点, 也不给错链接)',
    !!exRow('51640500') && exRow('51640500').txLink.tag === 'code' &&
    !!exRow('51640400') && exRow('51640400').txLink.tag === 'code' &&
    exRow('51640500').txLink.href === null && exRow('51640400').txLink.href === null,
    JSON.stringify([exRow('51640500') && exRow('51640500').txLink, exRow('51640400') && exRow('51640400').txLink]));
  check('网关页夹具 · 表头与列数没变 (新增的是格内节点, 不是第 8 列): 每行仍 7 格 + 任务格仍只 1 个文本节点',
    ex.act.headers.length === 7 && ex.act.rows.every((r) => r.cells.length === 7) &&
    ex.act.rows.every((r) => r.taskKids === 1),
    JSON.stringify({ h: ex.act.headers.length, cells: ex.act.rows.map((r) => r.cells.length), kids: ex.act.rows.map((r) => r.taskKids) }));
  check('网关页夹具 · 可见文本里没有全长地址/哈希 (链接文本一律短写) + 活动区里没有 href="#" 死链',
    (await evalJs(`(() => { const s = document.getElementById('pulse'); const t = s.innerText;
      const dead = Array.from(s.querySelectorAll('a')).filter((a) => { const h = a.getAttribute('href') || ''; return h === '#' || h === '' || /^javascript:/i.test(h); });
      return { addr: /0x[0-9a-fA-F]{40}/.test(t), hash: /[0-9a-fA-F]{64}/.test(t), dead: dead.length }; })()`)).addr === false &&
    (await evalJs(`document.querySelectorAll('#pulse a[href="#"], #pulse a[href=""]').length`)) === 0,
    JSON.stringify(await evalJs(`(() => { const t = document.getElementById('pulse').innerText; return { addr: /0x[0-9a-fA-F]{40}/.test(t), hash: /[0-9a-fA-F]{64}/.test(t) }; })()`)));
  check('网关页夹具这一轮无 console 错误 / 未捕获异常', consoleErrors.length === exErrStart, consoleErrors.slice(0, 3).join(' | '));

  console.log('\n[6g] 首页快照区 · 浏览器链接夹具 (与网关页同一套逻辑/同一份数据)');
  const exiErrStart = consoleErrors.length;
  eMode = 'chain';
  shouldIntercept = (p) => p.request.url.includes('network-pulse-verify');
  await fxEnable(PULSE_PATTERN);
  await cdp('Page.navigate', { url: `${BASE}/index.html?pulse=${encodeURIComponent(`${BASE}/network-pulse-verify-explorer.json`)}` });
  await fxSelfProof('explorer', { rootSel: IDX_PULSE_ROOT, domSignal: (v) => !!(v && v.txLine && v.txLine.href === FX_URL_TX_A), what: '首页 FX_EXPLORER' });
  const exIdx = await waitStable(pulseProbe(IDX_PULSE_ROOT), (v) => !!(v && v.txLine && v.txLine.tag === 'a'), { tries: 80, interval: 150 });
  check('首页夹具 · 「最新链上交易」是 <a> + basescan/tx/0x64hex + target=_blank + rel 含 noopener',
    !!exIdx.txLine && exIdx.txLine.tag === 'a' && exIdx.txLine.href === FX_URL_TX_A &&
    exIdx.txLine.target === '_blank' && /noopener/.test(exIdx.txLine.rel || ''),
    JSON.stringify(exIdx.txLine));
  check('首页夹具 · **合约不上页面** (首页侧): 序栏里 0 个 /address/ 链接; 指南/网关入口那类既有的真链接不算合约链接',
    exIdx.addrLinks.length === 0 && exIdx.txLine.tag === 'a' &&
    (await evalJs(`Array.from(document.querySelectorAll('${IDX_PULSE_ROOT} a')).every((a) => !/\\/address\\/0x[0-9a-f]{40}/i.test(a.getAttribute('href') || ''))`)) === true,
    JSON.stringify({ addrLinks: exIdx.addrLinks }));
  check('首页夹具 · 与网关页同一套短写 (同一个哈希在两页显示成同一串, 且都是「短写 + ↗」)',
    !!exIdx.txLine && exIdx.txLine.text === FX_SHORT_A + ' ↗' &&
    exIdx.txLine.text === (exRow('51640672') ? exRow('51640672').txLink.text : null),
    JSON.stringify({ idx: exIdx.txLine && exIdx.txLine.text, gw: exRow('51640672') && exRow('51640672').txLink.text }));
  check('首页夹具 · 序栏可见文本里没有全长哈希 (全长只在 href 里) + 没有 href="#" 死链',
    (await evalJs(`(() => { const r = document.querySelector('${IDX_PULSE_ROOT}'); const t = r.innerText;
      return { addr: /0x[0-9a-fA-F]{40}/.test(t), hash: /[0-9a-fA-F]{64}/.test(t),
        dead: Array.from(r.querySelectorAll('a')).filter((a) => { const h = a.getAttribute('href') || ''; return h === '#' || h === '' || /^javascript:/i.test(h); }).length }; })()`)).hash === false &&
    (await evalJs(`Array.from(document.querySelector('#intro .pulse-compact').querySelectorAll('a')).filter((a) => { const h = a.getAttribute('href') || ''; return h === '#' || h === ''; }).length`)) === 0);
  check('首页夹具 · 加了这一行后序栏整块仍 < 320px (紧凑契约没被破坏)',
    (await evalJs(`Math.round(document.querySelector('${IDX_PULSE_ROOT}').getBoundingClientRect().height)`)) < 320,
    String(await evalJs(`Math.round(document.querySelector('${IDX_PULSE_ROOT}').getBoundingClientRect().height)`)));
  check('首页夹具这一轮无 console 错误 / 未捕获异常', consoleErrors.length === exiErrStart, consoleErrors.slice(0, 3).join(' | '));

  console.log('\n[6h] 本机链夹具 (31337, 无 explorer 字段): 网关页保持纯文本 + 无死链');
  const loErrStart = consoleErrors.length;
  eMode = 'local';
  shouldIntercept = (p) => p.request.url.includes('network-pulse-verify');
  await fxEnable(PULSE_PATTERN);
  await cdp('Page.navigate', { url: `${BASE}/gateway.html?pulse=${encodeURIComponent(`${BASE}/network-pulse-verify-explorer.json`)}` });
  await fxSelfProof('explorer-local', { what: 'FX_EXPLORER_LOCAL (只有本机链一行)' });
  const lo = await waitStable(pulseProbe('#pulse'), (v) => !!(v && v.act && v.act.rowCount === 1), { tries: 80, interval: 150 });
  check('本机链夹具: 那一行的交易标签是纯文本 (不是 <a>), 也没有任何合约链接, 文本仍是短写哈希',
    lo.act.rowCount === 1 && lo.act.rows[0].txLink.tag === 'code' &&
    lo.act.rows[0].txLink.text === FX_SHORT_LOCAL && lo.act.rows[0].txLink.href === null &&
    (!lo.act.rows[0].contractLink || lo.act.rows[0].contractLink.tag === null),
    JSON.stringify({ rows: lo.act.rowCount, tx: lo.act.rows[0] && lo.act.rows[0].txLink, c: lo.act.rows[0] && lo.act.rows[0].contractLink }));
  check('本机链夹具 · 网关页活动区里一个 <a> 都没有 (没有链接就不该有链接), 也没有 href="#" 死链',
    (await evalJs(`document.querySelectorAll('#pulse [data-pulse-activity-body] a').length`)) === 0 &&
    (await evalJs(`document.querySelectorAll('#pulse a[href="#"], #pulse a[href=""]').length`)) === 0,
    String(await evalJs(`document.querySelectorAll('#pulse [data-pulse-activity-body] a').length`)));
  check('本机链夹具这一轮无 console 错误 / 未捕获异常', consoleErrors.length === loErrStart, consoleErrors.slice(0, 3).join(' | '));

  console.log('\n[6i] 本机链夹具 (31337): 首页快照区同样保持纯文本 + 无死链');
  const liErrStart = consoleErrors.length;
  eMode = 'local';
  shouldIntercept = (p) => p.request.url.includes('network-pulse-verify');
  await fxEnable(PULSE_PATTERN);
  await cdp('Page.navigate', { url: `${BASE}/index.html?pulse=${encodeURIComponent(`${BASE}/network-pulse-verify-explorer.json`)}` });
  await fxSelfProof('explorer-local', { rootSel: IDX_PULSE_ROOT, domSignal: (v) => !!(v && v.txLine && v.txLine.text === FX_SHORT_LOCAL), what: '首页 FX_EXPLORER_LOCAL' });
  const loIdx = await waitStable(pulseProbe(IDX_PULSE_ROOT), (v) => !!(v && v.txLine && v.txLine.text === FX_SHORT_LOCAL), { tries: 80, interval: 150 });
  check('本机链夹具 · 首页「最新链上交易」是纯文本 <code> (没有公网浏览器就不点), 没有 href',
    !!loIdx.txLine && loIdx.txLine.tag === 'code' && loIdx.txLine.href === null && loIdx.txLine.text === FX_SHORT_LOCAL,
    JSON.stringify(loIdx.txLine));
  check('本机链夹具 · 首页序栏里没有任何区块浏览器链接 (本机链不点), 且文档里没有 href="#" 死链',
    (await evalJs(`Array.from(document.querySelectorAll('${IDX_PULSE_ROOT} a')).every((a) => !/basescan\\.org|etherscan\\.io/.test(a.getAttribute('href') || ''))`)) === true &&
    (await evalJs(`Array.from(document.querySelectorAll('${IDX_PULSE_ROOT} a')).every((a) => { const h = a.getAttribute('href') || ''; return h !== '' && h !== '#' && !/^javascript:/i.test(h); })`)) === true &&
    (await evalJs(`document.querySelectorAll('a[href="#"], a[href=""]').length`)) === 0,
    JSON.stringify({ idxAnchors: await evalJs(`Array.from(document.querySelectorAll('${IDX_PULSE_ROOT} a')).map((a) => a.getAttribute('href'))`),
      dead: await evalJs(`document.querySelectorAll('a[href="#"], a[href=""]').length`) }));
  check('本机链夹具这一轮无 console 错误 / 未捕获异常', consoleErrors.length === liErrStart, consoleErrors.slice(0, 3).join(' | '));
  await fxDisable();
  fxOff();

  // ⑥′ 聚合计数缺失 + 空表 + agent_sites 为空: 「拿不到就不显示」「空表要说清」「空 ≠ 没数据」
  console.log('\n[6b] 任务计数缺失 + 空表 + 智能体私有站为空 (拿不到就不显示)');
  const cErrStart = consoleErrors.length;
  cMode = 'no-tasks';
  shouldIntercept = (p) => p.request.url.includes('network-pulse-verify');
  await fxEnable(PULSE_PATTERN);
  await cdp('Page.navigate', { url: `${BASE}/gateway.html?pulse=${encodeURIComponent(`${BASE}/network-pulse-verify-c.json`)}` });
  // 断言前自证 (送达证 C 档 auto-fulfill + 链路证 + 消费证 __vfy:no-tasks), 并等页面渲染完
  await fxSelfProof('no-tasks', { what: 'FX_NO_TASKS (缺 tasks* / 空表 / sites=[])' });
  const noT = await evalJs(pulseProbe('#pulse'));
  check('缺 tasks* 字段 → 小结行整行隐藏, 且不拿 0 或数字冒充; 「已验证」槽已下线 → 连钩子都没有 (null, 不是 —)',
    noT.state === 'live' && noT.tasksHidden.tasks === true && noT.tasksHidden.done === true &&
    noT.tasks === '—' && noT.tasksDone === '—' &&
    noT.tasksVerified === null && noT.tasksHidden.verified === null,
    JSON.stringify({ s: noT.state, h: noT.tasksHidden, v: [noT.tasks, noT.tasksDone, noT.tasksVerified] }));
  check('缺字段时节点/智能体照常显示 (2/3) — 只有拿不到的才不显示 (真 0 照常显示 0); 新增「已结算」本夹具没给 → 也整行隐藏',
    noT.nodes === '2' && noT.agents === '3' && noT.summary.filter((r) => r.hidden).length === 4 &&
    noT.tasksSettled === '—' && noT.tasksHidden.settled === true,
    JSON.stringify({ n: noT.nodes, a: noT.agents, settled: noT.tasksSettled, rows: noT.summary.map((r) => [r.key, r.hidden]) }));
  check('confirmed_activity=[] → 0 行 + 明说「本节点暂未观察到链上任务」(不是空白表格)',
    noT.act.rowCount === 0 && noT.act.emptyShown === true && noT.act.emptyText === '本节点暂未观察到链上任务。',
    JSON.stringify({ rows: noT.act.rowCount, shown: noT.act.emptyShown, text: noT.act.emptyText }));
  check('confirmed_activity_source=none → 表格下方如实短标「本节点未接入链上数据源」(不带「链上数据源：」长前缀, 也不说与事实相反的“尚未接入”)',
    noT.act.source === '本节点未接入链上数据源' && !/尚未接入/.test(noT.act.source), noT.act.source);
  check('agent_sites=[] → 0 条链接 + 极短诚实空态 (没发布 ≠ 没数据; 不显示假 0)',
    noT.sites.length === 0 && noT.sitesEmptyShown === true &&
    /^(空 = 未发布（不是没数据）|快照读不到，说不清发布了什么)$/.test(noT.sitesEmptyText) &&
    noT.sitesEmptyText.length <= 24 && !/\b0\b/.test(noT.sitesEmptyText) && !/尚未接入/.test(noT.sitesEmptyText),
    JSON.stringify({ n: noT.sites.length, shown: noT.sitesEmptyShown, text: noT.sitesEmptyText }));
  check('缺 signatures 字段 → 小结行里的签名项整行隐藏 (不拿 0 冒充, 也不显示假 0)',
    noT.tasksHidden.sig === true && noT.signatures === '—',
    JSON.stringify({ hidden: noT.tasksHidden.sig, v: noT.signatures }));
  check('缺字段这一轮无 console 错误 / 未捕获异常', consoleErrors.length === cErrStart, consoleErrors.slice(0, 3).join(' | '));

  // ⑥‴ 「0 个任务」与「25 行任务」同屏 —— 两套口径必须**各自带就近短标记** (2026-09-22 立 · 2026-09-23 精简后更严)
  console.log('\n[6d′] 0 个任务 与 25 行任务 同屏 → 两套口径各带就近短标记 (不许自相矛盾, 也不许删成一片空白)');
  const zErrStart = consoleErrors.length;
  cMode = 'pulse-zero';
  shouldIntercept = (p) => p.request.url.includes('network-pulse-verify');
  await fxEnable(PULSE_PATTERN);
  const zUrl = `${BASE}/gateway.html?pulse=${encodeURIComponent(`${BASE}/network-pulse-verify-c.json`)}`;
  await cdp('Page.navigate', { url: zUrl });
  // 断言前自证 + 等「消费证」出现 (夹具 notes 里的 __vfy:pulse-zero 出现 = 整轮渲染跑完):
  // 既治固定 sleep 量到中间态, 也让「夹具没生效」与「页面错」分得开。
  await fxSelfProof('pulse-zero', { what: 'FX_PULSE_ZERO (0 任务 + 25 行 + 口径三块)' });
  // 等「状态到 live 且第 1 页真画满一页 (ACT_PAGE_EXP 行)」再断言 —— 固定 sleep 会量到中间态 (实测 rows:0 的假失败)。
  // 2026-09-24 改 (leo 要的「分页栏在十五行底部」): 25 行现在**分页** —— DOM 里是一页的量, 25 是页信息/口径行里的总数。
  const pz = await waitStable(pulseProbe('#pulse'), (v) => v && v.state === 'live' && v.act.rowCount === ACT_PAGE_EXP);
  check(`25 行 → 第 1 页真画满 ${ACT_PAGE_EXP} 行 (剩下 ${25 - ACT_PAGE_EXP} 行在第 2 页), 页信息说总数 25 (与快照 activity_totals.rows 一致)`,
    pz.state === 'live' && pz.act.rowCount === ACT_PAGE_EXP && pz.act.pageInfo === `第 1/2 页 · 共 25 行`,
    JSON.stringify({ s: pz.state, rows: pz.act.rowCount, info: pz.act.pageInfo }));
  await evalJs(`(() => { const b = document.querySelector('#pulse [data-pulse-activity-next]'); if (b) b.click(); return !!b; })()`);
  await sleep(250);
  const pz2 = await evalJs(pulseProbe('#pulse'));
  check(`点「下一页」→ 第 2/2 页画剩下 ${25 - ACT_PAGE_EXP} 行, 且「下一页」禁用 / 「上一页」可用 (页边界不靠用户猜)`,
    pz2.act.rowCount === 25 - ACT_PAGE_EXP && pz2.act.pageInfo === '第 2/2 页 · 共 25 行' &&
    pz2.act.nextDisabled === true && pz2.act.prevDisabled === false,
    JSON.stringify({ rows: pz2.act.rowCount, info: pz2.act.pageInfo, next: pz2.act.nextDisabled, prev: pz2.act.prevDisabled }));
  await evalJs(`(() => { const b = document.querySelector('#pulse [data-pulse-activity-prev]'); if (b) b.click(); return !!b; })()`);
  await sleep(250);
  check('小结行如实显示 0 (24h 脉冲事件口径) —— 不为了"好看"改数字; 「已验证」槽已下线 (夹具给的 0 不再占一格)',
    pz.tasks === '0' && pz.tasksDone === '0' && pz.signatures === '0' && pz.tasksVerified === null,
    JSON.stringify({ t: pz.tasks, d: pz.tasksDone, v: pz.tasksVerified, sig: pz.signatures }));
  check('★ 口径行必在: 口径短标记 (链上索引 · 全量) + 行数/不同任务 (数字取自快照同源计数)',
    pz.act.totalsLineShown === true && pz.act.totalsLine.includes('25 行') && pz.act.totalsLine.includes('12 个不同任务') &&
    pz.act.totalsLine.includes('链上索引') && pz.act.totalsLine.includes('全量'),
    pz.act.totalsLine);
  check('★ 口径行不再写整句: 原来那句「… 是另一套口径 —— 不是数据丢了」已删 (长句消失 ≠ 口径标记消失)',
    !/不是数据丢了|另一套口径|脉冲事件/.test(pz.act.totalsLine) && !SENTENCE_PUNCT.test(pz.act.totalsLine) &&
    proseBudgetOk(pz).length === 0,
    JSON.stringify({ line: pz.act.totalsLine, bad: proseBudgetOk(pz) }));
  check('★ 口径行写明链归属 (本机隔离开发链 31337 · 不是公网活动) —— 不许读者误读成真网活动',
    pz.act.totalsLine.includes('31337') && pz.act.totalsLine.includes('本机隔离开发链') && pz.act.totalsLine.includes('不是公网活动'),
    pz.act.totalsLine);
  const pzMarks = scopeMarkers(pz);
  check('★ 反矛盾总断言 (2026-09-23 加强): 「0 个任务」与「N 行任务」并存时, 统计区「观察窗口」标记 + 表区「链上索引 · 全量」标记**两个都必须在场** (缺一个 = 并列而不解释)',
    pzMarks.statsOk && !(pz.act.rowCount > 0 && pz.tasks === '0' && !(pz.act.totalsLineShown === true && pzMarks.tableOk)),
    JSON.stringify({ rows: pz.act.rowCount, tasks: pz.tasks, stats: pzMarks.stats, table: pzMarks.table }));
  check('数据源行不重复第二遍 (口径行已带标记 → 表下那行为空)', pz.act.source === '', JSON.stringify({ src: pz.act.source }));
  check('口径行这一轮无 console 错误 / 未捕获异常', consoleErrors.length === zErrStart, consoleErrors.slice(0, 3).join(' | '));

  // 老快照 (有 25 行但缺 activity_totals/totals_scope/chain_id_scope) → 口径行整行隐藏, 不自己数行数、不编网络名
  cMode = 'pulse-zero-legacy';
  await cdp('Page.navigate', { url: zUrl });
  // 同一档换了夹具但 URL 相同 —— 必须等「这一份」的消费证 (__vfy:pulse-zero-legacy) 出现,
  // 否则会读到上一轮夹具的中间态 (这才是它以前会「时绿时红」的根因)
  await fxSelfProof('pulse-zero-legacy', { what: 'FX_PULSE_ZERO_LEGACY (缺口径三块)' });
  const pzL = await waitStable(pulseProbe('#pulse'), (v) => v && v.state === 'live' && v.act.rowCount === ACT_PAGE_EXP);
  check(`老快照 (缺口径三块) → 口径行整行隐藏 (不自己数行数/不编网络名), 行照旧**一页** ${ACT_PAGE_EXP} 行 (25 行分页: 第 2 页 ${25 - ACT_PAGE_EXP} 行)`,
    pzL.state === 'live' && pzL.act.rowCount === ACT_PAGE_EXP && pzL.act.totalsLineShown === false && pzL.act.totalsLine === '',
    JSON.stringify({ rows: pzL.act.rowCount, shown: pzL.act.totalsLineShown, line: pzL.act.totalsLine }));
  check('★ 老快照: 口径行没了 → 表区短标记退到表下数据源行 (「链上索引 · 全量」), 表里的行不会成为没口径的数字',
    pzL.act.source === '链上索引 · 全量' && scopeMarkers(pzL).tableOk,
    JSON.stringify({ src: pzL.act.source, caveat: pzL.caveat }));
  // ★ 同一概念不变量门 (2026-09-24) 在老快照上的表现: 顶部 0 任务 vs 表里 N 行**不算**矛盾 ——
  //   统计区「观察窗口 24h」+ 表区「链上索引 · 全量」两个就地标记都在场 = 解释过了 (与变异快照必红互为对照)。
  const pzLFindings = contradictionFindings(pzL, FX_PULSE_ZERO_LEGACY);
  check('★ 同一概念不变量门 · 老快照: 门判「有解释」→ 干净 (两处就地标记都在场), 不把话说清的数字当矛盾',
    pzLFindings.length === 0, JSON.stringify(pzLFindings));
  check('★ 老快照: 一个就地口径标记都不编 (快照没给 totals_scope.fields → 页面绝不替它编口径)',
    Object.keys(pzL.scopeTags).length > 0 && Object.keys(pzL.scopeTags).every((k) => pzL.scopeTags[k].text === ''),
    JSON.stringify(pzL.scopeTags));
  cMode = 'full';

  // ⑥″ IPNS 粘贴框: 真 input + 真按钮, 严格校验, 合法才开新窗口, 本页不发任何网络请求
  // (这节的断言只看控件行为, 不吃夹具数据 → 关掉夹具归因, 免得误标)
  fxOff();
  console.log('\n[6c] IPNS 粘贴框 (归一化 → 新窗口 / 非法就地报错)');
  const ipnsBox = await evalJs(pulseProbe('#pulse'));
  check('粘贴框 = 真 input + 真 type=submit 按钮 (回车可提交) + aria-label 齐全',
    !!ipnsBox.ipns && ipnsBox.ipns.inputTag === 'INPUT' && ipnsBox.ipns.inputType === 'text' &&
    ipnsBox.ipns.btnTag === 'BUTTON' && ipnsBox.ipns.btnType === 'submit' &&
    !!ipnsBox.ipns.inputAria && !!ipnsBox.ipns.btnAria,
    JSON.stringify(ipnsBox.ipns));
  check('粘贴框状态区 role=status + aria-live=polite', ipnsBox.ipns.msgRole === 'status' && ipnsBox.ipns.msgLive === 'polite',
    JSON.stringify(ipnsBox.ipns && { r: ipnsBox.ipns.msgRole, l: ipnsBox.ipns.msgLive }));
  const truth = await evalJs(`(() => {
    const P = window.__bolloonIpns;
    const good = ${JSON.stringify(IPNS_OK)};
    const bad = ${JSON.stringify(IPNS_BAD)};
    return { good: good.map((v) => [v, P.parse(v), P.url(v)]), bad: bad.map((v) => [v, P.parse(v), P.url(v)]) };
  })()`);
  check(`归一化: ${IPNS_OK.length} 种合法写法 (裸 k51… / ipns://… / /ipns/… / 网关 URL) 都得到同一 cid 与网关 URL`,
    truth.good.every((r) => !!r[1] && r[2] === 'https://ipfs.io/ipns/' + r[1]),
    JSON.stringify(truth.good.filter((r) => !(r[1] && r[2] === 'https://ipfs.io/ipns/' + r[1]))));
  check(`归一化: ${IPNS_BAD.length} 种非法输入全部拒绝 (含 javascript: / file: / data: / 空 / 带路径)`,
    truth.bad.every((r) => r[1] === null && r[2] === null),
    JSON.stringify(truth.bad.filter((r) => r[1] !== null)));
  // 输入内容绝不进 innerHTML: 塞一个 <img onerror> 进去, 只应看到被转义的文本
  const xss = await evalJs(`(() => {
    const f = document.querySelector('#pulse [data-pulse-ipns-form]');
    const i = f.querySelector('[data-pulse-ipns-input]');
    const m = f.querySelector('[data-pulse-ipns-msg]');
    i.value = '<img src=x onerror="window.__xss=1">';
    f.requestSubmit();
    return { msg: m.textContent, cls: m.className, html: m.innerHTML, imgs: f.querySelectorAll('img').length,
      rawMarkup: m.innerHTML.indexOf('<') !== -1, xss: !!window.__xss,
      kids: m.childNodes.length, nodeType: m.childNodes[0] && m.childNodes[0].nodeType,
      invalid: i.getAttribute('aria-invalid'), opened: window.__bolloonIpns.lastOpened() };
  })()`);
  check('非法输入 → 就地报错 (不是静默), 且输入内容绝不进 innerHTML (无标签节点 / 无 XSS)',
    /不是合法的 IPNS 地址/.test(xss.msg) && xss.msg.indexOf('<img') === -1 && xss.imgs === 0 &&
    xss.rawMarkup === false && xss.xss === false &&
    xss.kids === 1 && xss.nodeType === 3 && xss.invalid === 'true' && xss.opened === '',
    JSON.stringify(xss));

  // 真窗口: 合法 → 真的开一个新标签页; 非法 → 一个都不开 (新标签页在启动前挂起, 不会去访问 ipfs.io)
  await watchPopups(true);
  const ipnsInput = async (v) => evalJs(`(() => { const i = document.querySelector('#pulse [data-pulse-ipns-input]'); i.value = ${JSON.stringify(v)}; i.focus(); return i.value; })()`);
  const pressEnter = async () => {
    await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13, text: '\r' });
    await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
    await sleep(900);
  };
  const clickOpen = async () => {
    const b = await evalJs(`(() => { const el = document.querySelector('#pulse [data-pulse-ipns-open]'); el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; })()`);
    await cdp('Input.dispatchMouseEvent', { type: 'mousePressed', x: b.x, y: b.y, button: 'left', clickCount: 1 });
    await cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', x: b.x, y: b.y, button: 'left', clickCount: 1 });
    await sleep(900);
  };
  await closePopups();
  await ipnsInput('javascript:alert(1)');
  await pressEnter();
  check('非法输入 + 真回车 → 一个新窗口都不开', popups.length === 0, `popups=${popups.length}`);
  await closePopups();
  await ipnsInput(CID_1);
  await pressEnter();
  const kbOpen = await evalJs(`JSON.stringify({ cid: window.__bolloonIpns.lastCid(), opened: window.__bolloonIpns.lastOpened(), link: window.__bolloonIpns.lastLink() })`);
  check(`合法裸 k51 + 真回车 → 真的开一个新标签页 (${popups.length} 个 page 目标)`,
    popups.length === 1 && popups[0].type === 'page', `popups=${JSON.stringify(popups.map((p) => p.type))}`);
  check('开新窗口走的是新建 <a rel="noopener noreferrer" target="_blank"> (href = 网关 URL)',
    JSON.parse(kbOpen).opened === `https://ipfs.io/ipns/${CID_1}` &&
    JSON.parse(kbOpen).link.href === `https://ipfs.io/ipns/${CID_1}` &&
    JSON.parse(kbOpen).link.rel === 'noopener noreferrer' && JSON.parse(kbOpen).link.target === '_blank',
    kbOpen);
  await closePopups();
  await ipnsInput('/ipns/' + CID_3);
  await clickOpen();
  const clickOpen2 = await evalJs(`JSON.stringify({ cid: window.__bolloonIpns.lastCid(), opened: window.__bolloonIpns.lastOpened(), msg: document.querySelector('#pulse [data-pulse-ipns-msg]').textContent })`);
  check(`合法 /ipns/… + 真鼠标点「打开」→ 也真的开一个新标签页 (${popups.length} 个), cid 归一化对了`,
    popups.length === 1 && JSON.parse(clickOpen2).cid === CID_3 && JSON.parse(clickOpen2).opened === `https://ipfs.io/ipns/${CID_3}`,
    clickOpen2);
  await closePopups();
  await watchPopups(false);
  check('粘贴框这几轮无 console 错误 / 未捕获异常', consoleErrors.length === cErrStart, consoleErrors.slice(0, 3).join(' | '));
  cMode = 'full';

  // ⑥‴ 表格容错 (认不出的枚举原样显示 / 空标识不画行) + 数值变化在下一轮 30s 轮询内自动反映
  console.log('\n[6d] 表格枚举容错 (textContent) + 数值变化自动反映 (30s 轮询)');
  const kErrStart = consoleErrors.length;
  growMode = 'base';
  shouldIntercept = (p) => p.request.url.includes('network-pulse-verify');
  await fxEnable(PULSE_PATTERN);
  const growSrc = `${BASE}/network-pulse-verify-grow.json`;
  await cdp('Page.navigate', { url: `${BASE}/gateway.html?pulse=${encodeURIComponent(growSrc)}` });
  // ★ 这里原来是一句 `await sleep(1600)` —— 线上冷启动 (308 跳转 + CDN + app.js) 常 >2.5s,
  //   于是量到「页面还在 loading」的中间态: rows:0 / 空数组, 与「页面坏了」长得一模一样。
  //   现在改成先自证夹具生效 (等消费证 __vfy:newkinds:__ 出现 = 整轮渲染跑完) 再断言。
  await fxSelfProof('newkinds', { what: 'FX_NEWKINDS (未知枚举 3 条)' });
  const nk = await evalJs(pulseProbe('#pulse'));
  check('容错: 3 条夹具画成 2 行 (task 与 tx 都空的那条不画), 没有空白行',
    nk.act.rowCount === 2 && nk.act.blankRows === 0, JSON.stringify({ rows: nk.act.rowCount, blank: nk.act.blankRows }));
  check('容错: 未知 kind / 未知 state / 未知 finality 全部原样显示 (不猜、不吞、不报错)',
    nk.act.rows.some((r) => r.kindText === 'brand_new_kind_2099b' && r.stateText === 'settling' && r.finText === 'settled-weird'),
    JSON.stringify(nk.act.rows.map((r) => [r.kindText, r.stateText, r.finText])));
  check('容错: 认不出的 finality 徽标 = 虚线 is-other (不假装是三档之一)',
    nk.act.rows.some((r) => r.fin === 'settled-weird' && /is-other/.test(r.finClass || '')),
    JSON.stringify(nk.act.rows.map((r) => [r.fin, r.finClass])));
  check('容错: 任务标识里的 <b> 只当文字 (单元格只 1 个文本节点 + 标签被转义, 没走 innerHTML)',
    nk.act.rows.some((r) => r.task === MARKUP_TASK && r.taskKids === 1 && /&lt;b&gt;/.test(r.taskHtml || '')),
    JSON.stringify(nk.act.rows.map((r) => [r.task, r.taskKids, r.taskHtml])));
  check('容错: 表区口径短标记随快照变 (pulse-events → 「脉冲事件」, 不认领链上索引)',
    nk.act.source === '脉冲事件' && !SCOPE_WHOLE_MARK.test(nk.act.source), nk.act.source);
  check('容错这一轮无 console 错误 / 未捕获异常 (未知枚举不报错)', consoleErrors.length === kErrStart, consoleErrors.slice(0, 3).join(' | '));

  await evalJs(`document.querySelector('.lang-toggle [data-lang="en"]').click()`);
  await sleep(350);
  const nkEn = await evalJs(pulseProbe('#pulse'));
  check('容错: 切 EN 后已知 kind 出英文词, 未知 kind/state/finality 仍原样 (语言在渲染时才取)',
    nkEn.act.rows.some((r) => r.kindText === 'task created') &&
    nkEn.act.rows.some((r) => r.kindText === 'brand_new_kind_2099b' && r.stateText === 'settling' && r.finText === 'settled-weird'),
    JSON.stringify(nkEn.act.rows.map((r) => [r.kindText, r.stateText, r.finText])));
  await evalJs(`document.querySelector('.lang-toggle [data-lang="zh"]').click()`);
  await sleep(300);
  const nkZh = await evalJs(pulseProbe('#pulse'));
  check('容错: 切回中文复原 (原始枚举只存一份, 不是被覆盖过的文本)',
    nkZh.act.rows.some((r) => r.kindText === '任务创建') && nkZh.act.rows.some((r) => r.finText === 'settled-weird'),
    JSON.stringify(nkZh.act.rows.map((r) => [r.kindText, r.finText])));

  // —— 数值变化: 只改「下游夹具」+ 只读 DOM, 不调 refresh() / 不导航 / 不刷新页面 ——
  const growBefore = await evalJs(`(() => ({
    mark: (window.__growMark = 'no-reload'),
    nodes: (document.querySelector('#pulse [data-pulse-total="nodes"]') || {}).textContent,
    agents: (document.querySelector('#pulse [data-pulse-total="agents"]') || {}).textContent,
    sig: (document.querySelector('#pulse [data-pulse-total="signatures"]') || {}).textContent,
    rows: document.querySelectorAll('#pulse [data-pulse-activity-body] tr').length,
    source: (document.querySelector('[data-pulse-activity-source]') || {}).textContent,
    state: document.getElementById('pulse').getAttribute('data-pulse-state'),
  }))()`);
  growMode = 'grown';                      // 下一轮轮询将拿到「一个新 agent 加入 + 多一条交易」的快照
  const growT0 = Date.now();
  let growAfter = null;
  for (let i = 0; i < 100; i++) {          // 最多 ~50s (自动轮询间隔 30s + 余量)
    await sleep(500);
    growAfter = await evalJs(`(() => ({
      nodes: (document.querySelector('#pulse [data-pulse-total="nodes"]') || {}).textContent,
      agents: (document.querySelector('#pulse [data-pulse-total="agents"]') || {}).textContent,
      sig: (document.querySelector('#pulse [data-pulse-total="signatures"]') || {}).textContent,
      rows: document.querySelectorAll('#pulse [data-pulse-activity-body] tr').length,
      source: (document.querySelector('[data-pulse-activity-source]') || {}).textContent,
      firstKind: (document.querySelector('#pulse .pulse-kind-word') || {}).textContent,
      tasks: (document.querySelector('#pulse [data-pulse-total="tasks"]') || {}).textContent,
      mark: window.__growMark,
      state: document.getElementById('pulse').getAttribute('data-pulse-state'),
      blank: Array.from(document.querySelectorAll('#pulse [data-pulse-activity-body] tr')).filter((tr) => !tr.textContent.trim()).length,
    }))()`);
    if (growAfter && growAfter.nodes === '8' && growAfter.sig === '42' && growAfter.rows === 3) break;
  }
  // 断言前自证「第二轮夹具 (grown) 真的生效」: 只认 __vfy:grown:__ 这个消费证;
  // 拿不到就报「夹具未生效(拦截未命中)」(比如轮询那一次请求没被拦住), 而不是把「数字没变」算成页面错。
  await fxSelfProof('grown', { what: 'FX_GROWN (30s 轮询那一轮)', timeoutMs: 2000 });
  const growWaited = ((Date.now() - growT0) / 1000).toFixed(1);
  check(`数值与表格行在下一轮 30s 轮询内自动出现 (实测等了 ${growWaited}s; 未刷新页面 / 未手动 refresh / 未导航)`,
    !!growAfter && growBefore.nodes === '7' && growBefore.rows === 2 && growAfter.nodes === '8' &&
    growAfter.rows === 3 && growAfter.state === 'live' && Number(growWaited) < 40,
    JSON.stringify({ before: [growBefore.nodes, growBefore.rows], after: [growAfter && growAfter.nodes, growAfter && growAfter.rows], waited: growWaited }));
  check('新 agent 加入 → 智能体/任务/签名计数自己变 (12→13, 21→22, 3→42)',
    !!growAfter && growAfter.agents === '13' && growAfter.tasks === '22' && growAfter.sig === '42',
    JSON.stringify(growAfter));
  check('新增的链上活动那行也跟着出现 (事件 = 交易验真), 且没有空白行',
    !!growAfter && growAfter.firstKind === '交易验真' && growAfter.blank === 0,
    JSON.stringify({ first: growAfter && growAfter.firstKind, blank: growAfter && growAfter.blank }));
  check('数据源标注也跟着快照自己变 (pulse-events → chain index)',
    !!growAfter && /链上索引/.test(growAfter.source || ''), String(growAfter && growAfter.source));
  check('页面从未重新加载 (标记变量存活 ⇒ 数字是自己变的, 不是刷新带出来的)',
    !!growAfter && growAfter.mark === 'no-reload', JSON.stringify({ mark: growAfter && growAfter.mark }));
  check('自动轮询那一轮也无 console 错误 / 未捕获异常', consoleErrors.length === kErrStart, consoleErrors.slice(0, 3).join(' | '));

  // ⑦ 首页序栏紧凑版脉冲 (同一数据源, 同一诚实四态)
  console.log('\n[7] index.html 序栏紧凑版脉冲 (同一接口 + 同一四态)');
  const idxErrStart = consoleErrors.length;
  const IDX_ROOT = '#intro .pulse-compact';
  shouldIntercept = (p) => p.request.url.includes('network-pulse-verify');
  await fxEnable(PULSE_PATTERN);
  const pIdx = nextPaused(9000);
  await cdp('Page.navigate', { url: `${BASE}/index.html?pulse=${encodeURIComponent(pulseSrc)}` });
  let idxReq = null;
  try { idxReq = await pIdx; } catch { /* 下面按 DOM 判断 */ }
  await sleep(400);

  const idxLoading = await evalJs(pulseProbe(IDX_ROOT));
  check('index.html 序栏 (hero) 内存在紧凑脉冲区 [data-pulse]', !!idxLoading, '未找到 #intro .pulse-compact');
  const idxA11y = await evalJs(`(() => { const r = document.querySelector('${IDX_ROOT}'); const st = r && r.querySelector('[role="status"]'); return r ? { states: Array.from(r.querySelectorAll('.pulse-state-text')).map(e => e.getAttribute('data-state')), role: st ? st.getAttribute('role') : null, live: st ? st.getAttribute('aria-live') : null } : null; })()`);
  check('首页紧凑脉冲: 四态文案齐 + role=status + aria-live=polite',
    !!idxA11y && ['loading', 'live', 'stale', 'unavailable'].every((s) => idxA11y.states.includes(s)) && idxA11y.role === 'status' && idxA11y.live === 'polite',
    JSON.stringify(idxA11y));
  check('首页紧凑脉冲: 同一句极短作用域标记「观察窗口 24h」(长句「不是全网精确总量。」已删)',
    !!idxLoading && idxLoading.caveat === '观察窗口 24h' && SCOPE_WINDOW_MARK.test(idxLoading.caveat) &&
    !SENTENCE_PUNCT.test(idxLoading.caveat), idxLoading && idxLoading.caveat);
  // 首次 loading / 「拦到请求」这两条吃「请求被拦住挂着」的前置 → 先自证, 拿不到就明确报夹具未生效
  fxPre('live', !!idxReq, '首页取数请求 9s 内没被 CDP Fetch 拦住 (页面可能已拿到真快照)');
  check('首页紧凑脉冲: 首次 loading + 数值占位「—」',
    !!idxLoading && idxLoading.state === 'loading' && idxLoading.nodes === '—', JSON.stringify(idxLoading && { s: idxLoading.state, n: idxLoading.nodes }));
  const idxInst = await evalJs(`(() => ({ n: window.__bolloonPulses.length, src: window.__bolloonPulses[0].source(), name: window.__bolloonPulses[0].key, feedMax: window.__bolloonPulses[0].config.feedMax }))()`);
  check('首页那份也是独立实例: ?pulse= 生效 + 活动上限 data-pulse-feed-max=1',
    idxInst.n === 1 && idxInst.src === 'endpoint' && idxInst.name === 'hero' && idxInst.feedMax === 1, JSON.stringify(idxInst));
  check('首页紧凑脉冲真的发起取数 (CDP 拦到请求)', !!idxReq, idxReq ? '' : '未拦到请求');

  if (idxReq) await fxServe(idxReq, FX_LIVE, 'live');
  // 首页紧凑版**没有** notes 元素 → 消费证改用「只有夹具才有的活动流原文」(MARKUP_TEXT 由脚本给定,
  // 真快照撞不出来)。无论如何, 断言前必须先看到消费证 / 或拿到送达证。
  await fxSelfProof('live', { rootSel: IDX_ROOT, domSignal: fxFeedHas(MARKUP_TEXT.zh), what: '首页 FX_LIVE' });
  const idxLive = await evalJs(pulseProbe(IDX_ROOT));
  check('首页 live: 状态=实时 + 四个数值 = 7/12/4/5',
    idxLive.state === 'live' && idxLive.visible.includes('实时') && idxLive.nodes === '7' && idxLive.agents === '12' && idxLive.active === '4' && idxLive.h24 === '5',
    JSON.stringify({ s: idxLive.state, n: idxLive.nodes, a: idxLive.agents, ac: idxLive.active, d: idxLive.h24 }));
  check('首页 live: 只加两行 —— 任务 21 / 已完成 13 (第三行「已验真任务」刻意不放首页)',
    idxLive.tasks === '21' && idxLive.tasksDone === '13' && idxLive.tasksVerified === null &&
    idxLive.tasksHidden.tasks === false && idxLive.tasksHidden.done === false,
    JSON.stringify({ t: idxLive.tasks, d: idxLive.tasksDone, v: idxLive.tasksVerified, h: idxLive.tasksHidden }));
  const idxTotLabels = await evalJs(`Array.from(document.querySelectorAll('${IDX_ROOT} .pulse-c-totals span')).map(e=>e.textContent.trim())`);
  check('首页 live: 六行标签 = 节点 / agents / 活跃 agent / 24 小时内出现 / 任务 / 已完成',
    JSON.stringify(idxTotLabels) === JSON.stringify(['节点', 'agents', '活跃 agent', '24 小时内出现', '任务', '已完成']), JSON.stringify(idxTotLabels));
  check('首页 live: scope=observed + 活动流按 feed-max 截断 (只 1 条, 不是 5 条)',
    idxLive.scope === '当前节点观察到' && !idxLive.scopeHidden && idxLive.feed.length === 1 && idxLive.feedText[0] === MARKUP_TEXT.zh,
    JSON.stringify({ s: idxLive.scope, f: idxLive.feed, ft: idxLive.feedText }));
  check('首页 live: 极短作用域标记仍在 + 未接入提示隐藏',
    idxLive.caveat === '观察窗口 24h' && idxLive.hintShown === false,
    JSON.stringify({ c: idxLive.caveat, h: idxLive.hintShown }));
  // 首页紧凑区没有 <table>, 所以 pulseProbe 的 act 为 null —— 口径行直接点钩子读 (钩子在, 只是没有表)
  const idxTotalsLine = await evalJs(`(() => { const n = document.querySelector('${IDX_ROOT} [data-pulse-activity-totals]');
    return n ? { text: n.textContent.trim(), shown: getComputedStyle(n).display !== 'none' } : null; })()`);
  check('★ 首页 live: 统计区短标记「观察窗口 24h」必在; 口径行一旦真显示行数, 表区「链上索引 · 全量」标记也必须在场 (两套口径不许只标一边)',
    SCOPE_WINDOW_MARK.test(idxLive.caveat) && !SENTENCE_PUNCT.test(idxLive.caveat) &&
    !(idxTotalsLine && idxTotalsLine.shown && idxTotalsLine.text && !SCOPE_WHOLE_MARK.test(idxTotalsLine.text)),
    JSON.stringify({ caveat: idxLive.caveat, totals: idxTotalsLine }));
  check('首页 live: 有指向网关页完整脉冲的链接',
    (await evalJs(`!!document.querySelector('${IDX_ROOT} .pulse-c-more a[href$="gateway.html#pulse"]')`)) === true);
  const idxDensity = await evalJs(`(() => ({ font: parseFloat(getComputedStyle(document.querySelector('${IDX_ROOT} .pulse-c-totals b')).fontSize), h: Math.round(document.querySelector('${IDX_ROOT}').getBoundingClientRect().height), rows: document.querySelectorAll('${IDX_ROOT} .pulse-c-totals li').length, feedStyle: getComputedStyle(document.querySelector('${IDX_ROOT} [data-pulse-feed] li')).display }))()`);
  check(`首页那份确实更轻更密 (数值字号 ${idxDensity.font}px < 网关 ${gwValueFont}px, 加了两行后整块高 ${idxDensity.h}px < 320px, 共 ${idxDensity.rows} 行数值)`,
    idxDensity.font < gwValueFont && idxDensity.h < 320 && idxDensity.rows === 6, JSON.stringify({ idxDensity, gwValueFont }));
  // 首页刻意不列签名行: 实测 1440px 下 6 项正好 1 行 (容器 620px), 第 7 项必然换行 →
  // 「一眼扫过」的紧凑契约会被破坏。这条断言同时守住「布局没变宽之前别往首页加第 7 行」。
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 2, mobile: false });
  await sleep(300);
  const idxTot = await evalJs(`(() => { const r = document.querySelector('${IDX_ROOT}'); const list = r.querySelector('.pulse-c-totals');
    const tops = Array.from(list.children).map((li) => Math.round(li.getBoundingClientRect().top));
    return { sigRows: r.querySelectorAll('[data-pulse-total="signatures"]').length, rows: list.children.length, lines: new Set(tops).size, listW: Math.round(list.getBoundingClientRect().width), listH: Math.round(list.getBoundingClientRect().height) }; })()`);
  check(`首页紧凑版刻意不列签名行, 且 6 项仍是 1 行 (1440px 实测 ${idxTot.lines} 行 / ${idxTot.listH}px 高; 第 7 项会换行) — 明细由网关页全量区承接`,
    idxTot.sigRows === 0 && idxTot.rows === 6 && idxTot.lines === 1, JSON.stringify(idxTot));
  await cdp('Emulation.clearDeviceMetricsOverride');
  await sleep(200);

  // 首页那份也吃中英切换
  await evalJs(`document.querySelector('.lang-toggle [data-lang="en"]').click()`);
  await sleep(300);
  const idxEn = await evalJs(pulseProbe(IDX_ROOT));
  const idxLabels = await evalJs(`Array.from(document.querySelectorAll('${IDX_ROOT} .pulse-c-totals span')).map(e => e.textContent.trim())`);
  check('首页 EN: 状态 Live + scope + 活动文案英文',
    idxEn.visible.includes('Live') && idxEn.scope === 'Observed by this node' && idxEn.feedText[0] === MARKUP_TEXT.en,
    JSON.stringify({ v: idxEn.visible, s: idxEn.scope, f: idxEn.feedText }));
  check('首页 EN: 极短作用域标记变英文「24h observation window」+ 不出现「exact global total」类措辞',
    SCOPE_WINDOW_MARK.test(idxEn.caveat) && !/global total/i.test(idxEn.caveat) && !SENTENCE_PUNCT.test(idxEn.caveat),
    idxEn.caveat);
  check('首页 EN: 六个数值标签英文 (nodes/agents/active agents/seen in 24h/tasks/completed)',
    JSON.stringify(idxLabels) === JSON.stringify(['nodes', 'agents', 'active agents', 'seen in 24h', 'tasks', 'completed']), JSON.stringify(idxLabels));
  await evalJs(`document.querySelector('.lang-toggle [data-lang="zh"]').click()`);
  await sleep(250);

  // 活动流的语言回落 (缺当前语言退回另一种, 仍是服务端原文) + 相对时间刷新只改文字节点
  const pIdxEnOnly = nextPaused(7000);
  await evalJs(`(() => { window.__bolloonPulses[0].refresh(); return 1; })()`);
  let idxEnOnlyReq = null;
  try { idxEnOnlyReq = await pIdxEnOnly; } catch { /* 交给自证判「夹具未生效」 */ }
  fxPre('en-only', !!idxEnOnlyReq, '首页 refresh() 的取数请求 7s 内没被拦住');
  if (idxEnOnlyReq) await fxServe(idxEnOnlyReq, FX_EN_ONLY, 'en-only');
  // 消费证: 活动流里出现只有这份夹具才有的英文原文 (EN_ONLY_TEXT 由脚本给定)
  await fxSelfProof('en-only', { rootSel: IDX_ROOT, domSignal: fxFeedHas(EN_ONLY_TEXT), what: '首页 FX_EN_ONLY (只有 en 文案)' });
  const idxEnOnly = await evalJs(pulseProbe(IDX_ROOT));
  check('首页活动流: 只有 en 文案的条目在中文界面下退回 en (服务端原文, 不留空白行)',
    idxEnOnly.feedText.length === 1 && idxEnOnly.feedText[0] === EN_ONLY_TEXT && idxEnOnly.feedBlank === 0,
    JSON.stringify({ f: idxEnOnly.feedText, blank: idxEnOnly.feedBlank }));
  const idxTick = await evalJs(`(() => {
    const t = document.querySelector('${IDX_ROOT} [data-pulse-feed] time');
    window.__idxTick0 = t;
    const li = document.querySelector('${IDX_ROOT} [data-pulse-feed] li');
    window.__idxLi0 = li;
    t.setAttribute('data-at', String(Date.now() - 7200000));
    window.__bolloonPulses[0].tick();
    return { same: document.querySelector('${IDX_ROOT} [data-pulse-feed] time') === window.__idxTick0,
      liSame: document.querySelector('${IDX_ROOT} [data-pulse-feed] li') === window.__idxLi0,
      text: t.textContent, count: document.querySelectorAll('${IDX_ROOT} [data-pulse-feed] li').length };
  })()`);
  check('首页活动流: 相对时间刷新只改文字节点 (同类节点复用, 不重建列表)',
    idxTick.same && idxTick.liSame && /2 小时前/.test(idxTick.text) && idxTick.count === 1,
    JSON.stringify(idxTick));

  // 首页那份: 过期快照 → stale
  const pIdx2 = nextPaused(7000);
  await evalJs(`(() => { window.__bolloonPulses[0].refresh(); return 1; })()`);
  let idxReq2 = null;
  try { idxReq2 = await pIdx2; } catch { /* 交给自证判「夹具未生效」 */ }
  fxPre('expired', !!idxReq2, '首页 refresh() 的取数请求 7s 内没被拦住');
  if (idxReq2) await fxServe(idxReq2, FX_EXPIRED, 'expired');
  // 紧凑版没有 notes → 消费证 = 「只有夹具才有的形态」: 9 个节点 / 15 个 agent / 24h 2 / 活跃 0 + verified scope。
  // 这四个值同时从真快照里凑出来的概率可忽略; 就算真凑上, 后面断言也会照旧如实报错 (不放过)。
  await fxSelfProof('expired', { rootSel: IDX_ROOT, domSignal: fxVals({ nodes: '9', agents: '15', h24: '2', active: '0', scope: '网络观察快照' }), what: '首页 FX_EXPIRED' });
  const idxStale = await evalJs(pulseProbe(IDX_ROOT));
  check('首页 stale: fresh_until 已过 → 快照已过期 + scope=网络观察快照',
    idxStale.state === 'stale' && idxStale.visible.includes('快照已过期') && idxStale.scope === '网络观察快照',
    JSON.stringify({ s: idxStale.state, v: idxStale.visible, sc: idxStale.scope }));
  check('首页 stale: 仍显示快照数字 (9), 不伪装实时', idxStale.nodes === '9' && idxStale.feed.length === 0, JSON.stringify({ n: idxStale.nodes }));

  // 首页那份: 接口失败 → unavailable, 且不阻断首页其它区域
  const pIdx3 = nextPaused(7000);
  await evalJs(`(() => { window.__bolloonPulses[0].refresh(); return 1; })()`);
  let idxReq3 = null;
  try { idxReq3 = await pIdx3; } catch { /* 交给自证判「夹具未生效」 */ }
  fxPre('idx-fail', !!idxReq3, '首页 refresh() 的取数请求 7s 内没被拦住 (无法注入失败)');
  if (idxReq3) await fxFailServe(idxReq3, 'idx-fail');
  await fxSelfProof('idx-fail', { mode: 'fail', rootSel: IDX_ROOT, domSignal: (v) => !!v && v.state === 'unavailable', what: '首页取数失败夹具' });
  const idxUn = await evalJs(pulseProbe(IDX_ROOT));
  check('首页 unavailable: 请求失败 → 快照暂时读不到 + 数值清空 + ?pulse= 提示',
    idxUn.state === 'unavailable' && idxUn.visible.includes('快照暂时读不到') && idxUn.nodes === '—' &&
    idxUn.hintShown && idxUn.hint.includes('?pulse=') && idxUn.hint.includes('127.0.0.1:54188'),
    JSON.stringify({ s: idxUn.state, n: idxUn.nodes, h: idxUn.hintShown }));
  let idxBadge = '';
  for (let i = 0; i < 10; i++) {
    idxBadge = String(await evalJs(`(document.getElementById('version')||{}).textContent || ''`));
    if (/^\d+\.\d+\.\d+/.test(idxBadge)) break;
    await sleep(400);
  }
  const idxOthers = await evalJs(`(() => ({
    ctas: Array.from(document.querySelectorAll('#intro .intro-cta a')).map((a) => a.getAttribute('href')),
    year: (document.getElementById('year')||{}).textContent || '',
    capNo: Array.from(document.querySelectorAll('#capabilities .cap-no')).map(e => e.textContent).join(','),
  }))()`);
  // 序厅 CTA 行现在有 3 个按钮 (开始安装 / 加入网络 → gateway.html / 阅读文档) ——
  // 断言写成**逐项 href**, 而不是「个数 == 2」这种魔数: 这块要证明的是
  // 「首页那份取数失败后, 序厅 CTA 行依旧完整渲染」, 不是「按钮永远只有两个」。
  check('首页那份失败不阻断首页其它区域 (序厅 CTA 行 3 个按钮逐项仍在 / 能力区 / 徽章 / 页脚正常)',
    JSON.stringify(idxOthers.ctas) === JSON.stringify(['install.html', 'gateway.html', 'docs.html']) &&
    idxOthers.capNo === '01,02,03' && (!liveVersion || idxBadge === liveVersion) && /^\d{4}$/.test(idxOthers.year),
    JSON.stringify({ ...idxOthers, badge: idxBadge }));
  check('首页那份无 console 错误 / 未捕获异常', consoleErrors.length === idxErrStart, consoleErrors.slice(0, 3).join(' | '));

  // ⑧ 多实例隔离: 同一页两个实例, 一个失败另一个仍活
  console.log('\n[8] 多实例隔离 (同一页两个 [data-pulse], 互不干扰)');
  const isoErrStart = consoleErrors.length;
  await fxDisable();
  bMode = 'fail';
  aFail = false;
  shouldIntercept = (p) => p.request.url.includes('network-pulse-verify');
  await fxEnable(PULSE_PATTERN);
  const pIso = nextPaused(9000);
  await cdp('Page.navigate', { url: `${BASE}/gateway.html?pulse=${encodeURIComponent(pulseSrc)}` });
  let isoReq = null;
  try { isoReq = await pIso; } catch { /* 下面按 DOM 判断 */ }
  fxPre('live', !!isoReq, '多实例: 第一实例的取数请求 9s 内没被拦住');
  if (isoReq) await fxServe(isoReq, FX_LIVE, 'live');
  await fxSelfProof('live', { what: '多实例: 第一实例 FX_LIVE' });
  let isoBadge = '';
  for (let i = 0; i < 10; i++) {
    isoBadge = String(await evalJs(`(document.getElementById('version')||{}).textContent || ''`));
    if (/^\d+\.\d+\.\d+/.test(isoBadge)) break;
    await sleep(400);
  }
  const beforeInject = await evalJs(pulseProbe('#pulse'));
  check('隔离前: 第一实例 live (数值 7) 且页面上只有 1 个实例',
    beforeInject.state === 'live' && beforeInject.nodes === '7' && (await evalJs('window.__bolloonPulses.length')) === 1,
    JSON.stringify({ s: beforeInject.state, n: beforeInject.nodes }));

  const inject = await evalJs(`(() => {
    const orig = document.getElementById('pulse');
    const node = orig.cloneNode(true);
    node.removeAttribute('id');
    node.removeAttribute('data-pulse-bound');
    node.setAttribute('data-pulse-name', 'clone');
    node.setAttribute('data-pulse-src', ${JSON.stringify(B_SRC)});
    node.setAttribute('data-pulse-feed-max', '1');
    Array.from(node.querySelectorAll('[id]')).forEach((e) => e.removeAttribute('id'));
    document.body.appendChild(node);
    const inst = window.__bolloonPulse.attach(node);
    return { n: window.__bolloonPulses.length, attached: !!inst, scriptAttach: typeof window.__bolloonPulseAttach, id: node.id };
  })()`);
  check('运行时可再挂一个实例 (attach 新根 → 共 2 个独立实例)',
    inject.n === 2 && inject.attached === true && inject.id === '', JSON.stringify(inject));

  const pairProbe = `(() => {
    const roots = Array.from(document.querySelectorAll('[data-pulse]'));
    const A = roots[0], B = roots[1];
    const pick = (root, key) => { const n = root.querySelector('[data-pulse-total="' + key + '"]'); return n ? n.textContent.trim() : null; };
    const vis = (root) => (Array.from(root.querySelectorAll('.pulse-state-text')).filter(e => getComputedStyle(e).display !== 'none')[0] || {}).textContent || '';
    const notes = (root) => { const n = root.querySelector('[data-pulse-notes]'); return n ? n.textContent : ''; };
    if (!A || !B) return { missing: true, count: roots.length };
    return {
      count: roots.length,
      a: { state: A.getAttribute('data-pulse-state'), vis: vis(A), nodes: pick(A, 'nodes'), scope: (A.querySelector('[data-pulse-scope]')||{}).textContent, notes: notes(A) },
      b: { state: B.getAttribute('data-pulse-state'), vis: vis(B), nodes: pick(B, 'nodes'), notes: notes(B) },
    };
  })()`;
  // 第二实例的消费证: 它自己是 #pulse 的克隆 → 也有 [data-pulse-notes], 标记同样能落到它身上
  const pairSignal = (tag) => (v) => !v.missing && String(v.b.notes || '').includes(fxNoteText(tag));

  // 断言前自证: A 那份 FX_LIVE 真的到了页面 (quiet), B 那份「我方把请求打失败」也真的注入成功
  const gA = await fxSelfProof('live', { quietOk: true, what: '多实例: A 仍持 FX_LIVE' });
  const gB = await fxSelfProof('b-fail', { mode: 'fail', probeExpr: pairProbe, quietOk: true,
    domSignal: (v) => !v.missing && v.b.state === 'unavailable', what: '多实例: B 取数被拒' });
  fxNow = { ...gB, delivered: gA.delivered && gB.delivered, reason: gB.delivered ? gA.reason : gB.reason };
  if (fxNow.delivered) console.log('  🔒 夹具自证 [多实例] ✔ A = FX_LIVE 已送达 · B = 取数被拒夹具已注入 (我方 failRequest)');

  const pair1 = await evalJs(pairProbe);
  check('第二实例取数被拒 → 自己 unavailable 且数值不编造',
    !pair1.missing && pair1.b.state === 'unavailable' && pair1.b.vis.includes('快照暂时读不到') && pair1.b.nodes === '—',
    JSON.stringify(pair1));
  check('第一实例不受影响 (仍 live, 数值 7 未变)',
    !pair1.missing && pair1.a.state === 'live' && pair1.a.vis.includes('实时') && pair1.a.nodes === '7',
    JSON.stringify(pair1.a));

  // 反向: 第二实例给以过期快照 → stale 且仍有数字; 第一实例取数被拒 → unavailable
  bMode = 'expired';
  await evalJs(`(() => { window.__bolloonPulses[1].refresh(); return 1; })()`);
  // 断言前自证: B 的过期夹具真的到了它身上 (送达证记在 'expired-b', 消费证 = B 的 notes 里出现该夹具标记)
  await fxSelfProof('expired', { servedKey: 'expired-b', probeExpr: pairProbe, quietOk: true,
    domSignal: pairSignal('expired'), what: 'B 换到过期快照' });
  const pair2 = await evalJs(pairProbe);
  check('第二实例换到过期快照 → stale 且数字仍在 (9)',
    !pair2.missing && pair2.b.state === 'stale' && pair2.b.nodes === '9' && pair2.b.vis.includes('快照已过期'),
    JSON.stringify(pair2.b));

  aFail = true;
  await evalJs(`(() => { window.__bolloonPulses[0].refresh(); return 1; })()`);
  // A 的取数被拒 (我方 failRequest) + B 仍持过期夹具: 两侧都先自证, 任一没生效就明确报夹具错
  const gA3 = await fxSelfProof('a-fail', { mode: 'fail', domSignal: (v) => !!v && v.state === 'unavailable',
    what: 'A 取数被拒 (aFail)' });
  const gB3 = await fxSelfProof('expired', { servedKey: 'expired-b', probeExpr: pairProbe, quietOk: true, timeoutMs: 2000,
    domSignal: pairSignal('expired'), what: 'B 仍持过期快照' });
  fxNow = { ...gA3, delivered: gA3.delivered && gB3.delivered, reason: gA3.delivered ? gB3.reason : gA3.reason };
  const pair3 = await evalJs(`(() => {
    const roots = Array.from(document.querySelectorAll('[data-pulse]'));
    const A = roots[0], B = roots[1];
    const pick = (root, key) => { const n = root.querySelector('[data-pulse-total="' + key + '"]'); return n ? n.textContent.trim() : null; };
    const vis = (root) => (Array.from(root.querySelectorAll('.pulse-state-text')).filter(e => getComputedStyle(e).display !== 'none')[0] || {}).textContent || '';
    return {
      a: { state: A.getAttribute('data-pulse-state'), vis: vis(A), nodes: pick(A, 'nodes'), rows: A.querySelectorAll('[data-pulse-activity-body] tr').length },
      b: { state: B.getAttribute('data-pulse-state'), vis: vis(B), nodes: pick(B, 'nodes'), scope: (B.querySelector('[data-pulse-scope]')||{}).textContent },
      page: { cmd: (document.getElementById('skill-cmd')||{}).textContent || '' },
      api: { first: window.__bolloonPulse === window.__bolloonPulses[0], n: window.__bolloonPulses.length },
    };
  })()`);
  check('第一实例也能独立失败 (A → unavailable, 数值清空, 表格 0 行, 不编造)',
    pair3.a.state === 'unavailable' && pair3.a.vis.includes('快照暂时读不到') && pair3.a.nodes === '—' && pair3.a.rows === 0,
    JSON.stringify(pair3.a));
  check('第二实例完全不受第一份失败影响 (仍 stale + 数字 9 + 自己的 scope)',
    pair3.b.state === 'stale' && pair3.b.nodes === '9' && pair3.b.scope === '网络观察快照',
    JSON.stringify(pair3.b));
  check('两份实例互不干扰: 页面其它区域 (命令/徽章) 仍正常 + __bolloonPulse = 第一实例',
    /^read /.test(pair3.page.cmd) && (!liveVersion || isoBadge === liveVersion) && pair3.api.first === true && pair3.api.n === 2,
    JSON.stringify({ cmd: pair3.page.cmd.slice(0, 30), badge: isoBadge, api: pair3.api }));
  aFail = false;
  check('多实例这一轮无 console 错误 / 未捕获异常', consoleErrors.length === isoErrStart, consoleErrors.slice(0, 3).join(' | '));

  // ⑨ 全站无重复 id
  console.log('\n[9] 全站无重复 id (7 页, JS 跑完后实算)');
  await fxDisable();
  fxOff();
  for (const pg of ALL_PAGES) {
    await cdp('Page.navigate', { url: `${BASE}/${pg}` });
    // 固定 sleep 的隐患在「缺失类」断言上更危险: 文档没加载完时 [id] 为空 ⇒ 不可能有重复 id ⇒ **假绿**。
    // 先等到文档就绪且有内容再判; 超时也照原断言判红 (只加等待, 不改判据)。
    await waitUntil(`document.readyState === 'complete' && document.querySelectorAll('[id]').length > 0`, { tries: 60, interval: 200 });
    const dups = await evalJs(`(() => { const m = {}; document.querySelectorAll('[id]').forEach((e) => { m[e.id] = (m[e.id] || 0) + 1; }); return Object.keys(m).filter((k) => m[k] > 1); })()`);
    check(`${pg} 无重复 id`, Array.isArray(dups) && dups.length === 0, JSON.stringify(dups));
  }
  // 脉冲区内部节点一律用 data-pulse-* 钩子 (不靠 id ⇒ 多实例不会撞 id)
  await cdp('Page.navigate', { url: `${BASE}/index.html` });
  // 固定 sleep 会量到「文档还没画完」的中间态 (线上 CDN 更慢 → roots:0 的假红, 2026-09-22 实测)。
  // 先等到「文档就绪 且 脉冲根节点已出现」再取证; 超时也照原断言判红 (不改判据, 只加等待)。
  await waitUntil(`document.readyState === 'complete' && document.querySelectorAll('[data-pulse]').length >= 1`, { tries: 60, interval: 200 });
  const hookCheck = await evalJs(`(() => ({ ids: Array.from(document.querySelectorAll('[data-pulse] [id]')).map(e => e.id), roots: document.querySelectorAll('[data-pulse]').length }))()`);
  check('首页脉冲区内部节点一律用 data-pulse-* 钩子 (无 id, 天然不撞)',
    !!hookCheck && hookCheck.roots >= 1 && hookCheck.ids.length === 0, JSON.stringify(hookCheck));

  // ⑪ 全站资源版本 ?v=31 一致 (逐页抓原始 HTML —— 只看一页会被漏改骗过)
  console.log('\n[10] 全站资源 ?v=31 一致 (7 页原始 HTML)');
  const vStale = [], vMissing = [];
  for (const pg of ALL_PAGES) {
    const html = await fetchText(`${BASE}/${pg}`);
    const vs = (html.match(/\?v=\d+/g) || []).filter((v) => v !== '?v=31');
    if (vs.length) vStale.push(`${pg}:${vs.join(',')}`);
    if (pg !== 'skill.html' && (!/style\.css\?v=31/.test(html) || !/app\.js\?v=31/.test(html))) vMissing.push(pg);
  }
  check('7 页都没有 ?v=31 之外的版本号 (逐页 grep 一致, 无旧版残留)', vStale.length === 0, JSON.stringify(vStale));
  check('6 个带外链资源的页 = style.css?v=31 + app.js?v=31 (skill.html 自包含, 无外链)',
    vMissing.length === 0, JSON.stringify(vMissing));

  // ⑫ 命名与可见文本审计 (2026-09-22 语义收窄):
  //     ① 停用名「网络脉冲 / Network pulse / 全球网络脉冲」全站零出现 (改名不可回退);
  //     ② 「加入网络」**不再是停用名** —— leo 明确要求首页 CTA 行加一个指向网关页
  //        (gateway.html) 的「加入网络」按钮。这条断言本来要防的是**旧网关序厅 / 旧导航项**
  //        (那个已被删除的 `加入网络` 大字 h1 与导航项), 不是防这个按钮。
  //        所以拆开: 「加入网络」只允许作为首页那一个 <a class="join-network-cta" href="gateway.html">
  //        出现 —— 原始 HTML 里先把这个标签整体挖掉再看剩下有没有; 渲染后可见文本里先摘掉它的
  //        中/英标签再扫。摘掉后仍命中 = 页面别处还藏着一个「加入网络」(旧序厅复发) → 失败。
  //     ③ 页面里也不该有 40 位地址 / 64 位哈希 (长标识一律短写)。
  console.log('\n[11] 旧名清除 + 页面可见文本不含长地址/长哈希');
  const DEAD_NAMES = ['网络脉冲', 'Network pulse', '全球网络脉冲'];
  const JOIN_NAMES = ['加入网络', 'Join the network'];
  const nameHits = [], hashHits = [], joinRawHits = [];
  for (const pg of ALL_PAGES) {
    const html = await fetchText(`${BASE}/${pg}`);
    const hits = DEAD_NAMES.filter((w) => html.includes(w));
    if (hits.length) nameHits.push(`${pg}:${hits.join('|')}`);
    const stripped = html.replace(/<a[^>]*join-network-cta[^>]*>[\s\S]*?<\/a>/g, '');
    const jHits = JOIN_NAMES.filter((w) => stripped.includes(w));
    if (jHits.length) joinRawHits.push(`${pg}:${jHits.join('|')}`);
    if (/\b0x[0-9a-fA-F]{40}\b/.test(html) || /\b[0-9a-fA-F]{64}\b/.test(html)) hashHits.push(pg);
  }
  check('7 页原始 HTML (含 meta description) 都没有旧名 网络脉冲 / Network pulse / 全球网络脉冲',
    nameHits.length === 0, JSON.stringify(nameHits));
  check('「加入网络」在 7 页原始 HTML 里只出现在首页那个 CTA 按钮标签内 (其余 6 页 / 其余位置零出现)',
    joinRawHits.length === 0, JSON.stringify(joinRawHits));
  check('7 页原始 HTML 都没有 40 位地址 / 64 位哈希', hashHits.length === 0, JSON.stringify(hashHits));
  for (const pg of ['gateway.html', 'index.html']) {
    await cdp('Page.navigate', { url: `${BASE}/${pg}` });
    // ★ 同 [11b]/[11c]: 真域名冷启动时固定 sleep 会量到「还没建好的文档」→ 整轮崩在 null。
    //   等文档就绪再量 (量到的才是成品页); 拿不到就判红写原因, 不崩也不装作通过。
    await waitUntil(`document.readyState !== 'loading' && !!document.body`);
    await sleep(900);
    const audit = await evalJs(`(() => {
      if (!document.body) return null;
      const deads = ${JSON.stringify(DEAD_NAMES)};
      const joins = ${JSON.stringify(JOIN_NAMES)};
      const raw = document.body.innerText;
      const nav = Array.from(document.querySelectorAll('.mast-links a')).map((a) => a.textContent.trim()).join(' | ');
      // 首页 CTA 上那个「加入网络」按钮的文案不算旧名 —— 先把它从文本里摘掉再扫。
      // 摘掉后仍命中「加入网络」= 页面别处还藏着一个 (旧序厅复发) → 失败。
      const cta = document.querySelector('a.join-network-cta');
      const text = cta ? raw.split(cta.textContent.trim()).join('') : raw;
      return {
        nav: nav,
        hits: deads.filter((w) => raw.indexOf(w) !== -1),
        joinHits: joins.filter((w) => text.indexOf(w) !== -1),
        navHits: deads.concat(joins).filter((w) => nav.indexOf(w) !== -1),
        h1: Array.from(document.querySelectorAll('h1')).map((e) => e.textContent.trim()),
        titles: Array.from(document.querySelectorAll('.section-title')).map((e) => e.textContent.trim()),
        gatewayNav: Array.from(document.querySelectorAll('.mast-links .nav-menu a')).map((a) => a.textContent.trim()),
        longAddr: /\\b0x[0-9a-fA-F]{40}\\b/.test(raw),
        longHash: /\\b[0-9a-fA-F]{64}\\b/.test(raw),
      };
    })()`);
    if (!audit) { check(`${pg} 渲染后旧名/长地址审计可量 (等文档就绪后 body 仍在)`, false, 'null body — 页面没量到'); continue; }
    check(`${pg} 渲染后: 可见文本 + 导航(含下拉) 都没有旧名 (导航项: ${String(audit.nav).slice(0, 90)})`,
      audit.hits.length === 0 && audit.navHits.length === 0, JSON.stringify({ hits: audit.hits, navHits: audit.navHits, nav: audit.nav }));
    check(`${pg} 渲染后: 「加入网络」只作为首页 CTA 按钮出现 (摘掉按钮文案后零命中)`,
      audit.joinHits.length === 0, JSON.stringify(audit.joinHits));
    check(`${pg} 渲染后: 可见文本没有 40 位地址 / 64 位哈希`,
      audit.longAddr === false && audit.longHash === false, JSON.stringify({ a: audit.longAddr, h: audit.longHash }));
    if (pg === 'gateway.html') {
      check('网关页导航里确实有「链上活动」项 (是改名, 不是删掉)',
        audit.gatewayNav.includes('链上活动'), JSON.stringify(audit.gatewayNav));
      check('网关页 h1 / 各区标题都不再是「加入网络」序厅 (页面以链上活动为主体)',
        audit.h1.every((t) => !/加入网络/.test(t)) && audit.titles.every((t) => !/加入网络/.test(t)),
        JSON.stringify({ h1: audit.h1, titles: audit.titles }));
    }
    if (pg === 'index.html') {
      check('首页导航里确实有「链上活动」项 (指向网关页 #pulse)',
        audit.gatewayNav.includes('链上活动'), JSON.stringify(audit.gatewayNav));
    }
  }

  // ⑲′ 过期假标签防复发 (2026-09-22): 页面与导航里**不得**再出现与事实相反的"尚未接入"类文案 ——
  //     公开观察入口早已接入 (线上真在供给 25 行链上活动), 说"尚未接入"就是假话。
  //     扫真站点 7 页: 原始 HTML (含注释/导航) + 渲染后可见文本 + 导航 + unavailable 态文案。
  console.log('\n[11b] 过期假标签防复发 (页面 + 导航都不许出现"尚未接入"类虚假文案)');
  const FALSE_LABELS = ['尚未接入', '还没接入', '尚未打通', 'Public observation endpoint not connected', 'observation endpoint not connected'];
  const falseRaw = [];
  for (const pg of ALL_PAGES) {
    const html = await fetchText(`${BASE}/${pg}`);
    const hits = FALSE_LABELS.filter((w) => html.includes(w));
    if (hits.length) falseRaw.push(`${pg}:${hits.join('|')}`);
  }
  check('7 页原始 HTML (含注释 / 导航 / 静态文案) 都没有"尚未接入"类虚假文案', falseRaw.length === 0, JSON.stringify(falseRaw));
  for (const pg of ['gateway.html', 'index.html']) {
    await cdp('Page.navigate', { url: `${BASE}/${pg}` });
    // ★ 同 [11c]: 真域名冷启动会 >900ms (308 跳转 + CDN + app.js), 固定 sleep 后读 body.innerText
    //   会撞上「还没建好的文档」→ 整轮崩在 Cannot read properties of null (真域名实测第二次)。
    //   改成等文档就绪 (量到的才是成品页); 真拿不到就**判红并写原因**, 既不崩也不装作通过。
    await waitUntil(`document.readyState !== 'loading' && !!document.body`);
    await sleep(900);
    const f = await evalJs(`(() => {
      if (!document.body) return null;
      const labels = ${JSON.stringify(FALSE_LABELS)};
      const text = document.body.innerText;
      const nav = Array.from(document.querySelectorAll('.mast-links a')).map((a) => a.textContent.trim()).join(' | ');
      const un = document.querySelector('.pulse-state-text[data-state="unavailable"]');
      const hint = document.querySelector('[data-pulse-hint]');
      return {
        hits: labels.filter((w) => text.indexOf(w) !== -1),
        navHits: labels.filter((w) => nav.indexOf(w) !== -1),
        unavailableText: un ? un.textContent.trim() : null,
        hintText: hint ? hint.textContent : '',
      };
    })()`);
    if (!f) { check(`${pg} 渲染后可见文案可量 (等文档就绪后 body 仍在)`, false, 'null body — 页面没量到'); continue; }
    check(`${pg} 渲染后: 可见文本与导航都没有"尚未接入"类虚假文案`,
      f.hits.length === 0 && f.navHits.length === 0, JSON.stringify({ hits: f.hits, navHits: f.navHits }));
    check(`${pg} unavailable 态文案是真话 (快照暂时读不到), 不是"入口还没接"`,
      f.unavailableText === '快照暂时读不到', String(f.unavailableText));
    check(`${pg} unavailable 提示说的是真原因 (签名快照取数失败), 且仍给 ?pulse= 出路`,
      f.hintText.includes('快照这次没读到') && f.hintText.includes('network-pulse.json') && f.hintText.includes('?pulse='),
      f.hintText.slice(0, 120));
  }

  // ⑪c 文案精简防复发 (2026-09-23 leo: 「这些内容不用显示, 简洁最好」): 7 页**可见文案**里都不许
  //     再出现那几段长文案, 也不许反向改成「全网总量 / 精确总量」这类更大口径; 「智能体私有网站」
  //     的整句说明元素 (.pulse-sites-note) 也不许回来。剥掉注释后再扫 —— 设计意图本来就留在注释里。
  console.log('\n[11c] 文案精简防复发 (7 页可见文案无长句 / 无夸大措辞 / 无整句说明)');
  const longPages = [], claimPages = [], notePages = [], unreadyPages = [];
  for (const pg of ALL_PAGES) {
    await cdp('Page.navigate', { url: `${BASE}/${pg}` });
    // ★ 真域名冷启动常 >700ms (308 跳转 + CDN + app.js); 原来固定 sleep(700) 后在 body 还没建好时
    //   就 cloneNode → 整轮崩在「Cannot read properties of null (reading 'cloneNode')」(真域名实测一次)。
    //   改成「等文档就绪再量」= **加强**门 (不再量中间态), 不是放宽; 万一真量不到 (r=null) 也不许
    //   当成通过 (缺失类断言在空文档上恒真) —— 单列一页 unready 并断言为空。
    await waitUntil(`document.readyState !== 'loading' && !!document.body`);
    await sleep(700);
    const r = await evalJs(`(() => {
      if (!document.body) return null;
      const c = document.body.cloneNode(true);
      const w = document.createTreeWalker(c, NodeFilter.SHOW_COMMENT, null);
      const cs = []; while (w.nextNode()) cs.push(w.currentNode);
      cs.forEach((n) => n.parentNode && n.parentNode.removeChild(n));
      c.querySelectorAll('script, style, [data-pulse-notes], .pulse-notes').forEach((n) => n.remove());
      return { text: c.textContent.replace(/\\s+/g, ' '), sitesNote: !!document.querySelector('.pulse-sites-note') };
    })()`);
    if (!r) { unreadyPages.push(pg); continue; }
    const hits = killedHits(r.text);
    if (hits.length) longPages.push(`${pg}:${hits.join('|')}`);
    const claims = ['全网总量', '精确总量', 'exact global total', 'global total'].filter((w) => r.text.includes(w));
    if (claims.length) claimPages.push(`${pg}:${claims.join('|')}`);
    if (r.sitesNote) notePages.push(pg);
  }
  check('★ 7 页都真的量到了「渲染后可见文案」(等文档就绪后才 cloneNode, 没有一页量到空文档)',
    unreadyPages.length === 0, JSON.stringify(unreadyPages));
  check('★ 7 页渲染后可见文案都没有那几段被删的长句 (口径整句 / 隐私整句 / 「链上数据源：」前缀 / 私有站整句)',
    longPages.length === 0, JSON.stringify(longPages));
  check('★ 7 页渲染后可见文案都没有「全网总量 / 精确总量 / exact global total」类夸大措辞 (删长句 ≠ 把口径改大)',
    claimPages.length === 0, JSON.stringify(claimPages));
  check('★ 7 页都没有「智能体私有网站」的整句说明元素 (.pulse-sites-note) —— 只剩标题 + 极短空态标记',
    notePages.length === 0, JSON.stringify(notePages));

  // ⑬ 网关页两栏版式 + 首页「加入网络」CTA (2026-09-22 leo 要求):
  //    ① gateway.html: 「加入方式」(#skills) 必须在「链上活动」(#pulse) **右侧**,
  //       桌面下两者同一行 (链上活动 | 加入方式), 窄屏 (390px) 堆叠且不溢出;
  //    ② index.html: hero CTA 行新增「加入网络」按钮, 位置在「开始安装」**右侧**,
  //       指向 gateway.html, 双语, 真 <a> + 键盘 Tab 可达 + 焦点环可见。
  //    全部用真布局测量 (getBoundingClientRect + 真 Tab 键), 不看 CSS 声明猜。
  console.log('\n[12] 网关页两栏 (链上活动 左 · 加入方式 右) + 首页「加入网络」按钮');
  await cdp('Page.navigate', { url: `${BASE}/gateway.html` });
  // 等第一轮取数落地 (state 不再是 loading) 且布局两次读数一致再测量 —— 不用固定 sleep
  const duo = await waitStable(`(() => {
    const p = document.getElementById('pulse'), s = document.getElementById('skills');
    if (!p || !s) return null;
    const row = p.parentElement;
    const kick = (el) => { const k = el.querySelector('.section-head .kicker'); return k ? k.textContent.trim() : null; };
    return {
      sameParent: row === s.parentElement,
      rowClass: row.className,
      rowIsDiv: row.tagName === 'DIV',
      pulseBeforeSkills: !!(p.compareDocumentPosition(s) & 4),
      ids: Array.from(document.querySelectorAll('section[id]')).map((x) => x.id),
      pulseKicker: kick(p), skillsKicker: kick(s),
      pulseTitle: p.querySelector('.section-title').textContent.trim(),
      skillsTitle: s.querySelector('.section-title').textContent.trim(),
      pulseState: p.getAttribute('data-pulse-state'),
    };
  })()`, (v) => v && v.sameParent === true && v.pulseBeforeSkills === true && v.pulseState !== 'loading');
  check('gateway.html: #pulse 与 #skills 是同一个容器 (.gateway-row) 的两个子项 (两栏版式的地基)',
    !!duo && duo.sameParent && duo.rowIsDiv && /gateway-row/.test(duo.rowClass), JSON.stringify(duo && { same: duo.sameParent, cls: duo.rowClass }));
  check('gateway.html: 文档顺序仍是 pulse → skills (锚点 / 导航下拉 / 分节顺序都不变)',
    !!duo && duo.pulseBeforeSkills === true &&
    JSON.stringify(duo.ids) === JSON.stringify(['pulse', 'skills', 'join', 'manifest', 'endpoints', 'developer']),
    JSON.stringify(duo && duo.ids));
  check('gateway.html: 编号语义自洽 (左 01 链上活动 · 右 02 加入方式, 左→右即阅读顺序)',
    !!duo && /01/.test(duo.pulseKicker || '') && /02/.test(duo.skillsKicker || '') &&
    duo.pulseTitle === '链上活动' && duo.skillsTitle === '加入方式',
    JSON.stringify(duo && [duo.pulseKicker, duo.pulseTitle, duo.skillsKicker, duo.skillsTitle]));

  // 桌面 1440: 两区同一行, 加入方式在右 (真测量, 等稳定)
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  const desk = await waitStable(`(() => {
    const box = (el) => { const b = el.getBoundingClientRect(); return { l: Math.round(b.left), r: Math.round(b.right), t: Math.round(b.top), b: Math.round(b.bottom), w: Math.round(b.width) }; };
    const p = document.getElementById('pulse'), s = document.getElementById('skills');
    const row = p.parentElement;
    const pr = box(p), sr = box(s), rr = box(row), cs = getComputedStyle(row);
    return { vw: window.innerWidth, pr, sr, rr, display: cs.display, cols: cs.gridTemplateColumns.split(' ').length,
      gap: Math.round(parseFloat(cs.columnGap)), sameRow: Math.abs(pr.t - sr.t) <= 8,
      rightOfPulse: sr.l >= pr.r, rowInViewport: rr.r <= window.innerWidth + 1,
      pulseState: p.getAttribute('data-pulse-state') };
  })()`, (v) => v && v.display === 'grid' && v.cols === 2 && v.sameRow === true && v.rightOfPulse === true && v.pulseState !== 'loading');
  check(`1440px: 链上活动与加入方式同一行且加入方式在右侧 (链上活动 x ${desk.pr.l}→${desk.pr.r} · 加入方式 x ${desk.sr.l}→${desk.sr.r} · 顶 y ${desk.pr.t}/${desk.sr.t} · 列宽 ${desk.pr.w}/${desk.sr.w}px)`,
    desk.display === 'grid' && desk.cols === 2 && desk.sameRow === true && desk.rightOfPulse === true && desk.rowInViewport === true,
    JSON.stringify(desk));
  check('1440px: 两栏之间确有一段横向间隔 (不是靠负 margin 叠出来的假并排)',
    Math.abs(desk.sr.l - desk.pr.r - desk.gap) <= 1 && desk.gap >= 20, JSON.stringify({ gapDeclared: desk.gap, measured: desk.sr.l - desk.pr.r }));

  // 窄屏 390: 堆叠 (加入方式落到链上活动下方) + 不贡献横向溢出
  await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  const narrow = await waitStable(`(() => {
    const box = (el) => { const b = el.getBoundingClientRect(); return { l: Math.round(b.left), r: Math.round(b.right), t: Math.round(b.top), b: Math.round(b.bottom), w: Math.round(b.width) }; };
    const p = document.getElementById('pulse'), s = document.getElementById('skills');
    const row = p.parentElement;
    const pr = box(p), sr = box(s), rr = box(row);
    const de = document.documentElement;
    const overAll = de.scrollWidth - de.clientWidth;
    const prev = row.style.display; row.style.display = 'none';
    const overNoRow = de.scrollWidth - de.clientWidth;
    row.style.display = prev;
    const cmd = document.querySelector('#skills .skill-cmd');
    const cmdBox = cmd ? box(cmd) : null;
    return { vw: window.innerWidth, pr, sr, rr, cols: getComputedStyle(row).gridTemplateColumns,
      stacked: sr.t >= pr.b, sameLeft: Math.abs(sr.l - pr.l) <= 1 && Math.abs(sr.r - pr.r) <= 1,
      rowInViewport: rr.r <= window.innerWidth + 1 && sr.r <= window.innerWidth + 1,
      overAll, overNoRow, cmdBox,
      cmdOverflow: cmd ? cmd.scrollWidth - cmd.clientWidth : null,
      pulseState: p.getAttribute('data-pulse-state') };
  })()`, (v) => v && v.stacked === true && v.cols.split(' ').length === 1 && v.sameLeft === true && v.pulseState !== 'loading');
  check(`390px: 加入方式堆叠到链上活动下方 (链上活动 y ${narrow.pr.t}→${narrow.pr.b} · 加入方式 y ${narrow.sr.t}→${narrow.sr.b})`,
    narrow.stacked === true && narrow.cols.split(' ').length === 1 && narrow.sameLeft === true, JSON.stringify(narrow));
  check(`390px: 两栏容器与右列都不超出视口 (容器 x→${narrow.rr.r} · 右列 x→${narrow.sr.r} · 视口 ${narrow.vw}px), 命令块不横向溢出 (${narrow.cmdOverflow}px)`,
    narrow.rowInViewport === true && narrow.cmdOverflow === 0, JSON.stringify({ rr: narrow.rr, sr: narrow.sr, cmd: narrow.cmdBox, over: narrow.cmdOverflow }));
  check(`390px: 两栏自身不贡献页面横向溢出 (整页溢出 隐藏容器前 ${narrow.overAll}px / 后 ${narrow.overNoRow}px —— 老底噪在顶栏, 与新两栏无关)`,
    narrow.overAll === narrow.overNoRow, JSON.stringify({ overAll: narrow.overAll, overNoRow: narrow.overNoRow }));
  await cdp('Emulation.clearDeviceMetricsOverride');
  await sleep(200);

  // 首页 CTA: 「加入网络」按钮在「开始安装」右侧、指向网关页、双语、键盘可达
  await cdp('Page.navigate', { url: `${BASE}/index.html` });
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  const cta = await waitStable(`(() => {
    const box = (el) => { const b = el.getBoundingClientRect(); return { l: Math.round(b.left), r: Math.round(b.right), t: Math.round(b.top), w: Math.round(b.width) }; };
    const row = document.querySelector('.intro-cta');
    const join = document.querySelector('a.join-network-cta');
    if (!row || !join) return { row: !!row, join: !!join };
    const install = Array.from(row.querySelectorAll('a')).filter((a) => /开始安装/.test(a.textContent))[0];
    const jr = box(join), ir = install ? box(install) : null;
    return { tag: join.tagName, href: join.getAttribute('href'), text: join.textContent.trim(),
      zh: join.getAttribute('data-zh'), en: join.getAttribute('data-en'), kids: join.childNodes.length,
      order: Array.from(row.querySelectorAll('a')).map((a) => a.textContent.trim()),
      jr, ir, rightOfInstall: !!ir && jr.l >= ir.r - 1, sameRowAsInstall: !!ir && Math.abs(jr.t - ir.t) <= 8,
      tabIndex: join.tabIndex, isAnchor: join.tagName === 'A',
      inViewport: box(row).r <= window.innerWidth + 1,
      hasArrowKid: !!join.querySelector('span, em, i, b') };
  })()`, (v) => v && v.isAnchor === true && v.rightOfInstall === true && v.sameRowAsInstall === true && v.kids === 1);
  check('首页 hero CTA 行里有「加入网络」按钮 (真 <a>, href=gateway.html, 纯文本节点)',
    cta.isAnchor === true && cta.href === 'gateway.html' && cta.kids === 1 && cta.text === '加入网络' && cta.hasArrowKid === false,
    JSON.stringify({ tag: cta.tag, href: cta.href, text: cta.text, kids: cta.kids }));
  check(`首页: 「加入网络」在「开始安装」右侧且同一行 (开始安装 x→${cta.ir && cta.ir.r} · 加入网络 x ${cta.jr && cta.jr.l}→${cta.jr && cta.jr.r} · 顶 y ${cta.ir && cta.ir.t}/${cta.jr && cta.jr.t})`,
    cta.rightOfInstall === true && cta.sameRowAsInstall === true,
    JSON.stringify({ order: cta.order, ir: cta.ir, jr: cta.jr }));
  check('首页 CTA 顺序 = 开始安装 → 加入网络 → 阅读文档 (加入网络插在安装右侧, 文档仍在最后)',
    JSON.stringify(cta.order) === JSON.stringify(['开始安装 →', '加入网络', '阅读文档']), JSON.stringify(cta.order));
  check('首页「加入网络」双语属性齐 (data-zh/data-en), 切 EN 后文字真的变英文且不丢结构',
    cta.zh === '加入网络' && cta.en === 'Join the network' && cta.href === 'gateway.html', JSON.stringify({ zh: cta.zh, en: cta.en }));

  // 真键盘: 按 Tab 直到焦点落到「加入网络」—— 证明它在 Tab 序里 (不是只能鼠标点), 且焦点环可见
  await cdp('Page.bringToFront').catch(() => {});
  await waitUntil(`document.readyState === 'complete' && !!document.querySelector('a.join-network-cta')`);
  await evalJs(`(() => { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); return 1; })()`);
  let tabbed = null, tabSteps = 0;
  for (let i = 0; i < 40 && !tabbed; i++) {
    await cdp('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 });
    await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 });
    await sleep(70);
    tabSteps = i + 1;
    tabbed = await evalJs(`(() => { const a = document.activeElement; return a && a.classList && a.classList.contains('join-network-cta') ? a.textContent.trim() : null; })()`);
  }
  const focusRing = await evalJs(`(() => { const a = document.activeElement; const cs = getComputedStyle(a); return { cls: a.className, text: a.textContent.trim(), style: cs.outlineStyle, width: cs.outlineWidth, color: cs.outlineColor, offset: cs.outlineOffset }; })()`);
  check(`首页「加入网络」在真实 Tab 序里 (第 ${tabSteps} 次 Tab 到达, 焦点落在 ${JSON.stringify(focusRing.text)})`,
    tabbed === '加入网络', JSON.stringify({ tabbed, tabSteps }));
  check(`首页「加入网络」键盘焦点环可见 (outline ${focusRing.style} ${focusRing.width} ${focusRing.color})`,
    focusRing.style === 'solid' && focusRing.width === '2px' && /196,\s*214,\s*64/.test(focusRing.color), JSON.stringify(focusRing));

  const ctaEn = await evalJs(`(() => { document.querySelector('.lang-toggle [data-lang="en"]').click(); const j = document.querySelector('a.join-network-cta'); return { text: j.textContent.trim(), kids: j.childNodes.length, href: j.getAttribute('href') }; })()`);
  check('首页「加入网络」切 EN 后 = Join the network (仍是同一个 gateway.html 链接)',
    ctaEn.text === 'Join the network' && ctaEn.kids === 1 && ctaEn.href === 'gateway.html', JSON.stringify(ctaEn));
  await evalJs(`document.querySelector('.lang-toggle [data-lang="zh"]').click()`);
  await sleep(250);

  // 390px: 三个按钮换行且不溢出 (CTA 行 flex-wrap)
  await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  const ctaMob = await waitStable(`(() => {
    const box = (el) => { const b = el.getBoundingClientRect(); return { l: Math.round(b.left), r: Math.round(b.right), t: Math.round(b.top) }; };
    const row = document.querySelector('.intro-cta');
    const de = document.documentElement;
    const overAll = de.scrollWidth - de.clientWidth;
    const prev = row.style.display; row.style.display = 'none';
    const overNoRow = de.scrollWidth - de.clientWidth;
    row.style.display = prev;
    const items = Array.from(row.querySelectorAll('a')).map((a) => Object.assign({ text: a.textContent.trim() }, box(a)));
    return { vw: window.innerWidth, wrap: getComputedStyle(row).flexWrap, rr: box(row), items,
      rowInViewport: box(row).r <= window.innerWidth + 1 && items.every((i) => i.r <= window.innerWidth + 1),
      overAll, overNoRow };
  })()`, (v) => v && v.wrap === 'wrap' && v.rowInViewport === true && v.items.length === 3);
  check(`390px: CTA 行换成多行且三个按钮都在视口内 (flex-wrap: ${ctaMob.wrap}; ${ctaMob.items.map((i) => `${i.text} x→${i.r}`).join(' · ')})`,
    ctaMob.wrap === 'wrap' && ctaMob.rowInViewport === true, JSON.stringify(ctaMob));
  check(`390px: CTA 行本身不贡献横向溢出 (整页溢出 隐藏 CTA 行前 ${ctaMob.overAll}px / 后 ${ctaMob.overNoRow}px)`,
    ctaMob.overAll === ctaMob.overNoRow, JSON.stringify({ a: ctaMob.overAll, b: ctaMob.overNoRow }));
  await cdp('Emulation.clearDeviceMetricsOverride');
  await sleep(200);

  // ——————————————————————————————————————————————————————————————
  console.log('\n[13] 待接单任务 (快照 open_tasks[]) —— 脱敏投影的展示与「真值从快照推导」');
  // 这一节验的是「公开页把公告板露出来了, 而且只露了允许露的那几个字段」。
  // 期望值**全部从快照推导** (capability/预算/条数都不写死): 写死会在公告换一批时变成假绿。
  // 快照不许出现的形态同时在两处验: ①快照自己的行键白名单 ②页面渲染出来的文本/HTML。
  await fxDisable();                       // 本节读**真**快照 (不吃夹具)
  shouldIntercept = () => false;
  const OT_KEYS = ['announcementId', 'budget', 'capability', 'claimed', 'currency', 'deadline', 'network'];
  const otRaw = await fetchText(`${BASE}/network-pulse.json`);
  let otSnap = null;
  try { otSnap = JSON.parse(otRaw); } catch { /* 分支断言 */ }
  const otAll = (otSnap && Array.isArray(otSnap.open_tasks)) ? otSnap.open_tasks : null;
  const otRows = (otAll || []).filter((t) => t && typeof t === 'object' &&
    typeof t.capability === 'string' && t.capability.trim() && t.claimed !== true);
  const otSorted = otRows.slice().sort((a, b) => (Number(a.deadline) || 0) - (Number(b.deadline) || 0));
  const otWant = otSorted.map((t) => ({
    cap: t.capability.trim(),
    budget: String(t.budget == null ? '' : t.budget).trim() + (t.currency ? ' ' + String(t.currency).trim() : ''),
    net: String(t.network || '').trim(),
    id: String(t.announcementId || '').trim(),
    dl: Number(t.deadline) || 0,
  }));
  // 快照这一层的硬约束: 数组在 + 每行**只有**白名单 7 键 (正文/地址/DID 想搭车就没门)
  check('快照 open_tasks[] 是数组, 且每行只有白名单 7 键 (capability/budget/currency/network/deadline/claimed/announcementId)',
    Array.isArray(otAll) && otAll.every((t) => t && typeof t === 'object' && JSON.stringify(Object.keys(t).sort()) === JSON.stringify(OT_KEYS)),
    Array.isArray(otAll) ? JSON.stringify(otAll.map((t) => Object.keys(t).sort())) : typeof otSnap + '/open_tasks=' + (otSnap && typeof otSnap.open_tasks));
  check('快照 open_tasks[] 只含未认领的行 (claimed 全为 false), announcementId 是**前 8 位**短写',
    Array.isArray(otAll) && otAll.every((t) => t.claimed === false && typeof t.announcementId === 'string' && t.announcementId.length <= 8),
    Array.isArray(otAll) ? JSON.stringify(otAll.map((t) => ({ c: t.claimed, id: t.announcementId }))) : 'n/a');

  // 钩子必须写死在静态 HTML 里 (JS 挂了也要说「暂未观察到」, 不是留白也不是假 0)。
  // 「尚未接入」这一条**只扫本区块自己的 markup** —— 网关页的接口说明段里合法地写着
  // 「本节点未接入链上数据源」(那是在文档某一档回退行为), 扫全页会把它误判成假标签。
  for (const pg of ['gateway.html', 'index.html']) {
    const raw = await fetchText(`${BASE}/${pg}`);
    const blockRaw = ((pg === 'index.html')
      ? raw.match(/<p class="pulse-c-tasks">[\s\S]*?<\/p>/)
      : raw.match(/<div class="pulse-tasks">[\s\S]*?<\/div>/)) || [''];
    const blk = blockRaw[0] || '';
    check(`${pg} 静态 HTML 有待接单任务钩子 (data-pulse-tasks + data-pulse-tasks-empty + 空态文案)`,
      blk !== '' && /data-pulse-tasks(?![-\w])/.test(blk) && /data-pulse-tasks-empty/.test(blk) && /暂未观察到/.test(blk),
      JSON.stringify({ block: blk.length, list: /data-pulse-tasks(?![-\w])/.test(blk), empty: /data-pulse-tasks-empty/.test(blk), text: /暂未观察到/.test(blk) }));
    check(`${pg} 待接单任务区块静态文案无「尚未接入 / not connected」这类与事实相反的标签`,
      blk !== '' && !/尚未接入|not connected/i.test(blk), blk === '' ? '区块没抓出来' : '');
  }

  // 一页一探: 列表容器 · chip 逐字段 · 空态 · 可见文本
  const probeTasks = (rootSel) => `(() => {
    const root = document.querySelector(${JSON.stringify(rootSel)});
    if (!root) return { missing: true };
    const list = root.querySelector('[data-pulse-tasks]');
    const empty = root.querySelector('[data-pulse-tasks-empty]');
    const chipNodes = list ? Array.from(list.querySelectorAll('.pulse-task-chip')) : [];
    const q = (c, s) => { const e = c.querySelector(s); return e ? e.textContent.trim() : ''; };
    const chips = chipNodes.map((c) => ({
      cap: q(c, '.pulse-task-cap'), budget: q(c, '.pulse-task-budget'), net: q(c, '.pulse-task-net'),
      id: c.getAttribute('data-task-id') || '',
      dlIso: (c.querySelector('.pulse-task-deadline') || {}).dateTime || '',
      r: Math.round(c.getBoundingClientRect().right), w: Math.round(c.getBoundingClientRect().width),
    }));
    const more = list ? list.querySelector('.pulse-task-more') : null;
    const box = root.getBoundingClientRect();
    return {
      state: root.getAttribute('data-pulse-state'),
      hasList: !!list, hasEmpty: !!empty,
      chips, moreText: more ? more.textContent.trim() : null,
      moreN: more && more.hasAttribute('data-pulse-tasks-more') ? Number(more.getAttribute('data-pulse-tasks-more')) : null,
      emptyVisible: !!(empty && empty.offsetParent !== null && empty.getBoundingClientRect().height > 0),
      emptyText: empty ? empty.textContent.trim() : '',
      regionText: (list ? list.innerText : '') + ' ' + (empty ? empty.innerText : ''),
      regionHtml: list ? list.innerHTML : '',
      vw: window.innerWidth,
      pageText: document.body.innerText || '',
      pageHtml: document.documentElement.outerHTML || '',
      overFlow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      rootH: Math.round(box.height),
    };
  })()`;

  const OT_EMPTY_OK = ['暂未观察到', '快照读不到，暂未观察到', 'Empty = none observed', 'snapshot unreadable — none observed'];
  // 2026-09-24 leo:「固定高度…下滑滚动查看, 分页分栏切换」→ 网关页声明 data-pulse-tasks-page="4"。
  // 期望值从这里来 (不写死 4 在断言里): 页面一页画几条 = 这个数, 与 markup 声明绑在一起。
  const TASKS_PAGE_EXP = 4;
  const LEAK_SHAPES = [
    [/0x[0-9a-fA-F]{40}/, '40 位地址形态'],
    [/did:[a-z]/i, 'DID 形态'],
    [/\/(ip4|ip6|dns[46]?|p2p|tcp|udp|ws|wss)\//, 'multiaddr 形态'],
    [/12D3Koo[1-9A-HJ-NP-Za-km-z]{10,}|Qm[1-9A-HJ-NP-Za-km-z]{30,}/, 'peerId 形态'],
    [/0x[0-9a-fA-F]{64}/, '64 位 hex (私钥/公钥形态)'],
    [/\b[a-f0-9]{64}\b/, '裸 64 位 hex (sha256/私钥形态)'],
  ];
  const leakHit = (s) => { for (const [re, name] of LEAK_SHAPES) { const m = String(s || '').match(re); if (m) return name + ' → ' + m[0].slice(0, 24); } return null; };

  // 真公告板文件 (本机才有): 拿它当「正文样本」—— 验页面确实**没有**把正文/买方身份带出去
  const boardDir = path.join(os.homedir(), '.bolloon', 'tasks', 'board');
  const boardSamples = [];   // { label, needle }
  try {
    for (const f of fs.readdirSync(boardDir)) {
      if (!f.endsWith('.json')) continue;
      let b = null;
      try { b = JSON.parse(fs.readFileSync(path.join(boardDir, f), 'utf8')); } catch { continue; }
      const short = String(b.announcementId || '').slice(0, 8);
      const pub = otAll ? otAll.some((t) => t && t.announcementId === short) : false;
      if (!pub) continue;                                      // 只在快照里真的露了这一条时才算样本
      for (const k of ['instruction', 'instructionPreview', 'buyerDid', 'buyerPublicKeyHex', 'signature', 'instructionDigest']) {
        const v = b[k];
        if (typeof v !== 'string' || v.length < 8) continue;
        boardSamples.push({ label: `${f}:${k}`, needle: v });
        if (v.length >= 40) {                                  // 长正文再切成 20 字窗口 —— 截一半露出来也算泄漏
          for (let i = 0; i + 20 <= v.length; i += 10) boardSamples.push({ label: `${f}:${k}[${i}+20]`, needle: v.slice(i, i + 20) });
        }
      }
    }
  } catch { /* 没有本机公告板目录 → 下面显式跳过这一段 */ }

  for (const [label, page, rootSel, cap] of [['网关页', 'gateway.html', '#pulse', Infinity], ['首页序栏', 'index.html', '#intro .pulse-compact', 1]]) {
    await cdp('Page.navigate', { url: `${BASE}/${page}` });
    await waitUntil(`document.readyState === 'complete' && window.__bolloonPulses && window.__bolloonPulses.length > 0`);
    const p = await waitStable(probeTasks(rootSel), (v) => v && !v.missing && v.state && v.state !== 'loading');
    if (!p || p.missing) { check(`${label}: 找到待接单任务钩子`, false, '未找到 ' + rootSel); continue; }
    const want = otWant.slice(0, Math.min(cap, 20));
    // 2026-09-24: 列表改成分页渲染 (每页 data-pulse-tasks-page 条) → 首屏条数还要过一道分页上限;
    // 不加这一道, 这条断言会变成「页面必须一次把 20 条画完」—— 与实现正好相反。
    const perPage = Math.min(cap, TASKS_PAGE_EXP);
    // ① 钩子在场
    check(`${label}: 待接单任务列表容器 + 空态节点都在 DOM 里`, p.hasList && p.hasEmpty, JSON.stringify({ list: p.hasList, empty: p.hasEmpty }));
    // ② 条数与逐字段 = 快照 (期望值从快照推导)
    const nOk = p.chips.length === Math.min(otWant.length, perPage);
    const fOk = p.chips.every((c, i) => want[i] && c.cap === want[i].cap && c.budget === want[i].budget &&
      c.id === want[i].id && c.net === want[i].net &&
      (want[i].dl ? Date.parse(c.dlIso) === want[i].dl : true));
    check(`${label}: chip 条数 = 快照里未认领且未过期的公告数 (本页上限 ${cap === Infinity ? '20' : cap} · 每页 ${TASKS_PAGE_EXP}) 实际 ${p.chips.length} / 快照 ${otWant.length}`,
      nOk, JSON.stringify({ got: p.chips.length, want: Math.min(otWant.length, perPage) }));
    check(`${label}: 每条 chip 的 capability / 预算(原子)+币种 / network / 短 id / 截止 = 快照逐字相同`,
      fOk, JSON.stringify({ page: p.chips, snap: want }));
    // 截断要如实计数: 页面列不完就挂 +N, 不静默吞掉
    const rest = otWant.length - want.length;
    check(`${label}: 被本页上限截掉的行用「+N」如实计数 (应 ${rest}, 页面上是 ${p.moreN})`,
      rest <= 0 ? p.moreN === null : p.moreN === rest, JSON.stringify({ moreText: p.moreText, moreN: p.moreN, rest }));
    // ③ 空态: 文案在场(说「暂未观察到」) 且不是假 0; 显隐与快照一致
    check(`${label}: 空态文案 = 「暂未观察到」类诚实话, 不是假 0 (实际 ${JSON.stringify(p.emptyText)})`,
      OT_EMPTY_OK.includes(p.emptyText) && !/\b0\b/.test(p.emptyText) && p.emptyText.length <= 24, p.emptyText);
    check(`${label}: 空态显隐与快照一致 (快照 ${otWant.length} 条 → 空态${otWant.length === 0 ? '必须显示' : '不得显示'})`,
      p.emptyVisible === (otWant.length === 0), JSON.stringify({ visible: p.emptyVisible, n: otWant.length }));
    // ④ 页面不许出现泄漏形态 (区块 + 整页可见文本)
    const regionLeak = leakHit(p.regionText) || leakHit(p.regionHtml);
    const pageLeak = leakHit(p.pageText);
    check(`${label}: 待接单任务区块无 0x40 / DID / multiaddr / peerId / 64 位私钥形态`,
      !regionLeak, regionLeak || '');
    check(`${label}: 整页可见文本无 DID / multiaddr / peerId / 64 位私钥形态 (0x40 与 64 位哈希已有既有断言)`,
      !pageLeak, pageLeak || '');
    // ⑤ 任务正文样本串一定不在页面上 (在快照里露过的那条公告才算样本)
    if (boardSamples.length) {
      const hit = boardSamples.find((s) => p.pageText.includes(s.needle) || p.pageHtml.includes(s.needle));
      check(`${label}: 页面不含公告正文 / 买方 DID·公钥 / 签名的任何样本串 (${boardSamples.length} 个样本: 全文 + 20 字窗口)`,
        !hit, hit ? `${hit.label} → ${hit.needle.slice(0, 30)}` : '');
    } else {
      skip(`${label}: 任务正文样本串不在页面`, '本机没有 ~/.bolloon/tasks/board/ 里与快照对得上的公告文件, 拿不到样本串');
    }
    // ⑥ 读数不该被这一块撑破 (真几何: 区块自己不横向溢出)
    check(`${label}: 待接单任务区块不撑破容器 (窗口 ${p.vw}px, 每行右边界 ≤ 视口)`,
      p.chips.every((c) => c.r <= p.vw + 1), JSON.stringify(p.chips.map((c) => c.r)));
  }

  // 390px: 窄屏不因新区块多出横向溢出 (两栏/顶栏的老溢出不受影响 —— 只比"隐藏本区块前后")
  await cdp('Page.navigate', { url: `${BASE}/gateway.html` });
  await waitUntil(`document.readyState === 'complete' && window.__bolloonPulses && window.__bolloonPulses.length > 0`);
  await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  const otMob = await waitStable(`(() => {
    const blk = document.querySelector('#pulse .pulse-tasks');
    if (!blk) return null;
    const de = document.documentElement;
    const overAll = de.scrollWidth - de.clientWidth;
    const prev = blk.style.display; blk.style.display = 'none';
    const overNoBlock = de.scrollWidth - de.clientWidth;
    blk.style.display = prev;
    const r = blk.getBoundingClientRect();
    return { vw: window.innerWidth, overAll, overNoBlock, bl: Math.round(r.left), br: Math.round(r.right),
      inViewport: r.left >= -1 && r.right <= window.innerWidth + 1,
      selfOverflow: blk.scrollWidth - blk.clientWidth };
  })()`, (v) => v && typeof v.overAll === 'number');
  check(`390px: 待接单任务区块本身在视口内且不自溢出 (left ${otMob && otMob.bl} · right ${otMob && otMob.br} · 自溢出 ${otMob && otMob.selfOverflow}px)`,
    !!otMob && otMob.inViewport === true && otMob.selfOverflow <= 1, JSON.stringify(otMob));
  check(`390px: 这一块不贡献横向溢出 (隐藏前 ${otMob && otMob.overAll}px / 隐藏后 ${otMob && otMob.overNoBlock}px)`,
    !!otMob && otMob.overAll === otMob.overNoBlock, JSON.stringify(otMob));
  await cdp('Emulation.clearDeviceMetricsOverride');
  await sleep(200);

  // ═══ [14] 待接单任务: 固定高度 + 框内滚动 + 分页 + 分栏切换 (2026-09-24 leo 要求) ═══
  // 为什么单开一节、且必须吃夹具: 真快照此刻只有 1 条待接单 → 分页控件按纪律不出现,
  // 拿真数据**验不出分页**(也验不出「加了条目高度不变」)。所以这里注入 FX_TASKS_MANY (7 条),
  // 并**先量真数据下的高度当基准** —— 用户要的是「就这个目前的高度」, 那就要证明加条目后**一像素没变**。
  // 夹具未自证生效时, 本节失败会被 check() 报成「夹具错 · 未生效」, 不会被读成页面缺陷。
  // 控件文案探针 (2026-09-24 leo:「切换也太模糊」): 把**每一个**控件按钮的可见文案 + title/aria-label + 禁用态抓出来。
  //   断言口径: ① 不许出现「切换 / switch」这类两边都指、要读者自己猜的说法, 也不许空文案;
  //   ② 文案是**动词 + 去向**(上一页 / 下一页 / 切到双栏 / 切回单栏); ③ title 非空, 连禁用时也有说法 (按不动要有原因);
  //   ④ aria-label 里**含可见文案** (读屏念出的名字与眼睛看到的字一致, 不做两套说法)。
  const CTL_BUTTONS_JS = `(() => Array.prototype.map.call(document.querySelectorAll('#pulse .pulse-ctl-btn'), (b) => ({
    hook: b.hasAttribute('data-pulse-activity-prev') ? 'act-prev' : b.hasAttribute('data-pulse-activity-next') ? 'act-next'
      : b.hasAttribute('data-pulse-tasks-prev') ? 'tasks-prev' : b.hasAttribute('data-pulse-tasks-next') ? 'tasks-next'
        : b.hasAttribute('data-pulse-tasks-cols') ? 'tasks-cols' : '?',
    text: (b.textContent || '').trim(), title: b.getAttribute('title') || '', aria: b.getAttribute('aria-label') || '',
    disabled: b.disabled === true, shown: !b.closest('[hidden]'),
    color: getComputedStyle(b).color, borderStyle: getComputedStyle(b).borderTopStyle, bg: getComputedStyle(b).backgroundColor,
  })))()`;
  const VAGUE_CTL = ['切换', 'switch', 'toggle'];   // 这些词不说明"切什么、切成什么"
  // 品牌色 (与 style.css 的 --lime / --lime-deep 同一个值): 控件四态都要在这两个色上, 不许退回中性灰 ——
  //   真截图复核抓到过: 真快照正好 15 行 ⇒ 翻页按钮**长期禁用**, 禁用态一旦写成灰字灰边, 这条栏在线上永远是灰的。
  const LIME = 'rgb(196, 214, 64)';
  const LIME_DEEP = 'rgb(138, 148, 48)';
  const GREY_ISH = ['rgb(92, 92, 84)', 'rgb(144, 144, 136)', 'rgb(136, 136, 136)'];   // --ink-3 / --ink-2 (旧控件色)
  const ctlVerdict = (btns) => {
    const shown = btns.filter((b) => b.shown);
    const vague = shown.filter((b) => b.text.length === 0 || VAGUE_CTL.includes(b.text));
    return { shown, vague, ok: shown.length > 0 && vague.length === 0 };
  };
  const ctlActsOf = (btns) => btns.filter((b) => b.shown && b.hook.startsWith('act-'));

  console.log('\n[14] 待接单任务: 固定高度 + 下滑滚动 + 分页 + 分栏 (真数据量基数 → 夹具 7 条验行为)');

  const tasksBoxProbe = `(() => {
    const root = document.querySelector('#pulse');
    if (!root) return { missing: true };
    const blk = root.querySelector('.pulse-tasks');
    const list = root.querySelector('[data-pulse-tasks]');
    const ctl = root.querySelector('[data-pulse-tasks-ctl]');
    const chips = list ? Array.from(list.querySelectorAll('.pulse-task-chip')) : [];
    const q = (s) => root.querySelector(s);
    const cs = list ? getComputedStyle(list) : null;
    const r = list ? list.getBoundingClientRect() : null;
    const rb = blk ? blk.getBoundingClientRect() : null;
    return {
      missing: false,
      state: root.getAttribute('data-pulse-state'),
      chipCount: chips.length,
      caps: chips.map((c) => (c.querySelector('.pulse-task-cap') || {}).textContent || ''),
      ids: chips.map((c) => c.getAttribute('data-task-id') || ''),
      listH: r ? +r.height.toFixed(2) : null,
      listLeft: r ? Math.round(r.left) : null,
      listRight: r ? Math.round(r.right) : null,
      blkH: rb ? +rb.height.toFixed(2) : null,
      ctlH: ctl ? +ctl.getBoundingClientRect().height.toFixed(2) : 0,
      regionText: blk ? blk.innerText : '',
      regionHtml: blk ? blk.innerHTML : '',
      overflowY: cs ? cs.overflowY : null,
      scrollH: list ? list.scrollHeight : null,
      clientH: list ? list.clientHeight : null,
      isCols2: list ? list.classList.contains('is-cols2') : null,
      lefts: chips.map((c) => Math.round(c.getBoundingClientRect().left)),
      rights: chips.map((c) => Math.round(c.getBoundingClientRect().right)),
      ctlShown: ctl ? !(ctl.hasAttribute('hidden') || getComputedStyle(ctl).display === 'none') : null,
      pageInfo: (q('[data-pulse-tasks-pageinfo]') || {}).textContent || '',
      prevDisabled: q('[data-pulse-tasks-prev]') ? q('[data-pulse-tasks-prev]').disabled : null,
      nextDisabled: q('[data-pulse-tasks-next]') ? q('[data-pulse-tasks-next]').disabled : null,
      colsPressed: q('[data-pulse-tasks-cols]') ? q('[data-pulse-tasks-cols]').getAttribute('aria-pressed') : null,
      colsLabel: (q('[data-pulse-tasks-cols]') || {}).textContent || '',
      declaredPage: root.getAttribute('data-pulse-tasks-page'),
      cfgPageSize: (window.__bolloonPulses && window.__bolloonPulses[0] && window.__bolloonPulses[0].config)
        ? window.__bolloonPulses[0].config.tasksPageSize : null,
      vw: window.innerWidth,
      pageText: document.body.innerText || '',
      pageHtml: document.documentElement.outerHTML || '',
      overFlow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  })()`;

  // ① 基准 = **真数据**下这一块的高度 (用户说「就这个目前的高度」→ 后面所有形态都得等于它)
  shouldIntercept = () => false;
  await fxDisable().catch(() => {});
  await cdp('Page.navigate', { url: `${BASE}/gateway.html` });
  await waitUntil(`document.readyState === 'complete' && window.__bolloonPulses && window.__bolloonPulses.length > 0`);
  const tasksRef = await waitStable(tasksBoxProbe, (v) => v && !v.missing && v.state === 'live');
  fxOff();
  const refOk = !!tasksRef && tasksRef.state === 'live' && typeof tasksRef.listH === 'number';
  check(`[14] 基准: 真数据下待接单列表容器有高度 (${refOk ? tasksRef.listH + 'px' : '读不到'}) 且 overflow-y = auto (框内滚动)`,
    refOk && tasksRef.overflowY === 'auto', JSON.stringify({ listH: tasksRef && tasksRef.listH, overflowY: tasksRef && tasksRef.overflowY }));
  check(`[14] 基准: 真数据只有 ${tasksRef ? tasksRef.chipCount : '?'} 条 → 一页装得下 ⇒ 分页控件整行隐藏 (不添噪音)`,
    !!tasksRef && tasksRef.ctlShown === false, JSON.stringify({ chips: tasksRef && tasksRef.chipCount, ctlShown: tasksRef && tasksRef.ctlShown }));
  check(`[14] 基准: 网关页 markup 声明每页 ${TASKS_PAGE_EXP} 条 (data-pulse-tasks-page) 且 app 实例按它取值`,
    !!tasksRef && tasksRef.declaredPage === String(TASKS_PAGE_EXP) && tasksRef.cfgPageSize === TASKS_PAGE_EXP,
    JSON.stringify({ declared: tasksRef && tasksRef.declaredPage, cfg: tasksRef && tasksRef.cfgPageSize }));

  // ② 夹具 7 条 → 一页 4 条 / 2 页; 先自证夹具真生效, 再断言
  cMode = 'tasks-many';
  shouldIntercept = (p) => p.request.url.includes('network-pulse-verify');
  await fxEnable(PULSE_PATTERN);
  await cdp('Page.navigate', { url: `${BASE}/gateway.html?pulse=${encodeURIComponent(`${BASE}/network-pulse-verify-c.json`)}` });
  const manyProof = await fxSelfProof('tasks-many', {
    what: 'FX_TASKS_MANY (7 条待接单)', probeExpr: tasksBoxProbe,
    domSignal: (v) => !!(v && !v.missing && v.chipCount === TASKS_PAGE_EXP),
  });
  const many = await evalJs(tasksBoxProbe);
  const expPages = Math.ceil(7 / TASKS_PAGE_EXP);
  check(`[14] 夹具 7 条 → 首屏只画一页 (${many.chipCount} 条 = 每页 ${TASKS_PAGE_EXP}), 不是把 7 条一次铺开`,
    many.chipCount === TASKS_PAGE_EXP, JSON.stringify({ chips: many.chipCount, want: TASKS_PAGE_EXP }));
  check(`[14] 页信息 = 「第 1/${expPages} 页 · 共 7 条」(页数与总数从快照条数算出来)`,
    many.pageInfo === `第 1/${expPages} 页 · 共 7 条`, JSON.stringify(many.pageInfo));
  check(`[14] 首页时「上一页」禁用 / 「下一页」可用`,
    many.prevDisabled === true && many.nextDisabled === false, JSON.stringify({ prev: many.prevDisabled, next: many.nextDisabled }));
  check(`[14] 分页控件出现在一页装不下时 (7 > ${TASKS_PAGE_EXP})`, many.ctlShown === true, JSON.stringify({ ctlShown: many.ctlShown }));
  // ★ 固定高度: 7 条时这一块高度 == 真数据那个基准 (一像素不变), 且内容真的溢出 (框内可滚)
  check(`[14] ★ 固定高度: 7 条时列表高 ${many.listH}px == 真数据基准 ${tasksRef && tasksRef.listH}px (条目再多也不撑高这一块)`,
    refOk && many.listH === tasksRef.listH, JSON.stringify({ many: many.listH, ref: tasksRef && tasksRef.listH }));
  check(`[14] ★ 固定高度: 整块(标题+标记+列表+控件)高度的增长 ${tasksRef ? +(many.blkH - tasksRef.blkH).toFixed(2) : '?'}px = 分页控件那一行 ${many.ctlH}px (+它的外边距), 不是被条目堆高的`,
    refOk && many.blkH > tasksRef.blkH && many.blkH - tasksRef.blkH <= many.ctlH + 12,
    JSON.stringify({ many: many.blkH, ref: tasksRef && tasksRef.blkH, ctlH: many.ctlH, delta: tasksRef ? +(many.blkH - tasksRef.blkH).toFixed(2) : null }));
  check(`[14] ★ 框内可滚: scrollHeight ${many.scrollH} > clientHeight ${many.clientH} (多出来的在框里滚, 不往外长)`,
    many.scrollH > many.clientH && many.overflowY === 'auto', JSON.stringify({ scrollH: many.scrollH, clientH: many.clientH, overflowY: many.overflowY }));
  // 泄漏: 只看**待接单这一块** —— 夹具的 agent_sites 里本来就带一个 IPNS peerId 站链接 (那一块有它自己的门),
  // 拿整页文本来判这一块会把「夹具自带的合法内容」当成这一块的泄漏。
  check(`[14] 待接单任务区块 (夹具 7 条) 可见文本与 HTML 无 DID / 0x40 / multiaddr / 64 位私钥形态`,
    !leakHit(many.regionText) && !leakHit(many.regionHtml), leakHit(many.regionText) || leakHit(many.regionHtml) || '');

  // ③ 下一页: 第 2 页 = 剩下 3 条 (按 deadline 升序的**后 3 条**, 期望值从夹具推导)
  const fxCaps = JSON.parse(JSON.stringify(FX_TASKS_MANY.open_tasks)).sort((a, b) => a.deadline - b.deadline).map((t) => t.capability);
  const p2want = fxCaps.slice(TASKS_PAGE_EXP);
  await evalJs(`(() => { const b = document.querySelector('#pulse [data-pulse-tasks-next]'); if (b) b.click(); return !!b; })()`);
  await sleep(200);
  const pg2 = await evalJs(tasksBoxProbe);
  check(`[14] 点「下一页」→ 第 2 页画剩下 ${7 - TASKS_PAGE_EXP} 条, 且 capability 逐条 = 夹具排序后的后段`,
    pg2.chipCount === 7 - TASKS_PAGE_EXP && JSON.stringify(pg2.caps) === JSON.stringify(p2want),
    JSON.stringify({ caps: pg2.caps, want: p2want }));
  check(`[14] 第 2/2 页时「下一页」禁用 / 「上一页」可用 (页码边界不靠用户猜)`,
    pg2.nextDisabled === true && pg2.prevDisabled === false && pg2.pageInfo === `第 ${expPages}/${expPages} 页 · 共 7 条`,
    JSON.stringify({ next: pg2.nextDisabled, prev: pg2.prevDisabled, info: pg2.pageInfo }));
  check(`[14] 翻页不改高度: 第 2 页列表高 ${pg2.listH}px == 基准 ${tasksRef && tasksRef.listH}px`,
    refOk && pg2.listH === tasksRef.listH, JSON.stringify({ p2: pg2.listH, ref: tasksRef && tasksRef.listH }));

  // ④ 分栏切换: 真两列 (chip 左边界出现两种取值) + 高度不变 + aria-pressed/文案跟着状态走
  await evalJs(`(() => { const b = document.querySelector('#pulse [data-pulse-tasks-cols]'); if (b) b.click(); return !!b; })()`);
  await sleep(200);
  const cols2 = await evalJs(tasksBoxProbe);
  const uniq = (a) => Array.from(new Set(a)).length;
  check(`[14] 点「分栏」→ 列表进入双栏 (is-cols2 + chip 左边界两种取值 ${JSON.stringify(Array.from(new Set(cols2.lefts)))})`,
    cols2.isCols2 === true && uniq(cols2.lefts) === 2, JSON.stringify({ isCols2: cols2.isCols2, lefts: cols2.lefts }));
  check(`[14] ★ 分栏不改高度: 双栏列表高 ${cols2.listH}px == 基准 ${tasksRef && tasksRef.listH}px`,
    refOk && cols2.listH === tasksRef.listH, JSON.stringify({ cols2: cols2.listH, ref: tasksRef && tasksRef.listH }));
  check(`[14] 分栏按钮状态与文案跟着走 (aria-pressed=true · 文案「切回单栏」= 按一下切回单栏), 且这一页条数不变 (${cols2.chipCount})`,
    cols2.colsPressed === 'true' && cols2.colsLabel === '切回单栏' && cols2.chipCount === pg2.chipCount,
    JSON.stringify({ pressed: cols2.colsPressed, label: cols2.colsLabel, chips: cols2.chipCount }));
  await evalJs(`(() => { const b = document.querySelector('#pulse [data-pulse-tasks-cols]'); if (b) b.click(); return !!b; })()`);
  await sleep(200);
  const cols1 = await evalJs(tasksBoxProbe);
  check(`[14] 再按一下回到单栏 (is-cols2 移除 · 左边界只剩一种取值 · aria-pressed=false · 文案「切到双栏」)`,
    cols1.isCols2 === false && uniq(cols1.lefts) === 1 && cols1.colsPressed === 'false' && cols1.colsLabel === '切到双栏',
    JSON.stringify({ isCols2: cols1.isCols2, lefts: cols1.lefts, pressed: cols1.colsPressed, label: cols1.colsLabel }));

  // ⑤ 控件文案 (2026-09-24 leo:「切换也太模糊」): 按钮说清"按下去会发生什么", 且带同源的 title/aria-label
  const ctlT = await evalJs(CTL_BUTTONS_JS);
  const ctlTV = ctlVerdict(ctlT);
  check(`[14] ★ 控件文案说清动作, 不用「切换」这类要读者自己猜的说法: ${ctlTV.shown.map((b) => b.hook + '=' + JSON.stringify(b.text)).join(' ')}`,
    ctlTV.ok, JSON.stringify(ctlT));
  check('[14] 控件文案是**动词 + 去向**: 翻页 = 「上一页 / 下一页」, 分栏按钮 = 「切到双栏 / 切回单栏」(动作, 不是状态名)',
    ctlTV.shown.every((b) => b.hook === 'tasks-prev' ? b.text === '上一页'
      : b.hook === 'tasks-next' ? b.text === '下一页'
        : b.hook === 'tasks-cols' ? (b.text === '切到双栏' || b.text === '切回单栏') : true),
    JSON.stringify(ctlTV.shown.map((b) => [b.hook, b.text])));
  check('[14] 每个控件按钮都带 title + aria-label (同源去向; aria-label 里含可见文案 —— 读屏与眼睛看到的是同一件事)',
    ctlTV.shown.every((b) => b.title.length >= 4 && b.aria.startsWith(b.text) && b.aria.includes(b.title)),
    JSON.stringify(ctlTV.shown.map((b) => [b.hook, b.text, b.title, b.aria])));

  // ⑥ 390px: 双栏也不许撑破视口 (窄屏是这套版式最容易翻车的地方)
  //    这里不拿 window.innerWidth 当尺子 (真机上那是布局视口, 会被页面/设备缩放改), 而是拿
  //    ① 两列都在**列表框**里 (右边界 ≤ 框右边界) ② 这一块**隐藏前后**整页横向溢出不变 两条硬事实。
  await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await evalJs(`(() => { const b = document.querySelector('#pulse [data-pulse-tasks-cols]'); if (b) b.click(); return !!b; })()`);
  await sleep(300);
  const mob2 = await evalJs(`(() => {
    const root = document.querySelector('#pulse');
    const blk = root.querySelector('.pulse-tasks');
    const list = root.querySelector('[data-pulse-tasks]');
    const chips = Array.from(list.querySelectorAll('.pulse-task-chip'));
    const de = document.documentElement;
    const overWith = de.scrollWidth - de.clientWidth;
    const prev = blk.style.display; blk.style.display = 'none';
    const overWithout = de.scrollWidth - de.clientWidth;
    blk.style.display = prev;
    const lr = Math.round(list.getBoundingClientRect().right);
    const ll = Math.round(list.getBoundingClientRect().left);
    return {
      isCols2: list.classList.contains('is-cols2'),
      cols: Array.from(new Set(chips.map((c) => Math.round(c.getBoundingClientRect().left)))).length,
      outside: chips.filter((c) => c.getBoundingClientRect().right > lr + 1).length,
      leftGap: chips.filter((c) => c.getBoundingClientRect().left < ll - 1).length,
      overWith, overWithout,
      listW: Math.round(list.getBoundingClientRect().width),
      colW: chips.length ? Math.round(chips[0].getBoundingClientRect().width) : 0,
      clientW: de.clientWidth,
    };
  })()`);
  check(`[14] 390px 双栏: 真两列 (${mob2.cols} 种左边界) 且每条都在列表框内 (越界 ${mob2.outside} 条 / 漏出左边界 ${mob2.leftGap} 条 · 框宽 ${mob2.listW}px · 单列宽 ${mob2.colW}px)`,
    mob2.isCols2 === true && mob2.cols === 2 && mob2.outside === 0 && mob2.leftGap === 0 && mob2.colW * 2 <= mob2.listW + 2,
    JSON.stringify(mob2));
  check(`[14] 390px: 这一块不贡献横向溢出 (显示时 ${mob2.overWith}px / 隐藏后 ${mob2.overWithout}px)`,
    mob2.overWith === mob2.overWithout, JSON.stringify({ with: mob2.overWith, without: mob2.overWithout }));
  await cdp('Emulation.clearDeviceMetricsOverride');
  await sleep(200);
  await fxDisable().catch(() => {});
  shouldIntercept = () => false;
  cMode = 'full';
  fxOff();

  // ═══ [15] 链上活动表: 高度上限 = 十五行 + 表头钉住 + 底部十五行/页 (2026-09-24 leo 要求) ═══
  // leo:「链上索引 · 全量 · 15 行 … 可以按十五行的高度来设计吗」+「分页栏切换…在十五行底部」
  //   → 表体外面那一层 (.pulse-table-scroll) 用 --pulse-activity-h 封顶在**现在这份 15 行的真高度**上
  //     (1440px 实测 865.03px = caption 30.69 + 表头 41.19 + 15×52.84), 超出就在框内滚 —— 整页不再被表拉长;
  //     分页栏贴在十五行底下, 一页 = data-pulse-activity-page 行 = 高度上限那一份, 所以「翻页」= 「换一屏」。
  // 为什么必须吃夹具: 真快照此刻正好 15 行 = 一页 → 两个翻页按钮全禁用, 拿它验不出「翻页真的换行」;
  //   也验不出「行数涨了这一块一像素没长」。所以注入 FX_ACTIVITY_MANY (70 行 = 60 行上限 + 10 行未列),
  //   并**先量真数据那 15 行的几何当基准** —— leo 要的是「按十五行的高度」, 那就要证明多 55 行时高度不变。
  // 夹具未自证生效时, 本节失败会被 check() 报成「夹具错 · 未生效」, 不会被读成页面缺陷。
  console.log('\n[15] 链上活动表: 上限=十五行 + 表头钉住 + 底部十五行/页 (真数据量基准 → 夹具 70 行验行为)');

  // ① 基准 = 真数据那份的几何 (不加任何夹具)
  shouldIntercept = () => false;
  await fxDisable().catch(() => {});
  await cdp('Page.navigate', { url: `${BASE}/gateway.html` });
  await waitUntil(`document.readyState === 'complete' && window.__bolloonPulses && window.__bolloonPulses.length > 0`);
  const actRef = await waitStable(pulseProbe('#pulse'),
    (v) => v && v.state === 'live' && v.act && v.act.rowCount > 0 && !!v.act.box);
  fxOff();
  let actSnap = null;
  try { actSnap = JSON.parse(await fetchText(`${BASE}/network-pulse.json`)); } catch { actSnap = null; }
  const actSnapRows = actSnap && Array.isArray(actSnap.confirmed_activity) ? actSnap.confirmed_activity.length : null;
  const refBox = actRef && actRef.act.box ? actRef.act.box : null;
  const refRows = actRef && actRef.act ? actRef.act.rowCount : null;
  const refSum = refBox && refBox.rowH ? +(refBox.capH + refBox.theadH + refRows * refBox.rowH).toFixed(2) : null;
  const actRefOk = !!(refBox && typeof refRows === 'number' && refRows > 0);
  check(`[15] 基准: 表框高度 ${refBox && refBox.h}px = caption ${refBox && refBox.capH} + 表头 ${refBox && refBox.theadH} + ${refRows}×${refBox && refBox.rowH} 行 (差 ${refSum != null && refBox ? +(refBox.h - refSum).toFixed(2) : '?'}px)`,
    actRefOk && Math.abs(refBox.h - refSum) <= 2,
    JSON.stringify({ h: refBox && refBox.h, sum: refSum, capH: refBox && refBox.capH, theadH: refBox && refBox.theadH, rowH: refBox && refBox.rowH, rows: refRows }));
  check(`[15] 基准: 真快照行数 ${actSnapRows == null ? '读取失败' : actSnapRows} → 表里 ${refRows} 行 (= 上限 ${ACT_MAX_EXP} 之内那份)`,
    actRefOk && (actSnapRows == null || refRows === Math.min(actSnapRows, ACT_MAX_EXP)),
    JSON.stringify({ snap: actSnapRows, dom: refRows }));
  check(`[15] ★ 高度上限就是这份真高度: max-height = ${refBox && refBox.maxH} ≈ 表框高 ${refBox && refBox.h}px (样式里那个字面量不许跟真实行高漂开)`,
    actRefOk && Math.abs(parseFloat(refBox.maxH) - refBox.h) <= 1,
    JSON.stringify({ maxH: refBox && refBox.maxH, h: refBox && refBox.h }));
  check('[15] 表框 overflow-y = auto (框内滚动) 且这一份 15 行正好装满 ⇒ scrollHeight == clientHeight (此刻没有藏起来的行)',
    actRefOk && refBox.overflowY === 'auto' && refBox.scrollH === refBox.clientH,
    JSON.stringify({ oy: refBox && refBox.overflowY, sh: refBox && refBox.scrollH, ch: refBox && refBox.clientH }));
  check(`[15] ★ 表头钉在框顶: position = sticky + 不透明底色 (滚到下面时列名还在, 行不会从它背后透出来)`,
    actRefOk && refBox.thPos === 'sticky' && !/rgba\(\d+, \d+, \d+, 0\)/.test(refBox.thBg),
    JSON.stringify({ pos: refBox && refBox.thPos, bg: refBox && refBox.thBg }));
  check(`[15] 基准: 分页栏就在十五行底部 —— 真数据 ${refRows} 行 = 一页 ⇒ 写着「第 1/1 页 · 共 ${refRows} 行」且两个按钮都禁用 (leo 要的就是这条栏, 不是藏起来)`,
    actRefOk && actRef.act.ctlShown === true && actRef.act.pageInfo === `第 1/1 页 · 共 ${refRows} 行` &&
    actRef.act.prevDisabled === true && actRef.act.nextDisabled === true,
    JSON.stringify({ shown: actRef.act.ctlShown, info: actRef.act.pageInfo, prev: actRef.act.prevDisabled, next: actRef.act.nextDisabled }));
  check(`[15] 基准: 网关页 markup 声明每页 ${ACT_PAGE_EXP} 行 (data-pulse-activity-page) 且 app 实例按它取值`,
    actRefOk && actRef.act.declaredPage === String(ACT_PAGE_EXP) && actRef.act.cfgPageSize === ACT_PAGE_EXP,
    JSON.stringify({ declared: actRef.act.declaredPage, cfg: actRef.act.cfgPageSize }));

  // ①b 分页栏文案 (2026-09-24 leo:「切换也太模糊」): 真数据 1 页时两个按钮都禁用 —— 正是验「按不动也有说法」的时候
  const ctlBase = await evalJs(CTL_BUTTONS_JS);
  const ctlBaseV = ctlVerdict(ctlBase);
  check(`[15] ★ 分页栏文案说清动作: ${ctlActsOf(ctlBase).map((b) => b.hook + '=' + JSON.stringify(b.text)).join(' ')} (翻页写「上一页 / 下一页」, 不用「切换」这种要读者猜的说法)`,
    ctlBaseV.ok && ctlActsOf(ctlBase).every((b) => b.text === '上一页' || b.text === '下一页'), JSON.stringify(ctlBase));
  check(`[15] 1/1 页时两个按钮都禁用**且都写明为什么按不动** (${ctlActsOf(ctlBase).map((b) => JSON.stringify(b.title)).join(' / ')}), 不留空 title`,
    ctlActsOf(ctlBase).length === 2 && ctlActsOf(ctlBase).every((b) => b.disabled === true && b.title.length >= 4 && b.title !== b.text && b.aria.startsWith(b.text)),
    JSON.stringify(ctlActsOf(ctlBase).map((b) => [b.hook, b.text, b.title, b.aria, b.disabled])));
  check(`[15] ★ 禁用态也穿品牌色 (暗调 lime ${LIME_DEEP} + 虚线边), 不退回中性灰 —— 真快照长期 1/1 页, 这条栏天天是禁用样; 灰了就看不见 bolloon 色系 (真截图复核抓到的回归)`,
    ctlActsOf(ctlBase).length === 2 && ctlActsOf(ctlBase).every((b) => b.color === LIME_DEEP && b.borderStyle === 'dashed' && !GREY_ISH.includes(b.color)),
    JSON.stringify(ctlActsOf(ctlBase).map((b) => [b.hook, b.color, b.borderStyle, b.bg])));

  // ② 夹具 70 行: 高度不变 + 框内真滚 + 翻页真换行 + 页边界 + 上限口径与截断口径对得上
  fxPre('activity-many-fixture', !!FX_ACTIVITY_MANY,
    'network-pulse.json 读不到 (或 confirmed_activity 为空) → 70 行夹具造不出来 (先跑 refresh-pulse)');
  cMode = 'activity-many';
  shouldIntercept = (p) => p.request.url.includes('network-pulse-verify');
  await fxEnable(PULSE_PATTERN);
  await cdp('Page.navigate', { url: `${BASE}/gateway.html?pulse=${encodeURIComponent(`${BASE}/network-pulse-verify-c.json`)}` });
  await fxSelfProof('activity-many', {
    what: `FX_ACTIVITY_MANY (${ACT_MANY_ROWS} 行链上活动)`, probeExpr: pulseProbe('#pulse'),
    domSignal: (v) => !!(v && v.act && v.act.rowCount === ACT_PAGE_EXP),
  });
  const manyAct = await evalJs(pulseProbe('#pulse'));
  const mBox = manyAct.act.box;
  const cappedTotal = Math.min(ACT_MANY_ROWS, ACT_MAX_EXP);          // 上限之内的行数 = 分页总量
  const restRows = ACT_MANY_ROWS - cappedTotal;                      // 被上限截掉的 = 「另 R 行未列」
  const actExpPages = Math.ceil(cappedTotal / ACT_PAGE_EXP);
  const wantInfo = (p) => `第 ${p}/${actExpPages} 页 · 共 ${cappedTotal} 行 · 另 ${restRows} 行未列`;
  check(`[15] 夹具 ${ACT_MANY_ROWS} 行 → 第 1 页只画 ${ACT_PAGE_EXP} 行 (一页一屏, 不是把 ${ACT_MANY_ROWS} 行一次铺开)`,
    manyAct.act.rowCount === ACT_PAGE_EXP, JSON.stringify({ rows: manyAct.act.rowCount, want: ACT_PAGE_EXP }));
  check(`[15] ★ 行数从 ${refRows} 涨到 ${cappedTotal} 这一块**一像素没长**: 表框高 ${mBox.h}px == 真数据基准 ${refBox.h}px`,
    actRefOk && Math.abs(mBox.h - refBox.h) <= 1, JSON.stringify({ many: mBox.h, ref: refBox.h }));
  // 一页 = 高度上限那一份 (15 行) ⇒ 每一页**正好一屏**: scrollHeight == clientHeight。
  // 这不是"没滚起来", 而是设计本身 (leo 要的「分页栏在十五行底部」): 翻页就够, 不用在框里盲滚。
  // 「内容一旦超过上限就在框里滚」是**安全网** (行被撑高 / 字体回退 / 系统字号放大), 由下一段"临时摞到 60 行"直接验。
  check(`[15] 一页 = 上限那一份 ⇒ 每页正好一屏 (scrollHeight ${mBox.scrollH} == clientHeight ${mBox.clientH}), 框里没有藏着的行`,
    mBox.scrollH === mBox.clientH && mBox.overflowY === 'auto', JSON.stringify({ sh: mBox.scrollH, ch: mBox.clientH, oy: mBox.overflowY }));
  check(`[15] 页信息 = 「${wantInfo(1)}」(页数从行数算出来; 超上限被截掉的部分如实补一句)`,
    manyAct.act.pageInfo === wantInfo(1), JSON.stringify({ got: manyAct.act.pageInfo, want: wantInfo(1) }));
  check(`[15] ★ 上限/截断两个口径对得上: 页信息「共 ${cappedTotal} 行 + 另 ${restRows} 行未列」= 口径行的「${ACT_MANY_ROWS} 行」(并排不打架)`,
    manyAct.act.totalsLine.includes(`${ACT_MANY_ROWS} 行`) && manyAct.act.totalsLine.includes('链上索引') && cappedTotal + restRows === ACT_MANY_ROWS,
    JSON.stringify({ info: manyAct.act.pageInfo, totals: manyAct.act.totalsLine }));
  check('[15] 第 1 页时「上一页」禁用 / 「下一页」可用', manyAct.act.prevDisabled === true && manyAct.act.nextDisabled === false,
    JSON.stringify({ prev: manyAct.act.prevDisabled, next: manyAct.act.nextDisabled }));

  // 逐页翻到底: 每页行数 = min(每页, 剩余), 页信息逐页对上, 高度每页都不变
  const clickAct = (sel) => evalJs(`(() => { const b = document.querySelector('#pulse [data-pulse-activity-${sel}]'); if (b) b.click(); return !!b; })()`);
  const pagesSeen = [];
  for (let p = 2; p <= actExpPages; p++) {
    await clickAct('next');
    await sleep(250);
    const v = await evalJs(pulseProbe('#pulse'));
    pagesSeen.push({ p, rows: v.act.rowCount, info: v.act.pageInfo, h: v.act.box.h, sh: v.act.box.scrollH, ch: v.act.box.clientH, next: v.act.nextDisabled, prev: v.act.prevDisabled });
  }
  check(`[15] 逐页翻到最后一页 (共 ${actExpPages} 页): 每页行数 = min(${ACT_PAGE_EXP}, 剩余) 且页信息逐页对上`,
    pagesSeen.length === actExpPages - 1 &&
    pagesSeen.every((s, i) => s.rows === Math.min(ACT_PAGE_EXP, cappedTotal - (i + 1) * ACT_PAGE_EXP) && s.info === wantInfo(i + 2)),
    JSON.stringify(pagesSeen.map((s) => [s.p, s.rows, s.info])));
  check(`[15] 末页「下一页」禁用 / 「上一页」可用 (页码边界不靠用户猜)`,
    pagesSeen.length > 0 && pagesSeen[pagesSeen.length - 1].next === true && pagesSeen[pagesSeen.length - 1].prev === false,
    JSON.stringify(pagesSeen[pagesSeen.length - 1]));
  check(`[15] ★ 翻页不改高度: 每一页表框高都 == 基准 ${refBox && refBox.h}px, 且每一页都正好一屏 (scrollHeight == clientHeight: 页 = 一屏, 翻页不是盲滚)`,
    actRefOk && pagesSeen.every((s) => Math.abs(s.h - refBox.h) <= 1 && s.sh === s.ch),
    JSON.stringify(pagesSeen.map((s) => [s.p, s.h, s.sh, s.ch])));
  await clickAct('prev');
  await sleep(250);
  const backPage = await evalJs(pulseProbe('#pulse'));
  check(`[15] 点「上一页」回到第 ${actExpPages - 1}/${actExpPages} 页 (页信息与行数都对上, 不是单向走到黑)`,
    backPage.act.pageInfo === wantInfo(actExpPages - 1) && backPage.act.nextDisabled === false,
    JSON.stringify({ info: backPage.act.pageInfo, next: backPage.act.nextDisabled }));
  // ①c 翻页按钮的 title 必须写明**去哪一页** (不写「下一页」这种只说不做的), 且 aria-label 里含可见文案
  const ctlMid = ctlActsOf(await evalJs(CTL_BUTTONS_JS));
  const tipOf = (hook) => (ctlMid.find((b) => b.hook === hook) || {}).title || '';
  check(`[15] 中途页的按钮写明去哪一页: 上一页=${JSON.stringify(tipOf('act-prev'))} · 下一页=${JSON.stringify(tipOf('act-next'))}`,
    tipOf('act-prev') === `回到第 ${actExpPages - 2} 页（共 ${actExpPages} 页）` && tipOf('act-next') === `翻到第 ${actExpPages} 页（共 ${actExpPages} 页）`,
    JSON.stringify(ctlMid.map((b) => [b.hook, b.title, b.aria])));
  check(`[15] ★ 可点态 = 亮品牌色 (lime 文字 ${LIME} + 实线边 + 淡 lime 底), 与禁用态 (暗调 + 虚线) 一眼分得开`,
    ctlMid.length === 2 && ctlMid.every((b) => b.disabled === false && b.color === LIME && b.borderStyle === 'solid'),
    JSON.stringify(ctlMid.map((b) => [b.hook, b.color, b.borderStyle, b.bg, b.disabled])));

  // ③ 安全网与表头: 「内容一旦超过上限就在框内滚, 整页不被拉长」+「滚起来时表头还钉在框顶」。
  //    真快照 15 行、夹具又被分页挡成一页 —— 拿数据量不出「内容 > 上限」的样子, 所以在页面里把行**临时**摞到 60 行
  //    直接量 (量完立刻删)。同一批行里再量一次「把上限拿掉会怎样」: 上限必须**载荷** (拿掉它这一块就该被撑起来),
  //    否则等于没上限 (而门只在 15 行上量是不够的: 15 行正好等于上限, 有没有上限量出来都一样)。
  const capProof = await evalJs(`(() => {
    const b = document.querySelector('#pulse [data-pulse-activity-scroll]');
    const body = document.querySelector('#pulse [data-pulse-activity-body]');
    const th = document.querySelector('#pulse [data-pulse-activity] thead th');
    if (!b || !body || !th || !body.children.length) return null;
    const first = body.children[0];
    const n0 = body.children.length;
    for (let i = 0; i < 45; i++) body.appendChild(first.cloneNode(true));   // 临时摞到 60 行 (只为本段测量)
    const n1 = body.children.length;
    const capped = +b.getBoundingClientRect().height.toFixed(2);
    const sh = b.scrollHeight, ch = b.clientHeight, oy = getComputedStyle(b).overflowY;
    b.scrollTop = 240;
    const br = b.getBoundingClientRect();
    const thTopRel = +(th.getBoundingClientRect().top - br.top).toFixed(2);
    const firstTopRel = +(first.getBoundingClientRect().top - br.top).toFixed(2);
    b.scrollTop = b.scrollHeight;
    const reachBottom = Math.abs(b.scrollTop + b.clientHeight - b.scrollHeight) <= 1;
    const st = document.createElement('style');
    st.textContent = '#pulse [data-pulse-activity-scroll]{max-height:none !important}';
    document.head.appendChild(st);
    const free = +b.getBoundingClientRect().height.toFixed(2);              // 拿掉上限 → 这一块该被撑起来
    st.remove();
    b.scrollTop = 0;
    while (body.children.length > n0) body.removeChild(body.lastElementChild);
    return { n0, n1, left: body.children.length, capped, free, sh, ch, oy, thTopRel, firstTopRel, reachBottom };
  })()`);
  check(`[15] ★ 内容超上限就在框内滚 (临时摞到 ${capProof && capProof.n1} 行: 这一块仍高 ${capProof && capProof.capped}px, scrollHeight ${capProof && capProof.sh} > clientHeight ${capProof && capProof.ch}, overflow-y ${capProof && capProof.oy})`,
    !!capProof && capProof.n1 === capProof.n0 + 45 && capProof.sh > capProof.ch && capProof.oy === 'auto' && Math.abs(capProof.capped - refBox.h) <= 1,
    JSON.stringify(capProof));
  check(`[15] ★ 上限是载荷的 (不是摆设): 同一批 ${capProof && capProof.n1} 行把上限拿掉 → 这一块被撑到 ${capProof && capProof.free}px (高出封顶 ${capProof && Math.round(capProof.free - capProof.capped)}px)`,
    !!capProof && capProof.free > capProof.capped + 1000, JSON.stringify({ capped: capProof && capProof.capped, free: capProof && capProof.free }));
  check(`[15] ★ 框内滚起来后表头仍钉在框顶 (相对框顶 ${capProof && capProof.thTopRel}px ≈ 0), 而首行已移到 ${capProof && capProof.firstTopRel}px (真滚了, 不是没滚)`,
    !!capProof && Math.abs(capProof.thTopRel) <= 1 && capProof.firstTopRel < -100,
    JSON.stringify({ th: capProof && capProof.thTopRel, first: capProof && capProof.firstTopRel }));
  check(`[15] 框内滚到底可达 (最末一行不吊在半空), 且量完 DOM 行数回到原样 ${capProof && capProof.n0} 行 (这一节不把页面改脏)`,
    !!capProof && capProof.reachBottom === true && capProof.left === capProof.n0,
    JSON.stringify({ reachBottom: capProof && capProof.reachBottom, left: capProof && capProof.left, n0: capProof && capProof.n0 }));

  // ④ 390px: 上限跟着窄屏行高走 (那个字面量同样是实测值), 横向仍能滚 (列不被压扁)
  //    先回第 1 页 (上一段停在中间页) —— 窄屏要比的正是"同一页码下口径不因宽度换一套"。
  for (let i = 0; i < actExpPages; i++) {
    const v0 = await evalJs(pulseProbe('#pulse'));
    if (v0.act.prevDisabled === true) break;
    await clickAct('prev');
    await sleep(200);
  }
  await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await sleep(400);
  const mobAct = await evalJs(pulseProbe('#pulse'));
  const mb = mobAct.act.box;
  const mobSum = mb && mb.rowH ? +(mb.capH + mb.theadH + mobAct.act.rowCount * mb.rowH).toFixed(2) : null;
  check(`[15] 390px: 高度上限跟着窄屏行高走 (max-height ${mb && mb.maxH} ≈ caption+表头+${mobAct.act.rowCount}行 = ${mobSum}px)`,
    !!mb && mobSum != null && Math.abs(parseFloat(mb.maxH) - mobSum) <= 2,
    JSON.stringify({ maxH: mb && mb.maxH, sum: mobSum, rowH: mb && mb.rowH, rows: mobAct.act.rowCount }));
  check(`[15] 390px: 表框横向仍可滚 (scrollWidth ${mb && mb.scrollW} > clientWidth ${mb && mb.clientW}), 列不被压扁`,
    !!mb && mb.scrollW > mb.clientW, JSON.stringify({ sw: mb && mb.scrollW, cw: mb && mb.clientW }));
  check('[15] 390px: 分页栏仍在 (条数不变), 页信息与桌面一致 (不因窄屏换一套口径)',
    mobAct.act.ctlShown === true && mobAct.act.pageInfo === wantInfo(1),
    JSON.stringify({ shown: mobAct.act.ctlShown, info: mobAct.act.pageInfo }));
  await cdp('Emulation.clearDeviceMetricsOverride');
  await sleep(200);
  await fxDisable().catch(() => {});
  shouldIntercept = () => false;
  cMode = 'full';
  fxOff();

  // console 错误
  check('整轮访问无 console 错误 / 未捕获异常', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));

  console.log(`\n=== 结果: ${passed} passed, ${failed} failed, ${skipped} skipped ===`);
  console.log(`=== 其中「夹具错 · 未生效」(拦截没命中, 不代表页面有缺陷): ${fxFailures} 条 ===`);
  console.log(`=== 夹具自证纪律: 本节所有吃夹具的断言都在断言前跑过「送达证 + 链路证 + 消费证」; 显式跳过 ${skipped} 条 ===`);
  ws.close();
  proc.kill();
  try { fs.rmSync(userDir, { recursive: true, force: true }); } catch { /* noop */ }
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error('验收脚本异常:', e); process.exit(1); });
