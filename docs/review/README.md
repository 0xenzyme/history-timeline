# 历史审查记录

本目录保存历次内容、规则和工作流审查快照，不是现行规则源。

现行规则按以下顺序读取：

1. `AGENTS.md`
2. `pipeline/PLAYBOOK.md`（人物）
3. `docs/事件线规则.md`（事件）
4. `docs/内容质量.md`（告警分诊）

本目录中的旧人数带、阅读层人数、polity 推断和“registry 是唯一事实源”等说法，只代表当时的审查结论。它们与新规则冲突时，以现行规则为准。

## 快照索引

| 快照 | 当时主题 | 现在的归属 |
| --- | --- | --- |
| `01-技术.md` | Harness 结构、测试缺口、旧迁移脚本 | 已被本轮工程改造取代：门禁见 `AGENTS.md` 的 Build, Test, and Development 与 Testing and Validation，脚本清单见 `package.json` |
| `02-界面.md` | 画布与界面交互 | 无独立决策文档；现行行为以 `src/app/` 与 `src/styles.css` 为准 |
| `03-内容架构.md` | 人物与事件两条内容线的组织 | 事件部分见 `docs/decisions/event-entity-governance.md`；人物部分见 `pipeline/PLAYBOOK.md` |
| `04-内容.md` | 内容质量与告警 | 见 `docs/内容质量.md` |
| `05-收录规则审查.md` | 人物收录席位与生卒口径 | 见 `pipeline/PLAYBOOK.md` |
| `06-收录工作流审查.md` | 事件生产与审批流程 | 见 `docs/decisions/event-workflow-implementation.md` 与 `docs/decisions/event-agent-production.md` |
| `07-分朝代缺口审计.md` | 专题收录缺口盘点 | 无对应决策文档；缺口数量随内容增长已过期，只作历史 |
| `07-人物补充盘点/` | 人物补充名单 | 无对应决策文档；以 `content/` 与 `pipeline/topics/*/candidates.json` 为准 |
