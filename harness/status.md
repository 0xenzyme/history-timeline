# Project Status

harness-rule:bounded-status-snapshot: this file is a bounded current-state snapshot.

## Focus

- Current focus: 南北朝事件 Run `nanbeichao-events-20261004` 已发布完成（52 条事件 status: published，publish gate 已批准，manifest/checkpoint revision 5）；东汉 Run `donghan-events-20261004` 仍 publish-ready，待其发布 gate；宋代并发 Run 不在本 Run 范围。旧 inline 输入保持冻结。

## State

- Current phase: completed
- Authoritative Task/Goal: harness/goals/2026-10-04-event-agent-production.md
- Projection updated: 2026-10-05

## Verification

- Last command: npm run build
- Result: 南北朝 Run 发布批次通过——npm run content（编译收敛，wrote 22 files）、npm run events:check（213 事件）、npm run content:check（17 专题，index.json 一致）、npm run build 全部 exit 0。source-to-output 比对：52/52 id 在 events.json/military.json/history.json 中均为 published 且 catalogs 归属正确，parent 引用全部可解析。存量 warning（人物详表关系、旧事件两出处建议）保持非阻塞。

## Evidence

- `harness/specs/event-agent-production.md` and `harness/goals/2026-10-04-event-agent-production.md` record the new controller subagent ownership, four checkpoint stages, gate boundaries and deferred content production; Run evidence is `.harness/runs/20261004-024911-event-agent-production`.
- `harness/specs/event-workflow-implementation.md` remains the foundational event entity contract and now points agent-driven production to the new spec.
- `pipeline/events-migration-manifest.json` freezes 258 legacy inline snapshots, source digest, inventory and primary duplicate groups; `npm run events:migration:check` passes.
- `content/events/` has one canonical file per currently published event; `events:new` now creates draft-only records and `events:check` passes.
- 南北朝 Run `nanbeichao-events-20261004`：revision 5、stage publish、status completed；52 条事件已发布（含词表扩展 rouran/dongwei/xiwei/beiqi/beizhou/houliang，11 组 legacy duplicate 以 aliases 保留）；Run 证据见 `.harness/runs/nanbeichao-events-20261004/`（gates/、evidence/、candidate-ledger.jsonl、draft-manifest.json）。
- 东汉 Run `donghan-events-20261004` 仍为 publish-ready（8 个 draft），待其发布 gate，与本 Run 无关。
- 宋代并发 Run 的 draft 文件不在本 Run 范围，未触碰。
- `src/contract.ts`, `src/loader.ts` and `src/routing.ts` cover event-line validation, safe fallback and stable event-id links; `npm run build` passes.
- Browser smoke on the local Vite build confirmed stable event deep links, old-link canonicalization, invalid-event route miss and dual-catalog card navigation; console had no errors or warnings.

## Blockers

- No implementation blocker recorded.
- Next migration work is gated on evidence, canonical identity and reviewer decision; do not infer historical fields from the old inline shape.
