import { describe, expect, it } from 'vitest';
import { akoyanSpearFixture, createCraftDb } from '@poe2-craft/craft-db';
import { createItemState, type ItemState } from '@poe2-craft/craft-domain';
import { buildEligiblePool, explorePool, type ExplorerTab } from './index';

const db = createCraftDb(akoyanSpearFixture);
const view = db.forVersion('0.5.0');

const spear = (itemLevel = 82): ItemState =>
  createItemState({
    baseId: 'base.akoyan-spear',
    baseName: 'Akoyan Spear',
    itemClassName: 'Spears',
    rarity: 'rare',
    itemLevel,
    quality: null,
    slots: [],
    explicits: [
      {
        kind: 'resolved',
        modifierId: itemLevel >= 73 ? 'mod.local-critical-chance.t1' : 'mod.local-critical-chance.t2',
        values: [],
        fractured: true,
        sourceText: 'crit',
      },
    ],
    otherLines: [],
    corrupted: false,
  });

const explorer = (item: ItemState, actionId = 'action.add-random-modifier') => {
  const pool = buildEligiblePool({ item, context: { gameVersion: '0.5.0' }, db, actionId });
  if (pool.status !== 'ready') throw new Error('blocked');
  return explorePool(pool, view);
};
const tab = (tabs: readonly ExplorerTab[], id: string) => tabs.find((t) => t.id === id)!;
const row = (t: ExplorerTab, id: string) =>
  t.groups.flatMap((g) => g.rows).find((r) => r.entry.definition.id === id)!;

describe('modifier pool explorer', () => {
  it('splits the pool into prefix and suffix tabs with their weights', () => {
    const { tabs, totalWeight } = explorer(spear());
    expect(tabs.map((t) => t.id)).toEqual(['prefix', 'suffix']);
    expect(tab(tabs, 'prefix').eligibleWeight).toBe(15900);
    expect(tab(tabs, 'suffix').eligibleWeight).toBe(15800);
    expect(totalWeight).toBe(31700);
    const shares = tabs.flatMap((t) => t.groups.flatMap((g) => g.rows)).reduce((s, r) => s + (r.share ?? 0), 0);
    expect(shares).toBeCloseTo(1, 12);
  });

  it('only lists prefixes in the prefix tab and suffixes in the suffix tab', () => {
    const { tabs } = explorer(spear());
    for (const t of tabs) {
      for (const g of t.groups) for (const r of g.rows) expect(r.entry.definition.side).toBe(t.side);
    }
  });

  it('tells eligible, blocked, already present and excluded apart', () => {
    const suffix = tab(explorer(spear()).tabs, 'suffix');
    expect(row(suffix, 'mod.projectile-skill-levels.t1').status).toBe('eligible');
    expect(row(suffix, 'mod.local-critical-chance.t1').status).toBe('already-present');
    expect(row(suffix, 'mod.local-critical-chance.t3').status).toBe('blocked');
    expect(row(suffix, 'mod.local-critical-hybrid.t1').status).toBe('blocked');

    const lowLevel = tab(explorer(spear(70)).tabs, 'suffix');
    expect(row(lowLevel, 'mod.projectile-skill-levels.t1').status).toBe('excluded');
  });

  it('marks a whole side as blocked when the action cannot add there', () => {
    const prefix = tab(explorer(spear(), 'action.add-random-suffix').tabs, 'prefix');
    expect(prefix.eligibleWeight).toBe(0);
    expect(prefix.counts.eligible).toBe(0);
    expect(prefix.groups.every((g) => g.status === 'blocked')).toBe(true);
  });

  it('hides modifiers of other item classes but counts them', () => {
    const result = explorer(spear());
    expect(result.hiddenNotSpawnable).toBe(1); // arrow speed (bow only)
    const ids = result.tabs.flatMap((t) => t.groups.flatMap((g) => g.rows.map((r) => r.entry.definition.id)));
    expect(ids).not.toContain('mod.arrow-speed.t1');
  });

  it('summarises groups with their eligible weight and best status', () => {
    const suffix = tab(explorer(spear()).tabs, 'suffix');
    const projectile = suffix.groups.find((g) => g.key === 'group.projectile-skill-levels')!;
    expect(projectile.eligibleWeight).toBe(1250);
    expect(projectile.label).toBe('Level of all Projectile Skills');
    expect(projectile.status).toBe('eligible');
    const crit = suffix.groups.find((g) => g.key === 'group.local-critical-chance')!;
    expect(crit.status).toBe('already-present');
  });
});
