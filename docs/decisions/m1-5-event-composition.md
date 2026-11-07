# M1.5 事件组合与详情数据决策

日期：2026-11-07。状态：accepted for pilot implementation。

## 决策

1. 事件采用可选 `partOf?: EventPartRef[]` 表达组成关系。成员事件指向组合事件，每项包含 `id`、非空 `note`、至少一条 `sources`。编译器只在组合事件的详情中生成 `components` 反向引用。
2. `partOf` 不表示因果、背景、影响、共同人物或任意相关。`note` 必须说明该事件为什么是组合的一部分，不能复制「相关事件」一类空话。
3. `parent` 保持原契约：战争到其下 campaign 或 battle 的两层军事层级。`children` 只由 `parent` 派生。`partOf` 不派生 `children`，不改变事件 `type`、`catalogs`、`scale` 或目录成员。
4. `partOf` 可多层嵌套，但不允许自引用或循环。同一事件对同一组合至多一条；重复 `sources`、空数组或缺 `note` 均拒绝。组合和成员可以属于不同 catalog，但不因此互相收录。
5. 组合必须是能容纳多个组成节点的 span：`rebellion`，或 `type: military` 且 `scale: war | campaign`。成员可以是 point、普通 span 或符合相同类型约束的组合。组合可以处于更大的组合中，成员时间区间必须与组合区间相交，不要求完全包含；史料只支持局部相交时，`note` 应说明组成范围。
6. `partOf` 引用必须解析到已发布事件。draft 事件保持可格式化与结构校验，但其组合引用不能进入发布产物。组合或成员取消发布、删除或 id 缺失时编译失败，不能静默删除边或保留悬空反向引用。
7. `parent` 与 `partOf` 可以共存，但各自需要独立证据。`parent` 已表达的军事层级不需要重复写 `partOf`。同一对事件存在两个方向的语义时，校验人员应核对是否把层级与组成混用。

## 备选方案与排除理由

- **复用 `parent` / 反向 `children`**：排除。它要求父事件为 `scale: war` 的 `military`，会把 `anshi-zhiluan` 的 `rebellion` 事实类型改掉，且无法保存每条组成的出处与说明。
- **使用通用 `relatedEvents`**：排除。它不能稳定表达组成方向，容易扩张成任意因果或背景网络。
- **在 Collection 中保存战役组合**：排除。Collection 是编辑策展实体，不是事件事实的替代来源。
- **只存组合事件的 `components[]`**：排除。该方向容易与派生反向索引混淆，并让组合文件承担所有成员的组成证据。成员侧 `partOf` 与现有 `parent` 的方向一致，反向引用只由编译器生成。

## 人物与 Collection

- 人物 `aliases`、`sources` 保留在 canonical 文件并进入搜索和详情。`works`、`experiences` 为可选数组；字段未维护时省略，不输出空数组或占位。
- 作品和经历各自携带 `sources`。约略、异说年份必须有对应 note；未知年份不得填整数。个人经历使用可选 `event` 引用公共事件，不复制公共事件的 `year`、`place`、人物或结果。
- `content/collections/<id>.md` 是唯一 Collection 来源。published Collection 才进入目录和反查；draft 必须完整通过结构和引用校验，不能通过过滤引用规避错误。
- Collection 的 `relations` 只引用 topic 中已有事实边。方向按该 topic 的 relation type 处理；相同语义主键的 `directed` 冲突为 error。不同 topic 的显示名或颜色冲突产生 `[RELATION_CONFLICT]` warning，编译结果保留来源 topic 的定义，不静默全局覆盖。
- 同主键关系的 note 按字符串去重后保留全部不同值，不能随机选一个。两个不同的已知 `since` 输出 `[RELATION_CONFLICT]` warning；详情保留全部来源，Collection 禁止引用冲突边，不能随机选一个。仅一方缺 `since` 时保留已知值，但后续应回到原典统一该事实字段。`rujia-chuancheng` 不引用混合跨代思想影响与直接师承的 `cheng-yi → zhu-xi` 边。

## 运行时兼容

- 现有产物的 `contractVersion` 保持 `1`。新增字段全部可选，旧 `people.json`、事件线和专题不需要迁移即可继续读取。
- 新增 `people/<id>.json`、`events/<id>.json`、`collections.json`、`collections/<id>.json` 使用同一版本。读取器要求明确 id、有效结构和引用，不把错误 id 回退为第一个实体。
- 旧应用继续读取原有专题与两条事件线。`partOf` 只进入事件详情，不改变既有事件卡、画布层级或导出内容。

## 规则到机器 gate

| 规则 | 实现位置 |
| --- | --- |
| 字段形状、必填和空数组 | `pipeline/schema/*.schema.json`、Markdown parser |
| 精度、年份、出处、重复和自引用 | `pipeline/lint.ts`、对应领域 lint |
| 引用、循环、时间与类型 | `lintEvents`、`lintCollections` |
| 格式化、索引、draft 过滤 | `person-md.ts`、`event-md.ts`、`collection-md.ts` 与 content CLI |
| 派生详情、反查和计数 | `pipeline/compile.ts`、`pipeline/cli.ts` |
| 运行时结构与 id | `src/contract.ts`、`src/loader.ts` |
