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
  it('separates ordinary and desecrated pools, and unknown weights stay unknown', () => {
    const base = view.findBaseByName('Akoyan Spear')!;
    const item = createItemFromBase(view, base.id, 82)!;
    const pool = buildEligiblePool({ db, context: { gameVersion: version }, item, action: MANUAL_EDIT_ACTION });
    expect(pool.status).toBe('ready');
    if (pool.status !== 'ready') return;
    expect(pool.eligible.length).toBeGreaterThan(0);
    expect(pool.eligible.every((e) => e.weight === null && e.definition.layer === 'explicit')).toBe(true);
    expect(pool.entries.filter((e) => e.definition.layer === 'desecrated').every((e) => e.reasons.some((r) => r.code === 'layer-not-allowed'))).toBe(true);
    expect(explorePool(pool, view).tabs.map((t) => t.id)).toContain('desecrated');
  });
  it('refuses item classes with unmodelled limits', () => {
    const base = view.listBases().find((b) => b.dataStatus === 'unsupported')!;
    const item = createItemFromBase(view, base.id, 82)!;
    const pool = buildEligiblePool({ db, context: { gameVersion: version }, item, action: MANUAL_EDIT_ACTION });
    expect(pool.status).toBe('blocked');
    if (pool.status === 'blocked') expect(pool.issues.map((i) => i.code)).toContain('base-not-supported');
  });
});
