import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  rmSync,
  existsSync,
  symlinkSync,
  mkdirSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { parseContentBatch, type ContentBatch, type ContentCandidate } from '../pipeline/content-batch';
import { applyEventBatch, checkEventBatch, preflightEventBatch } from '../pipeline/event-production';
import { formatEventMarkdown, formatEventIndex, eventIndexRows, readEventMarkdown } from '../pipeline/event-md';
import type { RegistryEvent } from '../pipeline/types';

const root = mkdtempSync(join(tmpdir(), 'lantai-admission-'));
cpSync(resolve('pipeline'), join(root, 'pipeline'), { recursive: true });
cpSync(resolve('content'), join(root, 'content'), { recursive: true });
const originalIndex = readFileSync(join(root, 'content/events.md'), 'utf8');
afterEach(() => {
  for (const file of readdirSync(join(root, 'content/events'))) {
    if (file.startsWith('test-')) rmSync(join(root, 'content/events', file));
  }
  writeFileSync(join(root, 'content/events.md'), originalIndex);
  rmSync(join(root, 'workspace'), { recursive: true, force: true });
});
after(() => rmSync(root, { recursive: true, force: true }));

// Synthetic fixtures test admission mechanics, not historical truth.
function event(id = 'test-reform', extra: Partial<RegistryEvent> = {}): RegistryEvent {
  return {
    id,
    status: 'published',
    name: '测试改革',
    display: '改革',
    type: 'institutional',
    catalogs: ['history'],
    importance: 2,
    year: 700,
    yearAccuracy: 'exact',
    polity: ['tang'],
    sources: [
      { work: '测试甲书', part: '卷一', kind: 'classic' },
      { work: '测试乙书', part: '卷二', kind: 'classic' },
    ],
    ...extra,
  };
}
function candidate(value = event(), before: string | null = null): ContentCandidate {
  const proposal = {
    id: value.id,
    operation: before === null ? ('publish' as const) : ('revise' as const),
    author: 'fixture-writer',
    before,
    after: formatEventMarkdown(value),
    admission: '测试制度变化收录理由',
    evidence: value.sources!.map((s, i) => ({
      id: `s${i}`,
      work: s.work,
      locator: s.part!,
      excerpt: '测试摘录，仅用于自动化负例与正例。',
    })),
    claims: [{ text: '测试字段支持映射', fields: Object.keys(value), sourceIds: ['s0'] }],
  };
  return {
    proposal,
    review: {
      reviewer: 'fixture-reviewer',
      decision: 'pass',
      reason: '测试审核结论',
      reviewedProposal: structuredClone(proposal),
    },
  };
}
function batch(...items: ContentCandidate[]): ContentBatch {
  return {
    schemaVersion: 2,
    id: 'test-batch',
    scope: { description: '仅测试候选', eventIds: items.map((i) => i.proposal.id) },
    items,
  };
}
function seed(value: RegistryEvent): string {
  const text = formatEventMarkdown(value);
  writeFileSync(join(root, `content/events/${value.id}.md`), text);
  const files = readEventMarkdown(join(root, 'content')).filter((f) => f.path !== 'content/events.md');
  writeFileSync(join(root, 'content/events.md'), formatEventIndex(eventIndexRows(files)!));
  return text;
}
function reasons(value: ContentBatch): string {
  const result = checkEventBatch(value, root);
  return JSON.stringify([result.items, result.errors]);
}

test('检查可发布候选只读，不要求 Run、hash 或 Harness 路径', () => {
  const result = checkEventBatch(batch(candidate()), root);
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.items[0].state, 'ready');
  assert.equal(existsSync(join(root, 'content/events/test-reform.md')), false);
  assert.equal(existsSync(join(root, 'workspace')), false);
});

test('缺审核、自审与候选或证据变化均进入 pending', () => {
  const item = candidate();
  delete item.review;
  assert.match(reasons(batch(item)), /尚无独立审核/);
  const self = candidate();
  self.review!.reviewer = self.proposal.author;
  assert.match(reasons(batch(self)), /起草者不能/);
  const changed = candidate();
  changed.proposal.evidence[0].excerpt = '修改后的摘录';
  assert.match(reasons(batch(changed)), /STALE_REVIEW/);
});

test('重新审核存量修订：双出处和完整事实映射均为硬门槛', () => {
  const old = seed(event());
  const revised = candidate(event('test-reform', { result: '制度改变。' }), old);
  assert.equal(checkEventBatch(batch(revised), root).ok, true);
  const one = candidate(event('test-reform', { sources: [event().sources![0]] }), old);
  assert.match(reasons(batch(one)), /EVENT_PUBLISH_SOURCES/);
  const database = candidate(
    event('test-reform', { sources: [event().sources![0], { work: '测试库', part: '条目', kind: 'database' }] }),
    old,
  );
  assert.match(reasons(batch(database)), /EVENT_PUBLISH_SOURCES/);
  revised.proposal.claims[0].fields = ['result'];
  revised.review!.reviewedProposal = structuredClone(revised.proposal);
  assert.match(reasons(batch(revised)), /缺少 year 的依据映射/);
});

test('已有 draft 可以发布，已发布记录不能伪装成 publish', () => {
  const old = seed(event('test-reform', { status: 'draft' }));
  const item = candidate(event(), old);
  item.proposal.operation = 'publish';
  item.review!.reviewedProposal = structuredClone(item.proposal);
  assert.equal(checkEventBatch(batch(item), root).ok, true);
  seed(event());
  item.proposal.before = formatEventMarkdown(event());
  item.review!.reviewedProposal = structuredClone(item.proposal);
  assert.match(reasons(batch(item)), /publish 只接受/);
});

test('候选不能改 id、绕过状态或覆盖已有同名文件', () => {
  const wrong = candidate();
  wrong.proposal.after = formatEventMarkdown(event('test-other'));
  wrong.review!.reviewedProposal = structuredClone(wrong.proposal);
  assert.match(reasons(batch(wrong)), /文件名不一致/);
  const draft = candidate(event('test-reform', { status: 'draft' }));
  assert.match(reasons(batch(draft)), /after 必须/);
  seed(event('test-reform', { result: '他人的修改。' }));
  assert.match(reasons(batch(candidate())), /CONFLICT/);
});

test('部分通过只应用合格项，pending 保留证据、原因与原始候选', () => {
  const yes = candidate();
  const no = candidate(event('test-second'));
  delete no.review;
  const result = applyEventBatch(batch(yes, no), root, () => []);
  assert.deepEqual(result.appliedIds, ['test-reform']);
  assert.equal(result.verification, 'passed');
  assert.equal(result.ok, false);
  assert.equal(existsSync(join(root, 'content/events/test-second.md')), false);
  const pending = parseContentBatch(
    JSON.parse(readFileSync(join(root, 'workspace/content/pending/test-batch/batch.json'), 'utf8')),
  );
  assert.deepEqual(pending.items, [no]);
  assert.match(readFileSync(join(root, 'workspace/content/pending/test-batch/reasons.json'), 'utf8'), /尚无独立审核/);
  // Resume just the pending subset; the authoritative raw batch retains the already applied item.
  pending.items[0] = candidate(event('test-second'));
  const resumed = applyEventBatch(pending, root, () => []);
  assert.deepEqual(resumed.appliedIds, ['test-second']);
  assert.equal(resumed.items.find((i) => i.id === 'test-reform')?.state, 'already-applied');
  assert.equal(
    parseContentBatch(JSON.parse(readFileSync(join(root, 'workspace/content/raw/test-batch/batch.json'), 'utf8'))).items
      .length,
    2,
  );
  assert.equal(existsSync(join(root, 'workspace/content/pending/test-batch/batch.json')), false);
});

test('校验失败保留已应用事实，再次执行仅验证不重复写入', () => {
  const input = batch(candidate());
  const failed = applyEventBatch(input, root, () => ['模拟 build 失败']);
  assert.equal(failed.verification, 'failed');
  assert.equal(failed.ok, false);
  const resumed = applyEventBatch(input, root, () => []);
  assert.equal(resumed.verification, 'passed');
  assert.deepEqual(resumed.appliedIds, []);
  assert.equal(resumed.items[0].state, 'already-applied');
  assert.equal(preflightEventBatch(input, root).items[0].state, 'already-applied');
});

test('源文件已写但索引未写的中断可恢复', () => {
  const input = batch(candidate());
  writeFileSync(join(root, 'content/events/test-reform.md'), input.items[0].proposal.after);
  const result = applyEventBatch(input, root, () => []);
  assert.equal(result.verification, 'passed', JSON.stringify(result));
  assert.equal(result.items[0].state, 'already-applied');
  assert.match(readFileSync(join(root, 'content/events.md'), 'utf8'), /test-reform/);
});

test('未通过的组合候选不能被子事件引用；全部通过时可以共同发布', () => {
  const parent = candidate(event('test-parent', { type: 'rebellion', endYear: 710, endYearAccuracy: 'exact' }));
  const child = candidate(
    event('test-child', { partOf: [{ id: 'test-parent', note: '测试组成', sources: [event().sources![0]] }] }),
  );
  assert.equal(checkEventBatch(batch(child, parent), root).ok, true);
  delete parent.review;
  const result = checkEventBatch(batch(child, parent), root);
  assert.equal(
    result.items.every((item) => item.state === 'pending'),
    true,
    JSON.stringify(result),
  );
  assert.match(JSON.stringify(result), /不存在|未发布/);
});

test('组合循环由全局投影拦截，不写任何候选', () => {
  const a = candidate(
    event('test-a', {
      type: 'rebellion',
      endYear: 710,
      endYearAccuracy: 'exact',
      partOf: [{ id: 'test-b', note: '测试', sources: [event().sources![0]] }],
    }),
  );
  const b = candidate(
    event('test-b', {
      type: 'rebellion',
      endYear: 710,
      endYearAccuracy: 'exact',
      partOf: [{ id: 'test-a', note: '测试', sources: [event().sources![0]] }],
    }),
  );
  const result = applyEventBatch(batch(a, b), root);
  assert.deepEqual(result.appliedIds, []);
  assert.equal(result.ok, false);
  assert.match(JSON.stringify(result), /循环/);
});

test('畸形 JSON、旧协议、越界与重复 id 在写入前拒绝', () => {
  assert.throws(() => parseContentBatch({ schemaVersion: 1, runId: 'old' }), /schemaVersion/);
  const input = batch(candidate());
  input.items.push(input.items[0]);
  assert.throws(() => applyEventBatch(input, root), /重复/);
  const escape = batch(candidate());
  escape.id = '../escape';
  assert.throws(() => applyEventBatch(escape, root), /kebab/);
  const scope = batch(candidate());
  scope.scope.eventIds = ['test-other'];
  assert.throws(() => applyEventBatch(scope, root), /超出 scope/);
  assert.equal(existsSync(join(root, 'workspace')), false);
});

test('符号链接 canonical 和 workspace 不能作为写入路径', () => {
  const outside = join(root, 'outside.md');
  writeFileSync(outside, 'keep');
  symlinkSync(outside, join(root, 'content/events/test-reform.md'));
  assert.equal(checkEventBatch(batch(candidate()), root).ok, false);
  assert.equal(readFileSync(outside, 'utf8'), 'keep');
  mkdirSync(join(root, 'outside'), { recursive: true });
  symlinkSync(join(root, 'outside'), join(root, 'workspace'));
  assert.throws(() => applyEventBatch(batch(candidate()), root), /符号链接/);
});

test('同一批次不能用新修订覆盖已应用项的审核依据', () => {
  const input = batch(candidate());
  applyEventBatch(input, root, () => []);
  const revision = candidate(event('test-reform', { result: '再次修订。' }), input.items[0].proposal.after);
  assert.throws(() => applyEventBatch(batch(revision), root), /新的修订请使用新批次/);
  const archived = parseContentBatch(
    JSON.parse(readFileSync(join(root, 'workspace/content/raw/test-batch/batch.json'), 'utf8')),
  );
  assert.deepEqual(archived, input);
});

test('军事事件仅数据库出处即使有 pass 也不能准入', () => {
  const item = candidate(
    event('test-military', {
      type: 'military',
      catalogs: ['military'],
      scale: 'battle',
      polity: undefined,
      belligerents: ['tang', 'tujue'],
      place: '测试地点',
      result: '测试结果',
      sources: [{ work: '测试库', part: '条目', kind: 'database' }],
    }),
  );
  assert.match(reasons(batch(item)), /年份不能只靠 database/);
});

test('正式内容后续漂移或只换审核者也不能覆盖已接受材料', () => {
  const input = batch(candidate());
  applyEventBatch(input, root, () => []);
  const drift = seed(event('test-reform', { result: '后续版本。' }));
  const revision = candidate(event('test-reform', { result: '再后续版本。' }), drift);
  assert.throws(() => applyEventBatch(batch(revision), root), /新的修订请使用新批次/);
  const replacedReview = structuredClone(input);
  replacedReview.items[0].review!.reviewer = 'another-reviewer';
  assert.throws(() => applyEventBatch(replacedReview, root), /新的修订请使用新批次/);
  const accepted = parseContentBatch(
    JSON.parse(readFileSync(join(root, 'workspace/content/raw/test-batch/accepted.json'), 'utf8')),
  );
  assert.deepEqual(accepted.items, input.items);
});

test('人工交接：无审核预检可通过，但准入与应用仍拒绝且不写正式内容', () => {
  const item = candidate();
  delete item.review;
  const input = batch(item);
  const result = preflightEventBatch(input, root);
  assert.equal(result.checksPassed, true);
  assert.equal(result.admissionGranted, false);
  assert.equal(result.items[0].state, 'awaiting-review');
  assert.equal(existsSync(join(root, 'workspace')), false);
  assert.equal(checkEventBatch(input, root).ok, false);
  const applied = applyEventBatch(input, root);
  assert.deepEqual(applied.appliedIds, []);
  assert.equal(existsSync(join(root, 'content/events/test-reform.md')), false);
  assert.match(readFileSync(join(root, 'workspace/content/pending/test-batch/reasons.json'), 'utf8'), /尚无独立审核/);
});

test('人工交接预检不会忽略证据缺失或实体依赖错误', () => {
  const item = candidate();
  delete item.review;
  item.proposal.evidence = [];
  item.proposal.claims = [];
  assert.equal(preflightEventBatch(batch(item), root).checksPassed, false);
  const dangling = candidate(
    event('test-child', { partOf: [{ id: 'test-missing', note: '测试', sources: [event().sources![0]] }] }),
  );
  delete dangling.review;
  const result = preflightEventBatch(batch(dangling), root);
  assert.equal(result.checksPassed, false);
  assert.match(JSON.stringify(result), /不存在|未发布/);
});
