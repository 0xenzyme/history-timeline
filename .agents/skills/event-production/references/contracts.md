# 内容批次合同 v2

类型定义在 `pipeline/content-batch.ts`。以下字段由执行 Agent 写入 JSON，不要求用户填表。批次保存在 `workspace/content/raw/<batch-id>/batch.json`。执行者准备 proposal，用户手动交给独立审核会话补 review。author/reviewer 填实际角色或会话标识，模型与 Coding Agent 名称只是已知时可附的来源说明，不是准入凭证。应用结果由工具生成，不能手改结果声明通过。

## 批次与候选

```ts
interface ContentBatch {
  schemaVersion: 2;
  id: string; // kebab-case，新的授权范围使用新 id
  scope: { description: string; eventIds: string[] };
  items: Array<{ proposal: Proposal; review?: Review }>;
}
interface Proposal {
  id: string; // 在 scope.eventIds 内，每批次唯一
  operation: 'publish' | 'revise';
  author: string; // 起草 Agent 的实际身份或会话标识
  before: string | null; // 当前 canonical 文件完整原文；不存在为 null
  after: string; // 用 formatEventMarkdown 生成的完整目标原文，status: published
  admission: string; // 满足领域收录闸门的具体理由
  evidence: Array<{
    id: string;
    work: string;
    locator: string; // 卷篇或页码，包含 canonical source.part
    excerpt: string; // 实际核查过的必要短摘录
    url?: string; // 可核查的 http(s) 来源；本地原典可只写书目定位
  }>;
  claims: Array<{
    text: string;
    fields: string[]; // 顶层字段名，如 year、yearAccuracy、polity、partOf
    sourceIds: string[]; // evidence 中的 id
  }>;
}
interface Review {
  reviewer: string; // 实际独立审核角色或会话标识，不能与 author 相同
  decision: 'pass' | 'needs-evidence' | 'needs-revision' | 'needs-decision' | 'reject';
  reason: string; // 具体审核结论和未决事项
  reviewedProposal: Proposal; // 审核者读取的完整 proposal 快照
}
```

准备 JSON 时，使用文件读取取得 before，使用 `pipeline/event-md.ts` 的 `formatEventMarkdown` 生成 after，再用 JSON.stringify 序列化；不要手抄多行 Markdown 或自行转义。审核者返回结论后，将其实际读取的 proposal 对象原样保存为 reviewedProposal，不从此刻可能已变化的候选重新复制。

before/after 保存文本而非源码哈希。reviewedProposal 保存实际审核输入，用来识别候选或证据在审核后发生变化；不记录工具调用历史。审核者必须自己核对材料，不能仅复制 proposal 然后宣布通过。工具检查结构与一致性，不证明身份字符串真实性。

每项 evidence 的 id 唯一；claim 引用必须解析。所有已维护事实字段都需要 claim 映射：name、type、catalogs、scale、importance、year/yearAccuracy/yearNote、endYear/endYearAccuracy/endYearNote、place/placeNow、polity、belligerents、commanders、people、result、parent、partOf、aliases、tags、desc。省略的可选字段无需补写。展示短名 display 由审核者检查不改变原意，不要求独立史实 claim。

一条 claim 可以同时支持多个字段，但要说明事实与编辑判断的联系。例如原典支持政变发生时间，收录理由再解释 type、catalogs、importance 的选择；这些值不是从原文直接抄来的史料字段。sources 与每条 partOf.sources 都必须能匹配 evidence 的书名和卷篇定位。

publish 适用于不存在的新实体或已有 draft；revise 只适用于现有 published（含缺省 status）的实体。after 表示准入通过后的目标，不是绕过 draft 的发布许可。不能使用 revise 为新实体免除发布检查。

## 审核与工具结果

`preflight` 不要求 review，只输出 checksPassed、admissionGranted=false 和逐项 awaiting-review/needs-revision/already-applied，不能作为发布批准；非 JSON 输出附审核交接提示。它与 `publish-check` 都不写文件；`apply` 写入工作材料、pending 子集和正式通过项。返回结果包含：

- items：每条 id 的 ready、pending 或 already-applied，以及 reasons。
- errors：全局阻断原因。
- warnings：投影后的 warning，用于看见存量基线。
- appliedIds：本次实际写入的 id（仅 apply）。
- verification：not-run、passed 或 failed（仅 apply）。

ready 是准入通过，尚未表示已写入；appliedIds 表示源文件已写入；verification=passed 表示随后 content/build 成功。already-applied 表示当前文件恰好等于审核的 after；仍要重新检查当前引用并完成验证。

有 pending 时退出码为 1，但其他合格项可能已应用。全局循环或破坏外部引用等无法安全归因的错误会阻止整批应用。格式损坏的批次在任何写入前拒绝；修复输入再重试，不把工具异常包装成通过。

同一批次 pending 子集可以单独重跑，工具合回原始 raw 材料。scope 不允许静默变更。对已完成候选提出新的事实修改，使用新的批次，before 取当前正式原文。

旧 `--manifest` 参数名可指向 v2 批次，但 v1 Run manifest 不再具有准入效力。旧材料不删除；复用其中有效史料和决定，按当前具体修改生成 v2 候选，不补造旧过程文件。

通过准入的完整候选及 review 在 raw 批次内保存为 accepted.json。即使正式文件后来改变，也不能在原批次替换该候选或审核结论；新的修订使用新批次。该文件是内容审核依据，不是过程日志。
