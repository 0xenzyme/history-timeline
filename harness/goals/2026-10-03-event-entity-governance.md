# Goal: 事件实体库治理与迁移准备

Spec: harness/specs/event-entity-governance.md
Checkpoint Policy: disabled
Status: completed.

## Source Task

- harness/tasks.md: P1 建立事件实体库治理与迁移 ledger

## Read First

1. AGENTS.md
2. docs/事件线规则.md
3. pipeline/PLAYBOOK.md
4. harness/README.md
5. harness/specs/event-entity-governance.md

## State Sync Notes

- 规则写明 `content/events/<id>.md` 是唯一 canonical source。
- 258 条旧 inline 输入保持冻结；manifest 记录 17 个专题的逐专题计数（总和 258）、4 个重复 id、6 组同名同年来源（其中 4 组重叠）和逐条 gates；重复 id 优先规则最终形成 6 个 primary groups。
- 未迁移任何事件，也未修改运行时代码、旧专题输入或生成数据。

## Required Gate Evidence

- Gate: spec
  - Required: yes
  - Evidence: `harness/specs/event-entity-governance.md`；`docs/事件线规则.md` 的 canonical、ledger、taxonomy 和迁移门槛章节。
  - Status: satisfied
  - Unblocker: N/A
- Gate: execution
  - Required: yes
  - Evidence: `pipeline/events-migration-manifest.json`；`pipeline/PLAYBOOK.md` 事件入口边界。
  - Status: satisfied
  - Unblocker: N/A
- Gate: integration
  - Required: yes
  - Evidence: JSON 解析与旧输入计数核对；事件实体迁移的 `events:check` / `content:check` 仍是后续批次 gate。
  - Status: satisfied
  - Unblocker: N/A

## Pause Conditions

- 没有可靠出处却要求批准事件。
- 重复事件无法判定 canonical identity。
- 需要修改编译器、UI 或删除冻结输入。
