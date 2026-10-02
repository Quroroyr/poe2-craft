import { describe, expect, it } from 'vitest';
import { akoyanSpearFixture, createCraftDb, type CraftDb } from '@poe2-craft/craft-db';
import {
  createItemState,
  type CraftTarget,
  type ExplicitModifier,
  type ItemState,
} from '@poe2-craft/craft-domain';
import {
  buildEligiblePool,
  calculateTargetProbability,
  explainCalculation,
  type ExclusionCode,
  type ReadyPool,
} from './index';

/*
 * Expected numbers below are hand-derived from the fixture weights in
 * packages/craft-db/src/fixtures/akoyan-spear.ts (fixture data, not real PoE 2).
 *
 * Akoyan Spear, ilvl 82, game version 0.5.0, eligible weights by group:
 *   prefixes: phys% 3200, flat phys 3200, fire 2000, cold 2000, lightning 2000,
 *             phys/accuracy hybrid 900, accuracy 2600                       = 15900
 *   suffixes: crit damage 2200, attack speed 2200, projectile levels 1250,
 *             melee levels 1250, dexterity 4000, strength 4000, leech 900   = 15800
 *             (critical chance and the crit hybrid are blocked by the fractured crit)
 */

const db = createCraftDb(akoyanSpearFixture);
const context = { gameVersion: '0.5.0' };
const target = (id: string): CraftTarget => {
  const t = db.forVersion('0.5.0').getTarget(id);
  if (!t) throw new Error(`fixture target ${id} missing`);
  return t;
};
const PROJECTILE_4 = target('target.projectile-levels-4');

const resolved = (modifierId: string, fractured = false): ExplicitModifier => ({
  kind: 'resolved',
  modifierId,
  values: [],
  fractured,
  sourceText: modifierId,
});

const spear = (explicits: ExplicitModifier[], overrides: Partial<ItemState> = {}): ItemState =>
  createItemState({
    baseId: 'base.akoyan-spear',
    baseName: 'Akoyan Spear',
    itemClassName: 'Spears',
    rarity: 'rare',
    itemLevel: 82,
    quality: null,
    slots: [],
    explicits,
    otherLines: [],
    corrupted: false,
    ...overrides,
  });

const FRACTURED_CRIT = spear([resolved('mod.local-critical-chance.t1', true)]);

const ready = (item: ItemState, actionId = 'action.add-random-modifier', database: CraftDb = db, version = '0.5.0') => {
  const pool = buildEligiblePool({ item, context: { gameVersion: version }, db: database, actionId });
  if (pool.status !== 'ready') throw new Error(`pool blocked: ${JSON.stringify(pool.issues)}`);
  return pool;
};
const entry = (pool: ReadyPool, id: string) => {
  const found = pool.entries.find((e) => e.definition.id === id);
  if (!found) throw new Error(`no entry ${id}`);
  return found;
};
const codes = (pool: ReadyPool, id: string): ExclusionCode[] => entry(pool, id).reasons.map((r) => r.code);

describe('eligible modifier pool', () => {
  it('contains a suffix target and sums eligible weights', () => {
    const pool = ready(FRACTURED_CRIT);
    expect(entry(pool, 'mod.projectile-skill-levels.t1')).toMatchObject({ eligible: true, weight: 100 });
    expect(pool.totalKnownWeight).toBe(31700);
    expect(pool.slots.prefix).toMatchObject({ used: 0, free: 3 });
    expect(pool.slots.suffix).toMatchObject({ used: 1, free: 2 });
  });

  it('respects side restrictions of the action', () => {
    const pool = ready(FRACTURED_CRIT, 'action.add-random-suffix');
    expect(pool.totalKnownWeight).toBe(15800);
    expect(codes(pool, 'mod.local-physical-percent.t1')).toEqual(['side-not-allowed-by-action']);
  });

  it('handles a prefix target', () => {
    const result = calculateTargetProbability(ready(FRACTURED_CRIT), target('target.physical-percent-t1'));
    expect(result).toMatchObject({ status: 'ok', targetWeight: 400, totalWeight: 31700 });
  });

  it('excludes tiers above the item level', () => {
    const pool = ready(spear([resolved('mod.local-critical-chance.t2', true)], { itemLevel: 70 }));
    expect(entry(pool, 'mod.projectile-skill-levels.t1').reasons).toEqual([
      { code: 'item-level-too-low', required: 81, itemLevel: 70 },
    ]);
    expect(entry(pool, 'mod.projectile-skill-levels.t2').eligible).toBe(true);
  });

  it('blocks every modifier sharing a group with an existing one, including multi-group hybrids', () => {
    const pool = ready(FRACTURED_CRIT);
    expect(codes(pool, 'mod.local-critical-chance.t3')).toEqual(['group-already-on-item']);
    // The hybrid sits in the crit-chance AND crit-damage groups; crit chance is taken.
    expect(codes(pool, 'mod.local-critical-hybrid.t1')).toEqual(['group-already-on-item']);
    expect(entry(pool, 'mod.local-critical-damage.t1').eligible).toBe(true);
  });

  it('treats the fractured modifier as an existing modifier', () => {
    const pool = ready(FRACTURED_CRIT);
    const reasons = entry(pool, 'mod.local-critical-chance.t1').reasons;
    expect(reasons).toContainEqual({ code: 'modifier-already-on-item', fractured: true });
    expect(reasons).toContainEqual(
      expect.objectContaining({
        code: 'group-already-on-item',
        occupant: expect.objectContaining({ fractured: true, modifierId: 'mod.local-critical-chance.t1' }),
      }),
    );
  });

  it('excludes modifiers already on the item and fills slots', () => {
    const pool = ready(
      spear([
        resolved('mod.local-physical-percent.t1'),
        resolved('mod.local-flat-physical.t1'),
        resolved('mod.local-critical-chance.t1', true),
        resolved('mod.local-attack-speed.t1'),
      ]),
    );
    expect(codes(pool, 'mod.local-attack-speed.t1')).toEqual(['modifier-already-on-item', 'group-already-on-item']);
    expect(pool.slots.prefix.free).toBe(1);
    expect(pool.slots.suffix.free).toBe(1);
    expect(pool.totalKnownWeight).toBe(9500 + 13600);
  });

  it('excludes a side whose slots are full', () => {
    const pool = ready(
      spear([
        resolved('mod.local-critical-chance.t1', true),
        resolved('mod.dexterity.t1'),
        resolved('mod.strength.t1'),
      ]),
    );
    expect(codes(pool, 'mod.projectile-skill-levels.t1')).toEqual(['no-free-affix-slot']);
    expect(pool.totalKnownWeight).toBe(15900);
  });

  it('never lets off-class modifiers into the pool', () => {
    const pool = ready(FRACTURED_CRIT);
    expect(codes(pool, 'mod.arrow-speed.t1')).toEqual(['not-spawnable-on-base']);
  });

  it('applies an action minimum modifier level', () => {
    const pool = ready(FRACTURED_CRIT, 'action.add-random-modifier-min-level-50');
    expect(codes(pool, 'mod.projectile-skill-levels.t3')).toEqual(['below-action-min-modifier-level']);
    expect(entry(pool, 'mod.projectile-skill-levels.t2').eligible).toBe(true);
  });

  it('uses the rules of the selected game version', () => {
    const pool = ready(FRACTURED_CRIT, 'action.add-random-modifier', db, '0.4.0');
    // 0.4.0: attack speed T1 weighs 600 instead of 400, stun duration (1000) still exists.
    expect(pool.totalKnownWeight).toBe(31700 + 200 + 1000);
  });

  it('is blocked, not wrong, when the item cannot be evaluated', () => {
    const pool = buildEligiblePool({
      item: spear([], { baseId: null, rarity: 'magic' }),
      context,
      db,
      actionId: 'action.add-random-modifier',
    });
    expect(pool.status).toBe('blocked');
    expect(pool.status === 'blocked' && pool.issues.map((i) => i.code)).toEqual([
      'base-unknown',
      'rarity-not-allowed',
    ]);
  });

  it('counts unresolved lines conservatively', () => {
    const pool = ready(
      spear([
        resolved('mod.local-critical-chance.t1', true),
        {
          kind: 'unresolved',
          sourceText: '+40% to Critical Damage Bonus',
          fractured: false,
          reason: 'value-out-of-range',
          sideHint: 'suffix',
          groupIdsHint: ['group.local-critical-damage'],
        },
        { kind: 'unresolved', sourceText: '???', fractured: false, reason: 'no-matching-definition' },
      ]),
    );
    expect(pool.slots.suffix.used).toBe(2);
    expect(pool.slots.unknownSide).toBe(1);
    expect(codes(pool, 'mod.local-critical-damage.t1')).toEqual(['group-already-on-item']);
    expect(pool.caveats.map((c) => c.code)).toEqual(
      expect.arrayContaining(['unknown-side-lines', 'unresolved-lines-block-groups']),
    );
  });
});

describe('target probability', () => {
  it('computes target weight, total weight and probability from the data', () => {
    const result = calculateTargetProbability(ready(FRACTURED_CRIT), PROJECTILE_4);
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.targetWeight).toBe(100);
    expect(result.totalWeight).toBe(31700);
    expect(result.probability).toBeCloseTo(100 / 31700, 15);
    expect(result.expectedAttempts).toBeCloseTo(317, 9);
    expect(result.bound).toBe('exact');
  });

  it('reports cumulative chances and attempt quantiles', () => {
    const result = calculateTargetProbability(ready(FRACTURED_CRIT), PROJECTILE_4);
    if (result.status !== 'ok') throw new Error(result.status);
    const p = 100 / 31700;
    expect(result.cumulative.map((c) => c.attempts)).toEqual([1, 10, 25, 50, 100]);
    expect(result.cumulative[1]?.probability).toBeCloseTo(1 - (1 - p) ** 10, 12);
    expect(result.quantiles.map((q) => q.quantile)).toEqual([0.5, 0.75, 0.9, 0.95]);
    expect(result.quantiles[0]?.attempts).toBe(Math.ceil(Math.log(0.5) / Math.log(1 - p)));
  });

  it('sums several acceptable tiers', () => {
    const result = calculateTargetProbability(ready(FRACTURED_CRIT), target('target.projectile-levels-3-plus'));
    expect(result).toMatchObject({ status: 'ok', targetWeight: 350 });
  });

  it('outcome shares add up to 1', () => {
    const result = calculateTargetProbability(ready(FRACTURED_CRIT), PROJECTILE_4);
    if (result.status !== 'ok') throw new Error(result.status);
    expect(result.outcomes.reduce((s, o) => s + o.probability, 0)).toBeCloseTo(1, 12);
    expect(result.outcomes.filter((o) => o.isTarget).map((o) => o.modifierId)).toEqual([
      'mod.projectile-skill-levels.t1',
    ]);
  });

  it('says the target is unavailable and why', () => {
    const pool = ready(spear([resolved('mod.local-critical-chance.t2', true)], { itemLevel: 70 }));
    const result = calculateTargetProbability(pool, PROJECTILE_4);
    expect(result.status).toBe('target-unavailable');
    expect(result.status === 'target-unavailable' && result.targetEntries[0]?.reasons[0]?.code).toBe(
      'item-level-too-low',
    );
  });

  it('recognises a target that is already on the item', () => {
    const result = calculateTargetProbability(
      ready(spear([resolved('mod.projectile-skill-levels.t1')])),
      PROJECTILE_4,
    );
    expect(result).toEqual({ status: 'already-satisfied', modifierIds: ['mod.projectile-skill-levels.t1'] });
  });

  it('is deterministic for the same input', () => {
    const a = calculateTargetProbability(ready(FRACTURED_CRIT), PROJECTILE_4);
    const b = calculateTargetProbability(ready(FRACTURED_CRIT), PROJECTILE_4);
    expect(a).toEqual(b);
  });
});

describe('unknown weights', () => {
  const withWeight = (modifierId: string, weight: number | null) =>
    createCraftDb({
      ...akoyanSpearFixture,
      modifiers: akoyanSpearFixture.modifiers.map((m) =>
        m.id === modifierId ? { ...m, spawnWeights: [{ tag: 'spear', weight }, ...m.spawnWeights.slice(1)] } : m,
      ),
    });

  it('marks the result as an upper bound when a competing weight is unknown', () => {
    const pool = ready(FRACTURED_CRIT, 'action.add-random-modifier', withWeight('mod.dexterity.t1', null));
    const result = calculateTargetProbability(pool, PROJECTILE_4);
    expect(result).toMatchObject({ status: 'ok', bound: 'upper-bound', totalWeight: 31700 - 1000 });
    expect(pool.unknownWeightModifierIds).toEqual(['mod.dexterity.t1']);
  });

  it('refuses to compute when the target weight itself is unknown', () => {
    const pool = ready(FRACTURED_CRIT, 'action.add-random-modifier', withWeight('mod.projectile-skill-levels.t1', null));
    expect(calculateTargetProbability(pool, PROJECTILE_4)).toEqual({
      status: 'indeterminate',
      reason: 'target-weight-unknown',
      modifierIds: ['mod.projectile-skill-levels.t1'],
    });
  });
});

describe('explanation', () => {
  it('lists the facts behind the number in order', () => {
    const pool = ready(FRACTURED_CRIT);
    const steps = explainCalculation(pool, PROJECTILE_4, calculateTargetProbability(pool, PROJECTILE_4));
    expect(steps.map((s) => s.code)).toEqual([
      'dataset',
      'item',
      'affix-slots',
      'occupied-groups',
      'action',
      'target',
      'pool-summary',
      'formula',
      'caveat',
    ]);
    const formula = steps.find((s) => s.code === 'formula');
    expect(formula).toMatchObject({ targetWeight: 100, totalWeight: 31700, confidence: 'experimental' });
  });
});
