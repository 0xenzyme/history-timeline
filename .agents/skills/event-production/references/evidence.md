# Event Production Evidence

## Run layout

`.harness/runs/` 是本机的 Run 目录，已由 `.gitignore` 排除。`events:publish:check` 要求 draft manifest 位于这里。读取这个目录不是调用别的技能。

一次新 Run 必须有：

```text
.harness/runs/<run-id>/
  manifest.json
  checkpoint.json
  evidence/
  artifacts/
```

不创建 `dag.json`、`subagents.md` 或 Goal 文件。旧 Run 里如果已经有 `prompt.md`、`run.md`、`status.json`、`dag.json` 或 `subagents.md`，恢复时可以读取，但不把它们当作必需文件。

建议的事件 evidence：

```text
evidence/
  intent.json
  research/<period>/<domain>.json
  sources/<source-id>.json
  claims/<candidate-key>.json
  candidate-ledger.jsonl
  reviews/historian.json
  validation/deterministic.json
  validation/cross-reference.json
  gates/research-approval.json
  gates/publish-approval.json

artifacts/
  candidate-summary.md
  draft-manifest.json
  content-check.txt
  build.txt
```

## Source policy

- `classic`：原典、正史、政书和可靠数字化古籍；唐朝优先核对 `raw/唐`。
- `academic-modern`：大学、出版社、论文和现代专题史。
- `reference`：高质量通史或百科，只作交叉支持。
- `database`：只作发现线索，不能单独支撑年份或结论。
- `discovery`：只用于寻找可引用来源。

每个关键字段都要能回到 claim。非军事事件进入 publish gate 前必须有两条不同 `work` 的独立出处，且至少一条 `classic`；军事事件可使用一条强主出处，但必须支撑年份、参战方和结果。`npm run content:check` 对存量仍只报 warning；`npm run events:publish:check` 对新生产批次执行硬门禁。

完整 URL、访问时间、摘录和可信度只保存在 evidence。canonical `sources` 继续使用 `work`、`part`、`note`、`kind`，并由 `canonicalSourceMap` 建立 source index 到 evidence source id 的映射。

## Checkpoint

四个 stage 按这个顺序前进：`research`、`draft`、`validate`、`publish`。当前 stage 写在 `checkpoint.json` 的 `currentStage`。旧 checkpoint 里的 `revision`、`gates`、`publishedIds` 和 `reconciliationRequired` 继续有效。

出现下面任一情况时，停在当前 stage，把原因写入 `evidence/`，不进入下一 stage：

- 提问工具没有返回答案，或用户文本含糊；
- worker 的 `runId`、`inputHash` 或 `revision` 不匹配；
- event id、alias、parent、人物或 polity 冲突；
- validator 或 historian reviewer 没有通过；
- 工作区里出现本 Run 不能判断归属的文件，或命令输出和 manifest 对不上。

最后一种情况还要把原因写入 `evidence/reconciliation-required.json`，并把 checkpoint 的 `reconciliationRequired` 设为 `true`。不重试，不删除那些文件。用户明确处理归属后，controller 再恢复。

## Gate records

每个 gate record 至少记录：

- gate 类型；
- `questionId` 和 `decisionSource: askuserquestion`；
- Run id 和 checkpoint revision；
- `inputHash`；
- include、exclude、hold 的 id；
- 用户原始确认文本；
- controller 的规范化解释；
- evidence refs；
- 决策时间；
- 下一步动作。

`decisionSource: askuserquestion` 表示这次决定来自宿主提问工具。它不是某一个厂商的工具名。旧记录里的 revision 字段可以叫 `revision` 或 `checkpointRevision`。旧记录上的额外字段继续有效。

还没有 gate 记录的结果只是候选证据。controller 还没有把它写入 checkpoint 或 ledger。
