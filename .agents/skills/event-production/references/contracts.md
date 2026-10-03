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

`approval` 只在 controller 回显范围后填入。普通讨论文本不能被当成批准。

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
  "decision": "candidate|evidence-needed|rejected|held|approved",
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

## Review and validator reports

历史 reviewer 对每条候选返回 `approve`、`evidence-needed`、`reject` 或 `needs-revision`，并带 reasons、requiredEdits 和 claimRefs。

validator 报告每条命令的 exit code、输出引用、候选路径、errors、warnings、crossRefs 和总的 `publishable`。
