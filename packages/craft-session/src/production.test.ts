import { describe, expect, it } from 'vitest';
import { createCraftDb, productionDataset } from '@poe2-craft/craft-db';
import { buildEligiblePool, explorePool } from '@poe2-craft/probability-engine';
import { createItemFromBase, familyTiers, sourceTierOptions } from './index';
import { MANUAL_EDIT_ACTION } from './editing';

const db = createCraftDb(productionDataset);
const version = db.supportedVersions[0]!;
const view = db.forVersion(version);
describe('production applicability', () => {
  it('uses base-specific mana tiers and families', () => {
    const ring = view.listBases().find((b) => b.itemClassId === 'Ring' && !b.ambiguousName)!;
    const gloves = view.listBases().find((b) => b.itemClassId === 'Gloves' && !b.ambiguousName)!;
    expect(view.tierOf('IncreasedMana9', ring.id)).toBe(4);
    expect(view.tierOf('IncreasedMana9', gloves.id)).toBe(1);
    expect(familyTiers(view, view.getModifier('IncreasedMana9')!, gloves.id).every((m) => m.requiredItemLevel <= 60)).toBe(true);
  });
  it('separates ordinary and desecrated pools; PoE2DB weights where published, unknown elsewhere', () => {
    const base = view.findBaseByName('Akoyan Spear')!;
    const item = createItemFromBase(view, base.id, 82)!;
    const pool = buildEligiblePool({ db, context: { gameVersion: version }, item, action: MANUAL_EDIT_ACTION });
    expect(pool.status).toBe('ready');
    if (pool.status !== 'ready') return;
    expect(pool.eligible.length).toBeGreaterThan(0);
    expect(pool.eligible.every((e) => e.weight !== null && e.weight > 0 && e.definition.layer === 'explicit')).toBe(true);
    expect(pool.entries.filter((e) => e.definition.layer === 'desecrated').every((e) => e.reasons.some((r) => r.code === 'layer-not-allowed'))).toBe(true);
    expect(explorePool(pool, view).tabs.map((t) => t.id)).toContain('desecrated');
    // PoE2DB has no measurements for daggers (every row is 1): the pool stays unweighted.
    const dagger = view.listBases().find((b) => b.itemClassId === 'Dagger' && b.dataStatus === 'crafting-supported')!;
    const daggerPool = buildEligiblePool({ db, context: { gameVersion: version }, item: createItemFromBase(view, dagger.id, 82)!, action: MANUAL_EDIT_ACTION });
    if (daggerPool.status !== 'ready') throw new Error('dagger pool blocked');
    expect(daggerPool.eligible.length).toBeGreaterThan(0);
    expect(daggerPool.eligible.every((e) => e.weight === null)).toBe(true);
  });
  it('refuses item classes with unmodelled limits', () => {
    const base = view.listBases().find((b) => b.dataStatus === 'unsupported')!;
    const item = createItemFromBase(view, base.id, 82)!;
    const pool = buildEligiblePool({ db, context: { gameVersion: version }, item, action: MANUAL_EDIT_ACTION });
    expect(pool.status).toBe('blocked');
    if (pool.status === 'blocked') expect(pool.issues.map((i) => i.code)).toContain('base-not-supported');
  });
});

describe('production family labels', () => {
  const explore = (name: string) => {
    const base = view.listBases().find((b) => b.name === name)!;
    const pool = buildEligiblePool({ db, context: { gameVersion: version }, item: createItemFromBase(view, base.id, 82)!, action: MANUAL_EDIT_ACTION });
    if (pool.status !== 'ready') throw new Error(`${name} pool blocked`);
    return explorePool(pool, view);
  };
  const groups = (name: string) => explore(name).tabs.flatMap((t) => t.groups.map((g) => ({ ...g, tab: t.id })));

  // Regression: labels came from collision groups ("#% increased Trap Damage" over Spell Damage
  // tiers, "#% increased Fire Damage" over Lightning Damage tiers on a Wand).
  it('label every Wand family with its own tiers wording', () => {
    const wand = groups('Attuned Wand');
    const label = (family: string) => wand.find((g) => g.key === family)?.label;
    expect(label('WeaponSpellDamage')).toBe('#% increased Spell Damage');
    expect(label('LightningDamageWeaponPrefix')).toBe('#% increased Lightning Damage');
    expect(label('GlobalIncreaseFireSpellSkillGemLevelWeapon')).toBe('+# to Level of all Fire Spell Skills');
    expect(label('GlobalIncreaseColdSpellSkillGemLevelWeapon')).toBe('+# to Level of all Cold Spell Skills');
    expect(wand.map((g) => g.label)).not.toContain('#% increased Trap Damage');
  });

  it('every family label matches the wording of its tiers on Wand, Spear, Body Armour and Ring', () => {
    for (const name of ['Attuned Wand', 'Akoyan Spear', 'Garment', 'Gold Ring']) {
      const all = groups(name);
      for (const g of all) {
        const skeleton = (s: string) => s.replace(/#|-?\d+(?:\.\d+)?/g, '#');
        for (const r of g.rows) expect(skeleton(r.entry.definition.lines.map((l) => l.template).join(' / ')), `${name}: ${g.key}`).toBe(skeleton(g.label));
      }
      // Families that read the same would need a disambiguator; on these bases there are none.
      const labels = all.map((g) => `${g.tab}:${g.label}`);
      expect(new Set(labels).size, name).toBe(labels.length);
    }
  });
});
