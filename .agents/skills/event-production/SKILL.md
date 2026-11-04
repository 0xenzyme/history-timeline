---
name: event-production
description: 用研究、综合、起草、校验和历史审核 worker 生产历史事件；适用于“研究并添加某朝代重大事件”、恢复事件生产 Run 或处理事件审批 gate。
metadata:
  short-description: Agent-driven historical event production
---

# 事件生产

这个 Skill 是事件生产的唯一执行入口。controller 是一个角色，不是某一个宿主的子 agent 类型。它持有 Run、checkpoint、候选 ledger、人工 gate 和 published 状态。

执行本技能时不把本地 `.harness/archive/` 中的历史 Harness 文档当作内容规则源，也不运行 agent-harness。`.harness/runs/` 是本机存放 Run 文件和证据的目录。若宿主同时运行一个显式 Goal，Harness 只负责外层状态与证据同步，不改变本 Skill 的内容边界。

## 使用前读取

1. `AGENTS.md`
2. `docs/事件线规则.md`
3. `pipeline/PLAYBOOK.md` 的事件部分
4. 本 Skill 的 `references/contracts.md`、`references/roles.md`、`references/evidence.md`

本目录是 `.agents/skills/event-production/`。角色合同以这里的文件为准。只有 Codex 读取 `agents/openai.yaml`。其他宿主只读本文件的 `name` 和 `description`。

## 入口意图

将用户请求归一为以下动作之一：

- `start`：创建新的事件生产 Run；
- `resume`：恢复指定或自动发现的 active Run；
- `approve-research`：批准研究候选集合并标记排除或 hold；
- `approve-publish`：批准已经通过 validator 和历史 reviewer 的 draft 集合；
- `cancel`：取消 Run 并保留 evidence；
- `status`：只读展示 Run、checkpoint、candidate ledger 和下一步。

状态变更前，controller 先展示 Run id、revision、候选范围和即将发生的动作。含糊的“看起来可以”“继续吧”不能直接接受 gate。

## 谁担任 controller

controller 必须同时能做两件事：向用户提问，启动 worker。做不到这两件事的子 agent 不能担任 controller。

| 宿主 | 提问工具 | controller | 启动 worker |
| --- | --- | --- | --- |
| Grok | `ask_user_question` | 根 agent | 根 agent 调用 `spawn_subagent` |
| Codex | `request_user_input` 或 `request_user_input_async` | 根 agent，或一个能提问且能再启动 worker 的子 agent | 担任 controller 的那个 agent |
| Claude | `AskUserQuestion` | 能提问且能启动 worker 的那个 agent | 同一个 agent |

Cursor、ZCode、CodeBuddy 不另写选项。它们用自己的提问工具，并遵守上面的角色规则。

Grok 的一次 gate 只给四个选项：批准建议名单、批准但排除补充里点名的条目、先补证据、暂停。候选 id 写在问题正文里，或指向 `artifacts/candidate-summary.md`。四个选项以外的自由文本只作补充。自由文本本身不是批准。

用户不回答，或工具返回空，都不是批准。checkpoint 停在当前 stage。这条规则也适用于 Codex：空回答不能按最佳判断继续。

提问工具的原始返回值形状可以不同。controller 把它写成 `references/contracts.md` 里的 gate 记录后，才能推进 checkpoint。记录写入之前，不向用户发送已批准的结论，也不要求用户粘贴 JSON。

## 启动和恢复

`start` 或 `resume` 时，担任 controller 的 agent 读取：

- 用户归一化后的 `EventProductionRequest`；
- 当前 Run 路径、manifest、checkpoint revision 和下一步动作；
- 上面的项目事实和本 Skill 合同；
- 自己的读写范围。worker 只写分配给它的 evidence。

controller 启动 research、synthesis、draft、validator、historian-reviewer。根 agent 担任 controller 时，仍然把检索和起草交给 worker，不在根对话里直接研究、写 draft 或改 published。

worker 把长证据写入 Run 目录。controller 只读取 synthesis、ledger 和 gate 需要的摘要。

会话中断后，从该 Run 的 manifest、checkpoint、ledger 和 evidence 恢复。不把上一回合的聊天当作 gate 决定。

## 默认生产线

事件 Run 固定使用四个 checkpoint stage：

```text
research -> draft -> validate -> publish
```

research 阶段按时期和领域并行调用 research worker，再由 synthesis worker 合并。全任务只有一次 research approval。research approval 通过后，draft worker 只创建新的 `content/events/<id>.md`，并写 `status: draft`。validate 阶段同时运行确定性命令和独立历史 reviewer。第二次 publish approval 通过后，controller 才能把 draft 改为 `published` 并编译。

某个 stage 的暂停条件、以及外部文件或命令结果对不上时如何停止，写在 `references/evidence.md`。

## 角色边界

- `research`：Web-first 检索，回到 `raw/唐` 等本地原典核对；只返回带 URL、访问时间、claim 和不确定性的 `ResearchPacket`。
- `synthesis`：去重、canonical id、taxonomy、parent 和证据缺口；不能把未核实候选标为 research-approved。
- `draft`：只创建不存在的事件文件；不得覆盖文件、创建人物、修改迁移 manifest 或改变 published。
- `validator`：运行 `npm run events:check`、`npm run content:check`、`npm run build` 和 publish preview；只返回报告。
- `historian-reviewer`：只读审核收录闸门、史料冲突、分类、重复和人物引用；不改文件、不接受 gate。

所有 worker 输出必须带 `runId`、`inputHash`、`revision`。controller 拒绝不匹配的结果。只有 controller 能更新 checkpoint、gate、ledger 和 published 状态。

## 证据和生命周期

完整网页引用、摘录、claim mapping、review 和命令输出放在 `.harness/runs/<run-id>/evidence/`。canonical event 的 `sources` 继续只使用 `work`、`part`、`note`、`kind`。不要把 URL 写入事件 frontmatter。

新的事件生产 ledger 与旧的 258 条迁移 manifest 分离。ledger 同时记录：

- `decision`：`candidate`、`evidence-needed`、`rejected`、`held`、`research-approved`、`publish-approved`；
- `artifact`：`none`、`draft`、`publish-ready`、`published`。

`research-approved` 只允许创建 draft；`publish-approved` 只允许把 draft 改为 published。不得用单独一个 `approved` 表示任一阶段。迁移 manifest 使用单独的 `migration-approved`；它不属于本条生产 ledger。

未知人物只进入 `unresolvedPeople`，不得猜 id 或自动启动人物生产线。已有 event id、alias、parent 或 source 冲突时暂停并记录原因。

## 外部动作边界

不自动 commit、push、deploy、release 或调用付费 API。发布只在明确的 publish approval 后执行。编译结果或文件状态对不上时，按 `references/evidence.md` 停止并记录原因，不重试，不删除意外文件。

详细合同见：

- [contracts.md](references/contracts.md)
- [roles.md](references/roles.md)
- [evidence.md](references/evidence.md)
