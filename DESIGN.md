---
name: 兰台 Lantai
description: 纵横千年，人物相望
colors:
  paper: '#f5ebda'
  paper-raised: '#fff7e9'
  paper-sunken: '#efe0cb'
  ink: '#352519'
  ink-secondary: '#765e49'
  cinnabar: '#963b28'
  cinnabar-hover: '#7f2f20'
  bronze: '#806038'
  edge: '#cfb69b'
  edge-subtle: '#e2d2bd'
  wood: '#261a14'
  wood-raised: '#38251b'
  wood-text: '#ead5b7'
  gold: '#cf9b53'
  focus: '#1f5f8b'
  focus-on-dark: '#f2c879'
  info: '#33658a'
  success: '#3f6f4c'
  warning: '#8a5a16'
  error: '#963b28'
  event-military: '#b0442f'
  event-political: '#33658a'
  event-rebellion: '#8f4a55'
  event-institutional: '#3f7d52'
  event-diplomatic: '#6b5b95'
  event-cultural: '#a8763a'
typography:
  display:
    fontFamily: 'Lantai Serif, Noto Serif CJK SC, Songti SC, SimSun, serif'
    fontSize: '48px'
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: '0.08em'
  page-title:
    fontFamily: 'Lantai Serif, Noto Serif CJK SC, Songti SC, SimSun, serif'
    fontSize: '36px'
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: '0.05em'
  section-title:
    fontFamily: 'Lantai Serif, Noto Serif CJK SC, Songti SC, SimSun, serif'
    fontSize: '24px'
    fontWeight: 700
    lineHeight: 1.35
    letterSpacing: '0.03em'
  card-title:
    fontFamily: 'Lantai Serif, Noto Serif CJK SC, Songti SC, SimSun, serif'
    fontSize: '20px'
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: '0.01em'
  body:
    fontFamily: 'PingFang SC, Microsoft YaHei, Hiragino Sans GB, Noto Sans CJK SC, system-ui, sans-serif'
    fontSize: '16px'
    fontWeight: 400
    lineHeight: 1.75
    letterSpacing: '0em'
  ui:
    fontFamily: 'PingFang SC, Microsoft YaHei, Hiragino Sans GB, Noto Sans CJK SC, system-ui, sans-serif'
    fontSize: '14px'
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: '0em'
  data:
    fontFamily: 'PingFang SC, Microsoft YaHei, Hiragino Sans GB, Noto Sans CJK SC, system-ui, sans-serif'
    fontSize: '14px'
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: '0em'
    fontFeature: 'tnum'
rounded:
  none: '0'
  sm: '4px'
  md: '8px'
  lg: '12px'
  pill: '999px'
spacing:
  1: '4px'
  2: '8px'
  3: '12px'
  4: '16px'
  5: '20px'
  6: '24px'
  8: '32px'
  10: '40px'
  12: '48px'
  16: '64px'
components:
  button-primary:
    backgroundColor: '{colors.cinnabar}'
    textColor: '{colors.paper-raised}'
    typography: '{typography.ui}'
    rounded: '{rounded.md}'
    padding: '10px 16px'
    height: '44px'
  button-primary-hover:
    backgroundColor: '{colors.cinnabar-hover}'
    textColor: '{colors.paper-raised}'
    typography: '{typography.ui}'
    rounded: '{rounded.md}'
    padding: '10px 16px'
    height: '44px'
  button-secondary:
    backgroundColor: '{colors.paper-raised}'
    textColor: '{colors.cinnabar}'
    typography: '{typography.ui}'
    rounded: '{rounded.md}'
    padding: '10px 16px'
    height: '44px'
  card:
    backgroundColor: '{colors.paper-raised}'
    textColor: '{colors.ink}'
    typography: '{typography.body}'
    rounded: '{rounded.lg}'
    padding: '20px'
  input:
    backgroundColor: '{colors.paper-raised}'
    textColor: '{colors.ink}'
    typography: '{typography.body}'
    rounded: '{rounded.md}'
    padding: '10px 12px'
    height: '44px'
  chip:
    backgroundColor: '{colors.paper-sunken}'
    textColor: '{colors.ink-secondary}'
    typography: '{typography.ui}'
    rounded: '{rounded.pill}'
    padding: '4px 10px'
    height: '28px'
---

# 兰台设计系统

版本：2026-11-08 ｜ 状态：首版页面实现契约

## Overview

**Creative North Star：编年档案馆。**

兰台以深木色框架、宣纸色阅读面、朱砂操作色、青铜细节和水墨插画组织历史内容。视觉表达服从时间、人物和出处，不复刻古书，不用装饰替代信息。

年表是 Operate 工作区，目录是 Operate 发现界面，人物、事件、群像和朝代详情以 Read 为主，首页承担 Persuade 与导航。品牌表现集中在首页和页头；内容页保持精确、克制和可扫描。

**已固定的产品语义**

- 品牌为「兰台 Lantai」，副标题为「纵横千年，人物相望」。
- 主导航固定为「首页 · 年表 · 列传 · 群像 · 纪事 · 断代」。
- 群像是儒家、文学、书法等策展系列。成员资格与有证据的人物关系是两种数据。
- 首版不提供自动播放和二度关系。「巡航」只保留为现有皮肤名，不进入新导航。
- `temp/` 图片和 HTML 是构图参考，不是史实、功能或许可证据。

**规范索引**

| 文档                                                             | 规范责任                                           |
| ---------------------------------------------------------------- | -------------------------------------------------- |
| 本文件                                                           | tokens、视觉语言、页面骨架、十类路由映射和整体验收 |
| [组件规范](docs/design-system/components.md)                     | 通用组件、数据接口、真实样本、详情与时间轴行为     |
| [响应式与无障碍](docs/design-system/responsive-accessibility.md) | 断点、移动端交互、键盘、焦点、状态和减少动态效果   |
| [素材规则](docs/design-system/assets.md)                         | 图像、字体、许可、清单、性能和替代策略             |

领域语义以《兰台页面规格》和《兰台数据规格》为准。本文件只规定其视觉与交互表达，不改变实体、收录、日期或关系口径。

## Colors

### 表面与文字

| 语义 token      | CSS 变量              | 值        | 用途                          |
| --------------- | --------------------- | --------- | ----------------------------- |
| `paper`         | `--lt-paper`          | `#f5ebda` | 页面底色、Canvas 底色         |
| `paper-raised`  | `--lt-surface`        | `#fff7e9` | 卡片、输入框、浮层正文        |
| `paper-sunken`  | `--lt-surface-sunken` | `#efe0cb` | 表头、筛选分组、非激活轨道    |
| `ink`           | `--lt-ink`            | `#352519` | 标题、正文、年份和图标        |
| `ink-secondary` | `--lt-ink-secondary`  | `#765e49` | 次要说明；纸色底对比度 5.13:1 |
| `edge`          | `--lt-border`         | `#cfb69b` | 结构边框，不单独表达状态      |
| `edge-subtle`   | `--lt-border-subtle`  | `#e2d2bd` | 分隔线和网格                  |

### 品牌与操作

| 语义 token       | CSS 变量            | 值        | 用途                                      |
| ---------------- | ------------------- | --------- | ----------------------------------------- |
| `cinnabar`       | `--lt-accent`       | `#963b28` | 主按钮、当前项、选中对象；纸色底 6.02:1   |
| `cinnabar-hover` | `--lt-accent-hover` | `#7f2f20` | 主按钮 hover／active                      |
| `bronze`         | `--lt-bronze-text`  | `#806038` | 纸色底辅助链接；纸色底 4.87:1             |
| `wood`           | `--lt-wood`         | `#261a14` | 顶栏、页脚、年表刻度带                    |
| `wood-raised`    | `--lt-wood-raised`  | `#38251b` | 深木色 hover 和选中底                     |
| `wood-text`      | `--lt-wood-text`    | `#ead5b7` | 深木色正文；对比度 11.85:1                |
| `gold`           | `--lt-gold`         | `#cf9b53` | 印章、当前导航下划线、装饰；深木底 6.83:1 |

浅色主按钮使用 `paper-raised` 文字，对 `cinnabar` 为 6.68:1。`gold` 不用于纸色底小字。`edge` 不用于正文。边框、图标和焦点指示等非文字元素至少达到相邻背景 3:1；达不到时增加高对比外框或形状。

### 状态色

| 状态     | token／值                                       | 表达规则                                      |
| -------- | ----------------------------------------------- | --------------------------------------------- |
| focus    | `focus: #1f5f8b`；深底 `focus-on-dark: #f2c879` | 2px 实线外环＋2px 偏移；不只改变底色          |
| info     | `info: #33658a`                                 | 信息图标和标题，正文仍用 `ink`                |
| success  | `success: #3f6f4c`                              | 成功图标和标题，配明确结果文字                |
| warning  | `warning: #8a5a16`                              | 异说、精度提示和非阻断警告，配文字            |
| error    | `error: #963b28`                                | 错误标题、边框和图标，配原因与恢复动作        |
| disabled | `ink-secondary`＋`paper-sunken`                 | 降低强调但保留可读性；同时设置原生 `disabled` |

### 事件色与 Canvas 协同

六类事件色沿用 `src/app/skins.ts`：`military #b0442f`、`political #33658a`、`rebellion #8f4a55`、`institutional #3f7d52`、`diplomatic #6b5b95`、`cultural #a8763a`。它们只用于节点、线段、徽记和图例底色。标签文字使用 `ink` 或深底 `wood-text`，并显示类型名称；军事用双线，政治用方形，民变用菱形，制度用圆形，盟约用六边形，文化用三角形。形状不能替代文字标签。

实现将现有映射扩展为一套语义变量，而不是维护第二份颜色：

1. 在 `src/styles.css` 定义上述 `--lt-*` 变量和现有 Canvas 专用变量。
2. DOM 只引用变量。`src/app/skins.ts` 的 token→变量映射读取同一组计算值。
3. 六类事件色保留一处导出，DOM 图例通过 `data-event-type` 与该导出映射，或在构建时由同一 TypeScript token 模块生成 CSS 变量。
4. 专题 lane 色继续来自 `pipeline/topics/<id>/topic.json`；它们是内容编排色，不进入全站语义色。
5. 缺少变量、非法颜色或 Canvas／DOM 主题错位时立即报错，禁止透明回退。
6. PNG／SVG 导出使用当前同一 palette 的解析结果。导出文件包含图例、时间窗和精度标识。

新版「编年档案馆」是目标主题。现有 `deepspace` 保持旧功能，但不得让旧主题变量反向污染新页面。

## Typography

标题使用本地 `Lantai Serif`，其来源和回退见《素材规则》。正文和控件使用系统黑体，不为正文下载大字库。字体加载失败不能改变信息层级或隐藏文字。

| 角色          | 桌面规格                 | 移动规格            | 用途                               |
| ------------- | ------------------------ | ------------------- | ---------------------------------- |
| display       | 48/58，700，字距 `.08em` | 36/44               | 首页品牌；详情不滥用               |
| page-title    | 36/45，700，字距 `.05em` | 30/38               | 页面和实体主标题                   |
| section-title | 24/32，700               | 22/30               | 一级内容区块                       |
| card-title    | 20/28，700               | 19/27               | 卡片、预览、模块标题               |
| body          | 16/28，400               | 16/28               | 叙事正文，行宽 32–38 个汉字        |
| body-small    | 14/24，400               | 14/24               | 摘要、来源和辅助资料               |
| ui            | 14/21，500               | 16/24（输入与菜单） | 按钮、筛选、tab、表单              |
| data          | 14/20，500，`tnum`       | 14/20               | 年份、计数、坐标；不得小于 12px    |
| caption       | 12/18，400               | 12/18               | 图片信用、非关键注释；不得用于正文 |

标题不使用全大写中文伪字距。英文 `LANTAI` 可使用 `.24em` 字距。长标题允许两行；卡片标题最多两行后省略，并提供完整可访问名称。正文禁止整段宋体低对比小字，禁止用字号低于 12px 解决拥挤。

## Layout

### 栅格与尺寸

- 使用 4px 基础单位。间距只用 frontmatter 的 4、8、12、16、20、24、32、40、48、64px。
- 阅读页容器最大 1440px，左右留白桌面 32px、平板 24px、手机 16px；正文列最大 760px。
- 桌面采用 12 栏，栏沟 24px；平板 8 栏、栏沟 20px；手机 4 栏、栏沟 16px。
- 顶栏桌面 68px、手机 56px。主内容不能落在固定顶栏下面。
- 按钮和输入框高 44px；触屏目标最小 44×44px。卡片圆角 12px，控件 8px，小标记 4px。
- 页面使用自然文档流。只有年表工作区可以使用视口高度的独立布局；禁止目录和详情按 900px 高度裁切。

### 页面骨架

| 骨架       | 桌面结构                                                          | 适用页面               |
| ---------- | ----------------------------------------------------------------- | ---------------------- |
| 品牌首页   | 顶栏 → 品牌／搜索 → 四栏目 → 推荐断代与群像 → 页脚                | 首页                   |
| 年表工作区 | 顶栏 → 专题工具条 → 左筛选＋Canvas＋右预览 → 可折叠朝代带         | 年表                   |
| 目录       | 页头＋栏目搜索 → 左筛选＋结果工具条／结果 → 分页                  | 列传、群像、纪事、断代 |
| 人物详情   | 返回与面包屑 → 身份栏＋主操作 → 主叙事项＋右关联栏 → 出处         | 人物详情               |
| 事件详情   | 返回与面包屑 → 事件头＋主操作 → 左页内导航＋正文＋右关联栏 → 出处 | 事件详情               |
| 系列／朝代 | 头部＋主操作 → 可用 tab → 主内容＋辅助栏                          | 群像系列、朝代总览     |
| 搜索结果   | 查询框 → 类型筛选 → 分组结果 → 分页或分组入口                     | `/search` 辅助路由     |

首屏装饰带在目录页最高 176px，在详情页最高 240px；手机取消大面积装饰带，保留标题、摘要和主操作。年表的工具和坐标优先于横幅。

### 层级与密度

| 层        | z-index 建议 | 内容                       |
| --------- | ------------ | -------------------------- |
| base      | 0–9          | 页面、纸张纹理、卡片       |
| sticky    | 20–29        | 顶栏、结果工具条、页内 tab |
| canvas-ui | 30–39        | Canvas 内提示和缩放控件    |
| overlay   | 50–59        | 抽屉、菜单、底部面板       |
| modal     | 60–69        | 阻断式 dialog              |
| toast     | 70–79        | 非阻断结果通知             |
| skip-link | 100          | 跳到主内容                 |

同一区域只保留一个主操作。卡片默认静态，不用浮起制造层级。密集数据区优先缩短装饰、合并次要字段和提供展开，不压缩年份与正文。

## Elevation & Depth

静止卡片以 1px 边框和纸色层次为主。允许两类阴影：

- `raised`: `0 2px 8px rgb(53 37 25 / 8%)`，只用于可点击卡片的 hover 和当前预览。
- `overlay`: `0 12px 32px rgb(38 26 20 / 18%)`，只用于菜单、抽屉和 dialog。

纸张纹理使用本地低对比平铺图，透明度不高于 4%。纹理不进入正文、年份和控件的文字层。水墨插画位于装饰区，不铺在数据密度高的 Canvas 后方。

焦点、选中和错误由边框、形状和文字表达，不能靠更深阴影区分。禁用浮层套浮层；详情预览之内不再打开第二层预览。

## Shapes

- 方形象征档案页和档案签，圆角只用于减轻屏幕边界，不使用仿竹简卷轴造型。
- 印章使用 40×40px 细框「蘭」字；它是品牌标识，不用于普通按钮或事实认证。
- 卡片圆角 12px，输入和按钮 8px，chip 为胶囊；时间轴节点保持精确几何形状。
- 边框默认 1px，当前导航和选中时间轴对象使用 2–3px，避免只换颜色。
- 箭头表示阅读顺序或链接方向；只有 `directed` 关系边才能使用方向箭头。Collection 成员序列不得用师承箭头连接。

## Components

组件结构、状态和真实数据样例见[组件规范](docs/design-system/components.md)。全站只使用一套按钮、输入、chip、卡片、分页、来源列表、日期标签和实体链接。组件必须实现 default、hover、focus-visible、active、selected、disabled、loading、empty、error 中适用的状态。

### 十类页面与组件映射

下表对应《兰台页面规格》的十类页面模板；`/search` 是共享辅助路由，不改变十类计数。

| 路由               | 页面骨架   | 必需组件                                                                                               | 状态   |
| ------------------ | ---------- | ------------------------------------------------------------------------------------------------------ | ------ |
| `/`                | 品牌首页   | `SiteHeader`、`GlobalSearch`、`NavCard`、`EraCard`、`CollectionCard`                                   | 已交付 |
| `/timeline`        | 年表工作区 | `TimelineToolbar`、`FilterPanel`、`TimelineCanvas`、`EntityPreview`、`DynastyBand`、`ExportMenu`       | 已交付 |
| `/people`          | 目录       | `DirectorySearch`、`FilterPanel`、`ResultToolbar`、`PersonCard`、`Pagination`                          | 已交付 |
| `/people/:id`      | 人物详情   | `PersonIdentity`、`DateRange`、`ExperienceList`、`EventList`、`WorkList`、`RelationList`、`SourceList` | 已交付 |
| `/collections`     | 目录       | `DirectorySearch`、`CategoryTabs`、`CollectionCard`、`Pagination`                                      | 已交付 |
| `/collections/:id` | 系列详情   | `CollectionHero`、`ViewTabs`、`MemberList`、`MemberTimeline`、`RelationView`、`PathSteps`              | 已交付 |
| `/events`          | 目录       | `DirectorySearch`、`FilterPanel`、`ResultToolbar`、`EventRow`、`Pagination`                            | 已交付 |
| `/events/:id`      | 事件详情   | `EventHero`、`FactList`、`EventTimeline`、`PeopleRoles`、`EventComposition`、`SourceList`              | 已交付 |
| `/eras`            | 目录       | `EraGroups`、`EraCard`、`OverlapNotice`                                                                | 已交付 |
| `/eras/:id`        | 系列／朝代 | `EraHero`、`ViewTabs`、`EraTimeline`、`FeaturedEntities`                                               | 已交付 |
| `/search`          | 搜索结果   | `GlobalSearch`、`EntityTypeTabs`、`SearchResultGroup`                                                  | 已交付 |

群像可达状态：`CollectionHero`、`ViewTabs`、`MemberList`、`MemberTimeline`、`RelationView`、`PathSteps`、相关纪事与作品视图已可用。tab 从 Collection 的 `views` 和 `defaultView` 生成；事件／作品尚无真实系列样本，不显示无数据 tab。成员详情按需并行加载，局部失败不覆盖系列正文。

### 实现接口

首版实施年表、人物详情、事件详情和可支撑往返的简版导航。组件输入来自 `src/loader.ts`，不得直接读取 `public/data`。最小边界为：

| 组件               | 必需输入                                    | 关键输出／行为                                                |
| ------------------ | ------------------------------------------- | ------------------------------------------------------------- |
| `TimelineCanvas`   | 当前 topic／catalog、时间窗、筛选、选中实体 | 选择实体、改变时间窗、恢复选中；无自动播放                    |
| `EntityPreview`    | `PersonDetail` 或 `EventRecord`、来源 URL   | 「查看详情」建立新历史项；保留来源上下文                      |
| `PersonDetailView` | `people/li-bai.json` 对应加载模型           | 经历、作品、关系和出处按字段存在性显示；`events: []` 不造事件 |
| `EventDetailView`  | `events/anshi-zhiluan.json` 对应加载模型    | `components` 与 `children` 分区；安史之乱保持 `rebellion`     |
| `DateRange`        | 年份、起止年、accuracy、note                | 精确／约／异说／不详一致显示；BCE 使用「前」                  |
| `SourceList`       | `SourceRef[]`                               | 典籍／现代考证／数据库分组，数据库标「检索线索」              |
| `ReturnLink`       | 应用内来源、回退 URL                        | 优先浏览器返回；直接打开时回退到可定位年表                    |

**唐代路径设计验收**

1. 在 1440×900、768×1024、390×844 和 320×568 检查 `/timeline?topic=tang&view=tianbao&person=li-bai&from=710&to=770`。时间轴无页面级横向溢出，李白为选中对象，预览和「查看详情」可用键盘与触屏到达。
2. 打开李白详情。显示 701–762、「入长安，供奉翰林」为约 742 年并保留 note、《蜀道难》不显示虚构创作年、人物 sources 就近可读。`events` 为空时不得出现安史之乱关联卡。
3. 从李白返回。恢复原 topic、view、from／to、筛选、选中人物、预览和可恢复的滚动位置；直接打开详情时回退到带 `person=li-bai` 的年表，而不是默认专题。
4. 独立进入安史之乱详情。标题显示 755–763 和 `民变`，不得因设计稿改称战争。`components` 至少显示香积寺之战、睢阳保卫战及各自 note／sources；军事 `parent/children` 与组成 `partOf/components` 使用不同标题和说明。
5. 从安史之乱返回其来源年表，或用「在年表中查看」定位 755–763。保留事件跨度和选中状态。若从李白详情进入安史之乱的入口不存在，不得为完成路径伪造入口；可通过年表或显式事件来源进入。
6. 所有路径在键盘下具有可见焦点和合理顺序，在 200% 文本缩放下不丢主操作；减少动态效果开启时不使用平滑惯性、自动平移或入场动画。
7. 验证加载、局部失败、非法 id、无关联、图片失败和缺失可选字段。核心数据缺失不回退为李白或安史之乱。

## Do's and Don'ts

### Do

- **Do** 把年份、实体名称、精度和出处放在装饰之前。
- **Do** 让 Canvas 与 DOM 读取同一语义色，并在导出中保留图例。
- **Do** 对 `approx`、`disputed`、`unknown` 使用文字和说明，不虚构精度。
- **Do** 将 Collection 成员、人物关系、事件军事层级和事件组成分别命名和呈现。
- **Do** 在窄屏重排信息并保留主任务；时间轴保留横向时间坐标。
- **Do** 用真实数据决定可选模块是否出现，并允许局部模块独立失败。

### Don't

- **Don't** 把 `temp/` 中的自动播放、知名度排序、二度关系、人物数量或示例史实带入实现。
- **Don't** 用浅色金棕小字、低对比纸纹或全图背景承载正文。
- **Don't** 用箭头连接普通 Collection 成员，或把成员顺序称为连续师承。
- **Don't** 把 `parent/children` 和 `partOf/components` 合并为「相关事件」。
- **Don't** 把整页做成固定高度截图，或用手机双指缩放替代可访问的按钮操作。
- **Don't** 在资料缺失时生成肖像、作品年份、朝代、经历、关系或出处。
