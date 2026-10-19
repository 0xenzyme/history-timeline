# Project Status

harness-rule:bounded-status-snapshot: this file is a bounded current-state snapshot.

## Focus

- Current focus: 全站 review 的修复批次已提交并推送。两批共九个 commit：730b38c、5d2f94b、fdc76e3、5ddb71b（闸门与文档纠偏）与 4a15bc3、306dafe、d3b464a、bf8826c、4335fa1（`src/` 五处交互修复、事件出处本机路径清洗、`[*_SOURCE_LOCAL_PATH]` 闸门、`docs/前端重设计.md` 第二节改写）。origin/main 与本地 main 一致。
- 内容生产（详表关系、存量 44 条 polity、夏商西周事件空缺、事件 result/display 补齐）保持 deferred，等口径裁决与史料工作批次。

## State

- Current phase: completed
- Authoritative Task/Goal: harness/tasks.md《Now》2026-10-19 修复批次（无独立 Goal 文件，随线程直接执行）
- Projection updated: 2026-10-20

## Verification

- Last command: npm run build
- Result: exit 0 ——`tsc --noEmit`（app 与 pipeline）、people check（模板 2、索引 16、待编译人物 2139）、events check（609 条）、content check（17 专题）、vite build 全通过。
- 出处清洗对账：`content/events/` 里 `raw/`、`file:///`、行号锚 103 处 + 抽取文件名（`.md`）与分隔符 110 处已改写为书名与卷次篇目；`grep -c 'file:///' public/data/events.json` 从 50 降到 0。
- 新增闸门自证：临时 draft 探针 `part: raw/春秋/左传/卷01.md:12-20` 报出 `[EVENT_SOURCE_LOCAL_PATH]`，探针已删除；`https://` 网页出处不误报（首轮曾误报 2 条，已收紧判据）。
- 路由冒烟：`.tmp-verify/routing-smoke.ts` 经 esbuild bundle 后在 Node 跑 17 条断言全过，覆盖畸形 `#%zz` 不崩、旧链规范化、稳定事件链接与 push/replace/skip 去重。
- 界面核对未完成：In-app Browser 窗口 `innerWidth=0`、`visibilityState=hidden`，`requestAnimationFrame` 不触发，`#chart` 尺寸恒为 0、泳道面板无章节按钮；dev server 仍在 `http://localhost:5181/`。

## Evidence

- `src/app/app.ts` 五处修复：`state.viewId` 让章节进地址（`writeTopicHash` + 点击章节 + `applyRoute`）、`hitTest` 事件条按 `chipMatchEvent` 同口径过滤、事件条开关补 `rebuildLayout()`、`selectAndReveal` 不再把当前专题里的人跳走、`syncHash` 用 `decodeHash`。`src/routing.ts` 新增导出 `decodeHash`。
- `pipeline/lint.ts` 新增 `localArtifact` + `checkSourcePaths`，对人物与事件的 `sources[*].work|part|note` 拒绝本机绝对路径、`raw/`、抽取文件名与行号锚；全仓当前零命中，闸门以 error 上线。
- `content/events/` 86 个文件改写；`content/events/jiagu-zhihui.md` 人物引用由 `jiang-xiaobai`（齐桓公，卒 -643）改为 `qi-chunqiu-jinggong`（齐景公，卒 -490），`jin-wengong-qinwang.md` 删掉 `shu-dai`（赵叔带，卒 -771，与太叔带同名字不同人）。
- `docs/前端重设计.md` 第二节按代码改写：G1/G4 关闭，G2/G3/G5/G7/G9 部分兑现，G6/G8 仍缺，新增 G10–G12；死代码事实为 `src/contract.ts` 的 `filterTopics`/`filtersActive`、`src/types.ts` 的 `TopicFilters`、`Topic.events` 在 `src/` 内无调用者。
- 历史批次证据仍在各自 Run 目录（`.harness/runs/`），本快照不再重复：南北朝 Run `nanbeichao-events-20261004` 已发布 52 条，东汉 Run `donghan-events-20261004` 仍 publish-ready。

## Blockers

- 界面四项修复需用户把 In-app Browser 窗口置为可见后复验；本机该窗口尺寸为 0，任何截图与布局探针都拿不到真实渲染。
- 事件人物引用的 143 条 polity / 11 条 date 告警需口径裁决（见 harness/tasks.md《Now》P2 项），其中 48 条属 `pipeline/lint.ts` 判据与 PLAYBOOK 归属口径互相矛盾，不能靠改数据消警。
- `raw/` 抽取库存在本机但被 `.gitignore` 排除（5709 文件，维基文库 dump `20260901`），任何仍指向 `raw/` 的引用对他人不可解析——出处字段清洗后已无此类引用。
