import {
  createItemState,
  rangeDecimals,
  renderModifierText,
  replaceExplicitAt,
  withExplicitModifier,
  withoutExplicitAt,
  type AffixSide,
  type CraftAction,
  type ItemState,
  type ModifierDefinition,
  type ResolvedModifier,
  type TargetSpec,
} from '@poe2-craft/craft-domain';

/**
 * Manual edits of the source item and of the target. They describe what the user already has
 * or wants; they are never crafting and never cost anything.
 */

/**
 * A modifier instance for a hand-picked tier. Values are set to the middle of each range:
 * the user picks a tier, not a roll (entering exact values is a later feature).
 */
export function manualModifier(definition: ModifierDefinition, fractured = false): ResolvedModifier {
  const values = definition.lines.flatMap((line) =>
    line.ranges.map((range) => Number(((range.min + range.max) / 2).toFixed(rangeDecimals(range)))),
  );
  return {
    kind: 'resolved',
    modifierId: definition.id,
    values,
    fractured,
    sourceText: renderModifierText(definition, values),
  };
}

export function addSourceModifier(source: ItemState, definition: ModifierDefinition): ItemState {
  return withExplicitModifier(source, manualModifier(definition));
}

export function removeSourceModifier(source: ItemState, index: number): ItemState {
  return withoutExplicitAt(source, index);
}

/** Puts another definition (another tier, or another modifier) at `index`, keeping the fractured flag. */
export function replaceSourceModifier(source: ItemState, index: number, definition: ModifierDefinition): ItemState {
  const previous = source.explicits[index];
  if (!previous) return source;
  return replaceExplicitAt(source, index, manualModifier(definition, previous.fractured));
}

/**
 * Pool rules for "which modifiers could legally be on this item": any side, any rarity with
 * affix limits. Not a game action — it is only used to evaluate pools for manual editing and
 * is never passed to applyAction.
 */
export const MANUAL_EDIT_ACTION: CraftAction = {
  id: 'app.manual-edit',
  name: 'Manual edit',
  description: 'Hand edit of the source item or the target; not a crafting action.',
  requirements: { rarities: ['normal', 'magic', 'rare', 'unique'] },
  effect: { kind: 'add-random-modifier', allowedSides: ['prefix', 'suffix'] },
  defaultCost: [],
  versions: { introducedIn: '0.0.0' },
  provenance: { sourceId: 'app', confidence: 'experimental', notes: 'Application rule set, not game data' },
};

/**
 * Pool rules for adding one modifier of `side` to the current item by hand: the manual-edit rules
 * restricted to that side, so the other side reads "side not allowed" instead of offering a pick.
 */
export function manualAddAction(side: AffixSide): CraftAction {
  return { ...MANUAL_EDIT_ACTION, effect: { kind: 'add-random-modifier', allowedSides: [side] } };
}

/**
 * The target as an item, so the same pool rules (slots, groups, item level) tell which
 * requirements can still be added. Each requirement stands in at its minimum tier.
 */
export function targetAsItem(target: TargetSpec, fallback: ItemState | null): ItemState {
  return createItemState({
    baseId: target.baseId ?? fallback?.baseId ?? null,
    baseName: target.baseName ?? fallback?.baseName ?? null,
    itemClassName: fallback?.itemClassName ?? null,
    rarity: 'rare',
    itemLevel: target.itemLevel ?? fallback?.itemLevel ?? null,
    quality: null,
    slots: [],
    explicits: target.requirements.map(
      (r): ResolvedModifier => ({
        kind: 'resolved',
        modifierId: r.modifierId,
        values: [],
        fractured: r.fractured,
        sourceText: r.modifierId,
      }),
    ),
    otherLines: [],
    corrupted: false,
  });
}
