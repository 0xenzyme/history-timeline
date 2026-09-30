# Spec: 补齐宋到清的可读底册

Created: 2026-09-30
Status: accepted

## Decision

宋、元、明的底册已经入册，但阅读质量不齐。当前目标只做三件事，并按这个顺序做：先把宋的关系补到能读，再按席位规则补清，最后对读唐、明宰辅。不把人数检查线当成完成条件，也不新开朝代。

## Scope

- 宋：章节点名的人、事件参与者，以及现有关系已经点到的人，只要登记里的 bio 或出处能支持一条叙事边，就写入 `relations`，并写清 `note`。写不出叙事边的人留在底册，记入 `docs/song-relations.md`。不把“同时代”写成关系。
- 清：按 `pipeline/PLAYBOOK.md` 跑席位。只收有可引用生年或卒年的人。结果写入 `docs/qing-seats.md`，包括占了席位但没有年份、因此不收的人。
- 唐、明：对照 `docs/tang-seats.md` 和 `docs/ming-seats.md` 已点名的下一步，核宰相或宰辅年表。只补同时满足席位规则、且有可引用年份的人，并更新这两份说明。
- 人物生卒只写在 `pipeline/registry/people/`。专题只改泳道、文案、关系和事件。改完运行 `npm run content`，使 `public/data/` 与源文件一致。

## Non-Goals

- 不新开辽、金、五代或十六国专题。
- 不批量补春秋到隋、南北朝的底册。
- 不改时间轴交互、开放条画法、JSON Schema 或设计文档全文。
- 不编造没有出处的年份，不用一个整数假装精确。
- 不创建 branch、commit 或 push。

## Durable Control Invariants

- `harness-rule:path-containment`
- `harness-rule:run-dag-ownership`
- `harness-rule:candidate-accepted-evidence`
- `harness-rule:authoritative-completion-state`
- `harness-rule:state-sync-evidence`
- `harness-rule:bounded-status-snapshot`
- `harness-rule:project-neutral-core`
- `harness-rule:durable-tier-boundary`

## Host Execution

- 当前会话是 controller，角色是 `implementer`，工作方式是 `local`。
- 直接改 `D:\sites\history` 的当前 checkout。
- 长时间结果用 runtime outcome；眼前步骤用 transient plan。

## Acceptance Criteria

- 宋的章节人物和事件参与者，要么有一条写明原因的叙事关系，要么在 `docs/song-relations.md` 里说明为什么没有。
- 清的席位试跑写完。新入册的人有出处，没有年份的人不入册。
- 唐、明宰辅对读写完。新入册的人符合席位规则和年份规则。
- `npm run content:check` 通过。完成前再跑 `npm run build`。

## Spec Acceptance Checklist

- Item: `song-relations`
  - Acceptance: 宋专题里由章节或事件点名、且材料支持叙事边的人已经写入关系；其余人留在底册并记入 `docs/song-relations.md`。
  - Evidence: `TBD`
  - Status: `pending`
  - Unblocker: `N/A`
- Item: `qing-seats`
  - Acceptance: 清席位按 `pipeline/PLAYBOOK.md` 跑完，只收有可引用年份的人，并写入 `docs/qing-seats.md`。
  - Evidence: `TBD`
  - Status: `pending`
  - Unblocker: `N/A`
- Item: `tang-ming-chancellors`
  - Acceptance: 唐、明宰辅年表已按现有席位说明对读；新入册的人满足席位和年份规则，两份席位说明已更新。
  - Evidence: `TBD`
  - Status: `pending`
  - Unblocker: `N/A`
- Item: `content-gate`
  - Acceptance: `npm run content` 已重写生成数据，`npm run content:check` 通过。
  - Evidence: `TBD`
  - Status: `pending`
  - Unblocker: `N/A`

## Required Gate Evidence

- Gate: `spec`
  - Required: `yes`
  - Evidence: `TBD`
  - Status: `pending`
  - Unblocker: `N/A`
- Gate: `execution`
  - Required: `yes`
  - Evidence: `TBD`
  - Status: `pending`
  - Unblocker: `N/A`
- Gate: `integration`
  - Required: `yes`
  - Evidence: `TBD`
  - Status: `pending`
  - Unblocker: `N/A`

## Verification

- `npm run content`
- `npm run content:check`
- `npm run build`

## State Sync

- Records: `harness/tasks.md`, `harness/status.md`, `harness/goals`
- Evidence: 每完成一个 checklist item 就更新 Goal 与 status。

## Pause Conditions

- 材料给不出年份，而不收这个人会让某一章已经点名的结构塌掉。
- 同一人该复用旧登记还是新建，现有登记无法判断。
- 继续做下去必须改写 `pipeline/PLAYBOOK.md` 的席位规则。
- Spec 与更新的指令冲突，或需要凭据、付费接口、生产操作、破坏性命令。
