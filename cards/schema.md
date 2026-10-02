# 人物卡片 schema

一人一文件。YAML 给机器读，正文写事迹和引文。字段尽量与 `pipeline/schema/person.schema.json` 对齐，多出来的只服务草稿（`status`、`period`、`path`、`registry`）。

```markdown
---
id: ji-hu
name: 姬胡
display: 周厉王
status: draft
period: 西周
# periods: [西周, 春秋]   # 跨时段时可选；文件仍只放主时段目录
# idNote: 与厉王姬胡同拼音，后缀取晋
birthAccuracy: unknown
death: -828
deathAccuracy: exact
deathNote: 《史记·周本纪》共和十四年死于彘
aliases: [周厉王, 厉王]
sources:
  - work: 史记
    part: 周本纪
    path: raw/先秦-西汉/史記/卷004-周本紀.md
registry: pipeline/registry/people/ji-hu.json
---

# 周厉王

## 生平纪要
- …

## 引文
### 史记·周本纪
`raw/先秦-西汉/史記/卷004-周本紀.md` L96

> 必须是 raw 里的连续原文，不要改字。
```

## 字段

| 字段 | 必填 | 说明 |
|---|---|---|
| `id` | 是 | 与文件名（不含 `.md`）一致；全局唯一 |
| `name` | 是 | 汉字名（姬胡、芮良夫） |
| `display` | 是 | 通行称（周厉王） |
| `status` | 是 | `draft` 脚本/起草；`reviewed` 人审过；`promoted` 已写入 registry；`rejected` 不够格进轴；`candidate` 新发现、尚无登记 |
| `period` | 是 | 与所在目录名一致 |
| `periods` | 否 | 跨时段列表 |
| `idNote` | 否 | 同拼音后缀的说明 |
| `birth` / `death` | 否 | 整数；公元前为负。无年则省略，不可用 0 充数 |
| `birthAccuracy` / `deathAccuracy` | 是 | `exact` \| `approx` \| `disputed` \| `unknown`。禁止用一个整数假装精确 |
| `birthNote` / `deathNote` | 有年或异说时 | 依据或下限说明 |
| `aliases` | 是 | 检索用汉字（谥、字、通行称）。YAML 用简体与登记表一致；检索脚本会同时查繁体 |
| `sources` | 是 | 至少一条。`work` 必填；`part`、`path`、`note` 可选。卡片应有 `path`，指向真实 `raw/` 文件 |
| `registry` | 已有登记时 | `pipeline/registry/people/<id>.json` |

生卒与 registry 不一致时，**改卡片或写 note，不覆盖 JSON**。

registry 是唯一事实源，卡片是草稿。卡片里考出来的东西（例如 `deathNote` 的系年依据）要**回填注册表**再标 `promoted`，否则两套正文会分叉——`card/西周/ji-hu.md` 就有一句「共和十四年死于彘」，而 `ji-hu.json` 里没有对应的 `deathNote`。

## 正文

- `## 生平纪要`：条目，不写百科。服务读史料，不替代 registry `bio`。
- `## 引文`：已选用的原文。每条先写 `raw/...` 路径和行号，再引用。引文必须能在该文件里搜到（连续子串）。中间省略用 `…`，省略两侧各自仍须能命中。
- `## 引文候选`：检索脚本的待填输出。定稿后改成 `## 引文`，删掉张冠李戴的段（例如幽王章里追述厉王的句子）。

`raw/` 里的年表、注疏、他书窜入，不当作无出处的生卒依据。《十二诸侯年表》抽出后不是网格，只可引序文。
