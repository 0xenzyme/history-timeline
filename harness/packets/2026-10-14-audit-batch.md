# 工作包（制度 / 文化 / 更替线三批）

仓库 D:\sites\history 的历史事件线。任务：按 `docs/review/07-分朝代缺口审计.md`（下称审计）的 5.3、5.4、5.5 补事件实体。范围 -2070 到 1949。**不得改 `public/data/`（生成物），不得手改 `content/events.md` 索引**（用 `npm run events:format` 生成）。

## 你要读的规范

1. `AGENTS.md` — 仓库总则与内容规则。
2. `docs/事件线规则.md` — 事件线规则，优先于 PLAYBOOK。
3. `pipeline/PLAYBOOK.md` — 内容体例（只读人物相关也读）。
4. `docs/review/07-分朝代缺口审计.md` — 第五节是本次缺口清单。
5. `content/_template-event.md` — 事件文件骨架。
6. 现有事件范文（**必须照抄其结构、字段、语气、sources 写法和正文风格**）：
   - 制度类：`content/events/sanzheng-liubu.md`、`content/events/yitiaobian-fa.md`、`content/events/keju-kaishi.md`
   - 文化类：`content/events/houshu-chengshu.md`、`content/events/longmen-shiku.md`
   - 政治更替：`content/events/liu-yu-dai-jin.md`、`content/events/xiao-yan-dai-qi.md`
7. 每年朝代改动前看现有 `content/events/` 同年代文件。

## 硬规则

- 一人一事件一文件；同 person id 只用一份文件；id 全局唯一，kebab-case ASCII。
- 每个事件必须存在 `content/events/<id>.md`，frontmatter 字段按模板；`status: published`。
- **年份必须先查库**：跑 `npm run events:check` 与本目录清单核对，`docs/review/07` 记的"库无"要逐条复核（用 Select-String 查 `content/events/` 与 `public/data/events.json`），确认真的没有才写；已有的一律不建，写进报告。
- 历史事实用通说纪年（如秦灭齐前 221、前赵立国 304）。拿不准的年份写 `yearAccuracy: approx` 或 `disputed` 加 `yearNote`/`endYearNote`，**不要编造**。
- `type` 用 `military | political | rebellion | institutional | diplomatic | cultural`；`catalogs` 入 `military`/`history`；`importance` 1—3；军事事件必须 `belligerents`（≥2 个，取 `pipeline/vocab/polities.json` 里的 id）、`commanders`。`people` 只能引库内已有 id（查 `pipeline/topics/<topic>/topic.json` 的 `people[]`）；引不到就在正文点名并注明"未入人物库"。
- `sources` 每条写 `kind: classic | modern | database`。`work`/`part` 用史书原名与卷次（例：`史记 / 卷004-周本纪.md`）。数据库只作线索，不单独支撑年份。
- 正文仿范例：一段 100—300 字左右的文言白话，叙经过、结果、意义；不写"暂无""待补"；不留问号占位。
- 若需新增 `polity` id，**不要改词表**，改用最近的合法 id 并在 frontmatter 保持自洽；把需要的 id 写进报告由我补。
- 写完后运行 `npm run events:format` 与 `npm run events:check`，把最终输出附在报告里。

## 产出

在你的工作目录 `D:\sites\history\content\events\` 下直接写 `<id>.md`（三个 agent 用各自的 id，无冲突）。报告请列：新建文件清单、每条 id / year / type / 不复建的理由、`events:check` 结果、仍需人工确认之处。
