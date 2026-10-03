# Event Production Evidence

## Run layout

事件生产 Run 使用 Harness 的标准文件：

```text
.harness/runs/<run-id>/
  manifest.json
  run.md
  prompt.md
  subagents.md
  status.json
  checkpoint.json
  dag.json
  agents/<node>/
  evidence/
  artifacts/
```

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

每个关键字段都要能回到 claim。非军事事件原则上需要两条独立出处且至少一条 classic；军事事件可使用一条强主出处，但必须支撑年份、参战方和结果。

完整 URL、访问时间、摘录和可信度只保存在 evidence。canonical `sources` 继续使用 `work`、`part`、`note`、`kind`，并由 `canonicalSourceMap` 建立 source index 到 evidence source id 的映射。

## Gate records

每个 gate record 至少记录：

- gate 类型；
- Run id 和 checkpoint revision；
- scope hash；
- include/exclude/hold ids；
- 用户原始确认文本；
- controller 的规范化解释；
- evidence refs；
- 决策时间；
- 下一步动作。

未经 gate 的结果仍然是 candidate evidence，不是 accepted state。
