# Project Status

harness-rule:bounded-status-snapshot: this file is a bounded current-state snapshot.

## Focus

- Current focus: 新增历史事件工作流九项修改已完成；旧 inline 输入保持冻结，等待按 manifest 分批迁移。

## State

- Current phase: completed
- Authoritative Task/Goal: harness/goals/2026-10-03-event-workflow-implementation.md
- Projection updated: 2026-10-04

## Verification

- Last command: npm run build
- Result: 2026-10-04 final revalidation passed: tsc, pipeline tsc, people check, events check, migration check, content check and Vite build; existing people warnings remain non-blocking. Actual 258-event historical migration is explicitly deferred.

## Evidence

- `harness/specs/event-workflow-implementation.md` and `harness/goals/2026-10-03-event-workflow-implementation.md` record the accepted scope, controller ownership, gates and deferred migration boundary.
- `pipeline/events-migration-manifest.json` freezes 258 legacy inline snapshots, source digest, inventory and primary duplicate groups; `npm run events:migration:check` passes.
- `content/events/` has one canonical file per currently published event; `events:new` now creates draft-only records and `events:check` passes.
- `src/contract.ts`, `src/loader.ts` and `src/routing.ts` cover event-line validation, safe fallback and stable event-id links; `npm run build` passes.
- Browser smoke on the local Vite build confirmed stable event deep links, old-link canonicalization, invalid-event route miss and dual-catalog card navigation; console had no errors or warnings.

## Blockers

- No implementation blocker recorded.
- Next migration work is gated on evidence, canonical identity and reviewer decision; do not infer historical fields from the old inline shape.
