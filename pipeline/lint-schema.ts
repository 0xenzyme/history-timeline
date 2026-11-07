import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Catalog, DynastyProfile, HomeEditorial, Topic } from '../src/types';
import type { CandidateEntry, LintMessage, RegistryEvent, RegistryPerson } from './types';
import type { RegistryCollection } from '../src/types';

const pipelineRoot = dirname(fileURLToPath(new URL(import.meta.url)));

/** 内容 schema 使用的 JSON Schema 子集。支持本仓库 schema 实际用到的约束。 */
interface SchemaProp {
  title?: string;
  type?: string | string[];
  enum?: unknown[];
  const?: unknown;
  $ref?: string;
  items?: SchemaProp;
  required?: string[];
  properties?: Record<string, SchemaProp>;
  additionalProperties?: boolean;
  minLength?: number;
  minItems?: number;
  maxItems?: number;
  pattern?: string;
  $defs?: Record<string, SchemaProp>;
}

const personSchema = JSON.parse(readFileSync(join(pipelineRoot, 'schema', 'person.schema.json'), 'utf8')) as SchemaProp;

const eventSchema = JSON.parse(readFileSync(join(pipelineRoot, 'schema', 'event.schema.json'), 'utf8')) as SchemaProp;
const catalogSchema = JSON.parse(
  readFileSync(join(pipelineRoot, 'schema', 'catalog.schema.json'), 'utf8'),
) as SchemaProp;
const topicSchema = JSON.parse(readFileSync(join(pipelineRoot, 'schema', 'topic.schema.json'), 'utf8')) as SchemaProp;
const collectionSchema = JSON.parse(
  readFileSync(join(pipelineRoot, 'schema', 'collection.schema.json'), 'utf8'),
) as SchemaProp;
const dynastyProfileSchema = JSON.parse(
  readFileSync(join(pipelineRoot, 'schema', 'dynasty-profile.schema.json'), 'utf8'),
) as SchemaProp;
const homeEditorialSchema = JSON.parse(
  readFileSync(join(pipelineRoot, 'schema', 'home-editorial.schema.json'), 'utf8'),
) as SchemaProp;
const candidateSchema = JSON.parse(
  readFileSync(join(pipelineRoot, 'schema', 'candidate.schema.json'), 'utf8'),
) as SchemaProp;

function typeMatches(value: unknown, type: string): boolean {
  switch (type) {
    case 'integer':
      return typeof value === 'number' && Number.isInteger(value);
    case 'string':
      return typeof value === 'string';
    case 'array':
      return Array.isArray(value);
    case 'object':
      return typeof value === 'object' && value !== null && !Array.isArray(value);
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'null':
      return value === null;
    default:
      return true;
  }
}

function typeMismatch(value: unknown, rule: SchemaProp | undefined): boolean {
  if (!rule?.type) return false;
  const types = Array.isArray(rule.type) ? rule.type : [rule.type];
  return !types.some((type) => typeMatches(value, type));
}

function resolveSchema(rule: SchemaProp, root: SchemaProp): SchemaProp {
  if (!rule.$ref) return rule;
  const match = /^#\/\$defs\/([^/]+)$/.exec(rule.$ref);
  return match && root.$defs?.[match[1]] ? root.$defs[match[1]] : rule;
}

function schemaLabel(root: SchemaProp): string {
  return root.title ? `${root.title}.schema.json` : 'schema';
}

function lintSchemaValue(value: unknown, ruleInput: SchemaProp, root: SchemaProp, path: string): LintMessage[] {
  const messages: LintMessage[] = [];
  const rule = resolveSchema(ruleInput, root);

  if (typeMismatch(value, rule)) {
    messages.push({ level: 'error', path, message: `值类型不符合 ${schemaLabel(root)} 的 schema` });
    return messages;
  }
  if (rule.const !== undefined && value !== rule.const) {
    messages.push({ level: 'error', path, message: `值必须是 ${String(rule.const)}` });
  }
  if (rule.enum && !rule.enum.some((item) => Object.is(item, value))) {
    messages.push({ level: 'error', path, message: `取值 ${String(value)} 不合法` });
  }
  if (typeof value === 'string') {
    if (rule.minLength !== undefined && value.length < rule.minLength) {
      messages.push({ level: 'error', path, message: `字符串长度不能少于 ${rule.minLength}` });
    }
    if (rule.pattern && !new RegExp(rule.pattern).test(value)) {
      messages.push({ level: 'error', path, message: `字符串不符合格式 ${rule.pattern}` });
    }
  }
  if (Array.isArray(value)) {
    if (rule.minItems !== undefined && value.length < rule.minItems) {
      messages.push({ level: 'error', path, message: `数组至少需要 ${rule.minItems} 项` });
    }
    if (rule.maxItems !== undefined && value.length > rule.maxItems) {
      messages.push({ level: 'error', path, message: `数组最多只能有 ${rule.maxItems} 项` });
    }
    if (rule.items) {
      value.forEach((item, index) => messages.push(...lintSchemaValue(item, rule.items!, root, `${path}[${index}]`)));
    }
    return messages;
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return messages;

  const record = value as Record<string, unknown>;
  const props = rule.properties ?? {};
  for (const required of rule.required ?? []) {
    if (record[required] === undefined) {
      messages.push({ level: 'error', path, message: `缺少必填字段 ${required}` });
    }
  }
  for (const [key, child] of Object.entries(record)) {
    const rule = props[key];
    if (!rule) {
      if (resolveSchema(ruleInput, root).additionalProperties === false) {
        messages.push({ level: 'error', path, message: `字段 ${key} 不在 ${schemaLabel(root)} 中` });
      }
      continue;
    }
    messages.push(...lintSchemaValue(child, rule, root, `${path}.${key}`));
  }
  return messages;
}

export function lintPersonSchema(person: RegistryPerson, path: string): LintMessage[] {
  return lintSchemaValue(person, personSchema, personSchema, path);
}

export function lintEventSchema(event: RegistryEvent, path: string): LintMessage[] {
  return lintSchemaValue(event, eventSchema, eventSchema, path);
}

export function lintCatalogSchema(catalog: Catalog, path: string): LintMessage[] {
  return lintSchemaValue(catalog, catalogSchema, catalogSchema, path);
}

export function lintTopicSchema(topic: Topic, path: string): LintMessage[] {
  return lintSchemaValue(topic, topicSchema, topicSchema, path);
}

export function lintCandidatesSchema(entries: CandidateEntry[], path: string): LintMessage[] {
  return lintSchemaValue({ people: entries }, candidateSchema, candidateSchema, path);
}

export function lintCollectionSchema(collection: RegistryCollection, path: string): LintMessage[] {
  return lintSchemaValue(collection, collectionSchema, collectionSchema, path);
}

export function lintDynastyProfileSchema(profile: DynastyProfile, path: string): LintMessage[] {
  return lintSchemaValue(profile, dynastyProfileSchema, dynastyProfileSchema, path);
}

export function lintHomeEditorialSchema(editorial: HomeEditorial, path: string): LintMessage[] {
  return lintSchemaValue(editorial, homeEditorialSchema, homeEditorialSchema, path);
}
