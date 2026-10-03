# Project Status

harness-rule:bounded-status-snapshot: this file is a bounded current-state snapshot.

## Focus

- Current focus: Agent-driven 历史事件生产线基础设施已完成；下一步是带人工 gate 的 bounded 唐朝 pilot。旧 inline 输入保持冻结。

## State

- Current phase: completed
- Authoritative Task/Goal: harness/goals/2026-10-04-event-agent-production.md
- Projection updated: 2026-10-04

## Verification

- Last command: npm run build
- Result: Agent-driven production infrastructure completed; config/Goal/Run/checkpoint validation, event/migration/content checks, build and diff check passed. Existing people/content warnings remain non-blocking. Actual 258-event migration and Tang content pilot remain deferred.

## Evidence

- `harness/specs/event-agent-production.md` and `harness/goals/2026-10-04-event-agent-production.md` record the new controller subagent ownership, four checkpoint stages, gate boundaries and deferred content production; Run evidence is `.harness/runs/20261004-024911-event-agent-production`.
- `harness/specs/event-workflow-implementation.md` remains the foundational event entity contract and now points agent-driven production to the new spec.
- `pipeline/events-migration-manifest.json` freezes 258 legacy inline snapshots, source digest, inventory and primary duplicate groups; `npm run events:migration:check` passes.
- `content/events/` has one canonical file per currently published event; `events:new` now creates draft-only records and `events:check` passes.
- `src/contract.ts`, `src/loader.ts` and `src/routing.ts` cover event-line validation, safe fallback and stable event-id links; `npm run build` passes.
- Browser smoke on the local Vite build confirmed stable event deep links, old-link canonicalization, invalid-event route miss and dual-catalog card navigation; console had no errors or warnings.

## Blockers

- No implementation blocker recorded.
- Next migration work is gated on evidence, canonical identity and reviewer decision; do not infer historical fields from the old inline shape.
