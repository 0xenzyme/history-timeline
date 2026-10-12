# Project Goals

Priority uses P0, P1, P2, or P3 only.

## Now

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
