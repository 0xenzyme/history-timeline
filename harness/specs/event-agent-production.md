# Spec: Agent-driven 历史事件生产线

Created: 2026-10-04
Status: accepted

## Decision

Skill 只负责意图路由、规则加载、Run 启动/恢复和结果展示；专门的 controller subagent 负责事件生产状态机、worker 调度、checkpoint、候选 ledger、人工 gate、canonical 写入边界和最终状态同步。controller 不是常驻服务；每次恢复从 Harness Run 的 manifest、checkpoint、evidence 和 ledger 重建上下文。

事件实体仍以 `content/events/<id>.md` 为唯一 canonical source。旧的 `pipeline/topics/*/topic.json#events[]` 和 `pipeline/events-migration-manifest.json` 继续只服务冻结的 258 条迁移输入，不被新生产 Run 复用或扩写。

## Scope

1. 提供可自动发现的 project-local `event-production` Skill、角色合同和 evidence 说明。
2. 让事件 Run 使用 enforced checkpoint 的四个 stage：`research`、`draft`、`validate`、`publish`。
3. 按时期 × 领域调度 research worker，由 synthesis worker 生成 candidate ledger。
4. 全任务使用一次 research approval 和一次 publish approval；含糊自然语言不能直接改变 gate。
5. draft worker 只创建不存在的 `status: draft` 事件文件；已有 id、alias、parent、人物或政权冲突时暂停。
6. validator 与独立 historian reviewer 必须同时通过，事件才进入 publish-ready。
7. 完整网页引用、claim、review 和命令输出保存在 Run evidence；canonical `sources` 契约不增加 URL 字段。
8. 提供只读 `events:publish:check`，在不修改 canonical source 的前提下预演 draft 发布结果。

## Non-goals

- 不接 Agents API，不建立常驻后台服务。
- 不自动创建人物，不自动修改人物 registry 或 cards。
- 不从旧 inline 输入猜测年份、polity、catalog、人物或 parent。
- 不自动 commit、push、deploy、release 或调用付费 API。
- 不在本 Goal 中生产唐朝事件内容；先完成生产基础设施和 pilot 运行合同。

## Execution DAG / Ownership

- `event_skill`: Skill 入口、意图归一、controller 路由和用户 gate 展示；不写 canonical。
- `research_workers`: 按时期和领域只读检索，返回带 `runId`、`inputHash`、`revision` 的 ResearchPacket。
- `synthesis`: 合并 packet、去重、taxonomy、canonical id 建议和 evidence-needed 原因。
- `draft`: 只创建新的 `content/events/<id>.md`，显式写 `status: draft`。
- `validator`: 运行确定性检查和 publish preview，只返回 ValidatorReport。
- `historian_reviewer`: 只读返回 ReviewReport。
- `controller`: 唯一 accepted-state owner，负责 ledger、checkpoint、gate、published 和 state sync。

## Lifecycle Contract

- ledger `decision`: `candidate` → `evidence-needed|rejected|held|approved`。
- ledger `artifact`: `none` → `draft` → `publish-ready` → `published`。
- canonical frontmatter 只使用 `status: draft|published`。
- `approved` 只表示 research gate 已批准，不代表可以发布。
- `published` 只能在 publish gate 明确批准并完成 compile/build 后出现。

## Pause Conditions

- research evidence 不足、duplicate 未决或关键年份冲突。
- canonical id、alias、parent、人物或 polity 冲突。
- worker 输出的 run/revision/input hash 过期。
- validator 或 historian reviewer 未通过。
- 用户没有明确批准当前 gate。
- 外部状态不确定，需要 reconciliation-required。

## Verification

```bash
npm run events:publish:check -- --manifest <draft-manifest.json>
npm run events:migration:check
npm run events:check
npm run content:check
npm run build
```
