import { isDeepStrictEqual } from 'node:util';

/** Shared proposal envelope. Domain adapters own the canonical payload and its rules. */
export interface ContentEvidence {
  id: string;
  work: string;
  locator: string;
  excerpt: string;
  url?: string;
}

export interface ContentClaim {
  text: string;
  fields: string[];
  sourceIds: string[];
}

export interface ContentProposal {
  id: string;
  operation: 'publish' | 'revise';
  author: string;
  before: string | null;
  after: string;
  admission: string;
  evidence: ContentEvidence[];
  claims: ContentClaim[];
}

export interface ContentReview {
  reviewer: string;
  decision: 'pass' | 'needs-evidence' | 'needs-revision' | 'needs-decision' | 'reject';
  reason: string;
  /** Exact reviewed content and evidence, not a repository hash or execution identity. */
  reviewedProposal: ContentProposal;
}

export interface ContentCandidate {
  proposal: ContentProposal;
  review?: ContentReview;
}

export interface ContentBatch {
  schemaVersion: 2;
  id: string;
  scope: { description: string; eventIds: string[] };
  items: ContentCandidate[];
}

export const BATCH_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonempty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/** Validate untrusted JSON before any filesystem mutation. Malformed batches never partially apply. */
export function parseContentBatch(raw: unknown): ContentBatch {
  if (!record(raw) || raw.schemaVersion !== 2) {
    throw new Error(
      '需要 schemaVersion: 2 内容批次；旧 Run 材料保持原样，按当前候选重新组织，不以旧 hash 重开完成阶段',
    );
  }
  if (!nonempty(raw.id) || !BATCH_ID.test(raw.id)) throw new Error('批次 id 必须是 kebab-case');
  const scope = raw.scope;
  if (!record(scope) || !nonempty(scope.description) || !Array.isArray(scope.eventIds) || !scope.eventIds.length) {
    throw new Error('scope 必须包含 description 和非空 eventIds，范围来自用户授权');
  }
  if (scope.eventIds.some((id) => typeof id !== 'string' || !BATCH_ID.test(id))) throw new Error('非法 scope event id');
  if (new Set(scope.eventIds).size !== scope.eventIds.length) throw new Error('scope eventIds 重复');
  if (!Array.isArray(raw.items) || !raw.items.length) throw new Error('items 必须非空');
  const seen = new Set<string>();
  for (const item of raw.items) {
    if (!record(item) || !record(item.proposal)) throw new Error('每项需要 proposal');
    const p = item.proposal;
    if (!nonempty(p.id) || !BATCH_ID.test(p.id) || seen.has(p.id)) throw new Error('非法或重复的候选 id');
    seen.add(p.id);
    if (!scope.eventIds.includes(p.id)) throw new Error(`候选 ${p.id} 超出 scope`);
    if (p.operation !== 'publish' && p.operation !== 'revise') throw new Error(`候选 ${p.id} operation 不合法`);
    if (!nonempty(p.author) || (p.before !== null && typeof p.before !== 'string') || !nonempty(p.after)) {
      throw new Error(`候选 ${p.id} 需要 author、before（原文或 null）、after`);
    }
    if (typeof p.admission !== 'string' || !Array.isArray(p.evidence) || !Array.isArray(p.claims)) {
      throw new Error(`候选 ${p.id} 需要 admission、evidence、claims`);
    }
    const sources = new Set<string>();
    for (const source of p.evidence) {
      if (
        !record(source) ||
        !nonempty(source.id) ||
        sources.has(source.id) ||
        !nonempty(source.work) ||
        !nonempty(source.locator) ||
        !nonempty(source.excerpt) ||
        (source.url !== undefined && (!nonempty(source.url) || !/^https?:\/\//.test(source.url)))
      ) {
        throw new Error(`候选 ${p.id} evidence 必须有唯一 id、work、locator、excerpt 和合法可选 URL`);
      }
      sources.add(source.id);
    }
    for (const claim of p.claims) {
      if (
        !record(claim) ||
        !nonempty(claim.text) ||
        !Array.isArray(claim.fields) ||
        !claim.fields.length ||
        claim.fields.some((field) => !nonempty(field)) ||
        !Array.isArray(claim.sourceIds) ||
        !claim.sourceIds.length ||
        claim.sourceIds.some((id) => typeof id !== 'string' || !sources.has(id))
      ) {
        throw new Error(`候选 ${p.id} claim 必须有 text、fields 和可解析的 sourceIds`);
      }
    }
    if (item.review !== undefined) {
      const r = item.review;
      if (
        !record(r) ||
        !nonempty(r.reviewer) ||
        !nonempty(r.reason) ||
        !['pass', 'needs-evidence', 'needs-revision', 'needs-decision', 'reject'].includes(String(r.decision)) ||
        !record(r.reviewedProposal)
      )
        throw new Error(`候选 ${p.id} review 不合法`);
    }
  }
  return raw as unknown as ContentBatch;
}

export function reviewProblems(candidate: ContentCandidate, requireReview = true): string[] {
  const { proposal, review } = candidate;
  const problems: string[] = [];
  if (!proposal.admission.trim()) problems.push('[ADMISSION] 缺少收录理由');
  if (!proposal.evidence.length || !proposal.claims.length) problems.push('[EVIDENCE] 缺少史料与 claim');
  if (!requireReview) return problems;
  if (!review) return [...problems, '[REVIEW] 尚无独立审核'];
  if (review.reviewer.trim() === proposal.author.trim()) problems.push('[REVIEW] 起草者不能审核自己的候选');
  if (review.decision !== 'pass') problems.push(`[REVIEW:${review.decision}] ${review.reason}`);
  if (!isDeepStrictEqual(review.reviewedProposal, proposal))
    problems.push('[STALE_REVIEW] 候选或证据已变，需要重新审核');
  return problems;
}
