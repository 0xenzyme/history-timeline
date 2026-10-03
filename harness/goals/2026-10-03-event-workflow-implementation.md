# Goal: 实施新增历史事件工作流

Spec: harness/specs/event-workflow-implementation.md
Checkpoint Policy: disabled
Status: completed.

## Source Task

- `harness/tasks.md`: `P1 实施新增历史事件工作流九项修改`

## Controller

- Conversation route: `current-session`
- Controller: current thread
- Work mode: `local`
- No branch, commit, push, deploy or publish.

## Read First

1. `AGENTS.md`
2. `docs/事件线规则.md`
3. `pipeline/PLAYBOOK.md`
4. `harness/README.md`
5. `harness/specs/event-workflow-implementation.md`

## Work Mode and Execution Context

- Work mode: local current checkout; no remote-control worktree.
- Conversation route: `current-session`; controller thread owns accepted state and integration gates.
- Execution branch: existing checkout; no branch was created.
- Delegated ownership: lifecycle (`event_lifecycle`), runtime (`event_runtime`), governance (`event_governance`); controller owns cross-file integration, manifest freeze checker, generated data and final state sync.

## Checklist

- [x] canonical source、旧 inline freeze、逐条 migration manifest
- [x] draft lifecycle、发布占位符 gate、未知字段不静默丢弃
- [x] 时间端点、无零年、war/point 约束和 accuracy/note
- [x] 事件—人物年份/政权/引用交叉校验
- [x] `validateEventLine` 与 loader safe fallback
- [x] stable event-id route 与旧链接兼容
- [x] taxonomy/catalogs/dynasty filter 语义和 search/catalog 一致投影
- [x] integration checks and generated data
- [x] 258 条旧事件的迁移冻结、逐条 ledger、重复组和验收 gate（实际史料迁移另立批次）

## State Sync Notes

- 治理阶段已由 `harness/goals/2026-10-03-event-entity-governance.md` 记录并完成。
- 本 Goal 的实现改动仍在当前 checkout，未提交；生成数据由 content pipeline 重写。
- 最后一项完成的是“迁移冻结与可审计工作流”，不是 258 条事件的史料迁移；实际迁移必须另开受证据驱动的批次。
- 当前 checkout 仍保留用户原有的 Wang Mian dirty/untracked 改动；本 Goal 未回滚、清理或覆盖这些改动。

## Spec Acceptance Checklist

- Item: `canonical-and-ledger` — `content/events/<id>.md` canonical source、旧 inline freeze、258 条 manifest 和重复组。 Status: satisfied.
- Item: `lifecycle-and-lint` — draft/published、占位符、未知字段、时间端点、catalog 和跨实体 gate。 Status: satisfied.
- Item: `runtime-and-route` — event-line contract、safe fallback、stable event-id URL 和旧链接兼容。 Status: satisfied.
- Item: `integration` — 生成数据与 source pipeline 一致，未把史料迁移误报为完成。 Status: satisfied.

## Required Gate Evidence

- Gate: `spec` — `harness/specs/event-workflow-implementation.md` accepted；ownership DAG、non-goals 和 pause conditions 已记录。 Status: satisfied.
- Gate: `execution` — `pipeline/event-md.ts`、`pipeline/lint.ts`、`pipeline/event-migration.ts`、`src/contract.ts`、`src/loader.ts`、`src/routing.ts` 与 harness records 已落地。 Status: satisfied.
- Gate: `integration` — `npm run events:migration:check`、`npm run events:check`、`npm run content:check`、`npm run build` 和 `git diff --check` 均通过；人物既有 warning 单独保留。 Status: satisfied.

## Evidence

- `pipeline/events-migration-manifest.json` contains 258 frozen snapshots, source digest and duplicate groups.
- `content/events/` uses explicit lifecycle/catalog fields for the current five canonical records.
- `src/contract.ts` validates event line structure; `src/routing.ts` supports stable event URLs.

## Deferred Work

- 258 条旧事件仍未逐条迁入 `content/events/`；下一批次必须由历史专家按 manifest 补齐身份、出处、taxonomy、引用和 catalog 决策。
- 在证据和 reviewer decision 缺失时，条目保持 `frozen-inline` / `evidence-needed`，不得把生成数据或旧 inline 字段当作史料依据。

## Pause / Deferred

- No event is promoted from `evidence-needed` without a source and reviewer decision.
- The next migration batch must use the manifest and may not infer `polity` from dynasty overlap.
