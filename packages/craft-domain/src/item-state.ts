import type { AffixSide, ItemBaseId, Rarity, SlotKindId } from './item';
import type { ModifierGroupId, ModifierId } from './modifier';

/** An explicit modifier recognised against CraftDB. Holds only the stable id and rolled values. */
export interface ResolvedModifier {
  readonly kind: 'resolved';
  readonly modifierId: ModifierId;
  readonly values: readonly number[];
  readonly fractured: boolean;
  /** Text exactly as it appeared on this item — observation, not a copy of the definition. */
  readonly sourceText: string;
}

export type UnresolvedReason =
  /** No definition in CraftDB has this text. */
  | 'no-matching-definition'
  /** The text matches, but the rolled values fit no known tier. */
  | 'value-out-of-range'
  /** Several tiers fit equally well. */
  | 'ambiguous';

/**
 * An explicit line we could not map to a definition. Kept, never dropped:
 * it still occupies an affix slot and the user must see it.
 */
export interface UnresolvedModifier {
  readonly kind: 'unresolved';
  readonly sourceText: string;
  readonly fractured: boolean;
  readonly reason: UnresolvedReason;
  /** Known when every candidate definition agrees, or from an advanced (Ctrl+Alt+C) header. */
  readonly sideHint?: AffixSide;
  /** Groups of the candidate definitions; used to keep collision checks conservative. */
  readonly groupIdsHint?: readonly ModifierGroupId[];
}

export type ExplicitModifier = ResolvedModifier | UnresolvedModifier;

export type OtherLineSource = 'implicit' | 'rune' | 'enchant' | 'other';

/** Non-explicit lines (implicits, runes, ...). Recorded but not part of affix crafting in v0.1. */
export interface OtherItemLine {
  readonly source: OtherLineSource;
  readonly text: string;
}

/** How many slots of one kind the item has, e.g. 1 rune socket. Contents of the slots come later. */
export interface ItemSlotState {
  readonly kind: SlotKindId;
  readonly count: number;
}

/**
 * Immutable state of one concrete item. References definitions by stable id only;
 * full definitions live in CraftDB so data can be updated per patch without touching states.
 */
export interface ItemState {
  /** null when the base name was not found in CraftDB. */
  readonly baseId: ItemBaseId | null;
  readonly baseName: string | null;
  readonly itemClassName: string | null;
  readonly rarity: Rarity | null;
  readonly itemLevel: number | null;
  /**
   * Quality in percent; null when unknown or not applicable to the base. Recorded and shown only:
   * no engine reads it until a verified quality rule exists (crafting invariant 37).
   */
  readonly quality: number | null;
  /** Augment slots by kind; empty = none known. Like quality, not used by any calculation yet. */
  readonly slots: readonly ItemSlotState[];
  readonly explicits: readonly ExplicitModifier[];
  readonly otherLines: readonly OtherItemLine[];
  readonly corrupted: boolean;
}

export function createItemState(input: ItemState): ItemState {
  return deepFreeze({
    ...input,
    slots: input.slots.map((s) => ({ ...s })),
    explicits: input.explicits.map((m) => ({ ...m })),
    otherLines: input.otherLines.map((l) => ({ ...l })),
  });
}

/** A new state with one more explicit modifier. The original state is left untouched. */
export function withExplicitModifier(state: ItemState, modifier: ExplicitModifier): ItemState {
  return createItemState({ ...state, explicits: [...state.explicits, modifier] });
}

/** A new state with the fractured flag of the explicit at `index` set; other explicits untouched. */
export function withExplicitFractured(state: ItemState, index: number, fractured: boolean): ItemState {
  const mod = state.explicits[index];
  if (!mod || mod.fractured === fractured) return state;
  return replaceExplicitAt(state, index, { ...mod, fractured });
}

/** A new state without the explicit at `index`. */
export function withoutExplicitAt(state: ItemState, index: number): ItemState {
  return createItemState({ ...state, explicits: state.explicits.filter((_, i) => i !== index) });
}

/** A new state where the explicit at `index` is replaced, keeping its position. */
export function replaceExplicitAt(state: ItemState, index: number, modifier: ExplicitModifier): ItemState {
  return createItemState({ ...state, explicits: state.explicits.map((m, i) => (i === index ? modifier : m)) });
}

export function resolvedModifiers(state: ItemState): readonly ResolvedModifier[] {
  return state.explicits.filter((m): m is ResolvedModifier => m.kind === 'resolved');
}

export function unresolvedModifiers(state: ItemState): readonly UnresolvedModifier[] {
  return state.explicits.filter((m): m is UnresolvedModifier => m.kind === 'unresolved');
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const key of Object.keys(value)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
    Object.freeze(value);
  }
  return value;
}
