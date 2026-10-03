/**
 * Catalog classification of bases: which records a player can actually hold, and the defence
 * archetype of armour bases. Derived from the data only (names, ids, trade status, tags, base
 * properties) — no base is named in code. The raw dataset keeps every record; this layer decides
 * what a user-facing catalog shows.
 */
import type { ItemBase } from '@poe2-craft/craft-domain';

/**
 * - player-facing: a base a player can find and craft on;
 * - test: a developer record (bracketed marker in the name, e.g. "[DNT] …");
 * - internal: a record that exists to carry one unique item (its export id names it a Unique);
 * - unknown: released in the client but absent from the official trade base list.
 */
export type BaseVisibility = 'player-facing' | 'test' | 'internal' | 'unknown';
export type VisibilityReason = 'dev-marker' | 'unique-only-record' | 'not-in-official-trade' | 'listed' | 'hand-written';

export interface BaseVisibilityResult {
  readonly visibility: BaseVisibility;
  readonly reason: VisibilityReason;
}

const DEV_MARKER = /^\s*\[[^\]]+\]/;

export function baseVisibility(base: Pick<ItemBase, 'id' | 'name' | 'dataStatus'>): BaseVisibilityResult {
  if (DEV_MARKER.test(base.name)) return { visibility: 'test', reason: 'dev-marker' };
  // Hand-written (fixture) bases have no data status: they are the demo catalog itself.
  if (base.dataStatus === undefined) return { visibility: 'player-facing', reason: 'hand-written' };
  const record = base.id.split('/').pop() ?? base.id;
  if (/Unique/.test(record)) return { visibility: 'internal', reason: 'unique-only-record' };
  if (base.dataStatus === 'imported') return { visibility: 'unknown', reason: 'not-in-official-trade' };
  return { visibility: 'player-facing', reason: 'listed' };
}

export const isPlayerFacing = (base: Pick<ItemBase, 'id' | 'name' | 'dataStatus'>) => baseVisibility(base).visibility === 'player-facing';

/** Attribute combination of a defence base: armour = str, evasion = dex, energy shield = int. */
export type DefenceArchetype = 'str' | 'dex' | 'int' | 'str_dex' | 'str_int' | 'dex_int' | 'str_dex_int';
export const DEFENCE_ARCHETYPES: readonly DefenceArchetype[] = ['str', 'dex', 'int', 'str_dex', 'str_int', 'dex_int', 'str_dex_int'];

const DEFENCE_PROPERTIES: readonly (readonly [string, 'str' | 'dex' | 'int'])[] = [
  ['Armour', 'str'],
  ['Evasion Rating', 'dex'],
  ['Energy Shield', 'int'],
];
const ATTRIBUTE_TAG = /^((?:str|dex|int)(?:_(?:str|dex|int))*)_armour$/;

export interface ArchetypeResult {
  /** null when the base has no defence identity; 'special' when its defences and tag disagree. */
  readonly archetype: DefenceArchetype | 'special' | null;
  readonly fromProperties: DefenceArchetype | null;
  readonly fromTag: DefenceArchetype | null;
}

/**
 * Archetype from the base's defence properties, checked against its attribute spawn tag (the tag
 * decides the modifier pool and the weight group). Both agree → that archetype; only one known →
 * that one; they disagree (bases whose defences vary by variant) → 'special'.
 */
export function defenceArchetype(base: Pick<ItemBase, 'tags' | 'details'>): ArchetypeResult {
  const props = base.details?.properties ?? [];
  const parts = DEFENCE_PROPERTIES.filter(([name]) => props.some((p) => p.name === name && parseFloat(p.value) > 0)).map(([, a]) => a);
  const fromProperties = (parts.length ? parts.join('_') : null) as DefenceArchetype | null;
  const tag = base.tags.map((t) => t.match(ATTRIBUTE_TAG)?.[1]).find((t) => t !== undefined);
  const fromTag = (tag && (DEFENCE_ARCHETYPES as readonly string[]).includes(tag) ? tag : null) as DefenceArchetype | null;
  const archetype = fromProperties && fromTag && fromProperties !== fromTag ? 'special' : (fromTag ?? fromProperties);
  return { archetype, fromProperties, fromTag };
}

export interface CatalogCounts {
  readonly total: number;
  readonly byVisibility: Readonly<Record<BaseVisibility, number>>;
  readonly byReason: Readonly<Record<VisibilityReason, number>>;
}

export function catalogCounts(bases: readonly Pick<ItemBase, 'id' | 'name' | 'dataStatus'>[]): CatalogCounts {
  const byVisibility: Record<BaseVisibility, number> = { 'player-facing': 0, test: 0, internal: 0, unknown: 0 };
  const byReason: Record<VisibilityReason, number> = { 'dev-marker': 0, 'unique-only-record': 0, 'not-in-official-trade': 0, listed: 0, 'hand-written': 0 };
  for (const base of bases) {
    const result = baseVisibility(base);
    byVisibility[result.visibility]++;
    byReason[result.reason]++;
  }
  return { total: bases.length, byVisibility, byReason };
}
