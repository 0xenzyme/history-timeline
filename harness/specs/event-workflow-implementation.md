# Spec: 新增历史事件工作流实施

Created: 2026-10-03
Status: accepted

## Decision

当前 thread 是 controller，直接在现有 local checkout 实施事件工作流。事件实体的 canonical source 保持为 `content/events/<id>.md`；本 spec 只落实输入生命周期、证据闸门、编译/运行时契约、稳定路由和迁移冻结，不代替历史专家对 258 条旧记录逐条作史料判断。

## Scope

1. 冻结 `topic.json#events[]` 旧输入，并用逐条 manifest/摘要和重复组做可追溯盘点。
2. 让 `events:new` 产出 `draft`，draft 不进入索引、编译或时间轴；发布态拒绝占位符和未知字段。
3. 校验无公元 0 年、战争端点、点/段类型、端点 accuracy/note、范围和父子时间关系。
4. 在 content gate 中检查事件与人物的年份、主将政权和引用关系；冲突按确定错误/待核 warning 区分。
5. 为事件线提供独立 `validateEventLine`，加载坏产物时安全降级。
6. 用 `#<line>/event/<event-id>` 作为稳定 deep link，兼容并 canonicalize 旧分段链接。
7. 明确 `type`、`scale`、`importance`、`catalogs` 和 dynasty temporal filter 的边界，保证搜索索引与两条目录使用同一投影。
8. 把迁移状态、重复 alias、证据和逐条 gates 记录到 manifest；本次不虚构 canonical 事件内容。

## Non-Goals

- 不凭空补年份、出处、政权、交战方、主将或正文。
- 不在本次批次删除或改写 258 条冻结 inline 输入。
- 不部署、发布、创建分支、commit 或 push。
- 不把 `public/data/` 当源文件；生成数据只由 `npm run content` 更新。

## Acceptance Criteria

- `npm run events:migration:check` 能逐条发现旧输入变化，并报告重复 id/名称组。
- `events:new` 的结果为 draft，`events:check`/`content:check` 不把 draft 编译上轴；未知 frontmatter 字段不会被 format 静默丢弃。
- 事件规则 lint 覆盖占位符、年份端点、war/battle 形态、accuracy/note、catalogs、人物引用和 parent。
- `validateEventLine` 被 loader 调用，坏事件/坏分段有可见 warning 和安全 fallback。
- 稳定事件 URL 在分段合并后仍能按 event id 定位；旧 URL 可兼容并替换。
- `npm run events:check`、`npm run events:migration:check`、`npm run content:check`、`npm run build` 通过；既有人物 warning 单独记录，不升级为事件失败。

## Execution DAG / Ownership

- `event_lifecycle`: `pipeline/event-md.ts`, `pipeline/events-cli.ts`, `pipeline/lint.ts`, event schema。
- `event_runtime`: `src/contract.ts`, `src/loader.ts`, `src/routing.ts`, `src/main.ts`, event compile projection。
- `event_governance`: rules, PLAYBOOK entry, harness records and migration inventory.
- controller: cross-file type integration, manifest freeze checker, generated data, verification and final state sync.

## Pause Conditions

- 需要史料判断才能把 `evidence-needed` 变成 `approved`。
- 需要删除/改写冻结输入、生产发布、凭据或其他外部副作用。
- 运行时 schema 与编译产物无法在不破坏旧链接的情况下兼容。

## Verification

```bash
npm run events:migration:check
npm run events:check
npm run content:check
npm run build
```
