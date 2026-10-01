import type { CraftActionId, ItemState, TargetSpec } from '@poe2-craft/craft-domain';
import type { CraftDb } from '@poe2-craft/craft-db';
import { buildEligiblePool, type EligiblePool } from '@poe2-craft/probability-engine';
import { MANUAL_EDIT_ACTION, targetAsItem } from './editing';
import type { CraftSession } from './session';

/**
 * One modifier pool explorer, three jobs:
 * - inspect:     what the active tool could add to the current item;
 * - edit-source: what could legally be added to the source by hand (any side);
 * - edit-target: what could still be added to the target requirements.
 * `replaceIndex` evaluates the item as if that modifier were already removed.
 */
export type PoolMode =
  | { readonly kind: 'inspect'; readonly actionId: CraftActionId | null }
  | { readonly kind: 'edit-source'; readonly replaceIndex?: number }
  | { readonly kind: 'edit-target' };

export interface ModePool {
  readonly mode: PoolMode;
  /** The item the pool was evaluated for. */
  readonly item: ItemState | null;
  readonly pool: EligiblePool | null;
}

export function poolForMode(session: CraftSession, db: CraftDb, mode: PoolMode): ModePool {
  const item = itemForMode(session, mode);
  if (!item) return { mode, item: null, pool: null };
  const context = { gameVersion: session.gameVersion };

  if (mode.kind === 'inspect') {
    const pool = mode.actionId ? buildEligiblePool({ item, context, db, actionId: mode.actionId }) : null;
    return { mode, item, pool };
  }
  return { mode, item, pool: buildEligiblePool({ item, context, db, action: MANUAL_EDIT_ACTION }) };
}

function itemForMode(session: CraftSession, mode: PoolMode): ItemState | null {
  switch (mode.kind) {
    case 'inspect':
      return session.current;
    case 'edit-source': {
      const source = session.source;
      if (!source || mode.replaceIndex === undefined) return source;
      return { ...source, explicits: source.explicits.filter((_, i) => i !== mode.replaceIndex) };
    }
    case 'edit-target':
      return session.target ? targetAsItem(session.target, session.source) : null;
  }
}

/** A target to build from scratch on the source's base. */
export function targetForSource(source: ItemState | null): TargetSpec {
  return {
    baseId: source?.baseId ?? null,
    baseName: source?.baseName ?? null,
    itemLevel: source?.itemLevel ?? null,
    requirements: [],
    unresolvedLines: [],
  };
}
