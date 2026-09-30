# Spec: 补齐唐朝之前的可读底册

Created: 2026-09-30
Status: accepted

## Decision

宋到清的底册目标已经完成。这一目标从隋开始，按时间往前做南北朝、两晋、三国、两汉、秦、战国和春秋。每一朝先跑席位，只收本传或本纪能钉住生卒年的人，并写一份席位说明。不把人数检查线当成完成条件。

## Scope

- 顺序：隋、南北朝、两晋、三国、东汉、西汉、秦、战国、春秋。
- 人物生卒只写在 pipeline/registry/people/。专题只改泳道、文案、关系和事件参与者。叙事章不把底册全部铺进去。
- 年份只认同一篇纪或传里能指到的生年、卒年、薨年或被杀之年。纪传对读时，列传写明死于某事，本纪又在有年号的段落里点到这个人，才可以采用。
- 只有岁数、没有年份的，不进底册。由卒年与虚岁上推的生年写 approx，并写 birthNote。
- 席位规则沿用 pipeline/PLAYBOOK.md。一人只占一个席位。任期不够、席位不够，或年份钉不住的，写入该朝 docs 席位说明，不编假年份。
- 已有登记的人可以编入另一个专题，不另造生卒。
- 改完运行 npm run content，使 public/data/ 与源文件一致。

## Non-Goals

- 不新开辽、金、五代或十六国专题。
- 不改时间轴交互、开放条画法、JSON Schema 或设计文档全文。
- 不编造没有出处的年份，不用一个整数假装精确。
- 不为了靠近检查线放宽席位。
- 不创建 branch、commit 或 push。

## Host Execution

- 当前会话是 controller，角色是 implementer，工作方式是 local。
- 直接改 D:\sites\history 的当前 checkout。

## Acceptance Criteria

- 隋、南北朝、两晋、三国、东汉、西汉、秦、战国、春秋都有席位说明。新入册的人有出处，年份钉不住的人不入册。
- 每一朝说明写明已入册的人、占了席位但没有入册的人，以及检查线是否达到。
- npm run content:check 通过。完成前再跑 npm run build。

## Spec Acceptance Checklist

- Item: sui-seats
  - Acceptance: 隋席位按本纪列传钉年。结果写入 docs/sui-seats.md。
  - Evidence: docs/sui-seats.md；底册 15 增至 22；npm run content:check 通过（2026-09-30）
  - Status: satisfied
  - Unblocker: N/A
- Item: nanbei-seats
  - Acceptance: 南北朝席位跑完，只收能钉住年份的人，并写入 docs/nanbei-seats.md。
  - Evidence: docs/nanbei-seats.md。底册 27 增至 59。
  - Status: satisfied
  - Unblocker: N/A
- Item: liangjin-seats
  - Acceptance: 两晋席位跑完，只收能钉住年份的人，并写入 docs/liangjin-seats.md。
  - Evidence: docs/liangjin-seats.md。底册 37 增至 50。
  - Status: satisfied
  - Unblocker: N/A
- Item: sanguo-seats
  - Acceptance: 三国席位跑完，只收能钉住年份的人，并写入 docs/sanguo-seats.md。
  - Evidence: docs/sanguo-seats.md。底册 56 增至 61。
  - Status: satisfied
  - Unblocker: N/A
- Item: han-seats
  - Acceptance: 东汉、西汉席位跑完，只收能钉住年份的人，并写入各自的席位说明。
  - Evidence: docs/donghan-seats.md，42 增至 48。docs/xihan-seats.md，34 增至 40。
  - Status: satisfied
  - Unblocker: N/A
- Item: preqin-seats
  - Acceptance: 秦、战国、春秋席位跑完，只收本传能钉住年份的人，并写入各自的席位说明。
  - Evidence: docs/qin-seats.md，26 增至 31。docs/zhanguo-seats.md，31 增至 37。docs/chunqiu-seats.md，22 增至 23。
  - Status: satisfied
  - Unblocker: N/A
- Item: content-gate
  - Acceptance: npm run content 已重写生成数据，npm run content:check 通过，完成前 npm run build 通过。
  - Evidence: npm run build 通过（2026-09-30）：tsc、pipeline tsc、content:check 16 个专题、vite build。
  - Status: satisfied
  - Unblocker: N/A

## Required Gate Evidence

- Gate: spec
  - Required: yes
  - Evidence: 隋到春秋的席位说明都已写入 docs。
  - Status: satisfied
  - Unblocker: N/A
- Gate: execution
  - Required: yes
  - Evidence: 秦、战国、春秋已按席位写入 pipeline，未改界面，未 commit。
  - Status: satisfied
  - Unblocker: N/A
- Gate: integration
  - Required: yes
  - Evidence: npm run build 通过（2026-09-30）。
  - Status: satisfied
  - Unblocker: N/A

## Verification

- npm run content
- npm run content:check
- npm run build

## State Sync

- Records: harness/tasks.md, harness/status.md, harness/goals
- Evidence: 每完成一个 checklist item 就更新 Goal 与 status。

## Pause Conditions

- 材料给不出年份，而不收这个人会让某一章已经点名的结构塌掉。
- 同一人该复用旧登记还是新建，现有登记无法判断。
- 继续做下去必须改写 pipeline/PLAYBOOK.md 的席位规则。
- Spec 与更新的指令冲突，或需要凭据、付费接口、生产操作、破坏性命令。
