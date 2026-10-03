# Spec: 事件实体库治理与迁移准备

Created: 2026-10-03
Status: accepted

## Decision

事件实体采用 `content/events/<id>.md` 作为唯一 canonical source。现有专题 `topic.json` 的 `events[]` 共 258 条，冻结为只读旧输入；先建立可审计的迁移 ledger，再按批次迁移，不在本目标中凭空补历史资料或改写运行时代码。

## Scope

- 明确事件字段、taxonomy、军事/历史 catalog 语义和单条迁移 gates。
- 建立 `pipeline/events-migration-manifest.json`，记录 258 条旧输入的专题计数、entry key 约定、重复 id/名称组和批次验收条件。
- 在 `pipeline/PLAYBOOK.md` 留下事件入口边界，并更新 Harness 的 Task、Spec、Goal、Status 投影。

## Non-Goals

- 不创建或修改 `content/events/` 实体，不迁移任何旧事件。
- 不改 `src/`、`pipeline/compile.ts`、`pipeline/lint.ts` 或专题 `events[]`。
- 不编造年份、出处、polity、交战方、别名或 canonical id；不删除旧输入。

## Acceptance Criteria

- 事件规则明确 canonical source、冻结边界、ledger 状态、重复 alias 处理、taxonomy/catalog 语义和逐条验收门槛。
- manifest 的 `legacyEntryCount` 与 17 个专题计数之和均为 258，并记录已发现的 4 个重复 id 与 6 组同名同年来源；其中 4 组重叠，按重复 id 优先后 manifest 保留 6 个 primary groups，避免把重叠关系重复计数。
- Harness 记录能指出本 spec/goal、未完成的迁移工作和暂停条件。
- JSON 可解析，Markdown 结构可读；`npm run events:check`、`npm run content:check` 作为后续实体迁移 gate（本目标不因旧输入而声称迁移完成）。

## Pause Conditions

- 需要更改编译器、运行时 schema 或 UI 才能表达规则。
- 史料不足却要求把 `evidence-needed` 变成 `approved`。
- 重复 id/名称无法通过年份、人物、描述和出处判定同一性。
- 需要删除或改写冻结的旧 inline 输入。

## Verification

- `node -e "JSON.parse(require('fs').readFileSync('pipeline/events-migration-manifest.json'))"`
- `npm run events:check`
- `npm run content:check`
