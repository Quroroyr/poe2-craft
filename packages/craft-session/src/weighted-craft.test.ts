/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createCraftDb, productionDataset } from '@poe2-craft/craft-db';
import { createItemState, renderModifierText, type ItemState, type ModifierDefinition } from '@poe2-craft/craft-domain';
import { buildEligiblePool, calculateTargetProbability, type ReadyPool } from '@poe2-craft/probability-engine';
import type { PriceSnapshot } from '@poe2-craft/economy';
import { applyAction } from './apply-action';
import { createItemFromBase } from './item-setup';
import { applyToolStep, createSession, redoStep, sessionSpent, undoLastStep } from './session';

// Real data: PoE2DB weights (community) on the Akoyan Spear — a fully weighted golden base.
const db = createCraftDb(productionDataset);
const version = db.supportedVersions[0]!;
const view = db.forVersion(version);
const context = { gameVersion: version };
const golden = (name: string) => JSON.parse(readFileSync(new URL(`../../craft-db/src/production/golden/${name}.json`, import.meta.url), 'utf8'));
const spear = golden('akoyan-spear');
const blankRare = createItemFromBase(view, spear.baseId, 82)!;
const PRICES = { exalted: 1, transmute: 0.1, aug: 0.2, regal: 0.5, alch: 0.3, chaos: 2 } as const;
const prices: PriceSnapshot = { id: 'test', unit: 'div', source: 'manual', capturedAt: '2026-10-03', prices: PRICES };

const ready = (item: ItemState, actionId: string): ReadyPool => {
  const pool = buildEligiblePool({ db, context, item, actionId });
  if (pool.status !== 'ready') throw new Error(`pool blocked: ${JSON.stringify(pool.issues)}`);
  return pool;
};
const withMod = (item: ItemState, definition: ModifierDefinition): ItemState => {
  const values = definition.lines.flatMap((l) => l.ranges.map((r) => r.min));
  return createItemState({ ...item, explicits: [...item.explicits, { kind: 'resolved', modifierId: definition.id, values, fractured: false, sourceText: renderModifierText(definition, values) }] });
};
/** r that makes `pickWeighted` choose entry `index` when it walks this pool's eligible list. */
const midpoint = (pool: ReadyPool, index: number) => {
  const before = pool.eligible.slice(0, index).reduce((s, e) => s + e.weight!, 0);
  return (before + pool.eligible[index]!.weight! / 2) / pool.totalKnownWeight;
};
const sequence = (first: number) => { let n = 0; return () => (n++ === 0 ? first : 0.5); };

describe('weighted crafting on real data (PoE2DB weights)', () => {
  it('Exalted on a fully weighted base: exact denominator from the golden pool', () => {
    const pool = ready(blankRare, 'exalted');
    expect(pool.unknownWeightModifierIds).toEqual([]);
    // Derived from the golden snapshot (raw PoE2DB page Spears): every eligible tier at ilvl 82.
    expect(pool.totalKnownWeight).toBe(spear.weights.total);
    expect(pool.eligible.every((e) => e.weightEvidence?.sourceId === 'poe2db-weightings')).toBe(true);
  });

  it('preview probability and the sampler use the same pool', () => {
    const pool = ready(blankRare, 'exalted');
    // Every 7th entry: the r at the middle of its weight interval in the preview pool must make the
    // real click add exactly that modifier.
    for (let i = 0; i < pool.eligible.length; i += 7) {
      const result = applyAction({ db, context, item: blankRare, actionId: 'exalted', rng: sequence(midpoint(pool, i)) });
      if (result.status !== 'applied' || !('changes' in result)) throw new Error('not applied');
      expect(result.changes[0]!.modifierId).toBe(pool.eligible[i]!.definition.id);
    }
    const target = pool.eligible[3]!;
    const probability = calculateTargetProbability(pool, { id: 't', label: 't', modifierIds: [target.definition.id], provenance: target.definition.provenance });
    expect(probability).toMatchObject({ status: 'ok', targetWeight: target.weight, totalWeight: pool.totalKnownWeight, probability: target.weight! / pool.totalKnownWeight });
  });

  it('a "tier N or better" target counts every eligible acceptable tier in the numerator', () => {
    const pool = ready(blankRare, 'exalted');
    const family = pool.eligible.filter((e) => e.definition.family === pool.eligible[0]!.definition.family).sort((a, b) => a.tier - b.tier);
    const acceptable = family.filter((e) => e.tier <= 2);
    expect(acceptable.length).toBe(2);
    const result = calculateTargetProbability(pool, { id: 't', label: 't', modifierIds: acceptable.map((e) => e.definition.id), provenance: acceptable[0]!.definition.provenance });
    expect(result).toMatchObject({ status: 'ok', targetWeight: acceptable[0]!.weight! + acceptable[1]!.weight! });
  });

  it('occupied groups, item level and full slots leave the denominator', () => {
    const pool = ready(blankRare, 'exalted');
    const first = pool.eligible[0]!.definition;
    const familyWeight = pool.eligible.filter((e) => e.definition.groupIds.some((g) => first.groupIds.includes(g))).reduce((s, e) => s + e.weight!, 0);
    expect(ready(withMod(blankRare, first), 'exalted').totalKnownWeight).toBe(pool.totalKnownWeight - familyWeight);

    const low = createItemFromBase(view, spear.baseId, 40)!;
    const lowPool = ready(low, 'exalted');
    expect(lowPool.eligible.every((e) => e.definition.requiredItemLevel <= 40)).toBe(true);
    expect(lowPool.totalKnownWeight).toBe(pool.eligible.filter((e) => e.definition.requiredItemLevel <= 40).reduce((s, e) => s + e.weight!, 0));

    let threePrefixes = blankRare;
    for (const e of pool.eligible.filter((x) => x.definition.side === 'prefix')) {
      if (threePrefixes.explicits.length === 3) break;
      const p = ready(threePrefixes, 'exalted');
      if (p.eligible.some((x) => x.definition.id === e.definition.id)) threePrefixes = withMod(threePrefixes, e.definition);
    }
    expect(ready(threePrefixes, 'exalted').eligible.every((e) => e.definition.side === 'suffix')).toBe(true);
  });

  it('an Omen restricts the pool before the denominator, and the sampler obeys it', () => {
    const plain = ready(blankRare, 'exalted');
    const restricted = ready(blankRare, 'exalted+omen-of-sinistral-exaltation');
    expect(restricted.eligible.every((e) => e.definition.side === 'prefix')).toBe(true);
    expect(restricted.totalKnownWeight).toBe(spear.weights.prefixTotal);
    const target = plain.eligible.find((e) => e.definition.side === 'prefix')!;
    const p = (pool: ReadyPool) => calculateTargetProbability(pool, { id: 't', label: 't', modifierIds: [target.definition.id], provenance: target.definition.provenance });
    expect(p(restricted)).toMatchObject({ status: 'ok', probability: target.weight! / spear.weights.prefixTotal });
    expect((p(plain) as { probability: number }).probability).toBeLessThan((p(restricted) as { probability: number }).probability);
    for (const r of [0, 0.37, 0.999]) {
      const result = applyAction({ db, context, item: blankRare, actionId: 'exalted+omen-of-sinistral-exaltation', rng: sequence(r) });
      if (result.status !== 'applied' || !('changes' in result)) throw new Error('not applied');
      expect(view.getModifier(result.changes[0]!.modifierId!)!.side).toBe('prefix');
    }
  });

  it('partial data blocks only the pools that contain unmeasured modifiers', () => {
    // Topaz Ring: PoE2DB has no measurement for Cast Speed (suffix) on rings.
    const ring = createItemFromBase(view, golden('topaz-ring').baseId, 82)!;
    const full = buildEligiblePool({ db, context, item: ring, actionId: 'exalted' });
    expect(full.status === 'ready' && full.unknownWeightModifierIds.length).toBeGreaterThan(0);
    expect(applyAction({ db, context, item: ring, actionId: 'exalted', rng: () => { throw new Error('sampled'); } })).toMatchObject({ status: 'rejected', rejection: { code: 'unknown-weights' } });
    const prefixes = applyAction({ db, context, item: ring, actionId: 'exalted+omen-of-sinistral-exaltation', rng: sequence(0.5) });
    expect(prefixes.status).toBe('applied');
  });

  it.each([
    ['transmute', 'normal', 0, 'magic', 1],
    ['aug', 'magic', 1, 'magic', 2],
    ['regal', 'magic', 2, 'rare', 3],
    ['alch', 'normal', 0, 'rare', 4],
    ['exalted', 'rare', 3, 'rare', 4],
    ['chaos', 'rare', 3, 'rare', 3],
  ] as const)('%s: real weighted result, history, spending and undo/redo', (actionId, rarity, mods, expectedRarity, expectedMods) => {
    let item = createItemState({ ...blankRare, rarity });
    const pool = ready(blankRare, 'exalted');
    for (const e of [pool.eligible.find((x) => x.definition.side === 'prefix')!, pool.eligible.find((x) => x.definition.side === 'suffix')!, pool.eligible.filter((x) => x.definition.side === 'prefix')[20]!].slice(0, mods)) item = withMod(item, e.definition);
    const session = createSession({ gameVersion: version, seed: 7, source: item });
    const result = applyToolStep(session, { db, tool: { currencyId: actionId, omenIds: [] }, prices });
    expect(result.status).toBe('applied');
    if (result.status !== 'applied') return;
    const after = result.session.current!;
    expect(after.rarity).toBe(expectedRarity);
    expect(after.explicits).toHaveLength(expectedMods);
    // Every modifier on the result can legally be there (eligible on this base) and carries a known weight.
    expect(after.explicits.every((m) => m.kind === 'resolved' && view.weightFor(m.modifierId, item.baseId!).weight! > 0)).toBe(true);
    expect(result.session.steps).toHaveLength(1);
    expect(sessionSpent(result.session).total).toBe(PRICES[actionId]);
    const undone = undoLastStep(result.session);
    expect(undone.current).toBe(item);
    expect(sessionSpent(undone).total).toBe(0);
    expect(redoStep(undone).current).toBe(after);
  });
});
