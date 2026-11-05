# 更新日志

本文件记录项目的显著变更。格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [0.1.0] - 2026-11-05

首个公开版本。

### 新增

- 17 个专题的时间轴站点，覆盖西周至清，人物条目 3400 余条。
- 事件实体库与军事、历史两条按时间排序的事件目录，共 708 个事件。
- Canvas 绘图的时间轴引擎，支持专题与章节切换、缩放平移、泳道显隐、人物卡与事件卡、搜索和事件带。
- 宣纸与暗色两套皮肤，配色由 `src/styles.css` 的自定义属性统一驱动。
- 人物与事件的 PNG、SVG 导出。
- 基于哈希的路由，支持专题、章节、事件线和事件的深链。
- 内容编译管线：把 `content/` 的 Markdown 编译为 `public/data/` 的运行时 JSON，并校验契约。
- `node:test` 测试层，覆盖路由、运行时契约、布局与内容管线冒烟检查。
- Prettier 格式化门禁、提交前钩子和 GitHub Actions 构建流程。

### 说明

- 内容中的生卒年保留 `exact`、`approx`、`disputed`、`unknown` 精度状态。
- 代码使用 MIT 许可证；原创历史文案与结构化历史内容使用 CC BY-SA 4.0。
