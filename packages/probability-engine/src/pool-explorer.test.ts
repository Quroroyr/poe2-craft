import { describe, expect, it } from 'vitest';
import { akoyanSpearFixture, createCraftDb, type CraftDataset } from '@poe2-craft/craft-db';
import { createItemState, familyTemplate, type ItemState, type ModifierDefinition } from '@poe2-craft/craft-domain';
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
    expect(projectile.label).toBe('+# to Level of all Projectile Skills');
    expect(projectile.groupLabel).toBe('Level of all Projectile Skills');
    expect(projectile.status).toBe('eligible');
    const crit = suffix.groups.find((g) => g.key === 'group.local-critical-chance')!;
    expect(crit.status).toBe('already-present');
  });
});

describe('family labels', () => {
  const line = (template: string, ...ranges: [number, number][]) => ({ template, ranges: ranges.map(([min, max]) => ({ min, max })) });
  const tierOf = (...lines: ReturnType<typeof line>[]) => ({ lines });

  it('come from the tiers templates: numbers that differ between tiers become #', () => {
    expect(familyTemplate([tierOf(line('+1 to Level of all Fire Spell Skills')), tierOf(line('+5 to Level of all Fire Spell Skills'))])).toBe('+# to Level of all Fire Spell Skills');
    expect(familyTemplate([tierOf(line('Adds 1 to # Lightning Damage', [3, 5])), tierOf(line('Adds # to # Lightning Damage', [2, 3], [30, 40]))])).toBe('Adds # to # Lightning Damage');
    // A number every tier shares is part of the wording, not a rolled value.
    expect(familyTemplate([tierOf(line('#% increased Spell Damage per 100 maximum Mana', [1, 2])), tierOf(line('#% increased Spell Damage per 100 maximum Mana', [3, 4]))])).toBe('#% increased Spell Damage per 100 maximum Mana');
    expect(familyTemplate([tierOf(line('#% increased Spell Damage', [10, 20]), line('+# to maximum Mana', [5, 9]))])).toBe('#% increased Spell Damage / +# to maximum Mana');
  });

  // Regression: on a Wand, "#% increased Spell Damage" tiers were listed under "#% increased Trap
  // Damage" — the name of the collision group they share with a trap modifier.
  it('never take the collision group name, even when the group was named after another family', () => {
    const dataset: CraftDataset = {
      ...akoyanSpearFixture,
      groups: akoyanSpearFixture.groups.map((g) => (g.id === 'group.projectile-skill-levels' ? { ...g, name: '+5 to Level of all Fire Spell Skills' } : g)),
    };
    const fixtureDb = createCraftDb(dataset);
    const pool = buildEligiblePool({ item: spear(), context: { gameVersion: '0.5.0' }, db: fixtureDb, actionId: 'action.add-random-modifier' });
    if (pool.status !== 'ready') throw new Error('blocked');
    const projectile = tab(explorePool(pool, fixtureDb.forVersion('0.5.0')).tabs, 'suffix').groups.find((g) => g.key === 'group.projectile-skill-levels')!;
    expect(projectile.label).toBe('+# to Level of all Projectile Skills');
    expect(projectile.groupLabel).toBe('+5 to Level of all Fire Spell Skills');
  });

  it('keeps families with the same wording apart and tells them apart by tags', () => {
    const projectile = akoyanSpearFixture.modifiers.filter((m) => m.groupIds.includes('group.projectile-skill-levels'));
    const twin = projectile.map((m): ModifierDefinition => ({ ...m, id: `${m.id}.twin`, family: 'ProjectileTwin', groupIds: ['group.melee-skill-levels'], tags: ['gem', 'twin_tag'] }));
    const fixtureDb = createCraftDb({ ...akoyanSpearFixture, modifiers: [...akoyanSpearFixture.modifiers, ...twin] });
    const pool = buildEligiblePool({ item: spear(), context: { gameVersion: '0.5.0' }, db: fixtureDb, actionId: 'action.add-random-modifier' });
    if (pool.status !== 'ready') throw new Error('blocked');
    const same = tab(explorePool(pool, fixtureDb.forVersion('0.5.0')).tabs, 'suffix').groups.filter((g) => g.label === '+# to Level of all Projectile Skills');
    expect(same.map((g) => g.key).sort()).toEqual(['ProjectileTwin', 'group.projectile-skill-levels']);
    expect(same.find((g) => g.key === 'ProjectileTwin')!.detail).toBe('twin_tag');
    // The original family has no tag of its own: its id tells it apart.
    expect(same.find((g) => g.key !== 'ProjectileTwin')!.detail).toBe('group.projectile-skill-levels');
  });
});
