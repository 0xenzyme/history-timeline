# Goal: 实施 Agent-driven 历史事件生产线

Spec: `harness/specs/event-agent-production.md`
Checkpoint Policy: enforced
Checkpoint Stages: ["research", "draft", "validate", "publish"]
Status: completed

## Source Task

- `harness/tasks.md`: `P1 实施 Agent-driven 历史事件生产线`

## Controller

- Conversation route: current-session entry with a dedicated controller subagent.
- Controller: controller subagent; current thread/Skill only routes and displays gates.
- Work mode: local current checkout.
- No branch, commit, push, deploy or publish as part of this Goal.

## Work Mode Recommendation

Use `local` in the current checkout. The user designated the current session
as the entry controller and the implementation changes are limited to this
repository's Skill, Harness records and pipeline helper.

## Execution Role

Use `implementer`. The controller owns accepted state; worker roles return
candidate evidence and do not update Goal, Task, Run, gate or status state.

## Conversation Route

Use `current-session` as the entry route and a dedicated controller subagent
for event production. Do not create a branch or worktree.

## Execution Context Lock

- Conversation lane: `current-session`
- Controller thread: current session entry; controller subagent owns the event Run
- Execution cwd: `/Users/liuyj/project/sites/history-timeline`
- Execution branch: existing checkout
- Execution slot: `N/A`
- Remote-control worktree: `no`

## Read First

1. `AGENTS.md`
2. `docs/事件线规则.md`
3. `pipeline/PLAYBOOK.md`
4. `harness/README.md`
5. `harness/specs/event-agent-production.md`
6. `.agents/skills/event-production/SKILL.md`

## Scope

- Add the discoverable event-production Skill and role references.
- Add structured event production contracts and evidence layout.
- Enable project Harness checkpoint vocabulary while keeping global default disabled.
- Add deterministic `events:publish:check` without writing canonical files.
- Update the previous event workflow spec so its controller boundary matches the new subagent architecture.
- Validate the workflow infrastructure; do not create Tang event content in this Goal.

## Acceptance Criteria

- `agent-harness config validate --cwd .` passes with the adapter config.
- The Skill passes `quick_validate.py` and links all required references.
- The Goal validates with enforced checkpoint policy and finite stages.
- `run prepare` can generate a Run packet with the four declared stages.
- `events:publish:check` rejects missing manifests, stale hashes, existing non-draft files and lint errors without modifying source files.
- Existing `events:check`, `events:migration:check`, `content:check` and `build` remain green.
- No event content, old inline source or migration manifest is changed by this Goal.

## Required Gate Evidence

- Gate: `spec`
  - Required: yes
  - Evidence: This Goal references the accepted event-agent-production spec and the existing event entity rules.
  - Status: satisfied
  - Unblocker: N/A
- Gate: `execution`
  - Required: yes
  - Evidence: Skill, role contracts, Harness configuration and publish preview are implemented and inspected.
  - Status: satisfied
  - Unblocker: N/A
- Gate: `integration`
  - Required: yes
  - Evidence: Config/Goal validation, Skill validation, event checks, content check and build pass.
  - Status: satisfied
  - Unblocker: N/A

## Pause Conditions

- `.agents/skills` remains unavailable after the permission change.
- Harness config or checkpoint contract rejects the finite event stages.
- Publish preview would require mutating canonical files or generated data.
- Existing content validation fails for an unrelated pre-existing reason.
- The accepted spec conflicts with repository instructions or a newer user instruction.
- Work would require credentials, paid APIs, production access, deployment, release, push or PR.
- Work would require destructive deletion, rewriting frozen inline input or automatic publication.
- Product direction or an event admission decision requires historical expert judgment.

## Non-Goals

- Do not call Agents API or create a daemon.
- Do not research or publish concrete Tang events in this infrastructure Goal.
- Do not create people, cards or registry entries from event worker output.
- Do not change the 258-entry migration manifest or old topic inline events.
- Do not commit, push, deploy, release or publish.

## Verification

```bash
node /Users/liuyj/project/skills/agent-harness/plugins/agent-harness/scripts/agent-harness.mjs config validate --cwd . --json
node /Users/liuyj/project/skills/agent-harness/plugins/agent-harness/scripts/agent-harness.mjs goal validate --cwd . --goal harness/goals/2026-10-04-event-agent-production.md --json
node /Users/liuyj/.codex/skills/.system/skill-creator/scripts/quick_validate.py .agents/skills/event-production
npm run events:publish:check -- --manifest <draft-manifest.json>
npm run events:migration:check
npm run events:check
npm run content:check
npm run build
git diff --check
```

## Completion Conditions

- Required spec, execution and integration gates have fresh evidence.
- The Skill and all linked role/evidence references validate.
- The enforced Goal can prepare a Run with the four declared checkpoint stages.
- Publish preview is deterministic, read-only and rejects stale or conflicting drafts.
- Existing event, content and build checks pass.
- State Sync Notes identify changed files, verification commands, remaining pilot work and the fact that no event content was produced.

## State Sync Notes

Run: `.harness/runs/20261004-024911-event-agent-production`

Accepted infrastructure changes: project-local event-production Skill and role contracts, enforced four-stage checkpoint vocabulary, structured evidence layout, event-agent production spec/Goal, and deterministic `events:publish:check`.

Verification: config/Goal/Run/checkpoint validation, `npm run events:check`, `npm run events:migration:check`, `npm run content:check`, `npm run build`, `git diff --check`, and a stale/non-draft publish preview fixture passed. The Python Skill Creator quick validator was unavailable because PyYAML is not installed; Node YAML parsing and resource checks passed.

Remaining accepted work: run a bounded historical pilot (for example early Tang) with real research workers and human gates. No event content was produced by this Goal.
