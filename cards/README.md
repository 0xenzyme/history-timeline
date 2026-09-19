# 人物卡片（草稿层）

从 `raw/` 史料抽出的人物卡。**卡片不是时间轴，也不进编译。** 生卒与站点名录仍以 `pipeline/registry/people/*.json` 为准；审过后再人工提升。

## 目录

`cards/<时段>/<id>.md`。时段名与 `raw/` 一级目录、卡片 YAML 的 `period` 对齐（`西周`、`春秋`、`战国`…）。跨时段的人只放主时段一处，YAML 可写 `periods: [西周, 春秋]`。

```
cards/
  README.md
  schema.md
  西周/                 专题 14 人，生年皆 unknown
    ji-hu.md            周厉王
    ji-jing.md          周宣王
    ji-gongsheng.md     周幽王
    ji-yijiu.md         周平王（兼挂春秋）
    shao-hu.md          召穆公
    zhou-dinggong.md    周定公
    rui-liangfu.md      芮良夫
    zhong-shanfu.md     仲山甫
    yin-jifu.md         尹吉甫
    guo-shifu.md        虢石父
    bo-yangfu.md        伯阳父
    bao-si.md           褒姒
    shen-hou.md         申侯
    ji-you.md           郑桓公
```

不按姓氏或拼音再拆。宋、明人多了再分子目录。

## 同音、同拼音 id

身份靠汉字，不靠拼音。`id` 只是 ASCII 文件名，沿用登记习惯（名的拼音，无声调）。

1. **已占用的 id 不改名。** `ji-hu` 永远是厉王姬胡；提升到 registry 时也不重命名。
2. **后出现的同拼音的人加后缀** `ji-hu-<token>`。`token` 取最短能分开的通行称呼，顺序：谥号/爵称（`xuanwang`）→ 国或氏（`jin`、`zheng`）→ 字（`ziwen`）→ 活动下限年（`d828`，仅当前面都没有时）。
3. 不要用 `ji-hu-2`，也不要靠声调数字（`ji-hu3`）。
4. YAML 必填 `name`、`display`、`aliases`。检索 `raw/` 只用汉字别名（含繁体），不用拼音。
5. 需要说明时写 `idNote`，例如：`与厉王姬胡同拼音，后缀取晋`。

卡片和 registry 对不上时，以汉字 `name` + `display` 查表，不以拼音猜测。

新发现、尚未入登记表的人：自拟草稿 id，`status: candidate`。

## 流水线

`raw/` 是卷篇散文，不是结构化年表。抽出的《史记·十二诸侯年表》只剩序文和年份列表，**不能当生卒表解析**。检索只用汉字别名（脚本会附带常见繁体），不扫全库抽名。

```powershell
python -X utf8 raw/extract_people.py --ids ji-hu,ji-jing,rui-liangfu
python -X utf8 raw/extract_people.py --ids ji-hu --dry-run
python -X utf8 raw/extract_people.py --check
```

1. **检索**：按汉字别名在指定 `raw/` 路径里找命中，切出带路径/行号的片段。
2. **起草**：默认写出「待填」卡（`## 引文候选`）。`--fill` 若已有 registry，会把登记 bio 拆成纪要，并把候选改成 `## 引文`；仍须人看过引文是否张冠李戴。
3. **落盘**：只写 `cards/<period>/<id>.md`。已有卡默认不覆盖（`--force` 才覆盖）。不改 JSON，不跑 `npm run content`。

西周检索入口写在 `raw/extract_people.py` 的 `PEOPLE`。主要卷篇：周本纪、国语周语上/郑语、郑世家、诗经《江汉》《六月》《烝民》、兮甲盘、今本竹书周纪。`史記/卷014-十二諸侯年表.md` 抽出后不是逐年格，标为 optional。

## 不做什么

- 不自动把卡片提升到 `pipeline/registry/people/`
- 不改时间轴人数、关系、章节
- 不从 5557 页通跑抽名人录
- 不把 Wikidata / CBDB 当出处
