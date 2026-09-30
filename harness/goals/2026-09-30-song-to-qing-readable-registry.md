# Goal: 补齐宋到清的可读底册

Spec: harness/specs/song-to-qing-readable-registry.md
Checkpoint Policy: disabled
Checkpoint Stages: []
Status: completed.

## Source Task

- `harness/tasks.md`: `P1 补齐宋到清的可读底册`

## Read First

1. `AGENTS.md`
2. `harness/tasks.md`
3. `harness/README.md`
4. `.harness/config.json`
5. `harness/status.md`
6. `harness/specs/song-to-qing-readable-registry.md`

## Work Mode Recommendation

Use `local` until the goal has a confirmed spec and clear file ownership.

## Execution Role

Use `implementer`.

- `gate-only`: the current thread reviews candidate output and verification evidence, but does not directly edit implementation files.
- `implementer`: the current thread may edit files inside the accepted scope.
- Controller means outcome owner and accepted-state owner. Use `gate-only` only when review-only behavior is explicit; otherwise a controller may implement foreground work.
- Ordinary clear change/build requests use the current host directly. This durable Goal uses only `gate-only` or `implementer` roles.
- `harness-rule:durable-tier-boundary`: ordinary clear change/build uses the current host directly; already tracked simple work may use one bounded postflight sync; Harness ceremony is reserved for recovery, audit, persistent state sync, milestones, DAGs, multiple workers, or high-risk control. Once this durable Goal exists, do not downgrade its checklist, gate, or state-sync obligations to the bounded tier.

## Host Execution

- For accepted long-running controller work, establish or reuse a compatible runtime outcome and use the host transient plan for current multi-step progress when those capabilities are exposed. Controller means outcome owner and accepted-state owner; only explicit review-only or gate-only direction prohibits foreground implementation.
- Runtime outcome owns the current outcome and continuation; transient plan owns short-lived steps.
- The host owns scheduling, concurrency, cancellation, and model/effort selection when those capabilities are exposed.
- Repository Goal/Run owns cross-task recovery, durable dependencies, evidence, gates, and state sync.
- If native outcome or plan is unavailable, continue in the current session and record degraded provenance only when this durable Run requires it. Never invent runtime identifiers.

## Conversation Route

Use `current-session`.

- `current-session`: the current conversation owns execution in the locked cwd.
- `delegated-worker`: hand off to a dedicated worker session before editing.
- `isolated-worktree`: the current conversation may control a different locked worktree only when explicitly approved.

## Execution Context Lock

- Conversation lane: `current-session`
- Controller thread: `current-session`
- Execution cwd: `D:\sites\history`
- Execution branch: `main`
- Execution slot: `N/A`
- Remote-control worktree: `no`

## Execution DAG

Use `run prepare` to generate `dag.json`, `dag.md`, and per-node
`agents/<node>/prompt.md` files. The host owns worker selection,
delegation, concurrency, and cancellation; Harness records ownership and evidence.

## Context Focus Routing

`harness-rule:project-neutral-core`: Normalize the durable target to `Milestone`, `Goal`, `Task`, `Run`, `Priority`, or `Spec`; adapters own downstream paths and facts while plugin core remains project-neutral. `harness-rule:path-containment`: configured writes, Goal/Spec references, Run arguments, and DAG artifacts stay inside configured roots after lexical and existing-parent realpath checks.

## Cybernetic Stability

`harness-rule:state-sync-evidence`: durable completion includes verified State Sync Notes and synchronization of the configured Goal, Task, Run, gate, and bounded status records.


## State Sync Notes

Record concrete accepted-state updates, Run evidence, and bounded status
synchronization before marking this Goal/Run completed.

- Accepted-state records: harness/goals/2026-09-30-song-to-qing-readable-registry.md completed; harness/tasks.md done.
- Run evidence: npm run content:check passed and npm run build passed on 2026-09-30.
- Bounded status update: harness/status.md records the closed cross-check.

## Spec Acceptance Checklist

- Item: `song-relations`
  - Acceptance: 宋专题里由章节或事件点名、且材料支持叙事边的人已经写入关系；其余人留在底册并记入 docs/song-relations.md。
  - Evidence: docs/song-relations.md；宋关系 39 增至 42；npm run content:check 通过（2026-09-30）
  - Status: `satisfied`
  - Unblocker: `N/A`
- Item: `qing-seats`
  - Acceptance: 清席位按 pipeline/PLAYBOOK.md 跑完，只收有可引用年份的人，并写入 docs/qing-seats.md。
  - Evidence: docs/qing-seats.md；底册 39 增至 57；npm run content:check 通过（2026-09-30）
  - Status: `satisfied`
  - Unblocker: `N/A`
- Item: `tang-ming-chancellors`
  - Acceptance: 唐、明宰辅年表已按现有席位说明对读；新入册的人满足席位和年份规则，两份席位说明已更新。
  - Evidence: docs/tang-seats.md 与 docs/ming-seats.md 的对读收口。许敬宗、来济已入册。没有卒年的人留在说明里，不编假年份。
  - Status: `satisfied`
  - Unblocker: `N/A`
- Item: `content-gate`
  - Acceptance: npm run content 已重写生成数据，npm run content:check 通过。
  - Evidence: 2026-09-30 npm run content:check 通过，16 个专题；npm run build 通过。
  - Status: `satisfied`
  - Unblocker: `N/A`

## Required Gate Evidence

These gates apply only to durable Goal/Run completion. Postflight sync verifies completed work and updates existing tracked state only. It creates no Goal, Run, DAG, gate, or status artifact solely for bookkeeping, and durable completion gates do not apply unless a durable Goal/Run is being closed.

- Gate: `spec`
  - Required: `yes`
  - Evidence: docs/song-relations.md、docs/qing-seats.md、docs/tang-seats.md、docs/ming-seats.md；npm run build 通过。
  - Status: `satisfied`
  - Unblocker: `N/A`
- Gate: `execution`
  - Required: `yes`
  - Evidence: docs/song-relations.md、docs/qing-seats.md、docs/tang-seats.md、docs/ming-seats.md；npm run build 通过。
  - Status: `satisfied`
  - Unblocker: `N/A`
- Gate: `integration`
  - Required: `yes`
  - Evidence: docs/song-relations.md、docs/qing-seats.md、docs/tang-seats.md、docs/ming-seats.md；npm run build 通过。
  - Status: `satisfied`
  - Unblocker: `N/A`

## Scope

- 按已接受 spec 依次完成宋的叙事关系、清的席位试跑、唐明宰辅对读；只收有出处和可引用年份的人，并用 `npm run content:check` 验证。

## Non-Goals

- 不新开辽、金、五代或十六国专题。
- 不批量补春秋到隋、南北朝的底册。
- 不改时间轴交互、开放条画法、JSON Schema 或设计文档全文。
- 不编造没有出处的年份。
- 不创建 branch、commit 或 push。
- Do not launch workers or perform external side effects outside the accepted scope unless separately requested.
- Do not make destructive changes without explicit user approval.
- Do not add project-specific assumptions to the core harness contract.

## Context

- Source: harness/tasks.md

- Notes: 不新开朝代，不批量补春秋到隋，不改界面。

## Project Adapter Requirements

- Read `harness/README.md` for project-specific hard boundaries, validation rules, preflight requirements, and state-sync requirements.
- If a linked Doc is a goal prompt, read the spec and context documents referenced by that goal before editing.
- Agent Harness plugin references: adapter-harness, task-routing, and work-mode-policy.
- Preflight: npm run content:check
- State sync: harness/tasks.md
- State sync: harness/status.md
- State sync: harness/goals


## Verification

```bash
npm run content
npm run content:check
npm run build
```

## Completion Conditions

- The source Goal/work item acceptance is satisfied.
- Verification commands pass or any failure is documented with next steps.
- State-sync evidence or State Sync Notes are produced as part of Goal/Task Done.
- Status-file updates use a bounded current-state snapshot; replace status
  sections instead of appending historical focus logs.
- Update configured state records (`harness/tasks.md`, `harness/status.md`) when the project adapter requires state sync.

## Pause Conditions

- The referenced spec or accepted scope is missing, unconfirmed, or conflicts with code, production constraints, or newer user instructions.
- The measurement snapshot cannot identify a reliable observed state, feedback quality is insufficient for completion, or the remaining gap is not shrinking.
- The work requires credentials, paid APIs, production access, destructive commands, release, or another external side effect outside accepted scope.
- Product direction, file ownership, or worktree policy is unclear.
- User gives new instructions that conflict with this goal.
