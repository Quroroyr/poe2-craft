import type { GameVersion, ItemState } from '@poe2-craft/craft-domain';
import type { CraftDb } from '@poe2-craft/craft-db';
import { buildEligiblePool, type ExclusionReason } from '@poe2-craft/probability-engine';
import { familyTiers, type ItemComparison, type RequirementComparison } from './compare';
import { MANUAL_EDIT_ACTION } from './editing';

/**
 * Where each target requirement stands on the current item:
 * - done:          met (the required tier or better);
 * - craft:         missing, and the family could still be added to the current item as it is
 *                  (a free slot, the group free, the item level high enough) — "докрафтить";
 * - missing:       missing, and nothing of the family can be added now (no free slot, group taken,
 *                  item level too low) or it must be fractured — "не хватает";
 * - worse-tier:    the family is there, below the minimum tier;
 * - not-fractured: the family is there, but the requirement asks for a fractured modifier;
 * - unknown:       the requirement points to a modifier this game version does not have.
 */
export type TargetRowState = 'done' | 'craft' | 'missing' | 'worse-tier' | 'not-fractured' | 'unknown';

export interface TargetOutlookRow {
  readonly comparison: RequirementComparison;
  readonly state: TargetRowState;
  /** Why a missing family cannot be added now (empty otherwise). */
  readonly reasons: readonly ExclusionReason[];
}

export interface TargetOutlook {
  readonly rows: readonly TargetOutlookRow[];
  readonly done: number;
  readonly total: number;
  /** done / total; null for a target without requirements. */
  readonly ratio: number | null;
}

/**
 * Target progress for display. "Could be added" uses the manual-edit pool (what may legally stand
 * on the item), not a particular currency: it says there is room, not how likely a roll is.
 */
export function targetOutlook(
  db: CraftDb,
  gameVersion: GameVersion,
  current: ItemState,
  comparison: ItemComparison,
): TargetOutlook {
  const view = db.forVersion(gameVersion);
  const pool = buildEligiblePool({ item: current, context: { gameVersion }, db, action: MANUAL_EDIT_ACTION });

  const rows = comparison.rows.map((row): TargetOutlookRow => {
    switch (row.status) {
      case 'matched':
      case 'better-tier':
        return { comparison: row, state: 'done', reasons: [] };
      case 'worse-tier':
        return { comparison: row, state: 'worse-tier', reasons: [] };
      case 'not-fractured':
        return { comparison: row, state: 'not-fractured', reasons: [] };
      case 'unknown':
        return { comparison: row, state: 'unknown', reasons: [] };
      case 'missing': {
        // A fractured modifier cannot be added by any implemented action.
        if (!row.definition || row.requirement.fractured || pool.status !== 'ready') {
          return { comparison: row, state: 'missing', reasons: [] };
        }
        const required = row.definition;
        const acceptable = new Set(familyTiers(view, required).filter((t) => t.tier <= required.tier).map((t) => t.id));
        const entries = pool.entries.filter((e) => acceptable.has(e.definition.id));
        if (entries.some((e) => e.eligible)) return { comparison: row, state: 'craft', reasons: [] };
        const own = entries.find((e) => e.definition.id === required.id) ?? entries[0];
        return { comparison: row, state: 'missing', reasons: own?.reasons ?? [] };
      }
    }
  });

  const done = rows.filter((r) => r.state === 'done').length;
  return { rows, done, total: rows.length, ratio: rows.length > 0 ? done / rows.length : null };
}
