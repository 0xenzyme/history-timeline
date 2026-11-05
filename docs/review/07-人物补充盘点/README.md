# 07 · 人物补充盘点

> 本目录汇集 2026-10-10 全库人物收录审计的现状盘点与 7 份分组缺口报告。原文在临时目录 `.audit/`，本次迁入正式文档目录；正文结论原样保留，只在各文件顶部加一行来源说明。

## 文件索引

| 文件 | 来源 | 覆盖专题 |
|---|---|---|
| `01-现状盘点.md` | `.audit/people-inventory.md` | 17 专题现状：人数、泳道计数、brief/full、生卒缺失、关系覆盖、时间空档、悬空引用、`content:check` 原始输出 |
| `02-先秦.md` | `.audit/gaps-xianqin.md` | xizhou / chunqiu / zhanguo / qin |
| `03-秦汉三国.md` | `.audit/gaps-han-sanguo.md` | han / donghan / sanguo |
| `04-魏晋南北朝.md` | `.audit/gaps-weijin.md` | liangjin / nanbei |
| `05-隋唐五代.md` | `.audit/gaps-sui-tang-wudai.md` | sui / tang / wudai |
| `06-宋元.md` | `.audit/gaps-songyuan.md` | song / yuan |
| `07-明清.md` | `.audit/gaps-ming-qing.md` | ming / qing |
| `08-儒学.md` | `.audit/gaps-rujia.md` | rujia 与各朝代专题的儒学人物 |
| `现状盘点.json` | `.audit/people-inventory.json` | 上述现状盘点的机器可读版 |

`01-现状盘点.md` 的数据基准早于本轮候选登记，因此其「候选 pending/rejected」列只反映登记前的状态。本 README 的候选数字为登记后的实测值。

## 一、方法与证据口径

以下口径来自各分组报告，是解读本目录数据的依据。

1. **逐字回 `raw/` 原文取证。** 每条候选给出不超过 40 字的原文片段、`raw/...` 路径与行号、卷篇名。先秦报告对全部 339 行候选做了脚本核验，`anchor_quote` 必须是指定行的逐字子串，结果 0 行失配。
2. **活动年口径。** 史料只给活动年、任官年或事件年时，以该年作 `approx`，note 写明「活动下限／上限，非寿数」。只有岁数、没有任何可系年的年份时，不进底册，改标「需外证」。
3. **不用数据库数字当锚点。** Wikidata、CBDB 一类数据库只用于发现线索和对排异说。年份锚点必须回到 `classic` 或 `modern` 出处。生卒有异说时写 `disputed` 并并列各说。
4. **席位口径。** 一个人进入专题，必须同时占一个结构席位、并有可引用的年份锚点。席位判定逐字按 `pipeline/PLAYBOOK.md`。
5. **id 去重。** 候选 id 与全库既有 id 和姓名双向对照，撞名者按生卒年或活动年加后缀。

## 二、17 专题现状汇总表

「名册条数」为 `pipeline/topics/<topic>/topic.json` 的 `people[]` 条数，跨专题人物按专题各计一次。「Markdown」为 `content/<topic>/` 下的 `.md` 份数。

| 专题 | 名册条数 | Markdown | 主要泳道（前 3） | 明显稀薄泳道（计数 ≤3） |
|---|---:|---:|---|---|
| 西周 `xizhou` | 142 | 126 | lord 94、minister 36、kin 7 | — |
| 春秋 `chunqiu` | 464 | 460 | minister 220、lord 192、shi 24 | — |
| 战国 `zhanguo` | 155 | 147 | ruler 76、general 29、minister 19 | — |
| 秦 `qin` | 66 | 65 | opp 17、han 15、qin-official 10 | qin-consort 2、qin-kin 3 |
| 西汉 `han` | 193 | 169 | scholar 49、consort 29、chancellor 29 | xinmang 1 |
| 东汉 `donghan` | 171 | 171 | scholar 52、general 41、consort 23 | — |
| 三国 `sanguo` | 186 | 178 | caowei 67、sunwu 46、qunxiong 37 | — |
| 两晋十六国 `liangjin` | 251 | 250 | dongjin 93、shiliuguo 75、xijin 64 | — |
| 南北朝 `nanbei` | 266 | 263 | bei 132、nan 101、wen 33 | — |
| 隋 `sui` | 71 | 68 | mowei 23、general 17、minister 13 | craft 1、consort 2 |
| 唐 `tang` | 261 | 257 | chancellor 129、end 34、general 27 | — |
| 五代十国 `wudai` | 119 | 113 | shiguo 43、emperor 15、chancellor 15 | — |
| 宋 `song` | 409 | 400 | literati 120、chancellor 111、general 53 | — |
| 元 `yuan` | 218 | 209 | literati 68、chancellor 56、general 30 | — |
| 明 `ming` | 258 | 250 | chancellor 88、literati 50、general 38 | — |
| 清 `qing` | 281 | 279 | literati 77、chancellor 62、general 47 | — |
| 儒学 `rujia` | 31 | 0 | ru 30、fa 1 | fa 1 |

说明：

- `rujia` 的 31 条登记没有 `content/rujia/`（目录不存在）：23 条 Markdown 在其他专题目录，8 条仍在 `pipeline/registry/people/`。
- 上表「稀薄」只按绝对计数 ≤3 判定。各报告另外点名的**相对稀薄**泳道（计数 >3 但明显低于同专题主力）如下：西周 king 5、kin 7；西汉 xiongnu 14、opposite 11、kin 18；东汉 kin 9、qunxiong 8；三国 shuhan 36（低于 caowei 67）；五代 literati 9、end 5、khitan 6；宋 kin 11、end 4；元 consort 18、kin 18、general 30；唐 kin 8。隋 mowei 现为 23，已是该专题人数最多的泳道；五代 general 现为 15，与 emperor、chancellor 同数。这两条不再列入。

## 三、候选人怎么落库

候选台账里的每条 `pending` 是「已判定可入册、但还没上轴」的人。下一步动作按 `pipeline/PLAYBOOK.md` 的简表流程走：

1. 运行 `npm run people:new -- <topic> <id>`，在 `content/<topic>/` 建 `content/<topic>/<id>.md`，并刷新专题索引。
2. 改这份 Markdown：填 `id`、`name`、`display`、`gender`、生卒与 `accuracy`、约略或异说的 note、`sources`（每条写 `kind`）、`polity`；`profile` 写 `brief`，正文先留空。
3. 在该专题 `topic.json` 的 `people[]` 加 `{ "id", "lane" }`；`lane` 用候选的 `seat`。
4. 从该专题 `candidates.json` 删掉这条 `pending`。（确定不收的人改成 `status: "rejected"` 并写 `reason`。）
5. 运行 `npm run content`。

每条 `pending` 的 `anchor` 已含原文片段与 `raw/…:行号`，可直接按行号回原文核对，不必重查。还留在 `pipeline/registry/people/` 的存量 44 人继续改那份 JSON，不要另建 Markdown。

## 四、缺口登记汇总表

「报告行数」为各分组报告候选表中「可直接入册」行的原始行数（跨报告重复计入）。「现存 pending」「rejected」为当前 `candidates.json` 实测条数。「报告需外证」「报告不收」为报告候选表相应判定列的行数。

| 专题 | 报告可直接入册（行） | 现存 pending | rejected | 报告需外证（行） | 报告不收（行） |
|---|---:|---:|---:|---:|---:|
| 西周 `xizhou` | 14 | 0 | 0 | 0 | 0 |
| 春秋 `chunqiu` | 227 | 1 | 0 | 8 | 0 |
| 战国 `zhanguo` | 53 | 0 | 0 | 0 | 0 |
| 秦 `qin` | 17 | 0 | 8 | 12 | 8 |
| 西汉 `han` | 62 | 0 | 0 | 7 | 0 |
| 东汉 `donghan` | 39 | 0 | 0 | 4 | 0 |
| 三国 `sanguo` | 33 | 0 | 5 | 6 | 5 |
| 两晋十六国 `liangjin` | 124 | 0 | 0 | 0 | 0 |
| 南北朝 `nanbei` | 115 | 1 | 0 | 0 | 0 |
| 隋 `sui` | 28 | 0 | 2 | 7 | 2 |
| 唐 `tang` | 82 | 0 | 0 | 40 | 0 |
| 五代十国 `wudai` | 43 | 0 | 0 | 4 | 0 |
| 宋 `song` | 148 | 4 | 47 | 2 | 0 |
| 元 `yuan` | 111 | 4 | 28 | 5 | 0 |
| 明 `ming` | 100 | 0 | 0 | 8 | 0 |
| 清 `qing` | 131 | 0 | 4 | 6 | 0 |
| 儒学 `rujia` | 24 | 0 | 0 | 6 | 0 |
| **合计** | **1351** | **10** | **94** | **115** | **15** |

补充：

- 「需外证」「不收」两列只统计候选表内的**表行**。报告正文还有散文式名单，未计入本表：宋 §4.5 的画人／词人／史家／数学／医药等、元 §4.4 的宰辅与文学、明清华 §5 的若干条目。
- 已登记的 rejected 来源见第五节 5.3。

## 五、登记复核（独立复核）

复核方法：解析全部候选表行，按各报告的小节归属到专题；再与 `pipeline/topics/*/candidates.json` 的 pending 集合逐 id 比对。

### 5.1 逐专题「报告行数 / 已登记 / 差额」

| 专题 | 报告行数 | 已登记 pending | 差额 | 说明 |
|---|---:|---:|---:|---|
| xizhou | 14 | 14 | 0 | 一致 |
| chunqiu | 227 | 227 | 0 | 一致（另 8 条「需外证」未登记） |
| zhanguo | 53 | 53 | 0 | 一致 |
| qin | 17 | 17 | 0 | 一致（另 8 条「不收」已登记 rejected） |
| han | 62 | 62 | 0 | 一致；1 条改名：`xue-xuan`（薛宣）→ `xue-xuan-bc20` |
| donghan | 39 | 39 | 0 | 一致 |
| sanguo | 33 | 33 | 0 | 一致；5 条「不收」已登记 rejected |
| liangjin | 124 | 124 | 0 | 差额已补齐；7 条撞名候选已加后缀登记：`yuan-hong-jin`、`zhang-gui-qianliang`、`zhang-shi-qianliang`、`zhang-jun-qianliang`、`zhang-zai-jin`；另 `huan-yi`→`huan-yi-jin`、`kong-yu`→`kong-yu-jin` |
| nanbei | 115 | 114 | −1 | 仅差 `chen-qian-wendi`（陈蒨）一条——已由本轮修复直接新建 `content/nanbei/chen-qian-wendi.md`，不再走台账。`li-shun`→`li-shun-beiwei`、`zhang-chang`→`zhang-chang-457` 已改名登记 |
| sui | 28 | 28 | 0 | 一致（另 2 条「不收」已登记 rejected） |
| tang | 82 | 82 | 0 | 一致（另 40 条「需外证」未登记） |
| wudai | 43 | 43 | 0 | 一致 |
| song | 148 | 147 | −1 | `ta-cha-er` 与元专题共用，只登记一次（落在 yuan）。另 `li-zhi`→`li-zhi-1090`、`wang-yan`→`wang-yan-1139` 已改名 |
| yuan | 111 | 111 | 0 | 差额已补齐；`shan-si`（赡思）已由 rejected 改判 pending；`liu-yuan`→`liu-yuan-1270` 改名；`ta-cha-er` 自宋专题并入（跨专题共用） |
| ming | 100 | 100 | 0 | 一致；1 条改名：`xu-xuan`（薛瑄）→ `xue-xuan` |
| qing | 131 | 129 | −2 | 报告 131 行含 8 行与儒学报告重复；`gao-zong-ji-hou`（乾隆继后）未以该 id 登记，同人已登记为 `long-ke-na-la` pending；台账另有 7 条不在报告表内（6 条既有 pending 经报告第四节复核维持，加 `long-ke-na-la` 由 rejected 改判） |
| rujia | 24 | 23 | −1 | `er-kuan`（儿宽）与西汉报告共用一条，只登记一次（落在 han，canonical 朝代专题） |
| **合计** | **1351** | **1346** | **−5** | |

### 5.2 待决条目

以下条目仍需人工定夺，不能归入改名或跨专题共用。

| 报告 | 行号 | id（姓名） | 说明 |
|---|---|---:|---|
| `07-明清.md` | 136 | `gao-zong-ji-hou`（乾隆继后） | 报告 id 未采用；同人已以 `long-ke-na-la` 登记为 pending。二者为同一人（乾隆继后乌喇那拉氏），只登记一条，待确认是否统一改名 |
| `08-儒学.md` | 107 | `er-kuan`（儿宽） | 报告归属 rujia，实际登记在 han（canonical 朝代专题），与西汉报告共用一条 |
| `06-宋元.md` | 158 | `ta-cha-er`（塔察兒） | 报告列在 song，实际登记在 yuan（跨专题共用一条） |

**本轮已解决（原先待核查，现已闭合）：**

- 6 条撞名候选已加后缀入 `liangjin`／`nanbei`：`yuan-hong-jin`（袁宏）、`zhang-gui-qianliang`（张轨）、`zhang-shi-qianliang`（张寔）、`zhang-jun-qianliang`（张骏）、`zhang-zai-jin`（张载·西晋）、`li-shun-beiwei`（李顺·北魏）。
- `sanguo` 的 5 条「不收」表行已入台账：`cao-gun`、`liu-li`、`xiang-chong`、`zong-yu`、`liao-hua`。
- `yuan` 的 `shan-si`（赡思）判定冲突已闭合：改判 pending（元史卷 190 赡思传「十一年，卒于家，年七十有四」→ 卒 1351 `exact`）。

### 5.3 「不收」登记来源与缺口

已登记的 87 条 rejected 来源：

- **候选表「不收」表行（15 行，全部已登记）**：秦 8、隋 2、三国 5。
- **正文散文名单按姓名补 id 登记**：宋 42、元 26、清 4。

仍未转 id 的散文名单（报告以姓名列举，未进台账）：

- 宋 §4.4「宋·宰相」28 人：史浩、陈文龙、吴潜、葛邲、钱象祖、章鉴、王爚、留梦炎、余端礼、范纯仁、苏颂、刘挚、韩缜、王随、杜衍、梁适、陈旭、韩绛、丁大全、江万里、陈尧佐、董槐、杜范、赵葵、张商英、万俟卨、汪伯彦、何㮚。
- 元 §4.4「元·宰辅」：答剌罕。宰相表无此独名，是称号不是人名，本轮不立 id；与阿剌罕 `a-la-han` 不是同一人。
- 清 §5 约 10 人：察罕帖木儿、明玉珍（已在 `content/yuan/`，跨专题跳过）、张璧、郭朴、严讷、徐祯卿、杨维桢、蒲松龄、洪昇、孔尚任。

元 §4.4 原列、现已不在上一份未转名单里的姓名：线真、秃忽鲁、老的沙、阿鲁图、汪家奴、达识帖睦迩、阿里别、麦术督丁已入 `pipeline/topics/yuan/candidates.json`；贺惟一即太平 `tai-ping`，不另立 id。

### 5.4 全库 id 唯一性检查

扫描范围与结果：

- `pipeline/topics/*/candidates.json`：17 个文件，1433 条记录。
- `content/*/*.md`：2558 份（其中人物 2046 份，事件 512 份）。
- `pipeline/registry/people/*.json`：44 份。
- 合计 4035 个 id，**重复 0 个**。

## 六、本轮发现的数据缺陷

1. **`nanbei` 的 `chen-qian` 悬空引用（已修）。** `pipeline/topics/nanbei/topic.json` 的 `chen-qian` 没有 `content/nanbei/chen-qian.md`，被解析到全库唯一的 `content/liangjin/chen-qian.md`（西晋陈骞）。本次已把该引用改为 `chen-qian-wendi`，并新建 `content/nanbei/chen-qian-wendi.md`（陈蒨／陈文帝，卒 566）。
2. **registry 人数与文档不符（已修正）。** `AGENTS.md` 与 `pipeline/PLAYBOOK.md` 原称 `pipeline/registry/people/` 还有 61 人，实测为 **44** 份。已把两处文档的 4 处「61」全部改为「44」：`AGENTS.md` 第 61 行（Content and Data Rules 段的 `The 44 people still in pipeline/registry/people/ stay JSON …`）；`pipeline/PLAYBOOK.md` 第 3 行（开头的 `还有 44 人留在 pipeline/registry/people/*.json`）、第 33 行（简表第 2 步的 `还留在 pipeline/registry/people/ 里的 44 人继续改那份 JSON`）、第 75 行（目录表的 `registry/people/` 说明）。四处同句其它口径（缺 `polity`，或约略年份没有 note）保持原意不动。

## 七、未决问题

1. **宋元席位口径（已决，2026-10-10）。** ①「宰相」席位已放宽到「宰执」：宋专题据此重开 §4.4 第一批 28 人，已登记在 `pipeline/topics/song/candidates.json`（pending 21 人、rejected 5 人、跳过 2 人），口径与名单见 `docs/seats/song-seats.md` 的「2026-10-10 口径变更：宰相席放宽到宰执」一节；②元专题 `pipeline/topics/yuan/topic.json` 的 `meta.range` 已改为 `[1140, 1385]`，`meta.subtitle` 轴终点改为「公元 1385」（章节 `views` 里 overview、wenxue、moshi 的 `to` 已是 1385；beixing、liguo、wenzhi 的 `to` 没改）。宰辅按「单个连续中书任期跨三个年头及以上」判，以宰相表卷 112–113 为准。本轮没有新增 pending。秃忽鲁 `tu-hu-lu` 由 pending 改 rejected（只跨两个年头）。线真维持 rejected，id 改为 `xian-zhen-1263`（避开春秋先轸 `xian-zhen`）。贺惟一不另立 id（即 `tai-ping`）。答剌罕不立 id（称号）。扩廓帖木儿、方国珍沿用明专题 id，未写入 yuan candidates。口径见 `docs/seats/yuan-seats.md` 的「2026-10-10 口径变更：时间窗放到 1385，宰辅放宽到宰执」一节。后来元专题 pending 已落成 brief（王蒙 `wang-meng-1385` 也落了）。扩廓帖木儿、方国珍仍不在 yuan candidates，但已用原 id 写入 yuan `topic.json`（lane 分别是 general、end：`kuokuo-tiemuer-1375`、`fang-guozhen-1376`）。
2. **宋 `zhao-fan` id 冲突。** §2.4 赵范（将帅）与 §2.6 赵蕃（文苑）撞名，报告建议赵蕃用 `zhao-fan-po`，需定稿。
3. **明清华宰相席门槛挡掉的人。** 张璧、郭朴、严讷任期不足三个年头，是否按「主持过一件已上轴战事／制度」另判，待定。
4. **散文式「不收」名单未完整入台账。** 见 5.3。宋、清的正文名单尚未逐条转 id。元 §4.4 宰辅十人里，九人已入 yuan candidates（贺惟一即 `tai-ping`）；答剌罕是称号，不立 id。
5. **需外证者尚无年份锚点。** 例如宋画人范宽、郭熙、张择端、王希孟、李唐等（`raw/` 内无传或仅一句），清龚自珍（本传无纪年），明安图、华蘅芳等。这些人在 raw 内缺可系年的锚点，本轮不入底册，须外证。
6. **儒学报告 §三 的 12 条未进候选表。** 孔门无年者（11 人合 1 条）、郑众、孙复、游酢、吕大临、蔡元定、惠栋、阮元、高相、夏侯建、孟卿、赵子，因连锚点方向都未定，只列明缺什么。
7. **两晋十六国成片缺口未登记。** 汉赵刘聪以下、后赵石弘以下、前燕慕容暐以下、前秦苻丕／苻登、成汉诸主等（见 `04-魏晋南北朝.md` 现状节）；本次只登记了可核者，前凉 `zhang-gui`／`zhang-shi`／`zhang-jun` 已加后缀登记（见 5.2）。
8. **落库后仍 pending。** 下面这些 id 仍在各专题 `candidates.json`，是故意留在台账里的，不是漏跑。春秋 `xun-yao`（锚点不是卒年）；南北朝 `mu-li-yan`（436 是继位不是卒年）；宋 `liu-shu`、`xiong-ke`、`wang-huaiyin`、`qian-yi`（本传无系年）；元 `jin-lvxiang`、`zhang-xu`、`hua-shou`、`liu-yuan-1270`（只有「大德中／至元中／至明初」）。

## 八、复核边界

- 本复核只读管线源文件，不改 `content/`、`pipeline/`、`public/`、`src/`。
- 候选表「判定」列的文字（可直接入册／需外证／不收／跨专题复用）为报告原文，复核未重新判定席位与锚点。
- 「已解决」栏的结论以本次重算的 `candidates.json` 为准。
