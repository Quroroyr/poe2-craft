import { describe, expect, it } from 'vitest';
import { akoyanSpearFixture, createCraftDb, type CraftDb } from '@poe2-craft/craft-db';
import {
  createItemState,
  renderModifierText,
  targetSpecFromItem,
  type ExplicitModifier,
  type ItemState,
  type ResolvedModifier,
} from '@poe2-craft/craft-domain';
import type { AttemptCost } from '@poe2-craft/economy';
import { buildEligiblePool } from '@poe2-craft/probability-engine';
import {
  applyAction,
  applyStep,
  craftSteps,
  createSeededRng,
  createSession,
  pickWeighted,
  rollValues,
  sessionSpent,
  startFromSource,
  undoLastStep,
  withTarget,
} from './index';

const db = createCraftDb(akoyanSpearFixture);
const view = db.forVersion('0.5.0');
const context = { gameVersion: '0.5.0' };

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

const SOURCE = spear([resolved('mod.local-critical-chance.t1', true)]);
const TARGET = targetSpecFromItem(
  spear([resolved('mod.local-critical-chance.t1', true), resolved('mod.projectile-skill-levels.t1')]),
);
const COST: AttemptCost = {
  unit: 'div',
  total: 0.21,
  lines: [{ consumableId: 'currency.exalted-orb', quantity: 1, unitPrice: 0.21, subtotal: 0.21 }],
  missingPrices: [],
  complete: true,
};

const apply = (item: ItemState, actionId: string, seed: number, database: CraftDb = db) =>
  applyAction({ item, context, db: database, actionId, rng: createSeededRng(seed) });

const sideOf = (m: ResolvedModifier) => view.getModifier(m.modifierId)?.side;

describe('craft session state', () => {
  it('starts with current = source and an empty history', () => {
    const session = createSession({ gameVersion: '0.5.0', seed: 1, source: SOURCE, target: TARGET });
    expect(session.current).toBe(SOURCE);
    expect(session.target).toBe(TARGET);
    expect(session.steps).toEqual([]);
    expect(sessionSpent(session)).toEqual({ unit: null, total: 0, stepCount: 0, incomplete: false, mixedUnits: false });
  });

  it('keeps source, current and target apart when a step is applied', () => {
    const session = createSession({ gameVersion: '0.5.0', seed: 7, source: SOURCE, target: TARGET });
    const result = applyStep(session, { db, actionId: 'action.add-random-modifier', cost: COST });
    expect(result.status).toBe('applied');
    expect(result.session.source).toBe(SOURCE);
    expect(result.session.target).toBe(TARGET);
    expect(result.session.current).not.toBe(SOURCE);
    expect(result.session.current?.explicits).toHaveLength(2);
    expect(SOURCE.explicits).toHaveLength(1);
    // The original session value is untouched.
    expect(session.current).toBe(SOURCE);
    expect(session.steps).toHaveLength(0);
  });

  it('records each step in the history and adds its cost to spent', () => {
    let session = createSession({ gameVersion: '0.5.0', seed: 3, source: SOURCE });
    for (let i = 0; i < 2; i++) {
      const result = applyStep(session, { db, actionId: 'action.add-random-modifier', cost: COST });
      if (result.status !== 'applied') throw new Error('expected an applied step');
      session = result.session;
    }
    expect(session.steps.map((s) => s.index)).toEqual([1, 2]);
    expect(session.steps[1]?.before).toBe(session.steps[0]?.after);
    expect(session.steps[1]?.after).toBe(session.current);
    expect(craftSteps(session)[0]?.added.modifierId).toBe(
      (session.steps[0]?.after.explicits[1] as ResolvedModifier).modifierId,
    );
    expect(sessionSpent(session)).toMatchObject({ unit: 'div', total: 0.42, stepCount: 2 });
  });

  it('is reproducible from its seed', () => {
    const run = () =>
      applyStep(createSession({ gameVersion: '0.5.0', seed: 42, source: SOURCE }), {
        db,
        actionId: 'action.add-random-modifier',
        cost: COST,
      });
    const a = run();
    const b = run();
    expect(a.status === 'applied' && b.status === 'applied' && a.step.added).toEqual(
      b.status === 'applied' && b.step.added,
    );
  });

  it('undo restores the previous item and spent, but never replays the same roll', () => {
    const start = createSession({ gameVersion: '0.5.0', seed: 5, source: SOURCE });
    const first = applyStep(start, { db, actionId: 'action.add-random-modifier', cost: COST });
    if (first.status !== 'applied') throw new Error('expected an applied step');
    const undone = undoLastStep(first.session);
    expect(undone.current).toBe(SOURCE);
    expect(undone.steps).toHaveLength(0);
    expect(sessionSpent(undone).total).toBe(0);
    expect(undone.rollCount).toBe(1);
  });

  it('restarting from a new source clears history and keeps the target', () => {
    const first = applyStep(createSession({ gameVersion: '0.5.0', seed: 9, source: SOURCE, target: TARGET }), {
      db,
      actionId: 'action.add-random-modifier',
      cost: COST,
    });
    const other = spear([]);
    const restarted = startFromSource(first.session, other);
    expect(restarted.current).toBe(other);
    expect(restarted.steps).toEqual([]);
    expect(restarted.target).toBe(TARGET);
    expect(withTarget(restarted, null).target).toBeNull();
  });

  it('a rejected action changes nothing and spends nothing', () => {
    const full = spear([
      resolved('mod.local-critical-chance.t1', true),
      resolved('mod.dexterity.t1'),
      resolved('mod.strength.t1'),
    ]);
    const session = createSession({ gameVersion: '0.5.0', seed: 1, source: full });
    const result = applyStep(session, { db, actionId: 'action.add-random-suffix', cost: COST });
    expect(result.status).toBe('rejected');
    expect(result.session).toBe(session);
    expect(sessionSpent(result.session).total).toBe(0);
  });
});

describe('action application (demo simulation)', () => {
  it('adds one eligible modifier with values inside its tier', () => {
    const outcome = apply(SOURCE, 'action.add-random-modifier', 11);
    if (outcome.status !== 'applied') throw new Error(outcome.status);
    const pool = buildEligiblePool({ item: SOURCE, context, db, actionId: 'action.add-random-modifier' });
    const eligibleIds = pool.status === 'ready' ? pool.eligible.map((e) => e.definition.id) : [];
    expect(eligibleIds).toContain(outcome.added.modifierId);
    expect(outcome.item.explicits).toHaveLength(2);
    expect(outcome.before).toBe(SOURCE);
    const ranges = outcome.definition.lines.flatMap((l) => l.ranges);
    outcome.added.values.forEach((v, i) => {
      expect(v).toBeGreaterThanOrEqual(ranges[i]!.min);
      expect(v).toBeLessThanOrEqual(ranges[i]!.max);
    });
    const weight =
      pool.status === 'ready'
        ? pool.eligible.find((e) => e.definition.id === outcome.added.modifierId)?.weight
        : null;
    expect(outcome.share).toBeCloseTo((weight ?? 0) / outcome.totalWeight, 12);
    expect(outcome.totalWeight).toBe(31700);
    expect(outcome.added.sourceText).toBe(renderModifierText(outcome.definition, outcome.added.values));
  });

  it('suffix-only adds only suffixes and prefix-only only prefixes', () => {
    for (let seed = 0; seed < 60; seed++) {
      const suffix = apply(SOURCE, 'action.add-random-suffix', seed);
      const prefix = apply(SOURCE, 'action.add-random-prefix', seed);
      if (suffix.status !== 'applied' || prefix.status !== 'applied') throw new Error('rejected');
      expect(sideOf(suffix.added)).toBe('suffix');
      expect(sideOf(prefix.added)).toBe('prefix');
    }
  });

  it('never adds a modifier from a group already on the item', () => {
    for (let seed = 0; seed < 60; seed++) {
      const outcome = apply(SOURCE, 'action.add-random-suffix', seed);
      if (outcome.status !== 'applied') throw new Error('rejected');
      expect(outcome.definition.groupIds).not.toContain('group.local-critical-chance');
    }
  });

  it('rejects an impossible action and returns the item untouched', () => {
    const full = spear([
      resolved('mod.local-critical-chance.t1', true),
      resolved('mod.dexterity.t1'),
      resolved('mod.strength.t1'),
    ]);
    const outcome = apply(full, 'action.add-random-suffix', 1);
    expect(outcome).toEqual({ status: 'rejected', item: full, rejection: { code: 'no-free-slot', sides: ['suffix'] } });
    expect(full.explicits).toHaveLength(3);

    const magic = spear([], { rarity: 'magic' });
    const blocked = apply(magic, 'action.add-random-modifier', 1);
    expect(blocked.status === 'rejected' && blocked.rejection.code).toBe('pool-blocked');
  });

  it('refuses to sample when a weight is unknown', () => {
    const unknown = createCraftDb({
      ...akoyanSpearFixture,
      modifiers: akoyanSpearFixture.modifiers.map((m) =>
        m.id === 'mod.dexterity.t1' ? { ...m, spawnWeights: [{ tag: 'weapon', weight: null }] } : m,
      ),
    });
    const outcome = apply(SOURCE, 'action.add-random-modifier', 1, unknown);
    expect(outcome.status === 'rejected' && outcome.rejection).toEqual({
      code: 'unknown-weights',
      modifierIds: ['mod.dexterity.t1'],
    });
  });

  it('picks by cumulative weight', () => {
    const entries = [
      { weight: 100, definition: { id: 'a' } },
      { weight: 300, definition: { id: 'b' } },
    ] as unknown as Parameters<typeof pickWeighted>[0];
    expect(pickWeighted(entries, 0).definition.id).toBe('a');
    expect(pickWeighted(entries, 0.2499).definition.id).toBe('a');
    expect(pickWeighted(entries, 0.25).definition.id).toBe('b');
    expect(pickWeighted(entries, 0.9999999).definition.id).toBe('b');
  });

  it('rolls values at the precision of the range', () => {
    const crit = view.getModifier('mod.local-critical-chance.t1')!;
    const rng = createSeededRng(3);
    for (let i = 0; i < 50; i++) {
      const [v] = rollValues(crit, rng);
      expect(v).toBeGreaterThanOrEqual(3.21);
      expect(v).toBeLessThanOrEqual(4.4);
      expect(Math.round(v! * 100) / 100).toBe(v);
    }
    expect(rollValues(view.getModifier('mod.projectile-skill-levels.t1')!, rng)).toEqual([4]);
  });
});
