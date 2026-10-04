import { familyKeyOf, familyTemplate, isSpawnable, resolveSpawnWeight, sameDomain, type AffixSide, type ModifierDefinition, type ModifierGroupId, type SpecialModifierDefinition } from '@poe2-craft/craft-domain';
import type { CraftDbView } from '@poe2-craft/craft-db';
import type { ExclusionCode, PoolEntry, ReadyPool } from './eligible-pool';

/**
 * - eligible: can be the outcome of the selected action right now;
 * - already-present: this exact modifier is on the item;
 * - blocked: could roll on this item, but the current state or the action prevents it
 *   (group taken, no free slot, side or modifier level not allowed);
 * - excluded: cannot roll on this item at all at its item level.
 */
export type ExplorerStatus = 'eligible' | 'already-present' | 'blocked' | 'excluded';

/**
 * Explorer tabs. Today a tab is an affix side; special pools (desecrated, essence-only, ...)
 * will become extra ids decided by `tabOf`, without changing consumers.
 */
export type ExplorerTabId = 'prefix' | 'suffix' | 'desecrated' | 'implicit' | 'corruption';

export interface ExplorerRow {
  readonly entry: PoolEntry;
  readonly status: ExplorerStatus;
  /** weight / total eligible weight; null unless eligible with a known weight. */
  readonly share: number | null;
  readonly tier: number;
}

export interface ExplorerGroup {
  /** Stable key of the group set (hybrids belong to several groups). */
  readonly key: string;
  readonly groupIds: readonly ModifierGroupId[];
  /** The family's own wording (`familyTemplate` of its tiers), never a collision group's name. */
  readonly label: string;
  /**
   * Set only when another family on the same tab reads exactly the same: the tags that tell this
   * one apart, else its game family id. Different families are never merged by text.
   */
  readonly detail?: string;
  /** Collision groups of the family's tiers (technical: which modifiers exclude each other). */
  readonly groupLabel: string;
  readonly rows: readonly ExplorerRow[];
  readonly eligibleWeight: number;
  readonly share: number | null;
  readonly status: ExplorerStatus;
}

export type StatusCounts = Readonly<Record<ExplorerStatus, number>>;

export interface ExplorerTab {
  readonly id: ExplorerTabId;
  readonly side: AffixSide;
  readonly groups: readonly ExplorerGroup[];
  readonly eligibleWeight: number;
  readonly share: number | null;
  readonly counts: StatusCounts;
  readonly specials?: readonly SpecialModifierDefinition[];
}

export interface PoolExplorer {
  readonly tabs: readonly ExplorerTab[];
  readonly totalWeight: number;
  /** Modifiers of other item classes: never part of this item's pool, so not listed. */
  readonly hiddenNotSpawnable: number;
}

const EXCLUDING: ReadonlySet<ExclusionCode> = new Set(['item-level-too-low', 'not-spawnable-on-base']);

export function explorerStatus(entry: PoolEntry): ExplorerStatus {
  if (entry.eligible) return 'eligible';
  const codes = new Set(entry.reasons.map((r) => r.code));
  if (codes.has('modifier-already-on-item')) return 'already-present';
  if ([...codes].some((c) => EXCLUDING.has(c))) return 'excluded';
  return 'blocked';
}

export function tabOf(definition: ModifierDefinition): ExplorerTabId {
  return definition.layer === 'desecrated' ? 'desecrated' : definition.side;
}

const TAB_ORDER: readonly ExplorerTabId[] = ['prefix', 'suffix', 'desecrated'];
// A group shows the "best" status of its tiers, so a group with any eligible tier reads as eligible.
const STATUS_RANK: readonly ExplorerStatus[] = ['eligible', 'already-present', 'blocked', 'excluded'];

/** Craft-of-Exile-style view of the pool: tabs → modifier groups → tiers, with status and share. */
export function explorePool(pool: ReadyPool, view: CraftDbView): PoolExplorer {
  const total = pool.totalKnownWeight;
  const share = (weight: number) => (total > 0 ? weight / total : null);
  let hiddenNotSpawnable = 0;

  const byTab = new Map<ExplorerTabId, Map<string, ExplorerRow[]>>();
  for (const entry of pool.entries) {
    if (entry.reasons.some((r) => r.code === 'not-spawnable-on-base' || r.code === 'wrong-domain')) {
      hiddenNotSpawnable++;
      continue;
    }
    const status = explorerStatus(entry);
    const row: ExplorerRow = {
      entry,
      tier: entry.tier,
      status,
      share: status === 'eligible' && entry.weight !== null ? share(entry.weight) : null,
    };
    const tab = tabOf(entry.definition);
    const groups = byTab.get(tab) ?? new Map<string, ExplorerRow[]>();
    const key = familyKeyOf(entry.definition);
    groups.set(key, [...(groups.get(key) ?? []), row]);
    byTab.set(tab, groups);
  }

  const tabs = TAB_ORDER.filter((id) => byTab.has(id)).map((id): ExplorerTab => {
    const groups = disambiguate([...(byTab.get(id) ?? new Map<string, ExplorerRow[]>()).entries()].map(
      ([key, rows]): ExplorerGroup => {
        const groupIds = [...new Set(rows.flatMap((r) => r.entry.definition.groupIds))];
        const eligibleWeight = sumEligible(rows);
        return {
          key,
          groupIds,
          label: familyTemplate(rows.map((r) => r.entry.definition)) || key,
          groupLabel: groupIds.map((g) => view.getGroup(g)?.name ?? g).join(' + '),
          rows,
          eligibleWeight,
          share: eligibleWeight > 0 ? share(eligibleWeight) : null,
          status: STATUS_RANK.find((s) => rows.some((r) => r.status === s)) ?? 'excluded',
        };
      },
    ));
    const rows = groups.flatMap((g) => g.rows);
    const eligibleWeight = sumEligible(rows);
    return {
      id,
      side: id === 'suffix' ? 'suffix' : 'prefix',
      groups,
      eligibleWeight,
      share: eligibleWeight > 0 ? share(eligibleWeight) : null,
      counts: countStatuses(rows),
    };
  });

  for (const id of ['implicit', 'corruption'] as const) {
    const specials = view.listSpecialModifiers().filter((m) => m.layer === id && (id === 'implicit'
      ? pool.base.implicitModifierIds?.includes(m.id)
      : sameDomain(m.domain, pool.base.domain) && isSpawnable(resolveSpawnWeight(m, pool.base.tags))));
    if (specials.length) tabs.push({ id, side: 'prefix', groups: [], eligibleWeight: 0, share: null, counts: countStatuses([]), specials });
  }

  return { tabs, totalWeight: total, hiddenNotSpawnable };
}

/** Families that read the same get a `detail`: their distinguishing tags, else the family id. */
function disambiguate(groups: readonly ExplorerGroup[]): ExplorerGroup[] {
  const byLabel = new Map<string, ExplorerGroup[]>();
  for (const g of groups) byLabel.set(g.label, [...(byLabel.get(g.label) ?? []), g]);
  return groups.map((g) => {
    const twins = (byLabel.get(g.label) ?? []).filter((o) => o !== g);
    if (twins.length === 0) return g;
    const tags = (x: ExplorerGroup) => new Set(x.rows.flatMap((r) => r.entry.definition.tags));
    const others = new Set(twins.flatMap((o) => [...tags(o)]));
    const own = [...tags(g)].filter((t) => !others.has(t));
    return { ...g, detail: own.length > 0 ? own.join(', ') : g.key };
  });
}

function sumEligible(rows: readonly ExplorerRow[]): number {
  return rows.reduce((sum, r) => sum + (r.status === 'eligible' ? (r.entry.weight ?? 0) : 0), 0);
}

function countStatuses(rows: readonly ExplorerRow[]): StatusCounts {
  const counts: Record<ExplorerStatus, number> = { eligible: 0, 'already-present': 0, blocked: 0, excluded: 0 };
  for (const r of rows) counts[r.status]++;
  return counts;
}
