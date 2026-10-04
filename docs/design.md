Design this website as a digital art exhibition, not as a conventional SaaS, startup, portfolio template, or landing page.

The website should feel like entering an artist's private visual world.

PRIMARY REFERENCES AND DESIGN DIRECTIONS:

1. Cargo-style experimental artist websites
- Free-form composition
- Editorial layouts
- Elements may overlap
- Avoid rigid card-based grids
- Typography and imagery should feel spatial
- The composition should resemble an art book, collage, gallery wall, or printed editorial publication

2. SiteInspire Art / Portfolio / Design & Art Direction
- Minimal visual language
- Strong art direction
- Large negative space
- Artwork is the primary visual element
- Typography should support the artwork rather than compete with it
- Use unusual layouts when they improve the artistic composition

3. Experimental interactive portfolios
- Consider subtle spatial interaction
- Scroll should feel like moving through an exhibition
- Images may gradually reveal themselves
- Hover interactions should feel tactile and intentional
- Motion should create atmosphere rather than visual noise

4. Contemporary museum / gallery websites
- Treat each artwork as an object
- Artwork metadata can appear like a museum label
- Title, year, medium, dimensions and concept should be presented with restraint
- Navigation should be quiet and secondary

CORE VISUAL PHILOSOPHY:

The website is not a container for images.

The website itself should become part of the artwork.

Think:

digital exhibition
+
artist's archive
+
interactive art book
+
experimental gallery

NOT:

SaaS dashboard
startup landing page
generic portfolio
template website
card grid
marketing website

LAYOUT:

Do not automatically use:
- Hero section
- Three-column cards
- Rounded cards
- Gradient blobs
- Large CTA buttons
- Standard navbar
- Generic footer
- excessive border-radius
- excessive shadows

Instead, explore:
- asymmetric composition
- full-screen artwork
- overlapping layers
- irregular spacing
- large typography
- extremely small metadata typography
- floating annotations
- vertical text
- off-grid elements
- unexpected image positions
- large negative space
- editorial page structures
- visual rhythm

ARTWORK PRIORITY:

My own artwork is the highest-priority visual asset.

Do not modify the artwork's colors, proportions, composition, or visual identity unless explicitly requested.

The UI must adapt itself to the artwork.

Do NOT force my artwork into generic cards.

Instead, allow the artwork to determine:
- spacing
- background tone
- typography contrast
- page rhythm
- image scale
- composition

The artwork should occupy significant visual space.

Some works can be almost edge-to-edge.

Others can appear small with enormous surrounding negative space.

The variation is intentional.

COLOR:

Do not automatically use trendy gradients.

Prefer a restrained palette derived from the artwork itself.

Possible directions:
- warm paper
- ivory
- charcoal
- black
- muted gray
- faded colors
- subtle monochrome
- occasionally a strong color extracted from the artwork

Use color as an artistic decision, not decoration.

TYPOGRAPHY:

Typography should feel editorial and artistic.

Combine:
- elegant serif typography for titles
- restrained sans-serif typography for metadata
- occasional oversized display typography

Typography should have hierarchy without looking like a corporate design system.

Avoid:
- excessive bold text
- oversized startup-style headings
- generic Inter-only layouts
- excessive uppercase labels

MOTION:

Animation should be slow, subtle and intentional.

Preferred:
- image reveal
- opacity transitions
- subtle parallax
- slow image movement
- masked image transitions
- typography appearing gradually
- gentle cursor interactions
- smooth page transitions

Avoid:
- excessive bouncing
- flashy particle effects
- unnecessary 3D
- excessive gradients
- animation on every element

The visitor should feel like they are moving through an exhibition.

INTERACTION:

Consider making the artwork itself interactive.

For example:

hover → artwork subtly changes scale or position

move cursor → hidden annotations appear

scroll → artwork transitions between layers

click → artwork expands into an immersive viewing mode

navigation → feels like turning pages of an art book

The interaction should reveal the artwork rather than distract from it.

STRUCTURE:

Possible information architecture:

HOME
    ↓
WORKS
    ↓
INDIVIDUAL ARTWORK
    ↓
ARCHIVE
    ↓
ABOUT / ARTIST
    ↓
CONTACT

However, do not make this structure visually obvious.

The website should feel discovered rather than navigated.

INDIVIDUAL ARTWORK PAGE:

Each artwork page should feel like entering the work.

Example structure:

[large artwork]

Title
Year
Medium
Dimensions

short conceptual text

[detail image]

[full artwork]

related works

The page should have substantial negative space.

Do not put everything inside a card.

ART DIRECTION:

Imagine the website was designed by:

a contemporary art director
+
a museum exhibition designer
+
an editorial designer
+
a digital artist

rather than a SaaS product designer.

The final result should feel:

quiet
intelligent
strange
beautiful
slightly mysterious
artistic
editorial
spatial
human

The website should have a recognizable visual identity even when all text and artwork are removed.

IMPORTANT:

Before implementing the final interface, analyze my uploaded artwork and derive the visual system from it.

Identify:
- dominant colors
- secondary colors
- visual density
- geometric vs organic characteristics
- texture
- emotional atmosphere
- spatial structure
- recurring motifs

Then construct the interface around those properties.

Do not impose a pre-existing template onto my artwork.

The artwork defines the website.

QUALITY BAR:

The final result should look like an independent contemporary artist's website or digital exhibition, not an AI-generated website template.

When uncertain between "more beautiful" and "more restrained", choose restraint.

When uncertain between "more UI" and "more artwork", choose artwork.

When uncertain between "more features" and "more atmosphere", choose atmosphere.

---

# v2 · 产品层(2026-10-01, leo)

> 需求原文:「这个项目目前不像是一个开源项目。1. 日志写得很糟糕,尤其是 README。2. 网页端 UI 设置得不好看,
> 没有突出重点主题。因此,你需要使用乔布斯的设计审美来重构一下。你还记得我最核心的设计是什么吗?
> 就是『**一万个智能体来帮助你**』。我后面的打算是让这些智能体在艺术层面上,让 C 端用户拥有更好的体验。
> 所以,可能还需要一些核心的理由,来让用户理解这是一个 C 端产品。不过,目前我个人的使用方法是来做『可控核聚变』。」
>
> 补充:「没有看清楚用户为什么要试用我们的产品,我们的特点也不清楚。」「网关页面那里有些太过混乱。」

## 0. v1 与 v2 的关系(不是替代)

```text
v1(上面全文)  管「气质」:艺术展的调子 · 作品决定容器 · 宁克制不华丽   → 保留, 不动
v2(本节)      管「主张」:为什么用它 · 凭什么信你 · 一眼看懂哪件事最重要   → 新增
```
**两者缺一不可**:只有 v1 = 好看但没人知道为什么要用(这正是当前产品的病);只有 v2 = 一个好懂的通稿。
**合成公式**:艺术的**调子** + 论文的**结构**。

## 1. 唯一主题(全站只许一个)

```text
主题句:一万个智能体,为你工作。   (Ten thousand agents, working for you.)
```
判据:把页面上所有装饰拿掉只留文字,陌生人能否在**第一屏**说出「我为什么要试它」?
**出现第二个并列主题 ⇒ 删掉它,或把它降级成这条主题的证据。**

本站现有各节在主题下的角色(它们**都是证据**,不是并列主题):

| 区块 | 它是哪一类证据 | 不许变成什么 |
|---|---|---|
| 序厅(主题句 + 三句理由) | 主张本身 | 不许堆技术名词 |
| 它能做什么 | 能力证据(可当场验证的短句) | 不许变成功能表 |
| 可售资产 / 技能 | 资产证据(可积累、可核对) | 不许罗列技能名 |
| **来源**(新增) | 可核查性证据 | 不许写成免责声明 |
| 关于 / Colophon | 谁在做 | 不许写成长篇自述 |

## 2. 首屏三件套(只许三件)

```text
① 一句话定义(最大字号)  —— 用户视角, 不出现实现名词(P2P / DHT / DID / OrbitDB / 微服务)
② 一个动作             —— 一条可复制的命令, 或一个 Get started
③ 一个证据             —— 数字 / 可打开链接 / 可自行核对的接口
```
第四件出现 ⇒ 砍,或下移到下一屏。

**技术词翻译表**(现场就用这张,别再泄内部语言):

| 内部说法 | 说给人听的 |
|---|---|
| 通过 DHT 发现节点 | 不用任何服务器,设备之间直接找到彼此 |
| DID 身份 | 它有自己的身份,你随时能验证是它 |
| 多智能体委派 | 一个活可以拆给几个智能体同时做 |
| 链上结算 | 干完有记录,可以被核对 |
| IPFS / IPNS 私有站 | 它写的东西存在自己名下,不经过别人 |

## 3. 「来源」区块的设计规矩(新增, 已在首页落地)

来源不是免责声明,是**证据**。每条来源必须同时给四样:

```text
① 出处(文件/接口名)  ② 是什么  ③ 口径(观察窗口/是否全量)  ④ 空的时候怎么说
```
现行五条来源(见 index.html `#provenance`):签名快照 · 链上索引 · 脉冲事件账 · 签名审计账 · npm registry。
**纪律**:空态用自己的语义说(「快照这次没读到」≠ 0);被撤下的旧口径长句**不许以可见正文回来**
(门的 `KILLED_PROSE` 钉着,连否定句也算);隐私边界写在**这一节**(可见),不当全站免责声明重复三遍。

## 4. 网关页的层级规矩(混乱类页面的专治, 已落地)

**乱 ≠ 内容多,乱 = 没有主次。** 三步:

```text
① 该页唯一目的: 让你的智能体接进网络(一句话写进页面顶部)
② 排序按「用户此刻要做什么」, 不按「系统里有什么」
③ 技术细节(数据来源 / 取数顺序 / 状态语义 / 观察范围 / 隐私边界 / 前端行为)收进 <details> 折叠
```
**现状对照**(2026-10-01):

| 项 | 改前 | 改后 |
|---|---|---|
| 首屏 | 直接是「链上活动」数据表 | 序厅:一句话 + 一个动作(拿命令)+ 一句「数字可自核」 |
| 两节同名 | 「加入方式」(02) 与「如何加入」(03) | 「一条命令接入」与「接入四步」 |
| 技术名词当标题 | 「manifest 与 capability」「端点 / 协议」 | 「它怎么知道别人会什么」「接得进来:端点与协议」 |
| 开发者说明 | 6 个 h3 全铺在主路径上 | 一个 `<details>` 折叠 |
| 保留 | 左(链上活动)· 右(接入命令)两栏版式 | 不动(门钉着的设计地基) |

## 5. 交付前三句自检(写进提交信息也行)

```text
① 陌生人第一屏能不能说出「我为什么要试」?   → 能 / 不能
② 一句话定义里有没有实现名词?                → 有 ⇒ 翻译成利益
③ 页面上并列主题 / 并列主按钮有几个?         → ≥2 ⇒ 砍到 1
```

## 6. 现状与缺口(如实, 2026-10-01)

**已落地**:首页主题句 + 三句理由 + 「来源」节(五条来源 · 口径 · 空态 · 自核命令)·
网关页序厅 + 两处同名消歧 + 技术标题翻译 + 开发者说明折叠 · 全站门 `verify-site.mjs` **线上 452 项全绿**。

**还没有**:① 安装页 `install.html` 未按同一套首屏规矩过一遍(仍是步骤说明开头);
② 文档区 `docs.html` 的「为什么用它」也还没写;③ 首页**没有一张产品截图/GIF**——现在全靠文字说服,
图是下一步最该补的证据(得是真截图,不是示意图);④ 英文页面的语气还没按主题句统一过一遍。
