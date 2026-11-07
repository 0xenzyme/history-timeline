# M1.5 流水线试点覆盖报告

日期：2026-11-07。范围：契约、最小生产链路和四类真实样本。本报告不建立全库完整度等级或新的发布 gate。

## 已覆盖

| 模块 | 真实样本 | 已确认输出与断言 |
| --- | --- | --- |
| 人物详情 | `li-bai` | `sources`、`aliases` 保留；`works[shu-dao-nan]` 无创作年；`experiences[changan-hanlin]` 为 742 年 approx，note 明示「天宝初」；无 `anshi-zhiluan` 事件反查 |
| 资料不足 | `yuan-shang`、`bao-xu` | brief 的缺生年、bio、works、experiences 可加载；legacy 的缺生年、polity、works、experiences 保持缺失 |
| 事件组成 | `anshi-zhiluan`、`xiangjisi-zhizhan`、`suiyang-baowei-zhan` | rebellion 类型和 parent 不变；两项 `partOf` 各带 note 与原典出处，组合详情的 components 可读取；李白未被加入参与人物 |
| Collection | `rujia-chuancheng` | published 独立实体；5 名显式成员跨 `rujia`、`chunqiu`、`zhanguo`、`song`，包含 `zhu-xi`；成员反查、两条孔子师承关系、时间线可用 |
| 负例与旧数据 | 测试 fixtures | 覆盖悬空和 draft 引用、自引用和循环、重复与冲突关系、非法时间、精度缺说明、缺来源、空可选字段；旧事件线和缺新增字段人物可读 |

## 来源边界

- 李白作品来自《新唐书·韦皋传》对《蜀道难》的记载；经历来自《新唐书·文艺传中·李白传》「天宝初」至长安、供奉翰林。742 只是 approx 锚点，不是确切纪年。
- 事件组成沿用已发布事件中的《旧唐书》和《资治通鉴》出处，没有创建新事件，也没有改变史实类型。该操作不是新事件生产或发布审批。
- Collection 成员事实沿用各人物 canonical 出处；系列范围来自《史记》和《宋史》。未引用既有 `cheng-yi → zhu-xi` 跨代 `mentor` 边。

## 保留缺口

1. 只有李白一个有真实作品和经历的试点人物；没有批量扩写作品、经历、关系或 legacy 迁移。
2. Collection 没有真实相关事件和作品视图； views 仅声明有数据的 `overview`、`members`、`timeline`、`relations`。
3. `cheng-yi → zhu-xi` 的关系类型与 note 仍需单独史实校订；本次不引用、不静默修改。
4. 跨专题检查发现两条 `[RELATION_CONFLICT]` warning：`zhu-yuanzhang ↔ chen-youliang` 的 since 为 1360/1363，`zhu-yuanzhang ↔ zhang-shicheng` 的 since 为 1365/1367。冲突边不能进入 Collection，后续需回到原典统一。
5. DynastyProfile、编辑推荐、完整目录、UI、自动播放、二度关系和作品全文不在本阶段范围。

## 编译审查

`npm run content` 生成 4241 个文件：3510 个人物详情、708 个事件详情、1 个 Collection 详情及目录、原有专题与事件线。`public/data/people.json` 增加 aliases 和 bio；两条事件线只新增两项 `partOf`，不改变原有 id、catalogs、type、polity 或日期精度。核心三份样本详情在第二次编译后的 SHA-256 一致。

## 验证与交接

- `npm test`：修复后完整测试包含全量生成 contract、loader、负例、真实样本与 Chrome 兼容检查，数量以最新运行日志为准。
- `npm run content`、`npm run people:check`、`npm run events:check`、`npm run collections:check`、`npm run content:check`：通过；核心样本重复编译哈希一致。
- `npm run format:check`、`npm run build`、`git diff --check`：通过。
- Chrome 157 headless：专题和事件深链、aliases 搜索、人物与事件卡、章节、泳道、内容线、缩放平移、事件条、PNG/SVG 下载通过；无 page error。
- warning 对比：基线 150 条，当前 152 条；新增仅两条已说明的 `[RELATION_CONFLICT]`，没有未解释回归。

M2 可以定稿作品、个人经历、事件组成和群像的数据组件。M2 基础视觉仍可并行；M3 继续使用现有年表、卡片和深链，并消费独立详情产物。M5 可复用 Collection 维护入口与编译器，不另建事实来源。浏览器测试需要 Playwright 和本机 Chrome；其他环境可设置 `CHROME_PATH` 或安装 Playwright 浏览器。
