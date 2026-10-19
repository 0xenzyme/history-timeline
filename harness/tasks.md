# Project Goals

Priority uses P0, P1, P2, or P3 only.

## Now

- [ ] P1 全站 review 修复批次（2026-10-19，未 commit）
  - Type: development
  - Status: in-review
  - Spec: docs/前端重设计.md
  - Acceptance: 闸门与文档纠偏已 commit（730b38c、5d2f94b、fdc76e3、5ddb71b）；`src/` 五处交互修复、事件出处本机路径清洗、`[*_SOURCE_LOCAL_PATH]` 闸门与 `docs/前端重设计.md` 第二节改写须通过 `npm run build`。
  - Notes: 五处交互修复只有 `decodeHash` 有可执行验证（esbuild bundle + Node 冒烟，17 条断言全过）；章节 URL、事件条命中、事件条开关、跨专题跳转四项要 In-app Browser 可见窗口复验，本机该窗口 `innerWidth=0`、`visibilityState=hidden`，`requestAnimationFrame` 不触发，画布尺寸恒为 0。出处清洗实测：`raw/` 与 `file:///` 103 处、抽取文件名 110 处，产物里 `file:///` 从 50 处降到 0。

- [ ] P2 事件人物引用的口径裁决
  - Type: review
  - Status: need-user
  - Spec: docs/事件线规则.md
  - Acceptance: 对 `[EVENT_PERSON_POLITY]` 143 条与 `[EVENT_PERSON_DATE]` 11 条给出「降噪」或「改数据」的裁决；判据本身冲突时改 `pipeline/lint.ts`，不改数据。
  - Notes: 143 条分解为 48（`lint.ts:516` 用 `commanders.side` 比人物 `polity`，而 `lint.ts:480-490` 只允许 `side` 取 `belligerents` id，军事事件上两者不可能同时满足）+ 65（兴起期与伞形词条，PLAYBOOK 已规定）+ 16（事件 `polity` 少写涉事方，取决于 `docs/事件线规则.md:72`「所属政权」的读法）+ 8（`minbian` 能否进非军事事件 `polity`）+ 3（词表无复合 id `chu-han`）+ 2（确属标错，本批已修）。11 条 date 中 8 条是「过程事件只锚终点」与「`death` 被当可见年份」的口径产物。

- [x] P1 实施 Agent-driven 历史事件生产线
  - Type: development
  - Status: completed
  - Spec: harness/specs/event-agent-production.md
  - Goal: harness/goals/2026-10-04-event-agent-production.md
  - Acceptance: Skill、controller/worker 合同、Harness 四阶段 checkpoint、Run evidence 和 publish preview 落地；不生产具体唐朝事件，不修改 258 条冻结输入。
  - Notes: Run `.harness/runs/20261004-024911-event-agent-production` 完成；config/Goal/Run/checkpoint、events:check、migration check、content:check、build 和 diff check 通过。Python quick validator 因 PyYAML 缺失未运行，Node YAML/resource check 通过。下一步是有人工 gate 的 bounded Tang pilot。

## Next

- [ ] P1 按 manifest 分批迁移旧事件的史料与 canonical 实体
  - Type: research-and-development
  - Status: pending-evidence
  - Spec: docs/事件线规则.md
  - Goal: 另立受证据驱动的事件迁移批次
  - Acceptance: 每批有唯一 canonical id、可回溯出处、重复/alias 决策、人物与 catalog 引用 gate，并通过 events:check、content:check、build 和 source-to-output 对账；未决条目不得发布。
  - Notes: 258 条旧 inline 输入继续冻结；不得从旧字段或 dynasty overlap 猜测 polity。

## Later

## Done

- [x] P1 把原型前端方案落到正式版
  - Type: development
  - Status: completed
  - Spec: docs/前端重设计.md
  - Goal: 无独立 Goal 文件，随线程直接执行
  - Acceptance: `prototype/1008/dual` 的布局与双皮肤进入 `src/`；数据只经 `src/loader.ts`；内容线 / 专题 / 章节 / 深链 / 搜索 / 卡片 / 泳道 / 事件条 / PNG 与 SVG 导出可用；`npm run build` 通过。
  - Notes: 删除被取代的 SVG 渲染器与旧 UI（`src/timeline/`、`src/ui/`、`src/export.ts`、`src/format.ts`）。SVG 导出暂为位图内嵌；分类 / 政权多选筛选与列表视图未做，记录在 `docs/前端重设计.md` 第九节。

- [x] P1 建立事件实体库治理与迁移 ledger
  - Type: development
  - Status: completed
  - Spec: harness/specs/event-entity-governance.md
  - Goal: harness/goals/2026-10-03-event-entity-governance.md
  - Acceptance: 明确 canonical source、冻结旧 inline 输入、候选/审核状态、重复 alias、taxonomy/catalog 语义和逐条迁移 gate；manifest 盘点 258 条旧事件，不凭空迁移。
  - Notes: 未修改 content/events、src、编译器或旧专题 events；后续实体迁移须按 manifest 分批验收。

- [x] P1 实施新增历史事件工作流九项修改
  - Type: development
  - Status: completed
  - Spec: harness/specs/event-workflow-implementation.md
  - Goal: harness/goals/2026-10-03-event-workflow-implementation.md
  - Acceptance: 生命周期、证据/时间闸门、跨实体校验、事件线契约、稳定路由、taxonomy/catalog 语义和迁移冻结均落地；events:migration:check、events:check、content:check 与 build 通过；258 条史料迁移另行分批。
  - Notes: 当前 thread 为 controller；改动仍未 commit/push/deploy；实际史料迁移保持 deferred。

- [x] P1 补齐唐朝之前的可读底册
  - Type: development
  - Status: done
  - Spec: harness/specs/pre-tang-readable-registry.md
  - Goal: harness/goals/2026-09-30-pre-tang-readable-registry.md
  - Acceptance: 从隋起向前做南北朝、两晋、三国、两汉、秦、战国、春秋。只收本纪列传能钉住年份的人，每朝写席位说明，并用 npm run content:check 验证。
  - Notes: 不新开辽金五代，不改界面，不 commit。秦 26 增至 31，战国 31 增至 37，春秋 22 增至 23。npm run build 通过（2026-09-30）。


- [x] P1 补齐宋到清的可读底册
  - Type: development
  - Status: done
  - Spec: harness/specs/song-to-qing-readable-registry.md
  - Goal: harness/goals/2026-09-30-song-to-qing-readable-registry.md
  - Acceptance: 按已接受 spec 依次完成宋的叙事关系、清的席位试跑、唐明宰辅对读；只收有出处和可引用年份的人，并用 npm run content:check 验证。
  - Notes: 不新开朝代，不批量补春秋到隋，不改界面。
