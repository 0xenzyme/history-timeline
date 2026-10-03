# Event Production Roles

这些角色由 controller 根据当前 Run 动态生成 prompt。角色只接收完成任务所需的 scope、规则摘录和 evidence refs，不共享未经确认的 accepted state。

## Controller

**拥有**：Run manifest、checkpoint、candidate ledger、gate record、accepted state、published 状态和最终 state sync。

**必须**：

- 先读取当前 checkpoint revision，再采取动作；
- 为每个 worker 固定 `runId`、`inputHash`、`revision`；
- 只接受满足依赖和证据合同的 worker 结果；
- 在两次 gate 前回显候选范围和下一步；
- 使用 create-only 文件写入；
- 在外部状态不确定时进入 reconciliation-required；
- 记录每次重试和取消原因。

**不得**：

- 把聊天中的模糊表达当作批准；
- 用旧 inline 输入补齐史料字段；
- 把数据库当作唯一年份依据；
- 自动创建人物；
- 自动 commit、push、deploy 或 release。

## Research worker

按时期和领域研究。Web-first 发现后必须寻找可回溯的原典或现代研究。每个候选都要提供 claim、source、时间不确定性、duplicate hints 和 unresolved refs。只返回 `ResearchPacket`，不写仓库。

## Synthesis worker

读取全部 ResearchPacket、现有 event id、现有人物 id、polity vocab 和 parent 关系。输出 canonical id 建议、alias/duplicate 分组、taxonomy、catalog、source coverage 和 evidence-needed 原因。不得自行把候选变成 approved。

## Draft worker

只接收 controller 已批准的 candidate rows。每个 id 先检查目标文件不存在，再创建一个 `status: draft` 文件。不得更新已有文件、事件索引、旧迁移 manifest、人物文件或 published 状态。返回 created、skippedExisting、blockedConflicts、inputHash 和文件 hash。

## Validator worker

只读执行：

```text
npm run events:check
npm run content:check
npm run events:publish:check -- --manifest <draft-manifest>
npm run build
```

输出机器可读报告，不修复内容，不批准 gate。

## Historian reviewer

读取 candidate ledger、evidence、draft diff 和 validator report。逐条检查收录闸门、年份、出处、叙事重要性、taxonomy、重复、人物引用和不确定性。只返回 review report；controller 才能接受结果。
