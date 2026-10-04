import {
  withExplicitFractured,
  type AffixSide,
  type ExplicitModifier,
  type GameVersion,
  type ItemState,
  type ModifierId,
} from '@poe2-craft/craft-domain';
import type { CraftDb, CraftDbView } from '@poe2-craft/craft-db';
import { buildEligiblePool, type ExclusionReason } from '@poe2-craft/probability-engine';
import { sameFamily } from './compare';
import { MANUAL_EDIT_ACTION, addSourceModifier, removeSourceModifier, replaceSourceModifier } from './editing';
import { sourceTierOptions, type TierOption } from './item-setup';
import { currentAddOptions, isPickSelected, sourcePickOptions } from './pick';
import type { CraftSession, ManualEditModifier, ManualEditOperation, ManualEditStepRecord } from './session';

/**
 * MANUAL EDIT of the current item (ADR 009): a sandbox step — "what if this modifier were
 * different". It is recorded in the history so undo / redo walk through it, but it is not a
 * game action: no consumable, no cost, no roll. Annulment, Fracturing Orb and targeted tier
 * upgrades are future CraftActions with their own probabilities; these edits never stand in
 * for them. The item rules still hold: a new tier or modifier must be allowed on the item
 * without the one it replaces (same rules as the source setup).
 */
export type ManualEdit =
  /** A new modifier in a free slot of its side, appended to the explicits. */
  | { readonly operation: 'add'; readonly modifierId: ModifierId }
  | { readonly operation: 'retier' | 'replace'; readonly index: number; readonly modifierId: ModifierId }
  | { readonly operation: 'remove' | 'fracture' | 'unfracture'; readonly index: number };

/**
 * - no-item / no-modifier: nothing at that position;
 * - unresolved-modifier: a tier change needs the modifier's definition;
 * - unknown-modifier: the new id is not in this game version;
 * - not-same-family: a tier change must stay in the modifier's family;
 * - not-allowed: the item rules forbid it (`reasons` says why);
 * - no-change: the edit would leave the item as it is.
 */
export type ManualEditRejection =
  | 'no-item'
  | 'no-modifier'
  | 'unresolved-modifier'
  | 'unknown-modifier'
  | 'not-same-family'
  | 'not-allowed'
  | 'no-change';

export type ManualEditResult =
  | { readonly status: 'applied'; readonly session: CraftSession; readonly step: ManualEditStepRecord }
  | {
      readonly status: 'rejected';
      /** Unchanged session. */
      readonly session: CraftSession;
      readonly reason: ManualEditRejection;
      readonly reasons: readonly ExclusionReason[];
    };

export function applyManualEdit(session: CraftSession, db: CraftDb, edit: ManualEdit): ManualEditResult {
  const reject = (reason: ManualEditRejection, reasons: readonly ExclusionReason[] = []): ManualEditResult => ({
    status: 'rejected',
    session,
    reason,
    reasons,
  });
  const current = session.current;
  if (!current) return reject('no-item');
  const view = db.forVersion(session.gameVersion);
  if (edit.operation === 'add') {
    const definition = view.getModifier(edit.modifierId);
    if (!definition) return reject('unknown-modifier');
    const option = currentAddOptions(db, session.gameVersion, current, definition.side).get(edit.modifierId);
    if (!option) return reject('not-allowed', []);
    if (isPickSelected(option)) return reject('no-change');
    if (!option.allowed) return reject('not-allowed', option.reasons);
    const after = addSourceModifier(current, definition);
    const index = after.explicits.length - 1;
    return applied(session, { operation: 'add', modifierIndex: index, from: null, to: describe(after.explicits[index], view, current.baseId), before: current, after });
  }
  const mod = current.explicits[edit.index];
  if (!mod) return reject('no-modifier');

  let after: ItemState;
  switch (edit.operation) {
    case 'retier':
    case 'replace': {
      const definition = view.getModifier(edit.modifierId);
      if (!definition) return reject('unknown-modifier');
      if (edit.operation === 'retier') {
        const old = mod.kind === 'resolved' ? view.getModifier(mod.modifierId) : undefined;
        if (!old) return reject('unresolved-modifier');
        if (!sameFamily(old, definition)) return reject('not-same-family');
      }
      if (mod.kind === 'resolved' && mod.modifierId === edit.modifierId) return reject('no-change');
      const option = sourcePickOptions(db, session.gameVersion, current, edit.index).get(edit.modifierId);
      if (!option || isPickSelected(option)) return reject('not-allowed', []);
      if (!option.allowed) return reject('not-allowed', option.reasons);
      after = replaceSourceModifier(current, edit.index, definition);
      break;
    }
    case 'remove':
      after = removeSourceModifier(current, edit.index);
      break;
    case 'fracture':
    case 'unfracture': {
      const fractured = edit.operation === 'fracture';
      if (mod.fractured === fractured) return reject('no-change');
      after = withExplicitFractured(current, edit.index, fractured);
      break;
    }
  }

  const from = describe(mod, view, current.baseId);
  const to = edit.operation === 'remove' ? null : describe(after.explicits[edit.index], view, current.baseId);
  return applied(session, { operation: edit.operation, modifierIndex: edit.index, from, to, before: current, after });
}

function applied(
  session: CraftSession,
  edit: Pick<ManualEditStepRecord, 'operation' | 'modifierIndex' | 'from' | 'to' | 'before' | 'after'>,
): ManualEditResult {
  const step: ManualEditStepRecord = {
    kind: 'manual-edit',
    index: session.steps.length + 1,
    ...edit,
    label: manualEditLabel(edit.operation, edit.from, edit.to),
  };
  return {
    status: 'applied',
    step,
    // Like any new action, an edit makes the undone branch unreachable. No roll is used.
    session: { ...session, current: edit.after, steps: [...session.steps, step], redoStack: [] },
  };
}

/** Free slots of one side of the current item for a manual add, from the real affix limits. */
export interface ManualAddSlot {
  readonly side: AffixSide;
  readonly used: number;
  readonly max: number;
  /** A free slot exists and at least one modifier of this side may go into it. */
  readonly canAdd: boolean;
}

/**
 * Whether "Add prefix" / "Add suffix" can do anything on the current item: the slot count comes
 * from the affix limits of its rarity and class, and a free slot only counts when the pool rules
 * (base, item level, groups, domain) leave at least one modifier for it. null when the item has no
 * pool at all (unknown base, unsupported class, unknown limits) — there is nothing to add from.
 */
export function manualAddSlots(db: CraftDb, gameVersion: GameVersion, current: ItemState): Readonly<Record<AffixSide, ManualAddSlot>> | null {
  const pool = buildEligiblePool({ item: current, context: { gameVersion }, db, action: MANUAL_EDIT_ACTION });
  if (pool.status !== 'ready') return null;
  const slot = (side: AffixSide): ManualAddSlot => {
    const s = pool.slots[side];
    return { side, used: s.used, max: s.max, canAdd: s.free > 0 && pool.eligible.some((e) => e.definition.side === side) };
  };
  return { prefix: slot('prefix'), suffix: slot('suffix') };
}

/**
 * Tiers of the family of the current item's modifier at `index`, best first, each with whether
 * the item allows it once the old tier is gone. The same rule the source setup uses.
 */
export function currentTierOptions(
  db: CraftDb,
  gameVersion: GameVersion,
  current: ItemState,
  index: number,
): readonly TierOption[] {
  return sourceTierOptions(db, gameVersion, current, index);
}

/**
 * The next better tier of the family, from the real tier list — not `tier - 1`, which may not
 * exist. null at the best tier or when the modifier is not in the list.
 */
export function betterTierOption(options: readonly TierOption[], modifierId: ModifierId): TierOption | null {
  const at = options.findIndex((o) => o.definition.id === modifierId);
  return at > 0 ? (options[at - 1] ?? null) : null;
}

function describe(mod: ExplicitModifier | undefined, view: CraftDbView, baseId: string | null): ManualEditModifier {
  const definition = mod?.kind === 'resolved' ? view.getModifier(mod.modifierId) : undefined;
  return {
    modifierId: mod?.kind === 'resolved' ? mod.modifierId : null,
    text: mod?.sourceText ?? '',
    tier: definition ? view.tierOf(definition.id, baseId) : null,
    side: definition?.side ?? null,
  };
}

function manualEditLabel(operation: ManualEditOperation, from: ManualEditModifier | null, to: ManualEditModifier | null): string {
  const tier = (m: ManualEditModifier | null) => (m?.tier ? `T${m.tier}` : '?');
  const was = from?.text ?? '';
  switch (operation) {
    case 'add':
      return `Manual edit: add ${tier(to)} "${to?.text ?? ''}"`;
    case 'retier':
      return `Manual edit: retier ${tier(from)} → ${tier(to)} (${was})`;
    case 'replace':
      return `Manual edit: replace "${was}" with "${to?.text ?? ''}"`;
    case 'remove':
      return `Manual edit: remove "${was}"`;
    case 'fracture':
      return `Manual edit: mark fractured "${was}"`;
    case 'unfracture':
      return `Manual edit: unmark fractured "${was}"`;
  }
}
