import {
  existsSync,
  readFileSync,
  mkdirSync,
  writeFileSync,
  renameSync,
  lstatSync,
  unlinkSync,
  openSync,
  closeSync,
} from 'node:fs';
import { dirname, join, resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { spawnSync } from 'node:child_process';

import { compileAll, compileEventDetails, compilePersonDetails, compileCollectionDetails } from './compile';
import { parseContentBatch, reviewProblems, type ContentBatch, type ContentCandidate } from './content-batch';
import { eventIndexRows, formatEventIndex, parseEventMarkdown, readEventMarkdown } from './event-md';
import { lintPipeline, lintRegistryEvent } from './lint';
import { loadPipeline } from './load';
import { checkLegacyEventManifest } from './event-migration';
import type { PipelineData, RegistryEvent, LintMessage } from './types';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export interface AdmissionItem {
  id: string;
  state: 'ready' | 'pending' | 'already-applied';
  reasons: string[];
}
export interface PublishCheckResult {
  ok: boolean;
  batchId: string;
  items: AdmissionItem[];
  errors: string[];
  warnings: LintMessage[];
}
export interface ApplyResult extends PublishCheckResult {
  appliedIds: string[];
  verification: 'not-run' | 'passed' | 'failed';
}

function readText(path: string): string | null {
  return existsSync(path) ? readFileSync(path, 'utf8') : null;
}

/** Refuse symlinks in every existing path component, including output directories. */
function safePath(root: string, path: string): string {
  const full = resolve(root, path);
  const rel = relative(root, full);
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) throw new Error(`路径越界：${path}`);
  let current = root;
  for (const part of rel.split('/')) {
    current = join(current, part);
    try {
      if (lstatSync(current).isSymbolicLink()) throw new Error(`拒绝符号链接：${current}`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  return full;
}

function canonicalPath(root: string, id: string): string {
  return safePath(root, `content/events/${id}.md`);
}

function sourceProblems(event: RegistryEvent): string[] {
  const sources = event.sources ?? [];
  const problems: string[] = [];
  if (event.type !== 'military') {
    const works = new Set(sources.filter((s) => s.kind !== 'database').map((s) => s.work.trim()));
    if (works.size < 2)
      problems.push('[EVENT_PUBLISH_SOURCES] 非军事事件需要两部不同 work 的非数据库出处，独立性由历史审核确认');
    if (!sources.some((s) => (s.kind ?? 'classic') === 'classic'))
      problems.push('[EVENT_PUBLISH_CLASSIC] 非军事事件需要至少一条 classic');
  }
  return problems;
}

function evidenceProblems(candidate: ContentCandidate, event: RegistryEvent): string[] {
  const p = candidate.proposal;
  const problems: string[] = [];
  // All maintained factual fields need support, including unchanged fields on a legacy revision.
  const facts = [
    'name',
    'type',
    'catalogs',
    'scale',
    'importance',
    'year',
    'yearAccuracy',
    'yearNote',
    'endYear',
    'endYearAccuracy',
    'endYearNote',
    'place',
    'placeNow',
    'polity',
    'belligerents',
    'commanders',
    'people',
    'result',
    'parent',
    'partOf',
    'aliases',
    'tags',
    'desc',
  ];
  for (const field of facts) {
    if (event[field as keyof RegistryEvent] !== undefined && !p.claims.some((claim) => claim.fields.includes(field))) {
      problems.push(`[CLAIM] 缺少 ${field} 的依据映射`);
    }
  }
  const cited = [...(event.sources ?? []), ...(event.partOf ?? []).flatMap((part) => part.sources)];
  for (const source of cited) {
    if (!p.evidence.some((e) => e.work === source.work && (!source.part || e.locator.includes(source.part)))) {
      problems.push(`[EVIDENCE] 缺少 ${source.work} ${source.part ?? ''} 的定位与必要摘录`);
    }
  }
  return problems;
}

function project(data: PipelineData, events: Map<string, RegistryEvent>): PipelineData {
  const paths = new Map(data.eventPaths);
  for (const id of events.keys()) paths.set(id, `content/events/${id}.md`);
  return { ...data, events, eventPaths: paths };
}

function validateProjection(data: PipelineData): LintMessage[] {
  const { catalog, topics, events } = compileAll(data);
  const messages = lintPipeline(data, topics, catalog);
  // Detail projections are part of admission, not only the two catalog views.
  compileEventDetails(data, events);
  compilePersonDetails(data, events);
  compileCollectionDetails(data, events);
  return messages;
}

function inspectEventBatch(batch: ContentBatch, root: string, requireReview: boolean): PublishCheckResult {
  // Revalidate callers as well as CLI input.
  parseContentBatch(batch);
  const result: PublishCheckResult = { ok: false, batchId: batch.id, items: [], errors: [], warnings: [] };
  let data: PipelineData;
  try {
    const migrationProblems = checkLegacyEventManifest(join(root, 'pipeline'));
    if (migrationProblems.length) throw new Error(migrationProblems.join('; '));
    const resuming = batch.items.some(
      (item) =>
        reviewProblems(item).length === 0 && readText(canonicalPath(root, item.proposal.id)) === item.proposal.after,
    );
    data = loadPipeline(join(root, 'pipeline'), { allowEventIndexDrift: resuming });
  } catch (error) {
    result.errors.push(`[BASELINE] ${String(error)}`);
    result.items = batch.items.map(({ proposal }) => ({
      id: proposal.id,
      state: 'pending',
      reasons: [...result.errors],
    }));
    return result;
  }
  const proposals = new Map<string, RegistryEvent>();
  for (const candidate of batch.items) {
    const p = candidate.proposal;
    const reasons = reviewProblems(candidate, requireReview);
    const row: AdmissionItem = { id: p.id, state: 'pending', reasons };
    result.items.push(row);
    try {
      const current = readText(canonicalPath(root, p.id));
      if (current !== p.before && current !== p.after) reasons.push('[CONFLICT] 正式文件与候选基线不同，保留当前文件');
      const parsed = parseEventMarkdown(p.after, `content/events/${p.id}.md`);
      reasons.push(...parsed.messages.filter((m) => m.level === 'error').map((m) => m.message));
      if (reasons.length && !parsed.event) continue;
      const event = parsed.event;
      if (!event) {
        reasons.push('[PARSE] 不能解析候选');
        continue;
      }
      if (event.status !== 'published')
        reasons.push('[STATUS] after 必须是目标 published 内容，候选通过前不进入正式源');
      const before = p.before === null ? undefined : parseEventMarkdown(p.before, `content/events/${p.id}.md`);
      if (before?.messages.some((m) => m.level === 'error')) reasons.push('[BASE] before 必须是可解析且格式正确的原文');
      if (p.operation === 'revise' && (!before?.event || before.event.status === 'draft'))
        reasons.push('[OPERATION] revise 只能修订已发布事件');
      if (p.operation === 'publish' && p.before !== null && before?.event?.status !== 'draft')
        reasons.push('[OPERATION] publish 只接受新事件或已有 draft');
      if (p.before === p.after) reasons.push('[NO_CHANGE] 候选没有修改');
      // Schema/type errors must stop access to nested data.
      const preliminary = lintRegistryEvent(event, {
        polityIds: new Set(data.polities.map((p) => p.id)),
        people: new Set(data.people.keys()),
        personRecords: data.people,
        events: new Map([...data.events, [p.id, event]]),
      });
      const schemaErrors = preliminary.filter(
        (m) => m.level === 'error' && /schema|值类型|取值|必填字段/.test(m.message),
      );
      if (schemaErrors.length) {
        reasons.push(...schemaErrors.map((m) => m.message));
        continue;
      }
      reasons.push(...sourceProblems(event), ...evidenceProblems(candidate, event));
      if (reasons.length === 0) {
        row.state = current === p.after ? 'already-applied' : 'ready';
        proposals.set(p.id, event);
      }
    } catch (error) {
      reasons.push(`[CANDIDATE] ${String(error)}`);
    }
  }

  // Remove invalid candidates and repeat so descendants cannot use a rejected draft dependency.
  let removed = true;
  while (removed) {
    removed = false;
    const events = new Map([...data.events, ...proposals]);
    for (const row of result.items) {
      const event = proposals.get(row.id);
      if (!event) continue;
      try {
        const messages = lintRegistryEvent(event, {
          polityIds: new Set(data.polities.map((p) => p.id)),
          people: new Set(data.people.keys()),
          personRecords: data.people,
          events,
          publishedEventIds: new Set(events.keys()),
        });
        // New/reworked records must clear their own warnings too; existing unrelated warnings remain baseline.
        if (messages.length) {
          row.reasons.push(...messages.map((m) => `${m.level}: ${m.message}`));
          row.state = 'pending';
          proposals.delete(row.id);
          removed = true;
        }
      } catch (error) {
        row.reasons.push(`[VALIDATION] ${String(error)}`);
        row.state = 'pending';
        proposals.delete(row.id);
        removed = true;
      }
    }
  }
  try {
    const baseline = validateProjection(data);
    const baselineWarnings = new Set(baseline.filter((m) => m.level === 'warning').map((m) => JSON.stringify(m)));
    const projected = validateProjection(project(data, new Map([...data.events, ...proposals])));
    result.warnings = projected.filter((m) => m.level === 'warning');
    const blocking = projected.filter((m) => m.level === 'error' || !baselineWarnings.has(JSON.stringify(m)));
    if (blocking.length) result.errors.push(...blocking.map((m) => `${m.path}: ${m.message}`));
  } catch (error) {
    result.errors.push(`[PROJECTION] ${String(error)}`);
  }
  if (result.errors.length) {
    for (const row of result.items) {
      if (row.state !== 'pending') {
        row.state = 'pending';
        row.reasons.push(...result.errors);
      }
    }
  }
  result.ok = result.errors.length === 0 && result.items.every((row) => row.state !== 'pending');
  return result;
}

/** Admission always requires an independent review. */
export function checkEventBatch(batch: ContentBatch, root = repoRoot): PublishCheckResult {
  return inspectEventBatch(batch, root, true);
}

/** Writer-only structural preflight; never produces an admission or writes files. */
export function preflightEventBatch(batch: ContentBatch, root = repoRoot) {
  const result = inspectEventBatch(batch, root, false);
  return {
    kind: 'preflight' as const,
    batchId: result.batchId,
    checksPassed: result.ok,
    admissionGranted: false as const,
    items: result.items.map((item) => ({
      ...item,
      state:
        item.state === 'pending'
          ? ('needs-revision' as const)
          : item.state === 'already-applied'
            ? ('already-applied' as const)
            : ('awaiting-review' as const),
    })),
    errors: result.errors,
    warnings: result.warnings,
  };
}

export function runPublishCheck(batchPath: string, root = repoRoot): PublishCheckResult {
  return checkEventBatch(parseContentBatch(JSON.parse(readFileSync(batchPath, 'utf8'))), root);
}

function atomicJson(root: string, path: string, value: unknown): void {
  atomicText(root, path, `${JSON.stringify(value, null, 2)}\n`);
}
function atomicText(root: string, path: string, text: string): void {
  const full = safePath(root, path);
  mkdirSync(dirname(full), { recursive: true });
  const tmp = `${full}.tmp-${process.pid}`;
  safePath(root, tmp);
  writeFileSync(tmp, text, { flag: 'wx' });
  try {
    renameSync(tmp, full);
  } finally {
    if (existsSync(tmp)) unlinkSync(tmp);
  }
}

/** Apply only ready candidates. A global projection error blocks all writes to canonical sources. */
export function applyEventBatch(batch: ContentBatch, root = repoRoot, verify?: () => string[]): ApplyResult {
  parseContentBatch(batch);
  const lock = safePath(root, 'workspace/content/.apply.lock');
  mkdirSync(dirname(lock), { recursive: true });
  const fd = openSync(lock, 'wx');
  try {
    writeFileSync(fd, `${process.pid}\n`);
    const rawPath = `workspace/content/raw/${batch.id}/batch.json`;
    const pendingPath = `workspace/content/pending/${batch.id}/batch.json`;
    const resultPath = `workspace/content/raw/${batch.id}/result.json`;
    const acceptedPath = `workspace/content/raw/${batch.id}/accepted.json`;
    const acceptedText = readText(safePath(root, acceptedPath));
    const accepted = acceptedText === null ? [] : parseContentBatch(JSON.parse(acceptedText)).items;
    for (const item of batch.items) {
      const fixed = accepted.find((entry) => entry.proposal.id === item.proposal.id);
      if (fixed && !isDeepStrictEqual(fixed, item)) {
        throw new Error(`候选 ${item.proposal.id} 已接受，新的修订请使用新批次 id，保留原审核依据`);
      }
    }
    const previous = readText(safePath(root, rawPath));
    if (previous !== null) {
      const old = parseContentBatch(JSON.parse(previous));
      if (!isDeepStrictEqual(old.scope, batch.scope)) throw new Error('同一批次 id 的 scope 已变化，请使用新批次 id');
      const items = new Map(old.items.map((item) => [item.proposal.id, item]));
      for (const item of batch.items) {
        const previousItem = items.get(item.proposal.id);
        if (
          previousItem &&
          readText(canonicalPath(root, item.proposal.id)) === previousItem.proposal.after &&
          !isDeepStrictEqual(previousItem.proposal, item.proposal)
        ) {
          throw new Error(`候选 ${item.proposal.id} 已应用，新的修订请使用新批次 id，保留原审核依据`);
        }
        items.set(item.proposal.id, item);
      }
      batch = { ...batch, items: [...items.values()] };
    }
    const checked = checkEventBatch(batch, root);
    const result: ApplyResult = { ...checked, appliedIds: [], verification: 'not-run' };
    const acceptedById = new Map(accepted.map((item) => [item.proposal.id, item]));
    for (const item of batch.items) {
      if (checked.items.some((row) => row.id === item.proposal.id && row.state !== 'pending')) {
        acceptedById.set(item.proposal.id, item);
      }
    }
    // Preserve accepted content and review before canonical writes; subsequent drift cannot erase it.
    if (acceptedById.size) atomicJson(root, acceptedPath, { ...batch, items: [...acceptedById.values()] });
    atomicJson(root, rawPath, batch);
    const pendingIds = new Set(result.items.filter((row) => row.state === 'pending').map((row) => row.id));
    const pending = batch.items.filter((item) => pendingIds.has(item.proposal.id));
    if (pending.length) atomicJson(root, pendingPath, { ...batch, items: pending });
    else {
      const path = safePath(root, pendingPath);
      if (existsSync(path)) unlinkSync(path);
    }
    atomicJson(root, resultPath, result);
    const ready = batch.items.filter((item) =>
      result.items.some((row) => row.id === item.proposal.id && row.state === 'ready'),
    );
    const indexPath = safePath(root, 'content/events.md');
    // Recheck all targets before the first write. UI changes do not participate in this check.
    for (const { proposal: p } of ready) {
      if (readText(canonicalPath(root, p.id)) !== p.before) throw new Error(`候选 ${p.id} 在预检后变化，停止应用`);
    }
    for (const { proposal: p } of ready) {
      // Recheck immediately before each write; interrupted application resumes by comparing exact after content.
      const path = canonicalPath(root, p.id);
      if (readText(path) !== p.before) throw new Error(`候选 ${p.id} 在写入前变化，停止应用`);
      atomicText(root, path, p.after);
      result.appliedIds.push(p.id);
      atomicJson(root, resultPath, result);
    }
    if (ready.length || result.items.some((row) => row.state === 'already-applied')) {
      // Only regenerate the index, never format unrelated canonical sources.
      const rows = eventIndexRows(
        readEventMarkdown(join(root, 'content')).filter((file) => file.path !== 'content/events.md'),
      );
      if (!rows) throw new Error('事件索引无法生成；已应用项保留，修复后重新执行本批次');
      atomicText(root, indexPath, formatEventIndex(rows));
    }
    if (verify && (result.appliedIds.length || result.items.some((row) => row.state === 'already-applied'))) {
      try {
        result.errors.push(...verify());
      } catch (error) {
        result.errors.push(`[VERIFY] ${String(error)}`);
      }
      result.verification = result.errors.length ? 'failed' : 'passed';
      if (result.verification === 'failed') result.ok = false;
    }
    atomicJson(root, resultPath, result);
    atomicJson(
      root,
      `workspace/content/pending/${batch.id}/reasons.json`,
      result.items.filter((row) => row.state === 'pending'),
    );
    return result;
  } finally {
    closeSync(fd);
    unlinkSync(lock);
  }
}

function main(): void {
  const [command, ...args] = process.argv.slice(2);
  if (command === '--help' || args.includes('--help') || !command) {
    console.log(
      '用法：tsx pipeline/event-production.ts preflight|publish-check|apply --batch <batch.json> [--json]\n旧 --manifest 参数可指向 v2 批次。publish-check 只读；apply 分流、应用通过项并运行 content 与 build。',
    );
    return;
  }
  let path = '';
  let json = false;
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--batch' || args[i] === '--manifest') path = args[++i] ?? '';
    else if (args[i] === '--json') json = true;
    else throw new Error(`未知参数 ${args[i]}`);
  }
  if (!path || !['preflight', 'publish-check', 'apply'].includes(command))
    throw new Error('需要 preflight|publish-check|apply --batch <batch.json>');
  const batch = parseContentBatch(JSON.parse(readFileSync(resolve(path), 'utf8')));
  if (command === 'preflight') {
    const result = preflightEventBatch(batch);
    if (json) console.log(JSON.stringify(result, null, 2));
    else {
      for (const item of result.items) console.log(`${item.state} ${item.id}: ${item.reasons.join('; ')}`);
      for (const error of result.errors) console.error(error);
      console.log('仅完成机器预检，未授予准入。已应用项不重写审核历史；未应用项交给独立审核会话：');
      console.log(
        `使用项目 event-review Skill 独立审核批次 ${resolve(path)}；核对史料并记录审核结论，再运行准入工具应用通过项，保留 pending。`,
      );
    }
    if (!result.checksPassed) process.exitCode = 1;
    return;
  }
  let result: PublishCheckResult | ApplyResult;
  if (command === 'apply') {
    result = applyEventBatch(batch, repoRoot, () => {
      for (const script of ['content', 'build']) {
        const run = spawnSync('npm', ['run', script], { cwd: repoRoot, encoding: 'utf8' });
        if (!json) {
          process.stdout.write(run.stdout ?? '');
          process.stderr.write(run.stderr ?? '');
        }
        if (run.status !== 0 || run.error) {
          if (json) process.stderr.write((run.stderr || run.stdout || '').slice(-6000));
          return [
            `[VERIFY:${script}] ${run.error?.message ?? `exit ${run.status}`}，已写入源文件但未验证完成；修复后重跑同一批次`,
          ];
        }
      }
      return [];
    });
  } else result = checkEventBatch(batch);
  if (json) console.log(JSON.stringify(result, null, 2));
  else {
    for (const item of result.items)
      console.log(`${item.state} ${item.id}${item.reasons.length ? `: ${item.reasons.join('; ')}` : ''}`);
    for (const error of result.errors) console.error(error);
    if ('verification' in result) console.log(`verification: ${result.verification}`);
  }
  if (!result.ok) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(String(error));
    process.exitCode = 1;
  }
}
