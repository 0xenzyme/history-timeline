# Goal: 补齐唐朝之前的可读底册

Spec: harness/specs/pre-tang-readable-registry.md
Checkpoint Policy: disabled
Checkpoint Stages: []
Status: completed.

## Source Task

- harness/tasks.md: P1 补齐唐朝之前的可读底册

## Read First

1. AGENTS.md
2. harness/tasks.md
3. harness/README.md
4. .harness/config.json
5. harness/status.md
6. harness/specs/pre-tang-readable-registry.md
7. pipeline/PLAYBOOK.md

## Work Mode Recommendation

Use local in the current checkout. Do not create a branch, commit, or push.

harness-rule:durable-tier-boundary: this Goal keeps its checklist, gate, and state-sync obligations.

## Host Execution

- Controller implements in D:\sites\history on branch main.
- Runtime outcome owns the long-running result. Transient plan owns the current dynasty slice.

## Conversation Route

Use current-session.

## Execution Context Lock

- Conversation lane: current-session
- Controller thread: current-session
- Execution cwd: D:\sites\history
- Execution branch: main
- Execution slot: N/A
- Remote-control worktree: no

## State Sync Notes

- Accepted-state records: harness/tasks.md active; this Goal active.
- Run evidence: docs/qin-seats.md 26 增至 31；docs/zhanguo-seats.md 31 增至 37；docs/chunqiu-seats.md 22 增至 23。npm run build 通过（2026-09-30）。
- Bounded status update: harness/status.md records the pre-Tang seat pass complete.

## Spec Acceptance Checklist

- Item: sui-seats
  - Acceptance: 隋席位按本纪列传钉年。结果写入 docs/sui-seats.md。
  - Evidence: docs/sui-seats.md；底册 15 增至 22；npm run content:check 通过（2026-09-30）
  - Status: satisfied
  - Unblocker: N/A
- Item: nanbei-seats
  - Acceptance: 南北朝席位跑完，只收能钉住年份的人，并写入 docs/nanbei-seats.md。
  - Evidence: docs/nanbei-seats.md。底册 27 增至 59。
  - Status: satisfied
  - Unblocker: N/A
- Item: liangjin-seats
  - Acceptance: 两晋席位跑完，只收能钉住年份的人，并写入 docs/liangjin-seats.md。
  - Evidence: docs/liangjin-seats.md。底册 37 增至 50。
  - Status: satisfied
  - Unblocker: N/A
- Item: sanguo-seats
  - Acceptance: 三国席位跑完，只收能钉住年份的人，并写入 docs/sanguo-seats.md。
  - Evidence: docs/sanguo-seats.md。底册 56 增至 61。
  - Status: satisfied
  - Unblocker: N/A
- Item: han-seats
  - Acceptance: 东汉、西汉席位跑完，只收能钉住年份的人，并写入各自的席位说明。
  - Evidence: docs/donghan-seats.md，42 增至 48。docs/xihan-seats.md，34 增至 40。
  - Status: satisfied
  - Unblocker: N/A
- Item: preqin-seats
  - Acceptance: 秦、战国、春秋席位跑完，只收本传能钉住年份的人，并写入各自的席位说明。
  - Evidence: docs/qin-seats.md，26 增至 31。docs/zhanguo-seats.md，31 增至 37。docs/chunqiu-seats.md，22 增至 23。
  - Status: satisfied
  - Unblocker: N/A
- Item: content-gate
  - Acceptance: npm run content 已重写生成数据，npm run content:check 通过，完成前 npm run build 通过。
  - Evidence: npm run build 通过（2026-09-30）：tsc、pipeline tsc、content:check 16 个专题、vite build。
  - Status: satisfied
  - Unblocker: N/A

## Required Gate Evidence

- Gate: spec
  - Required: yes
  - Evidence: 隋到春秋的席位说明都已写入 docs。
  - Status: satisfied
  - Unblocker: N/A
- Gate: execution
  - Required: yes
  - Evidence: 秦、战国、春秋已按席位写入 pipeline，未改界面，未 commit。
  - Status: satisfied
  - Unblocker: N/A
- Gate: integration
  - Required: yes
  - Evidence: npm run build 通过（2026-09-30）。
  - Status: satisfied
  - Unblocker: N/A

## Pause Conditions

- 材料给不出年份，而不收这个人会让某一章已经点名的结构塌掉。
- 同一人该复用旧登记还是新建，现有登记无法判断。
- 继续做下去必须改写 pipeline/PLAYBOOK.md 的席位规则。
- Spec 与更新的指令冲突，或需要凭据、付费接口、生产操作、破坏性命令。
