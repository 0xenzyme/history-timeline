---
name: event-production
description: 用研究、综合、起草、校验和历史审核 subagent 生产历史事件；适用于“研究并添加某朝代重大事件”、恢复事件生产 Run 或处理事件审批 gate。
metadata:
  short-description: Agent-driven historical event production
---

# Agent-driven 事件生产

这个 Skill 是事件生产的入口层。真正的状态机、Run、checkpoint、候选 ledger、人工 gate 和 accepted-state 由 controller subagent 负责；当前对话只负责识别意图、启动或恢复 controller、展示结果和转发用户确认。

## 使用前读取

按需读取以下项目事实：

1. `AGENTS.md`
2. `docs/事件线规则.md`
3. `pipeline/PLAYBOOK.md` 的事件部分
4. `harness/README.md`
5. `harness/specs/event-agent-production.md`
6. 本 Skill 的 `references/contracts.md` 和 `references/roles.md`

本目录就是标准 project-local Skill discovery 路径 `.agents/skills/event-production/`。Skill 的角色合同和引用文件随仓库版本控制；不要把宿主缓存或全局安装目录当作事实来源。

## 入口意图

将用户请求归一为以下动作之一：

- `start`：创建新的事件生产 Run；
- `resume`：恢复指定或自动发现的 active Run；
- `approve-research`：批准研究候选集合并标记排除或 hold；
- `approve-publish`：批准已经通过 validator 和历史 reviewer 的 draft 集合；
- `cancel`：取消 Run 并保留 evidence；
- `status`：只读展示 Run、checkpoint、candidate ledger 和下一步。

自然语言可以触发动作，但涉及状态变更时必须让 controller 回显 Run id、revision、候选范围和即将发生的动作。含糊的“看起来可以”“继续吧”不能直接接受 gate。

## Controller 启动协议

当动作是 `start` 或 `resume` 时，当前 root 应创建或恢复一个专门的 controller subagent，并把以下内容作为 bounded context 传入：

- 用户归一化后的 `EventProductionRequest`；
- 当前 Run 路径、manifest、checkpoint revision 和下一步动作；
- `AGENTS.md`、事件规则、PLAYBOOK 事件部分和本 Skill 合同；
- controller 的读写范围和禁止的外部动作。

controller subagent 可以继续创建 research、synthesis、draft、validator 和 historian-reviewer worker。当前 root 负责等待 controller 结果、把 controller 的 gate 摘要展示给用户，并把用户的明确确认原样转发回同一个 Run。root 不应绕过 controller 直接研究、写 draft 或改变 published。

如果 app 重启或 controller 上下文不存在，Skill 重新创建 controller，并以 Run evidence、checkpoint 和 ledger 作为唯一恢复输入；不要依赖上一回合的聊天记忆。

## 默认生产线

事件 Run 固定使用四个 checkpoint stage：

```text
research -> draft -> validate -> publish
```

research 阶段按时期和领域并行调用 research worker，再由 synthesis worker 合并。全任务只设置一次 research approval；批准后 draft worker 只创建新的 `content/events/<id>.md`，并显式写 `status: draft`。validate 阶段同时运行确定性命令和独立历史 reviewer；第二次全任务 publish approval 通过后，controller 才能把 draft 改为 `published` 并编译。

## 角色边界

- `research`：Web-first 检索，回到 `raw/唐` 等本地原典核对；只返回带 URL、访问时间、claim 和不确定性的 `ResearchPacket`。
- `synthesis`：去重、canonical id、taxonomy、parent 和证据缺口；不能把未核实候选标为 approved。
- `draft`：只创建不存在的事件文件；不得覆盖文件、创建人物、修改迁移 manifest 或改变 published。
- `validator`：运行 `npm run events:check`、`npm run content:check`、`npm run build` 和 publish preview；只返回报告。
- `historian-reviewer`：只读审核收录闸门、史料冲突、分类、重复和人物引用；不改文件、不接受 gate。

所有 worker 输出必须带 `runId`、`inputHash`、`revision`。controller 拒绝 stale output，并且是唯一能够更新 Harness accepted state、gate、ledger artifact 状态和 published 状态的角色。

## 证据和生命周期

完整网页引用、摘录、claim mapping、review 和命令输出放在 `.harness/runs/<run-id>/evidence/`。canonical event 的 `sources` 继续只使用 `work`、`part`、`note`、`kind`；不要把 URL 直接塞入事件 frontmatter。

新的事件生产 ledger 与旧的 258 条迁移 manifest 分离。ledger 同时记录：

- `decision`：`candidate`、`evidence-needed`、`rejected`、`held`、`approved`；
- `artifact`：`none`、`draft`、`publish-ready`、`published`。

未知人物只进入 `unresolvedPeople`，不得猜 id 或自动启动人物生产线。已有 event id、alias、parent 或 source 冲突时暂停并记录原因。

## 外部动作边界

不自动 commit、push、deploy、release 或调用付费 API。发布只在明确的 publish approval 后执行；如果编译或文件状态不确定，进入 Harness reconciliation-required/blocked，不盲目重试。

详细合同见：

- [contracts.md](references/contracts.md)
- [roles.md](references/roles.md)
- [evidence.md](references/evidence.md)
