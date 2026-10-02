import {
  isSpawnable,
  resolveSpawnWeight,
  type ExplicitModifier,
  type ModifierDefinition,
  type ModifierGroupId,
} from '@poe2-craft/craft-domain';
import type { ParsedModifierLine } from './parse-item-text';

const NUMBER = '(-?\\d+(?:\\.\\d+)?)';
// Displayed values are rounded; a small tolerance avoids rejecting 4.40 against max 4.4 etc.
const EPSILON = 1e-9;

const regexCache = new Map<string, RegExp>();

/** Turns "+#% to Critical Hit Chance" into an anchored regex capturing each "#". */
export function compileTemplate(template: string): RegExp {
  let regex = regexCache.get(template);
  if (!regex) {
    const pattern = template
      .split('#')
      .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join(NUMBER);
    regex = new RegExp(`^${pattern}$`, 'i');
    regexCache.set(template, regex);
  }
  return regex;
}

export function matchTemplate(text: string, template: string): number[] | null {
  const match = compileTemplate(template).exec(text);
  return match ? match.slice(1).map(Number) : null;
}

interface Candidate {
  readonly definition: ModifierDefinition;
  readonly values: readonly number[];
}

/** Candidates whose line templates match the span, in order. Values are not checked yet. */
function templateCandidates(
  span: readonly ParsedModifierLine[],
  definitions: readonly ModifierDefinition[],
): Candidate[] {
  const result: Candidate[] = [];
  for (const definition of definitions) {
    if (definition.lines.length !== span.length) continue;
    const values: number[] = [];
    let ok = true;
    for (let i = 0; i < span.length && ok; i++) {
      const line = definition.lines[i];
      const matched = line ? matchTemplate(span[i]?.text ?? '', line.template) : null;
      if (matched) values.push(...matched);
      else ok = false;
    }
    if (ok) result.push({ definition, values });
  }
  return result;
}

function valuesFit(candidate: Candidate): boolean {
  const ranges = candidate.definition.lines.flatMap((line) => line.ranges);
  return ranges.every((range, i) => {
    const v = candidate.values[i];
    return v !== undefined && v >= range.min - EPSILON && v <= range.max + EPSILON;
  });
}

export interface MatchOptions {
  /** Base spawn tags. When given, definitions spawnable on the base win over others with the same text. */
  readonly baseTags?: readonly string[];
  readonly tierOf?: (id: string) => number;
}

/**
 * Maps explicit lines to modifiers. Multi-line modifiers (hybrids) are tried first, then
 * shorter spans, so two independent single-line modifiers are not mistaken for a hybrid
 * unless the hybrid's value ranges actually fit. Lines grouped by an advanced-copy header
 * are always resolved as one block.
 */
export function matchExplicitLines(
  lines: readonly ParsedModifierLine[],
  definitions: readonly ModifierDefinition[],
  options: MatchOptions = {},
): ExplicitModifier[] {
  const maxSpan = Math.max(1, ...definitions.map((d) => d.lines.length));
  const result: ExplicitModifier[] = [];
  let i = 0;

  while (i < lines.length) {
    const first = lines[i];
    if (!first) break;

    if (first.blockId !== undefined) {
      let end = i;
      while (lines[end + 1]?.blockId === first.blockId) end++;
      const span = lines.slice(i, end + 1);
      result.push(resolveSpan(span, templateCandidates(span, definitions), options));
      i = end + 1;
      continue;
    }

    let consumed = 0;
    for (let k = Math.min(maxSpan, lines.length - i); k >= 1 && consumed === 0; k--) {
      const span = lines.slice(i, i + k);
      if (span.some((l) => l.blockId !== undefined)) continue;
      const candidates = templateCandidates(span, definitions);
      if (candidates.some(valuesFit) || (k === 1 && candidates.length > 0)) {
        result.push(resolveSpan(span, candidates, options));
        consumed = k;
      }
    }
    if (consumed === 0) {
      result.push(resolveSpan([first], [], options));
      consumed = 1;
    }
    i += consumed;
  }
  return result;
}

function resolveSpan(
  span: readonly ParsedModifierLine[],
  candidates: readonly Candidate[],
  options: MatchOptions,
): ExplicitModifier {
  const sourceText = span.map((l) => l.raw).join('\n');
  const fractured = span.some((l) => l.fractured);
  const header = span[0]?.header;

  let pool = candidates;
  if (header?.side) pool = pool.filter((c) => c.definition.side === header.side);
  if (options.baseTags) {
    const tags = options.baseTags;
    const spawnable = pool.filter((c) => isSpawnable(resolveSpawnWeight(c.definition, tags)));
    if (spawnable.length > 0) pool = spawnable;
  }

  let fitting = pool.filter(valuesFit);
  if (fitting.length > 1 && header?.tier !== undefined) {
    const byTier = fitting.filter((c) => (options.tierOf?.(c.definition.id) ?? c.definition.tier) === header.tier);
    if (byTier.length > 0) fitting = byTier;
  }
  if (fitting.length > 1 && header?.affixName !== undefined) {
    const byName = fitting.filter((c) => c.definition.name === header.affixName);
    if (byName.length > 0) fitting = byName;
  }

  const only = fitting.length === 1 ? fitting[0] : undefined;
  if (only) {
    return {
      kind: 'resolved',
      modifierId: only.definition.id,
      values: only.values,
      fractured,
      sourceText,
    };
  }

  const hintsFrom = fitting.length > 1 ? fitting : pool;
  const sides = new Set(hintsFrom.map((c) => c.definition.side));
  const sideHint = header?.side ?? (sides.size === 1 ? [...sides][0] : undefined);
  const groupIds = unique(hintsFrom.flatMap((c) => c.definition.groupIds));

  return {
    kind: 'unresolved',
    sourceText,
    fractured,
    reason:
      fitting.length > 1 ? 'ambiguous' : pool.length > 0 ? 'value-out-of-range' : 'no-matching-definition',
    ...(sideHint ? { sideHint } : {}),
    ...(groupIds.length > 0 ? { groupIdsHint: groupIds } : {}),
  };
}

function unique(ids: readonly ModifierGroupId[]): ModifierGroupId[] {
  return [...new Set(ids)];
}
