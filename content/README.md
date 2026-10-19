# 人物内容

按专题分目录。秦朝是 `content/qin/ying-zheng.md` 这样的一人一文件，文件名就是 id。`content/qin.md` 是这个目录的索引。

`content/_template.md` 和 `content/_template-full.md` 是模板，不进编译。不要把模板放进朝代目录。

各专题目录都已有人物文件。同一个人不能两处都有。还有 44 人留在 `pipeline/registry/people/*.json`，因为缺 `polity`，或约略年份没有 note。专题、泳道、关系、事件、章节和 `candidates.json` 仍是 JSON。

```bash
npm run people:new -- qin <id>   # 在该专题目录按简表模板建文件，并更新索引
npm run people:format            # 文首收成规定顺序，bio 放回正文，重写索引
npm run people:check             # 格式、模板锁、索引，以及与登记相同的年份和出处规则
npm run content                  # 编译进 public/data
```

索引由 `people:format` 生成，不要手改。顺序跟 `pipeline/topics/<id>/topic.json` 的收录一致。

文首字段顺序以 `content/_template.md` 为准。`bio` 只写在第二个 `---` 之后的正文。新文件必须写 `profile`（`brief` 或 `full`）、`gender`，以及每条出处的 `kind`（`classic`、`modern` 或 `database`）。

模板里的 `polity: [han]`、`gender: male` 和「待填」都是占位，要改成这个人自己的。模板没有年份。缺年份不能编译上轴。

不要手改 `public/data`。卡片 `cards/` 仍是草稿，不参与编译。
