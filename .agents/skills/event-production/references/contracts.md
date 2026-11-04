# Event Production Contracts

这些是 controller 和 worker 之间的逻辑合同。初期可以通过 prompt 传递，但每个结果都必须能按这些字段解析和审计。

## Request

```json
{
  "schemaVersion": 1,
  "runId": "optional-existing-run",
  "action": "start|resume|approve-research|approve-publish|cancel",
  "intent": {
    "dynasty": "tang",
    "periods": ["early-tang", "high-tang", "mid-tang", "late-tang"],
    "catalogs": ["military", "history"],
    "sourceOrder": "web-first",
    "localVerification": ["raw/唐"]
  },
  "approval": {
    "includeIds": [],
    "excludeIds": [],
    "holdIds": [],
    "userText": "the original explicit approval"
  },
  "expectedRevision": 0
}
```

`approval` 由 controller 写入。controller 先用 `SKILL.md` 里的宿主提问工具展示范围，再把工具结果规范化成下面的记录。普通聊天、用户手写 JSON 或“看起来可以”不是批准。工具没有返回答案也不是批准。

宿主工具的原始返回值可以不同。Grok 的 `ask_user_question` 返回选项和自由文本。controller 把「批准建议名单」写成 `decision: approve`，把点名排除写入 `excludeIds`，把「先补证据」写成 `needs-more-evidence`，把「暂停」写成 `hold`。自由文本进入 `userText`。自由文本单独出现时，`decision` 不能是 `approve`。

规范化记录至少包含：

```json
{
  "gate": "research|publish",
  "questionId": "research-approval-1",
  "decision": "approve|exclude|hold|needs-more-evidence",
  "includeIds": [],
  "excludeIds": [],
  "holdIds": [],
  "userText": "the optional free-text clarification returned with the tool answer"
}
```

已有 gate 文件可以带更多字段，也可以使用 `approve-with-vocab` 这类已经写下来的 `decision`。新说明接受这些旧字段。controller 缺少上面的任一标识时，不推进 checkpoint。

controller 把这条记录写入 `gates/*.json` 之后，才能推进 checkpoint。

## Worker envelope

每个 worker 输出都要包含：

```json
{
  "schemaVersion": 1,
  "runId": "run-id",
  "workerId": "research-early-military",
  "inputHash": "sha256-of-input-snapshot",
  "revision": 4,
  "result": {}
}
```

controller 会拒绝 `runId`、`inputHash` 或 `revision` 不匹配的结果。

## ResearchPacket

`result` 可以包含：

```json
{
  "slice": {"period": "early-tang", "domains": ["military"]},
  "sources": [
    {
      "sourceId": "source-001",
      "url": "https://example.test/source",
      "title": "source title",
      "accessedAt": "2026-10-04T00:00:00Z",
      "sourceClass": "classic|academic-modern|reference|database|discovery",
      "locator": "卷/篇/章节",
      "excerpt": "short supporting excerpt",
      "credibilityNotes": "why this source is usable"
    }
  ],
  "claims": [
    {"claimId": "claim-001", "text": "supported claim", "sourceIds": ["source-001"]}
  ],
  "candidates": [
    {
      "candidateKey": "candidate-key",
      "name": "事件名称",
      "aliases": [],
      "year": 618,
      "endYear": 618,
      "yearAccuracy": "exact|approx|disputed|unknown",
      "yearNote": "required for approx/disputed",
      "type": "military|political|rebellion|institutional|diplomatic|cultural",
      "scale": "war|campaign|battle|engagement",
      "catalogs": ["military"],
      "importance": 2,
      "proposedPeople": [
        {"name": "人物", "id": "known-id", "status": "known|unresolved"}
      ],
      "admissionRationale": "why this changes the historical pattern",
      "claimIds": ["claim-001"],
      "duplicateHints": [],
      "uncertainties": []
    }
  ],
  "unresolved": []
}
```

## Ledger row

新的事件生产 Run 使用自己的 append-only `candidate-ledger.jsonl`，不写旧的迁移 manifest：

```json
{
  "candidateKey": "candidate-key",
  "canonicalId": "optional-kebab-id",
  "aliases": [],
  "decision": "candidate|evidence-needed|rejected|held|research-approved|publish-approved",
  "artifact": "none|draft|publish-ready|published",
  "sourceRefs": ["source-001"],
  "claimRefs": ["claim-001"],
  "reviewRefs": [],
  "unresolvedPeople": [],
  "unresolvedParents": [],
  "duplicateGroup": null,
  "gates": {
    "identity": "pending|pass|fail",
    "taxonomy": "pending|pass|fail",
    "evidence": "pending|pass|fail",
    "references": "pending|pass|fail",
    "compile": "pending|pass|fail",
    "catalog": "pending|pass|fail"
  },
  "attempts": 1,
  "lastError": null
}
```

`research-approved` 允许 `artifact: draft`。`publish-approved` 允许 `artifact: published`。`publish-ready` 只表示 validator 和历史 reviewer 已通过，不等于发布批准。迁移 manifest 的 `migration-approved` 是另一套状态，不得写入本 ledger。

## Review and validator reports

历史 reviewer 对每条候选返回 `approve`、`evidence-needed`、`reject` 或 `needs-revision`，并带 reasons、requiredEdits 和 claimRefs。

validator 报告每条命令的 exit code、输出引用、候选路径、errors、warnings、crossRefs 和总的 `publishable`。
