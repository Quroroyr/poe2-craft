import type {
  AffixSide,
  Confidence,
  CraftTarget,
  GameVersion,
  ModifierId,
  Rarity,
} from '@poe2-craft/craft-domain';
import type { DatasetKind } from '@poe2-craft/craft-db';
import type { GroupOccupant, SlotSummary } from './affix-slots';
import type { EligiblePool, ExclusionCode, PoolCaveat, PoolEntry, PoolIssue } from './eligible-pool';
import type { ProbabilityResult } from './target-probability';

/**
 * One step of the "why" behind a number. Structured data, not prose: the UI decides
 * wording and language, the engine guarantees every fact used is listed.
 */
export type ExplanationStep =
  | {
      readonly code: 'dataset';
      readonly title: string;
      readonly kind: DatasetKind;
      readonly gameVersion: GameVersion;
    }
  | { readonly code: 'blocked'; readonly issues: readonly PoolIssue[] }
  | {
      readonly code: 'item';
      readonly baseName: string;
      readonly baseTags: readonly string[];
      readonly itemLevel: number;
      readonly rarity: Rarity;
    }
  | { readonly code: 'affix-slots'; readonly slots: SlotSummary }
  | { readonly code: 'occupied-groups'; readonly occupants: readonly GroupOccupant[] }
  | {
      readonly code: 'action';
      readonly name: string;
      readonly allowedSides: readonly AffixSide[];
      readonly minModifierLevel: number | null;
    }
  | {
      readonly code: 'target';
      readonly label: string;
      readonly entries: readonly PoolEntry[];
      readonly missingModifierIds: readonly ModifierId[];
    }
  | {
      readonly code: 'pool-summary';
      readonly consideredCount: number;
      readonly eligibleCount: number;
      readonly excludedByReason: Readonly<Partial<Record<ExclusionCode, number>>>;
    }
  | {
      readonly code: 'formula';
      readonly targetWeight: number;
      readonly totalWeight: number;
      readonly probability: number;
      readonly expectedAttempts: number;
      readonly confidence: Confidence;
    }
  | { readonly code: 'already-satisfied'; readonly modifierIds: readonly ModifierId[] }
  | { readonly code: 'target-weight-unknown'; readonly modifierIds: readonly ModifierId[] }
  | { readonly code: 'caveat'; readonly caveat: PoolCaveat };

export function explainCalculation(
  pool: EligiblePool,
  target: CraftTarget,
  result: ProbabilityResult,
): ExplanationStep[] {
  const steps: ExplanationStep[] = [
    {
      code: 'dataset',
      title: pool.dataset.title,
      kind: pool.dataset.kind,
      gameVersion: pool.context.gameVersion,
    },
  ];

  if (pool.status === 'blocked') {
    steps.push({ code: 'blocked', issues: pool.issues });
    return steps;
  }

  steps.push(
    {
      code: 'item',
      baseName: pool.base.name,
      baseTags: pool.base.tags,
      itemLevel: pool.itemLevel,
      rarity: pool.rarity,
    },
    { code: 'affix-slots', slots: pool.slots },
    { code: 'occupied-groups', occupants: pool.occupiedGroups },
    {
      code: 'action',
      name: pool.action.name,
      allowedSides: pool.action.effect.allowedSides,
      minModifierLevel: pool.action.effect.minModifierLevel ?? null,
    },
  );

  const wanted = new Set(target.modifierIds);
  const targetEntries = pool.entries.filter((e) => wanted.has(e.definition.id));
  const known = new Set(targetEntries.map((e) => e.definition.id));
  steps.push({
    code: 'target',
    label: target.label,
    entries: targetEntries,
    missingModifierIds: target.modifierIds.filter((id) => !known.has(id)),
  });

  const excludedByReason: Partial<Record<ExclusionCode, number>> = {};
  for (const entry of pool.entries) {
    for (const code of new Set(entry.reasons.map((r) => r.code))) {
      excludedByReason[code] = (excludedByReason[code] ?? 0) + 1;
    }
  }
  steps.push({
    code: 'pool-summary',
    consideredCount: pool.entries.length,
    eligibleCount: pool.eligible.length,
    excludedByReason,
  });

  if (result.status === 'ok') {
    steps.push({
      code: 'formula',
      targetWeight: result.targetWeight,
      totalWeight: result.totalWeight,
      probability: result.probability,
      expectedAttempts: result.expectedAttempts,
      confidence: result.confidence,
    });
  } else if (result.status === 'already-satisfied') {
    steps.push({ code: 'already-satisfied', modifierIds: result.modifierIds });
  } else if (result.status === 'indeterminate') {
    steps.push({ code: 'target-weight-unknown', modifierIds: result.modifierIds });
  }

  for (const caveat of pool.caveats) steps.push({ code: 'caveat', caveat });
  return steps;
}
