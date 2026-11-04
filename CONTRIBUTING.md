# 参与贡献

欢迎报告错误、补充史料、改进内容和修复界面问题。开始修改前，请先阅读本指南与根目录 `AGENTS.md`。

规则冲突时按 `AGENTS.md` 的 Rule Precedence 执行。事件字段、收录和迁移以 `docs/事件线规则.md` 为准。

## 本地环境

1. 使用 Node.js 22 或更高版本。
2. 安装依赖：`npm ci`。
3. 启动开发服务器：`npm run dev`。
4. 提交前运行：`npm run build`。

不要手改 `public/data/`、`content/<topic>.md` 或 `content/events.md`。它们由项目命令生成。

## 报告问题

- 界面或功能问题使用 Bug 模板，提供复现步骤、浏览器和可分享的 URL。
- 历史内容问题使用内容订正模板，提供人物或事件 id、问题位置与出处。
- 不要只写“年份不对”或“人物归属不对”。请给出支持订正的典籍卷篇、现代研究或数据库记录。
- 安全问题不要发公开 Issue，按 [安全政策](SECURITY.md) 报告。

## 修改人物

1. 阅读 [内容编写手册](pipeline/PLAYBOOK.md)。
2. 确认该人物还没有源文件。一个人只保留一个 canonical 文件。
3. 使用 `npm run people:new -- <topic> <id>` 创建简表。
4. 填写身份、生卒年、年份精度、出处与 `polity`。不要根据生活年代猜测政权归属。
5. 按现有规则更新专题候选与泳道。
6. 运行 `npm run people:format` 和 `npm run people:check`。
7. 运行 `npm run content`，并在同一改动中审查生成的 `public/data/`。

详表还需要正文 `bio` 和有意义的关系说明。不要为了消除告警而编造年份、关系、归属或出处。

## 修改事件

1. 阅读 [事件线规则](docs/事件线规则.md)。该文档与人物手册冲突时，事件以事件线规则为准。
2. 使用 `npm run events:new -- <id>` 创建事件。
3. 保持事件 id 全局唯一，不添加朝代前缀。
4. 填写可核查的时间、出处和人物引用。公元前年份使用负数，不使用公元 0 年。
5. 运行 `npm run events:format` 和 `npm run events:check`。
6. 运行 `npm run content` 并审查生成数据。

## 修改代码

- 使用 TypeScript、两空格缩进、分号和单引号。
- 数据访问保持在 `src/types.ts`、`src/contract.ts`、`src/loader.ts` 和 `src/routing.ts`。
- 渲染器不要直接读取 `public/data`。
- 保持改动集中，不顺手重构无关模块。
- 插入 SVG 或 HTML 前必须转义数据文本。
- 界面改动需检查深链、内容线切换、专题、搜索、详情卡、泳道、事件条、缩放平移和 PNG/SVG 导出，并在 PR 中附截图或短录屏。

## 内容告警

`npm run build` 是必须通过的门禁，但现有内容仍会产生 warning。warning 不会被自动视为史实错误，常见类型包括：

- 人物与事件的政权或日期口径需要人工裁决。
- 非军事事件目前只有一条出处。
- 军事事件缺少 `result`。
- 长名称缺少适合轴上展示的 `display`。
- 详表人物尚未补关系。

提交内容改动时，应确保没有新增由本次改动引起的 warning。已有告警的治理口径见 [开源内容质量说明](docs/内容质量.md)。

## 提交与 PR

- 使用简洁的祈使句提交标题，可使用现有 Conventional Commit 风格。
- 一个 PR 聚焦一个主要目标。
- 说明用户可见变化、内容或 schema 变化，以及执行过的验证命令。
- 涉及生成数据时，同时提交源文件和对应的 `public/data/` 变化。
- 不要提交密钥、本机路径、私有研究材料或 `raw/` 本地史料库。
